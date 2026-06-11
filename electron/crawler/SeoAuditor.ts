/**
 * SeoAuditor - Extracts and validates SEO meta tags from HTML content.
 */

import * as cheerio from 'cheerio'

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

// Industry standard limits
const TITLE_MIN = 30
const TITLE_MAX = 60
const DESCRIPTION_MIN = 120
const DESCRIPTION_MAX = 160

export class SeoAuditor {
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

    if (length < TITLE_MIN) {
      return {
        value,
        length,
        status: 'warning',
        message: `Title is too short (${length} chars). Recommended: ${TITLE_MIN}-${TITLE_MAX} characters`,
      }
    }

    if (length > TITLE_MAX) {
      return {
        value,
        length,
        status: 'warning',
        message: `Title is too long (${length} chars). Recommended: ${TITLE_MIN}-${TITLE_MAX} characters`,
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

    if (length < DESCRIPTION_MIN) {
      return {
        value,
        length,
        status: 'warning',
        message: `Meta description is too short (${length} chars). Recommended: ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} characters`,
      }
    }

    if (length > DESCRIPTION_MAX) {
      return {
        value,
        length,
        status: 'warning',
        message: `Meta description is too long (${length} chars). Recommended: ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} characters`,
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
