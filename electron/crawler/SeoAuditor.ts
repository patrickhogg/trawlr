/**
 * SeoAuditor - Extracts and validates on-page SEO signals from HTML content.
 * Limits are configurable via the SeoLimits interface.
 */

import * as cheerio from 'cheerio'

export interface SeoLimits {
  titleMin: number
  titleMax: number
  descriptionMin: number
  descriptionMax: number
}

export const DEFAULT_SEO_LIMITS: SeoLimits = {
  titleMin: 30,
  titleMax: 60,
  descriptionMin: 120,
  descriptionMax: 160,
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

export class SeoAuditor {
  private limits: SeoLimits

  constructor(limits?: Partial<SeoLimits>) {
    this.limits = { ...DEFAULT_SEO_LIMITS, ...limits }
  }

  setLimits(limits: Partial<SeoLimits>): void {
    Object.assign(this.limits, limits)
  }

  audit(html: string): SeoResult {
    const $ = cheerio.load(html)

    return {
      title: this.auditTitle($),
      metaDescription: this.auditMetaDescription($),
      metaKeywords: this.auditMetaKeywords($),
      h1: this.auditH1($),
      canonical: this.auditCanonical($),
      images: this.auditImages($),
      indexability: this.auditIndexability($),
      openGraph: this.auditOpenGraph($),
      viewport: this.auditViewport($),
      lang: this.auditLang($),
      structuredData: this.auditStructuredData($),
      wordCount: this.countWords($),
    }
  }

  private auditTitle($: cheerio.CheerioAPI): SeoResult['title'] {
    const titleEl = $('title')
    const value = titleEl.length > 0 ? titleEl.first().text().trim() : null

    if (!value || value.length === 0) {
      return { value: null, length: 0, status: 'missing', message: 'Title tag is missing or empty' }
    }

    const length = value.length
    const { titleMin, titleMax } = this.limits

    if (length < titleMin) {
      return { value, length, status: 'warning', message: `Title is too short (${length} chars). Recommended: ${titleMin}-${titleMax} characters` }
    }
    if (length > titleMax) {
      return { value, length, status: 'warning', message: `Title is too long (${length} chars). Recommended: ${titleMin}-${titleMax} characters` }
    }
    return { value, length, status: 'pass', message: `Title length is optimal (${length} chars)` }
  }

  private auditMetaDescription($: cheerio.CheerioAPI): SeoResult['metaDescription'] {
    const metaEl = $('meta[name="description"]')
    const value = metaEl.length > 0 ? metaEl.attr('content')?.trim() || null : null

    if (!value || value.length === 0) {
      return { value: null, length: 0, status: 'missing', message: 'Meta description is missing or empty' }
    }

    const length = value.length
    const { descriptionMin, descriptionMax } = this.limits

    if (length < descriptionMin) {
      return { value, length, status: 'warning', message: `Meta description is too short (${length} chars). Recommended: ${descriptionMin}-${descriptionMax} characters` }
    }
    if (length > descriptionMax) {
      return { value, length, status: 'warning', message: `Meta description is too long (${length} chars). Recommended: ${descriptionMin}-${descriptionMax} characters` }
    }
    return { value, length, status: 'pass', message: `Meta description length is optimal (${length} chars)` }
  }

  private auditMetaKeywords($: cheerio.CheerioAPI): SeoResult['metaKeywords'] {
    const metaEl = $('meta[name="keywords"]')
    const value = metaEl.length > 0 ? metaEl.attr('content')?.trim() || null : null

    if (!value || value.length === 0) {
      return { value: null, status: 'missing', message: 'Meta keywords tag is missing or empty' }
    }
    return { value, status: 'pass', message: 'Meta keywords tag is present' }
  }

  private auditH1($: cheerio.CheerioAPI): SeoResult['h1'] {
    const h1s = $('h1')
    const count = h1s.length
    const value = count > 0 ? h1s.first().text().trim() || null : null

    if (count === 0) {
      return { count, value: null, status: 'missing', message: 'No H1 heading found' }
    }
    if (count > 1) {
      return { count, value, status: 'warning', message: `Multiple H1 headings found (${count}). Use a single H1 per page` }
    }
    return { count, value, status: 'pass', message: 'Exactly one H1 heading' }
  }

  private auditCanonical($: cheerio.CheerioAPI): SeoResult['canonical'] {
    const el = $('link[rel="canonical"]')
    const value = el.length > 0 ? el.attr('href')?.trim() || null : null

    if (!value) {
      return { value: null, status: 'warning', message: 'No canonical link tag' }
    }
    return { value, status: 'pass', message: 'Canonical link tag present' }
  }

  private auditImages($: cheerio.CheerioAPI): SeoResult['images'] {
    const imgs = $('img')
    const total = imgs.length
    let missingAlt = 0

    imgs.each((_, el) => {
      const alt = $(el).attr('alt')
      // Missing alt attribute entirely; empty alt="" is valid (decorative)
      if (alt === undefined) missingAlt++
    })

    if (total === 0) {
      return { total, missingAlt: 0, status: 'pass', message: 'No images on page' }
    }
    if (missingAlt > 0) {
      return { total, missingAlt, status: 'warning', message: `${missingAlt} of ${total} images missing an alt attribute` }
    }
    return { total, missingAlt: 0, status: 'pass', message: `All ${total} images have alt attributes` }
  }

  private auditIndexability($: cheerio.CheerioAPI): SeoResult['indexability'] {
    const robots = (
      $('meta[name="robots"]').attr('content') ||
      $('meta[name="googlebot"]').attr('content') ||
      null
    )?.toLowerCase() || null

    const indexable = !robots || !robots.includes('noindex')

    if (!indexable) {
      return { indexable, robots, status: 'warning', message: `Page is set to noindex (robots: "${robots}")` }
    }
    return { indexable, robots, status: 'pass', message: 'Page is indexable' }
  }

  private auditOpenGraph($: cheerio.CheerioAPI): SeoResult['openGraph'] {
    const required = ['og:title', 'og:description', 'og:image']
    const missing = required.filter(
      (prop) => !$(`meta[property="${prop}"]`).attr('content')?.trim()
    )

    if (missing.length === required.length) {
      return { missing, status: 'missing', message: 'No Open Graph tags found' }
    }
    if (missing.length > 0) {
      return { missing, status: 'warning', message: `Missing Open Graph tags: ${missing.join(', ')}` }
    }
    return { missing, status: 'pass', message: 'Open Graph tags present' }
  }

  private auditViewport($: cheerio.CheerioAPI): SeoResult['viewport'] {
    const present = $('meta[name="viewport"]').attr('content') != null
    if (!present) {
      return { present, status: 'warning', message: 'No viewport meta tag (mobile-friendliness)' }
    }
    return { present, status: 'pass', message: 'Viewport meta tag present' }
  }

  private auditLang($: cheerio.CheerioAPI): SeoResult['lang'] {
    const value = $('html').attr('lang')?.trim() || null
    if (!value) {
      return { value: null, status: 'warning', message: 'No lang attribute on <html>' }
    }
    return { value, status: 'pass', message: `Document language: ${value}` }
  }

  private auditStructuredData($: cheerio.CheerioAPI): SeoResult['structuredData'] {
    const count = $('script[type="application/ld+json"]').length
    if (count === 0) {
      return { count, status: 'warning', message: 'No JSON-LD structured data' }
    }
    return { count, status: 'pass', message: `${count} JSON-LD block(s) found` }
  }

  private countWords($: cheerio.CheerioAPI): number {
    // Strip non-content elements before counting.
    $('script, style, noscript, template').remove()
    const text = $('body').text().replace(/\s+/g, ' ').trim()
    if (!text) return 0
    return text.split(' ').filter(Boolean).length
  }
}
