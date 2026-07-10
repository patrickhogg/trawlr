/**
 * Cross-page analysis helpers for crawl results — kept framework-agnostic so
 * they're easy to test and reuse across views. Mirrors the normalization the
 * crawl engine uses so URL comparisons line up with sitemap/link data.
 */

import type { CrawledPage, DiscoveredLink } from '../types'

export function normalizeUrl(url: string): string {
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

/**
 * Whether a page has an actionable on-page SEO issue. Mirrors the engine's
 * `hasSeoIssues` gate (informational signals like OG/viewport are excluded).
 */
export function pageHasSeoIssue(p: CrawledPage): boolean {
  const s = p.seo
  return (
    !!s &&
    (s.title.status !== 'pass' ||
      s.metaDescription.status !== 'pass' ||
      s.h1.status !== 'pass' ||
      s.canonical.status !== 'pass' ||
      s.images.status !== 'pass' ||
      s.indexability.status !== 'pass')
  )
}

/** Values (trimmed, lowercased) that occur on more than one page. */
function duplicateValues(values: Array<string | null | undefined>): Set<string> {
  const counts = new Map<string, number>()
  for (const v of values) {
    const key = v?.trim().toLowerCase()
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const dupes = new Set<string>()
  for (const [key, n] of counts) if (n > 1) dupes.add(key)
  return dupes
}

export interface DuplicateSets {
  titles: Set<string>
  descriptions: Set<string>
}

export function computeDuplicates(pages: CrawledPage[]): DuplicateSets {
  return {
    titles: duplicateValues(pages.map((p) => p.seo?.title.value)),
    descriptions: duplicateValues(pages.map((p) => p.seo?.metaDescription.value)),
  }
}

export function isDuplicateTitle(p: CrawledPage, dupes: DuplicateSets): boolean {
  const key = p.seo?.title.value?.trim().toLowerCase()
  return !!key && dupes.titles.has(key)
}

export function isDuplicateDescription(p: CrawledPage, dupes: DuplicateSets): boolean {
  const key = p.seo?.metaDescription.value?.trim().toLowerCase()
  return !!key && dupes.descriptions.has(key)
}

/** Count of internal links pointing at each normalized page URL. */
export function computeInlinkCounts(links: DiscoveredLink[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const link of links) {
    if (link.type !== 'internal') continue
    const key = normalizeUrl(link.targetUrl)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

export function inlinkCountFor(p: CrawledPage, counts: Map<string, number>): number {
  return counts.get(normalizeUrl(p.url)) ?? 0
}

export interface SitemapCoverage {
  sitemapCount: number
  /** Pages with zero internal inlinks (excluding the seed page). */
  orphans: CrawledPage[]
  /** Sitemap URLs that were not crawled (missing / blocked / errored). */
  inSitemapNotCrawled: string[]
  /** Crawled pages absent from the sitemap. */
  crawledNotInSitemap: CrawledPage[]
}

export function computeSitemapCoverage(
  pages: CrawledPage[],
  links: DiscoveredLink[],
  sitemapUrls: string[],
  seedUrl: string | null
): SitemapCoverage {
  const inlinks = computeInlinkCounts(links)
  const sitemapSet = new Set(sitemapUrls.map(normalizeUrl))
  const crawledSet = new Set(pages.map((p) => normalizeUrl(p.url)))
  const normalizedSeed = seedUrl ? normalizeUrl(seedUrl) : null

  const orphans = pages.filter((p) => {
    const key = normalizeUrl(p.url)
    return key !== normalizedSeed && (inlinks.get(key) ?? 0) === 0
  })

  const inSitemapNotCrawled = sitemapUrls
    .map(normalizeUrl)
    .filter((u) => !crawledSet.has(u))

  const crawledNotInSitemap = sitemapUrls.length
    ? pages.filter((p) => !sitemapSet.has(normalizeUrl(p.url)))
    : []

  return {
    sitemapCount: sitemapSet.size,
    orphans,
    inSitemapNotCrawled,
    crawledNotInSitemap,
  }
}
