/**
 * CrawlEngine - Core crawling engine that coordinates URL discovery,
 * link classification, broken link detection, redirect tracking, and SEO auditing.
 * Uses BFS traversal with configurable concurrency via p-queue.
 */

import * as cheerio from 'cheerio'
import PQueue from 'p-queue'
import { HttpClient, type HttpResponse, type RedirectHop } from './HttpClient'
import { SeoAuditor, type SeoResult } from './SeoAuditor'
import { RobotsParser } from './RobotsParser'

// ---- Types ----

export interface CrawlSettings {
  seedUrl: string
  concurrency: number
  maxPages: number
  rateLimitMs: number
  userAgent?: string
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
}

type ProgressCallback = (progress: CrawlProgress) => void
type PageCallback = (page: CrawledPage) => void

// ---- Engine ----

export class CrawlEngine {
  private httpClient: HttpClient
  private seoAuditor: SeoAuditor
  private robotsParser: RobotsParser
  private queue: PQueue | null = null

  private visited: Set<string> = new Set()
  private urlQueue: string[] = []
  private pages: CrawledPage[] = []
  private allLinks: DiscoveredLink[] = []

  private seedOrigin: string = ''
  private seedRootDomain: string = ''
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
    this.seoAuditor = new SeoAuditor()
    this.robotsParser = new RobotsParser()
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

    // Configure HTTP client
    this.httpClient = new HttpClient(settings.userAgent, settings.rateLimitMs)

    // Parse seed URL
    const seedParsed = new URL(settings.seedUrl)
    this.seedOrigin = seedParsed.origin
    this.seedRootDomain = this.extractRootDomain(seedParsed.hostname)

    // Fetch robots.txt
    await this.robotsParser.fetchRobotsTxt(settings.seedUrl, this.httpClient.getUserAgent())

    // Set up concurrency queue
    this.queue = new PQueue({ concurrency: settings.concurrency })
    this.status = 'crawling'
    this.startTime = Date.now()

    // Seed the queue
    const normalizedSeed = this.normalizeUrl(settings.seedUrl)
    this.visited.add(normalizedSeed)
    this.urlQueue.push(normalizedSeed)

    this.emitProgress()

    // Process the queue
    await this.processQueue()

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
    if (this.queue) {
      this.queue.clear()
    }
  }

  /**
   * Get current results.
   */
  getResults(): CrawlResults {
    return {
      pages: [...this.pages],
      allLinks: [...this.allLinks],
      progress: this.getProgress(),
    }
  }

  /**
   * Get current progress.
   */
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
      // Check max pages cap
      if (this.pages.length >= (this.settings?.maxPages || 800)) {
        break
      }

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

    // Check robots.txt
    if (!this.robotsParser.isAllowed(url)) {
      return
    }

    try {
      // Fetch the page content
      const response = await this.httpClient.fetch(url, true)

      // Track redirects
      if (response.redirectChain.length > 0) {
        this.redirectCount++
      }

      // Parse HTML and extract data
      const contentType = response.headers['content-type'] || ''
      const isHtml = contentType.includes('text/html') || (!contentType && response.body)

      let seo: SeoResult | null = null
      const discoveredLinks: DiscoveredLink[] = []

      if (isHtml && response.body) {
        // Run SEO audit
        seo = this.seoAuditor.audit(response.body)
        if (this.hasSeoIssues(seo)) {
          this.seoIssuesCount++
        }

        // Extract links
        const rawLinks = this.extractLinks(response.body, response.finalUrl)

        // Check each link
        for (const link of rawLinks) {
          if (this.status !== 'crawling') break

          const linkType = this.classifyLink(link.href)
          let linkStatus: HttpResponse | null = null

          // Check the link (HEAD request for status)
          try {
            linkStatus = await this.httpClient.fetch(link.href, false)
          } catch {
            linkStatus = null
          }

          const discoveredLink: DiscoveredLink = {
            sourceUrl: url,
            targetUrl: link.href,
            anchorText: link.text,
            type: linkType,
            statusCode: linkStatus?.statusCode || 0,
            redirectChain: linkStatus?.redirectChain || [],
            isBroken:
              !linkStatus ||
              linkStatus.statusCode >= 400 ||
              linkStatus.statusCode === 0,
            error: linkStatus?.error || null,
          }

          if (discoveredLink.isBroken) {
            this.brokenLinksCount++
          }
          if (discoveredLink.redirectChain.length > 0) {
            this.redirectCount++
          }

          discoveredLinks.push(discoveredLink)
          this.allLinks.push(discoveredLink)

          // If internal and not visited, add to queue
          if (linkType === 'internal' && !this.visited.has(link.href)) {
            const normalized = this.normalizeUrl(link.href)
            if (!this.visited.has(normalized) && this.robotsParser.isAllowed(normalized)) {
              this.visited.add(normalized)
              this.urlQueue.push(normalized)
            }
          }
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

      if (this.onPage) {
        this.onPage(page)
      }

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

  private extractLinks(
    html: string,
    baseUrl: string
  ): { href: string; text: string }[] {
    const $ = cheerio.load(html)
    const links: { href: string; text: string }[] = []
    const seen = new Set<string>()

    $('a[href]').each((_, el) => {
      const rawHref = $(el).attr('href')
      if (!rawHref) return

      // Skip non-http links
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

  /**
   * Extract the root domain from a hostname.
   * e.g., 'blog.example.com' → 'example.com'
   * e.g., 'example.co.uk' → 'example.co.uk'
   */
  private extractRootDomain(hostname: string): string {
    const parts = hostname.split('.')
    if (parts.length <= 2) return hostname

    // Handle common two-part TLDs
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
      // Remove fragment
      parsed.hash = ''
      // Remove trailing slash for consistency
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
    return (
      seo.title.status !== 'pass' ||
      seo.metaDescription.status !== 'pass' ||
      seo.metaKeywords.status !== 'pass'
    )
  }

  private emitProgress(): void {
    if (this.onProgress) {
      this.onProgress(this.getProgress())
    }
  }

  private reset(): void {
    this.visited.clear()
    this.urlQueue = []
    this.pages = []
    this.allLinks = []
    this.seedOrigin = ''
    this.seedRootDomain = ''
    this.settings = null
    this.status = 'idle'
    this.startTime = 0
    this.brokenLinksCount = 0
    this.redirectCount = 0
    this.seoIssuesCount = 0
    this.robotsParser.clear()
    if (this.queue) {
      this.queue.clear()
    }
  }
}
