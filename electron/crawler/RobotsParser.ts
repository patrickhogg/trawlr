/**
 * RobotsParser - Fetches and parses robots.txt to check if a URL is allowed.
 * Simple parser that handles User-Agent, Allow, and Disallow directives.
 */

export interface RobotsRules {
  allowRules: string[]
  disallowRules: string[]
}

export class RobotsParser {
  private rulesCache: Map<string, RobotsRules> = new Map()
  private fetchedDomains: Set<string> = new Set()

  /**
   * Fetch and parse robots.txt for a given URL's domain.
   */
  async fetchRobotsTxt(baseUrl: string, userAgent: string): Promise<void> {
    const origin = new URL(baseUrl).origin
    if (this.fetchedDomains.has(origin)) return

    this.fetchedDomains.add(origin)

    try {
      const response = await fetch(`${origin}/robots.txt`, {
        headers: { 'User-Agent': userAgent },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        // No robots.txt or error — allow everything
        this.rulesCache.set(origin, { allowRules: [], disallowRules: [] })
        return
      }

      const text = await response.text()
      const rules = this.parse(text)
      this.rulesCache.set(origin, rules)
    } catch {
      // Network error — allow everything
      this.rulesCache.set(origin, { allowRules: [], disallowRules: [] })
    }
  }

  /**
   * Check if a URL is allowed by robots.txt rules.
   */
  isAllowed(url: string): boolean {
    try {
      const parsedUrl = new URL(url)
      const origin = parsedUrl.origin
      const rules = this.rulesCache.get(origin)

      if (!rules) return true // No rules fetched — allow

      const path = parsedUrl.pathname + parsedUrl.search

      // Check allow rules first (more specific takes precedence)
      for (const rule of rules.allowRules) {
        if (this.matchesRule(path, rule)) return true
      }

      // Check disallow rules
      for (const rule of rules.disallowRules) {
        if (this.matchesRule(path, rule)) return false
      }

      return true
    } catch {
      return true
    }
  }

  /**
   * Parse robots.txt content into rules for all user agents.
   * Focuses on * (wildcard) user-agent rules.
   */
  private parse(content: string): RobotsRules {
    const lines = content.split('\n')
    const allowRules: string[] = []
    const disallowRules: string[] = []
    let isRelevantBlock = false

    for (const rawLine of lines) {
      const line = rawLine.trim()

      // Skip comments and empty lines
      if (line.startsWith('#') || line.length === 0) continue

      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) continue

      const directive = line.substring(0, colonIdx).trim().toLowerCase()
      const value = line.substring(colonIdx + 1).trim()

      if (directive === 'user-agent') {
        isRelevantBlock = value === '*'
      } else if (isRelevantBlock) {
        if (directive === 'disallow' && value.length > 0) {
          disallowRules.push(value)
        } else if (directive === 'allow' && value.length > 0) {
          allowRules.push(value)
        }
      }
    }

    return { allowRules, disallowRules }
  }

  /**
   * Check if a path matches a robots.txt rule.
   * Supports * wildcard and $ end-of-string anchor.
   */
  private matchesRule(path: string, rule: string): boolean {
    // Convert robots.txt rule pattern to regex
    let pattern = rule
      .replace(/[.+?^{}()|[\]\\]/g, '\\$&') // Escape special regex chars (except *)
      .replace(/\*/g, '.*') // Convert * to .*

    // Handle $ anchor at end
    if (pattern.endsWith('$')) {
      pattern = pattern.slice(0, -1) + '$'
    } else {
      // By default, the rule matches the beginning of the path
      // No need to add anything — startsWith behavior
    }

    try {
      return new RegExp(`^${pattern}`).test(path)
    } catch {
      return path.startsWith(rule)
    }
  }

  /**
   * Clear all cached rules.
   */
  clear(): void {
    this.rulesCache.clear()
    this.fetchedDomains.clear()
  }
}
