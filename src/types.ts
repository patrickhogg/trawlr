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
  // History / persistence
  saveCrawl: () => Promise<{ success: boolean; meta?: SavedCrawlMeta; error?: string }>
  listCrawls: () => Promise<SavedCrawlMeta[]>
  loadCrawl: (id: string) => Promise<SavedCrawl | null>
  deleteCrawl: (id: string) => Promise<{ success: boolean; error?: string }>
}

export interface SavedCrawlMeta {
  id: string
  seedUrl: string
  savedAt: number
  pageCount: number
  brokenCount: number
  redirectCount: number
  seoIssueCount: number
}

export interface SavedCrawl {
  meta: SavedCrawlMeta
  results: CrawlResults
}

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

export interface RedirectHop {
  url: string
  statusCode: number
}

export type SeoStatus = 'pass' | 'warning' | 'missing'

export interface SeoResult {
  title: {
    value: string | null
    length: number
    status: SeoStatus
    message: string
  }
  metaDescription: {
    value: string | null
    length: number
    status: SeoStatus
    message: string
  }
  metaKeywords: {
    value: string | null
    status: 'pass' | 'missing'
    message: string
  }
  h1: {
    count: number
    value: string | null
    status: SeoStatus
    message: string
  }
  canonical: {
    value: string | null
    status: SeoStatus
    message: string
  }
  images: {
    total: number
    missingAlt: number
    status: SeoStatus
    message: string
  }
  indexability: {
    indexable: boolean
    robots: string | null
    status: SeoStatus
    message: string
  }
  openGraph: {
    missing: string[]
    status: SeoStatus
    message: string
  }
  viewport: {
    present: boolean
    status: SeoStatus
    message: string
  }
  lang: {
    value: string | null
    status: SeoStatus
    message: string
  }
  structuredData: {
    count: number
    status: SeoStatus
    message: string
  }
  wordCount: number
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
  sitemapUrls: string[]
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
