/**
 * Diff two crawls to surface regressions over time. "Added / new" means present
 * in the current crawl but not the baseline.
 */

import type { CrawledPage, DiscoveredLink } from '../types'
import { normalizeUrl, pageHasSeoIssue } from './analysis'

export interface StatusChange {
  url: string
  from: number
  to: number
}

export interface CrawlDiff {
  pagesAdded: string[]
  pagesRemoved: string[]
  brokenAdded: DiscoveredLink[]
  brokenResolved: DiscoveredLink[]
  seoRegressed: string[]
  seoImproved: string[]
  statusChanged: StatusChange[]
}

function pageMap(pages: CrawledPage[]): Map<string, CrawledPage> {
  const m = new Map<string, CrawledPage>()
  for (const p of pages) m.set(normalizeUrl(p.url), p)
  return m
}

function brokenMap(links: DiscoveredLink[]): Map<string, DiscoveredLink> {
  const m = new Map<string, DiscoveredLink>()
  for (const l of links) {
    if (!l.isBroken) continue
    // Key by target + source so the same dead URL on different pages counts once each.
    m.set(`${normalizeUrl(l.targetUrl)}|${normalizeUrl(l.sourceUrl)}`, l)
  }
  return m
}

/**
 * @param current  the crawl being viewed
 * @param baseline the older crawl to compare against
 */
export function diffCrawls(
  current: { pages: CrawledPage[]; allLinks: DiscoveredLink[] },
  baseline: { pages: CrawledPage[]; allLinks: DiscoveredLink[] }
): CrawlDiff {
  const curPages = pageMap(current.pages)
  const basePages = pageMap(baseline.pages)

  const pagesAdded: string[] = []
  const pagesRemoved: string[] = []
  const seoRegressed: string[] = []
  const seoImproved: string[] = []
  const statusChanged: StatusChange[] = []

  for (const [key, page] of curPages) {
    const prev = basePages.get(key)
    if (!prev) {
      pagesAdded.push(page.url)
      continue
    }
    if (prev.statusCode !== page.statusCode) {
      statusChanged.push({ url: page.url, from: prev.statusCode, to: page.statusCode })
    }
    const wasIssue = pageHasSeoIssue(prev)
    const isIssue = pageHasSeoIssue(page)
    if (!wasIssue && isIssue) seoRegressed.push(page.url)
    else if (wasIssue && !isIssue) seoImproved.push(page.url)
  }

  for (const [key, page] of basePages) {
    if (!curPages.has(key)) pagesRemoved.push(page.url)
  }

  const curBroken = brokenMap(current.allLinks)
  const baseBroken = brokenMap(baseline.allLinks)
  const brokenAdded: DiscoveredLink[] = []
  const brokenResolved: DiscoveredLink[] = []

  for (const [key, link] of curBroken) {
    if (!baseBroken.has(key)) brokenAdded.push(link)
  }
  for (const [key, link] of baseBroken) {
    if (!curBroken.has(key)) brokenResolved.push(link)
  }

  return {
    pagesAdded,
    pagesRemoved,
    brokenAdded,
    brokenResolved,
    seoRegressed,
    seoImproved,
    statusChanged,
  }
}
