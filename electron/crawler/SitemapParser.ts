/**
 * SitemapParser - Discovers and parses XML sitemaps for a site.
 * Handles sitemap index files (recursing into child sitemaps), gzip-less
 * plain XML, and both <urlset> and <sitemapindex> documents. Results feed
 * orphan-page detection and can seed the crawl.
 */

import * as cheerio from 'cheerio'

const MAX_SITEMAPS = 50 // cap on sitemap documents fetched (index fan-out guard)
const MAX_URLS = 50000 // cap on page URLs collected
const FETCH_TIMEOUT_MS = 15000

export class SitemapParser {
  /**
   * Discover page URLs from a site's sitemaps.
   *
   * @param origin       e.g. "https://example.com"
   * @param robotsSitemaps sitemap URLs declared in robots.txt (preferred)
   * @param userAgent
   */
  async discover(origin: string, robotsSitemaps: string[], userAgent: string): Promise<string[]> {
    const toVisit: string[] = []
    const seenSitemaps = new Set<string>()

    // Prefer sitemaps declared in robots.txt; otherwise probe the conventional path.
    const seeds = robotsSitemaps.length > 0 ? robotsSitemaps : [`${origin}/sitemap.xml`]
    for (const s of seeds) {
      if (!seenSitemaps.has(s)) {
        seenSitemaps.add(s)
        toVisit.push(s)
      }
    }

    const pageUrls = new Set<string>()
    let fetched = 0

    while (toVisit.length > 0 && fetched < MAX_SITEMAPS && pageUrls.size < MAX_URLS) {
      const sitemapUrl = toVisit.shift()!
      fetched++

      const xml = await this.fetchText(sitemapUrl, userAgent)
      if (!xml) continue

      const { childSitemaps, urls } = this.parse(xml)

      for (const child of childSitemaps) {
        if (!seenSitemaps.has(child) && seenSitemaps.size < MAX_SITEMAPS) {
          seenSitemaps.add(child)
          toVisit.push(child)
        }
      }
      for (const u of urls) {
        if (pageUrls.size >= MAX_URLS) break
        pageUrls.add(u)
      }
    }

    return Array.from(pageUrls)
  }

  private parse(xml: string): { childSitemaps: string[]; urls: string[] } {
    const childSitemaps: string[] = []
    const urls: string[] = []

    try {
      const $ = cheerio.load(xml, { xmlMode: true })
      const isIndex = $('sitemapindex').length > 0

      $('loc').each((_, el) => {
        const loc = $(el).text().trim()
        if (!loc) return
        if (isIndex) childSitemaps.push(loc)
        else urls.push(loc)
      })

      // Fallback: some index files don't use the <sitemapindex> root but list
      // sitemap URLs anyway. If nothing classified and locs point at .xml, treat as children.
      if (!isIndex && urls.length > 0 && childSitemaps.length === 0) {
        const looksLikeIndex = urls.every((u) => /\.xml(\?|$)/i.test(u))
        if (looksLikeIndex && urls.length <= MAX_SITEMAPS) {
          return { childSitemaps: urls, urls: [] }
        }
      }
    } catch {
      // Malformed XML — ignore
    }

    return { childSitemaps, urls }
  }

  private async fetchText(url: string, userAgent: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': userAgent, Accept: 'application/xml,text/xml,*/*' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!response.ok) return null
      return await response.text()
    } catch {
      return null
    }
  }
}
