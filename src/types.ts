/**
 * Type declarations for the Trawlr preload API exposed via contextBridge.
 */

export interface TrawlrAPI {
  startCrawl: (settings: CrawlSettings) => Promise<CrawlResponse>
  cancelCrawl: () => Promise<{ success: boolean; error?: string }>
  getResults: () => Promise<CrawlResults | null>
  getProgress: () => Promise<CrawlProgress | null>
  exportCsv: (type: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
  getDefaultUserAgent: () => Promise<string>
  onProgress: (callback: (progress: CrawlProgress) => void) => () => void
  onPage: (callback: (page: CrawledPage) => void) => () => void
}

export interface CrawlSettings {
  seedUrl: string
  concurrency: number
  maxPages: number
  rateLimitMs: number
  userAgent?: string
}

export interface RedirectHop {
  url: string
  statusCode: number
}

export interface SeoResult {
  title: {
    value: string | null
    length: number
    status: 'pass' | 'warning' | 'missing'
    message: string
  }
  metaDescription: {
    value: string | null
    length: number
    status: 'pass' | 'warning' | 'missing'
    message: string
  }
  metaKeywords: {
    value: string | null
    status: 'pass' | 'missing'
    message: string
  }
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

export interface CrawlResponse {
  success: boolean
  results?: CrawlResults
  error?: string
}

declare global {
  interface Window {
    spider: TrawlrAPI
  }
}
