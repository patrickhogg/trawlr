/**
 * CrawlEngine - Core crawling engine that coordinates URL discovery,
 * link classification, broken link detection, redirect tracking, and SEO auditing.
 * Uses BFS traversal with configurable concurrency via p-queue.
 *
 * Performance: Links are discovered instantly during page crawls. Internal links
 * get their status when crawled. External links are batch-checked in parallel.
 */

import * as cheerio from 'cheerio'
import PQueue from 'p-queue'
import { HttpClient, type RedirectHop } from './HttpClient'
import { SeoAuditor, type SeoResult } from './SeoAuditor'
import { RobotsParser } from './RobotsParser'
import { SitemapParser } from './SitemapParser'

// ---- Types ----

export interface CrawlSettings {
  seedUrl: string
  concurrency: number
  maxPages: number
  rateLimitMs: number
  checkExternalLinks: boolean
  titleMinLength: number
  titleMaxLength: number
  descriptionMinLength: number
  descriptionMaxLength: number
  userAgent?: string
  useSitemap?: boolean
}

export interface DiscoveredLink {
  sourceUrl: string
  targetUrl: string
  anchorText: string
  type: 'internal' | 'external'
  statusCode: number
  redirectChain: RedirectHop[]
  isBroken: boolean
  error: string | null
}

export interface CrawledPage {
  url: string
  statusCode: number
  contentType: string
  seo: SeoResult | null
  links: DiscoveredLink[]
  redirectChain: RedirectHop[]
  error: string | null
  crawledAt: number
}

export interface CrawlProgress {
  status: 'idle' | 'crawling' | 'paused' | 'completed' | 'cancelled'
  pagesDiscovered: number
  pagesCrawled: number
  maxPages: number
  brokenLinksCount: number
  redirectCount: number
  seoIssuesCount: number
  elapsedMs: number
}

export interface CrawlResults {
  pages: CrawledPage[]
  allLinks: DiscoveredLink[]
  progress: CrawlProgress
  /** Normalized internal page URLs discovered in the site's XML sitemap(s). */
  sitemapUrls: string[]
}

type ProgressCallback = (progress: CrawlProgress) => void
type PageCallback = (page: CrawledPage) => void

// ---- Engine ----

export class CrawlEngine {
  private httpClient: HttpClient
  private linkCheckClient: HttpClient // Separate client for link checks — no rate limit
  private seoAuditor: SeoAuditor
  private robotsParser: RobotsParser
  private sitemapParser: SitemapParser
  private queue: PQueue | null = null
  private linkCheckQueue: PQueue | null = null

  private visited: Set<string> = new Set()
  private checkedLinks: Map<string, { statusCode: number; redirectChain: RedirectHop[]; error: string | null }> = new Map()
  private urlQueue: string[] = []
  private pages: CrawledPage[] = []
  private allLinks: DiscoveredLink[] = []

  private seedOrigin: string = ''
  private seedRootDomain: string = ''
  private sitemapUrls: string[] = []
  private settings: CrawlSettings | null = null

  private status: CrawlProgress['status'] = 'idle'
  private startTime: number = 0
  private brokenLinksCount: number = 0
  private redirectCount: number = 0
  private seoIssuesCount: number = 0

  private onProgress: ProgressCallback | null = null
  private onPage: PageCallback | null = null

  constructor() {
    this.httpClient = new HttpClient()
    this.linkCheckClient = new HttpClient()
    this.seoAuditor = new SeoAuditor()
    this.robotsParser = new RobotsParser()
    this.sitemapParser = new SitemapParser()
  }

  /**
   * Start a crawl with the given settings.
   */
  async start(
    settings: CrawlSettings,
    onProgress?: ProgressCallback,
    onPage?: PageCallback
  ): Promise<CrawlResults> {
    this.reset()
    this.settings = settings
    this.onProgress = onProgress || null
    this.onPage = onPage || null

    // Main client has rate limiting for page fetches
    this.httpClient = new HttpClient(settings.userAgent, settings.rateLimitMs)
    // Link check client has NO rate limiting for fast parallel checks
    this.linkCheckClient = new HttpClient(settings.userAgent, 0)

    // Configure SEO auditor with custom limits
    this.seoAuditor.setLimits({
      titleMin: settings.titleMinLength || 30,
      titleMax: settings.titleMaxLength || 60,
      descriptionMin: settings.descriptionMinLength || 120,
      descriptionMax: settings.descriptionMaxLength || 160,
    })

    // Parse seed URL
    const seedParsed = new URL(settings.seedUrl)
    this.seedOrigin = seedParsed.origin
    this.seedRootDomain = this.extractRootDomain(seedParsed.hostname)

    // Fetch robots.txt
    await this.robotsParser.fetchRobotsTxt(settings.seedUrl, this.httpClient.getUserAgent())

    // Discover XML sitemap(s). Used for orphan-page analysis, and (when
    // enabled) to seed the crawl so pages not linked internally are still found.
    if (settings.useSitemap !== false) {
      try {
        const declared = this.robotsParser.getSitemaps(this.seedOrigin)
        const found = await this.sitemapParser.discover(
          this.seedOrigin,
          declared,
          this.httpClient.getUserAgent()
        )
        // Keep only internal URLs, normalized for consistent comparison.
        const internal = new Set<string>()
        for (const u of found) {
          if (this.classifyLink(u) === 'internal') {
            internal.add(this.normalizeUrl(u))
          }
        }
        this.sitemapUrls = Array.from(internal)
      } catch {
        this.sitemapUrls = []
      }
    }

    // Set up concurrency queues
    this.queue = new PQueue({ concurrency: settings.concurrency })
    // Higher concurrency for link checks since they're just HEAD requests
    this.linkCheckQueue = new PQueue({ concurrency: settings.concurrency * 3 })
    this.status = 'crawling'
    this.startTime = Date.now()

    // Seed the queue
    const normalizedSeed = this.normalizeUrl(settings.seedUrl)
    this.visited.add(normalizedSeed)
    this.urlQueue.push(normalizedSeed)

    // Seed from sitemap so pages that aren't linked internally still get crawled.
    if (settings.useSitemap !== false) {
      for (const url of this.sitemapUrls) {
        if (!this.visited.has(url) && this.robotsParser.isAllowed(url)) {
          this.visited.add(url)
          this.urlQueue.push(url)
        }
      }
    }

    this.emitProgress()

    // Process pages
    await this.processQueue()

    // Wait for remaining external link checks to finish
    if (this.linkCheckQueue) {
      await this.linkCheckQueue.onIdle()
    }

    if (this.status === 'crawling') {
      this.status = 'completed'
    }
    this.emitProgress()

    return this.getResults()
  }

  /**
   * Cancel the current crawl.
   */
  cancel(): void {
    this.status = 'cancelled'
    if (this.queue) this.queue.clear()
    if (this.linkCheckQueue) this.linkCheckQueue.clear()
  }

  getResults(): CrawlResults {
    return {
      pages: [...this.pages],
      allLinks: [...this.allLinks],
      progress: this.getProgress(),
      sitemapUrls: [...this.sitemapUrls],
    }
  }

  getProgress(): CrawlProgress {
    return {
      status: this.status,
      pagesDiscovered: this.visited.size,
      pagesCrawled: this.pages.length,
      maxPages: this.settings?.maxPages || 0,
      brokenLinksCount: this.brokenLinksCount,
      redirectCount: this.redirectCount,
      seoIssuesCount: this.seoIssuesCount,
      elapsedMs: this.startTime > 0 ? Date.now() - this.startTime : 0,
    }
  }

  // ---- Internal Methods ----

  private async processQueue(): Promise<void> {
    while (this.urlQueue.length > 0 && this.status === 'crawling') {
      if (this.pages.length >= (this.settings?.maxPages || 800)) break

      const batch = this.urlQueue.splice(0, this.settings?.concurrency || 10)

      const promises = batch.map((url) =>
        this.queue!.add(async () => {
          if (this.status !== 'crawling') return
          if (this.pages.length >= (this.settings?.maxPages || 800)) return
          await this.crawlPage(url)
        })
      )

      await Promise.all(promises)
      await this.queue!.onIdle()
    }
  }

  private async crawlPage(url: string): Promise<void> {
    if (this.status !== 'crawling') return
    if (!this.robotsParser.isAllowed(url)) return

    try {
      // Fetch the page content (rate-limited)
      const response = await this.httpClient.fetch(url, true)

      if (response.redirectChain.length > 0) {
        this.redirectCount++
      }

      const contentType = response.headers['content-type'] || ''
      const isHtml = contentType.includes('text/html') || (!contentType && response.body)

      let seo: SeoResult | null = null
      const discoveredLinks: DiscoveredLink[] = []

      if (isHtml && response.body) {
        // SEO audit — instant (just string parsing)
        seo = this.seoAuditor.audit(response.body)
        if (this.hasSeoIssues(seo)) {
          this.seoIssuesCount++
        }

        // Extract links — instant (just HTML parsing, no HTTP)
        const rawLinks = this.extractLinks(response.body, response.finalUrl)

        for (const link of rawLinks) {
          const linkType = this.classifyLink(link.href)

          const discoveredLink: DiscoveredLink = {
            sourceUrl: url,
            targetUrl: link.href,
            anchorText: link.text,
            type: linkType,
            statusCode: 0,
            redirectChain: [],
            isBroken: false,
            error: null,
          }

          if (linkType === 'internal') {
            // Add to crawl queue if not visited — status captured when crawled
            const normalized = this.normalizeUrl(link.href)
            if (!this.visited.has(normalized) && this.robotsParser.isAllowed(normalized)) {
              this.visited.add(normalized)
              this.urlQueue.push(normalized)
            }
            // If already crawled, fill in status from records
            const existingPage = this.pages.find(
              (p) => this.normalizeUrl(p.url) === this.normalizeUrl(link.href)
            )
            if (existingPage) {
              discoveredLink.statusCode = existingPage.statusCode
              discoveredLink.redirectChain = existingPage.redirectChain
              discoveredLink.isBroken = existingPage.statusCode >= 400 || existingPage.statusCode === 0
              discoveredLink.error = existingPage.error
              if (discoveredLink.isBroken) this.brokenLinksCount++
              if (discoveredLink.redirectChain.length > 0) this.redirectCount++
            }
          } else {
            // External links: only check if setting is enabled
            if (this.settings?.checkExternalLinks) {
              this.queueLinkCheck(discoveredLink)
            }
          }

          discoveredLinks.push(discoveredLink)
          this.allLinks.push(discoveredLink)
        }
      }

      const page: CrawledPage = {
        url,
        statusCode: response.statusCode,
        contentType,
        seo,
        links: discoveredLinks,
        redirectChain: response.redirectChain,
        error: response.error,
        crawledAt: Date.now(),
      }

      this.pages.push(page)

      // Backfill status for any earlier links that pointed to this URL
      this.updateInternalLinkStatus(url, response.statusCode, response.redirectChain, response.error)

      if (this.onPage) this.onPage(page)
      this.emitProgress()
    } catch (err: any) {
      const page: CrawledPage = {
        url,
        statusCode: 0,
        contentType: '',
        seo: null,
        links: [],
        redirectChain: [],
        error: err.message || 'Unknown error',
        crawledAt: Date.now(),
      }
      this.pages.push(page)
      this.emitProgress()
    }
  }

  /**
   * Queue a parallel external link status check.
   * Uses a high-concurrency queue with NO rate limiting.
   * Results are cached to avoid re-checking the same URL.
   */
  private queueLinkCheck(link: DiscoveredLink): void {
    // Use cache if we already checked this URL
    const cached = this.checkedLinks.get(link.targetUrl)
    if (cached) {
      link.statusCode = cached.statusCode
      link.redirectChain = cached.redirectChain
      link.isBroken = cached.statusCode >= 400 || cached.statusCode === 0
      link.error = cached.error
      if (link.isBroken) this.brokenLinksCount++
      if (link.redirectChain.length > 0) this.redirectCount++
      return
    }

    if (!this.linkCheckQueue) return

    this.linkCheckQueue.add(async () => {
      if (this.status !== 'crawling') return

      try {
        const response = await this.linkCheckClient.fetch(link.targetUrl, false)
        link.statusCode = response.statusCode
        link.redirectChain = response.redirectChain
        link.isBroken = response.statusCode >= 400 || response.statusCode === 0
        link.error = response.error

        this.checkedLinks.set(link.targetUrl, {
          statusCode: response.statusCode,
          redirectChain: response.redirectChain,
          error: response.error,
        })
      } catch (err: any) {
        link.statusCode = 0
        link.isBroken = true
        link.error = err.message || 'Unknown error'

        this.checkedLinks.set(link.targetUrl, {
          statusCode: 0,
          redirectChain: [],
          error: link.error,
        })
      }

      if (link.isBroken) this.brokenLinksCount++
      if (link.redirectChain.length > 0) this.redirectCount++
      this.emitProgress()
    })
  }

  /**
   * When a page is crawled, backfill status for any links discovered earlier
   * that point to this URL but didn't have status yet.
   */
  private updateInternalLinkStatus(
    url: string,
    statusCode: number,
    redirectChain: RedirectHop[],
    error: string | null
  ): void {
    const normalized = this.normalizeUrl(url)
    for (const link of this.allLinks) {
      if (
        link.type === 'internal' &&
        link.statusCode === 0 &&
        this.normalizeUrl(link.targetUrl) === normalized
      ) {
        link.statusCode = statusCode
        link.redirectChain = redirectChain
        link.isBroken = statusCode >= 400 || statusCode === 0
        link.error = error
        if (link.isBroken) this.brokenLinksCount++
        if (link.redirectChain.length > 0) this.redirectCount++
      }
    }
  }

  private extractLinks(html: string, baseUrl: string): { href: string; text: string }[] {
    const $ = cheerio.load(html)
    const links: { href: string; text: string }[] = []
    const seen = new Set<string>()

    $('a[href]').each((_, el) => {
      const rawHref = $(el).attr('href')
      if (!rawHref) return

      if (
        rawHref.startsWith('mailto:') ||
        rawHref.startsWith('tel:') ||
        rawHref.startsWith('javascript:') ||
        rawHref.startsWith('#') ||
        rawHref.startsWith('data:')
      ) {
        return
      }

      try {
        const resolved = new URL(rawHref, baseUrl).href
        const normalized = this.normalizeUrl(resolved)

        if (!seen.has(normalized)) {
          seen.add(normalized)
          links.push({
            href: normalized,
            text: $(el).text().trim().substring(0, 200),
          })
        }
      } catch {
        // Invalid URL — skip
      }
    })

    return links
  }

  private classifyLink(url: string): 'internal' | 'external' {
    try {
      const parsed = new URL(url)
      const linkRootDomain = this.extractRootDomain(parsed.hostname)
      return linkRootDomain === this.seedRootDomain ? 'internal' : 'external'
    } catch {
      return 'external'
    }
  }

  private extractRootDomain(hostname: string): string {
    const parts = hostname.split('.')
    if (parts.length <= 2) return hostname

    const twoPartTlds = ['co.uk', 'com.au', 'co.nz', 'co.za', 'com.br', 'co.in', 'org.uk', 'net.au']
    const lastTwo = parts.slice(-2).join('.')
    if (twoPartTlds.includes(lastTwo)) {
      return parts.slice(-3).join('.')
    }

    return parts.slice(-2).join('.')
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url)
      parsed.hash = ''
      let normalized = parsed.href
      if (normalized.endsWith('/') && parsed.pathname !== '/') {
        normalized = normalized.slice(0, -1)
      }
      return normalized
    } catch {
      return url
    }
  }

  private hasSeoIssues(seo: SeoResult): boolean {
    // Meaningful, actionable checks gate the "issue" flag. Informational
    // signals (keywords, OG, viewport, lang, structured data) are surfaced in
    // the UI but do not by themselves mark a page as having an SEO issue.
    return (
      seo.title.status !== 'pass' ||
      seo.metaDescription.status !== 'pass' ||
      seo.h1.status !== 'pass' ||
      seo.canonical.status !== 'pass' ||
      seo.images.status !== 'pass' ||
      seo.indexability.status !== 'pass'
    )
  }

  private emitProgress(): void {
    if (this.onProgress) {
      this.onProgress(this.getProgress())
    }
  }

  private reset(): void {
    this.visited.clear()
    this.checkedLinks.clear()
    this.urlQueue = []
    this.pages = []
    this.allLinks = []
    this.seedOrigin = ''
    this.seedRootDomain = ''
    this.sitemapUrls = []
    this.settings = null
    this.status = 'idle'
    this.startTime = 0
    this.brokenLinksCount = 0
    this.redirectCount = 0
    this.seoIssuesCount = 0
    this.robotsParser.clear()
    if (this.queue) this.queue.clear()
    if (this.linkCheckQueue) this.linkCheckQueue.clear()
  }
}
