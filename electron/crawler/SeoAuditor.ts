/**
 * SeoAuditor - Extracts and validates SEO meta tags from HTML content.
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

export class SeoAuditor {
  private limits: SeoLimits

  constructor(limits?: Partial<SeoLimits>) {
    this.limits = { ...DEFAULT_SEO_LIMITS, ...limits }
  }

  /**
   * Update the limits used for auditing.
   */
  setLimits(limits: Partial<SeoLimits>): void {
    Object.assign(this.limits, limits)
  }

  /**
   * Audit HTML content for SEO meta tags.
   */
  audit(html: string): SeoResult {
    const $ = cheerio.load(html)

    return {
      title: this.auditTitle($),
      metaDescription: this.auditMetaDescription($),
      metaKeywords: this.auditMetaKeywords($),
    }
  }

  private auditTitle($: cheerio.CheerioAPI): SeoResult['title'] {
    const titleEl = $('title')
    const value = titleEl.length > 0 ? titleEl.first().text().trim() : null

    if (!value || value.length === 0) {
      return {
        value: null,
        length: 0,
        status: 'missing',
        message: 'Title tag is missing or empty',
      }
    }

    const length = value.length
    const { titleMin, titleMax } = this.limits

    if (length < titleMin) {
      return {
        value,
        length,
        status: 'warning',
        message: `Title is too short (${length} chars). Recommended: ${titleMin}-${titleMax} characters`,
      }
    }

    if (length > titleMax) {
      return {
        value,
        length,
        status: 'warning',
        message: `Title is too long (${length} chars). Recommended: ${titleMin}-${titleMax} characters`,
      }
    }

    return {
      value,
      length,
      status: 'pass',
      message: `Title length is optimal (${length} chars)`,
    }
  }

  private auditMetaDescription($: cheerio.CheerioAPI): SeoResult['metaDescription'] {
    const metaEl = $('meta[name="description"]')
    const value = metaEl.length > 0 ? metaEl.attr('content')?.trim() || null : null

    if (!value || value.length === 0) {
      return {
        value: null,
        length: 0,
        status: 'missing',
        message: 'Meta description is missing or empty',
      }
    }

    const length = value.length
    const { descriptionMin, descriptionMax } = this.limits

    if (length < descriptionMin) {
      return {
        value,
        length,
        status: 'warning',
        message: `Meta description is too short (${length} chars). Recommended: ${descriptionMin}-${descriptionMax} characters`,
      }
    }

    if (length > descriptionMax) {
      return {
        value,
        length,
        status: 'warning',
        message: `Meta description is too long (${length} chars). Recommended: ${descriptionMin}-${descriptionMax} characters`,
      }
    }

    return {
      value,
      length,
      status: 'pass',
      message: `Meta description length is optimal (${length} chars)`,
    }
  }

  private auditMetaKeywords($: cheerio.CheerioAPI): SeoResult['metaKeywords'] {
    const metaEl = $('meta[name="keywords"]')
    const value = metaEl.length > 0 ? metaEl.attr('content')?.trim() || null : null

    if (!value || value.length === 0) {
      return {
        value: null,
        status: 'missing',
        message: 'Meta keywords tag is missing or empty',
      }
    }

    return {
      value,
      status: 'pass',
      message: 'Meta keywords tag is present',
    }
  }
}
