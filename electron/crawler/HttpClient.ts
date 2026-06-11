/**
 * HttpClient - Handles HTTP requests with HEAD/GET fallback and redirect chain capture.
 * Manually follows redirects to record each hop in the chain.
 */

export interface RedirectHop {
  url: string
  statusCode: number
}

export interface HttpResponse {
  url: string
  finalUrl: string
  statusCode: number
  headers: Record<string, string>
  body: string | null
  redirectChain: RedirectHop[]
  error: string | null
}

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

const MAX_REDIRECTS = 10
const REQUEST_TIMEOUT_MS = 30000

export class HttpClient {
  private userAgent: string
  private rateLimitMs: number

  constructor(userAgent?: string, rateLimitMs: number = 0) {
    this.userAgent = userAgent || DEFAULT_USER_AGENT
    this.rateLimitMs = rateLimitMs
  }

  setUserAgent(ua: string): void {
    this.userAgent = ua
  }

  setRateLimit(ms: number): void {
    this.rateLimitMs = ms
  }

  getUserAgent(): string {
    return this.userAgent
  }

  static getDefaultUserAgent(): string {
    return DEFAULT_USER_AGENT
  }

  /**
   * Fetch a URL, following redirects manually to capture the chain.
   * If fetchBody is true, performs a GET request to retrieve HTML content.
   * If false, tries HEAD first, falling back to GET if HEAD returns an error.
   */
  async fetch(url: string, fetchBody: boolean = false): Promise<HttpResponse> {
    if (this.rateLimitMs > 0) {
      await this.delay(this.rateLimitMs)
    }

    const redirectChain: RedirectHop[] = []
    let currentUrl = url
    let finalResponse: HttpResponse | null = null

    for (let i = 0; i < MAX_REDIRECTS; i++) {
      try {
        const method = fetchBody ? 'GET' : 'HEAD'
        const response = await this.makeRequest(currentUrl, method)

        // If HEAD returns an error (some servers block it), retry with GET
        if (!fetchBody && response.statusCode >= 400) {
          const getResponse = await this.makeRequest(currentUrl, 'GET')
          if (getResponse.statusCode < 400) {
            // HEAD was blocked but GET works - check for redirect
            if (this.isRedirect(getResponse.statusCode)) {
              const location = getResponse.headers['location']
              if (location) {
                redirectChain.push({ url: currentUrl, statusCode: getResponse.statusCode })
                currentUrl = this.resolveUrl(currentUrl, location)
                continue
              }
            }
            finalResponse = {
              url,
              finalUrl: currentUrl,
              statusCode: getResponse.statusCode,
              headers: getResponse.headers,
              body: getResponse.body,
              redirectChain,
              error: null,
            }
            break
          }
        }

        // Handle redirect
        if (this.isRedirect(response.statusCode)) {
          const location = response.headers['location']
          if (location) {
            redirectChain.push({ url: currentUrl, statusCode: response.statusCode })
            currentUrl = this.resolveUrl(currentUrl, location)
            continue
          }
        }

        finalResponse = {
          url,
          finalUrl: currentUrl,
          statusCode: response.statusCode,
          headers: response.headers,
          body: fetchBody ? response.body : null,
          redirectChain,
          error: null,
        }
        break
      } catch (err: any) {
        finalResponse = {
          url,
          finalUrl: currentUrl,
          statusCode: 0,
          headers: {},
          body: null,
          redirectChain,
          error: err.message || 'Unknown error',
        }
        break
      }
    }

    if (!finalResponse) {
      finalResponse = {
        url,
        finalUrl: currentUrl,
        statusCode: 0,
        headers: {},
        body: null,
        redirectChain,
        error: 'Too many redirects',
      }
    }

    return finalResponse
  }

  private async makeRequest(
    url: string,
    method: string
  ): Promise<{ statusCode: number; headers: Record<string, string>; body: string | null }> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'User-Agent': this.userAgent,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        redirect: 'manual', // Don't auto-follow — we track manually
        signal: controller.signal,
      })

      const headers: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value
      })

      let body: string | null = null
      if (method === 'GET') {
        try {
          body = await response.text()
        } catch {
          body = null
        }
      }

      return {
        statusCode: response.status,
        headers,
        body,
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  private isRedirect(statusCode: number): boolean {
    return [301, 302, 303, 307, 308].includes(statusCode)
  }

  private resolveUrl(base: string, relative: string): string {
    try {
      return new URL(relative, base).href
    } catch {
      return relative
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
