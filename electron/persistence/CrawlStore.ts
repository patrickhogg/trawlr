/**
 * CrawlStore - Persists completed crawls to disk so they can be reopened and
 * compared later. Each crawl is a JSON file under <userData>/crawls/, with a
 * lightweight index.json for fast listing.
 */

import { app } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { CrawlResults } from '../crawler/CrawlEngine'

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

export class CrawlStore {
  private dirPromise: Promise<string> | null = null

  private async dir(): Promise<string> {
    if (!this.dirPromise) {
      this.dirPromise = (async () => {
        const dir = path.join(app.getPath('userData'), 'crawls')
        await fs.mkdir(dir, { recursive: true })
        return dir
      })()
    }
    return this.dirPromise
  }

  private async indexPath(): Promise<string> {
    return path.join(await this.dir(), 'index.json')
  }

  private async readIndex(): Promise<SavedCrawlMeta[]> {
    try {
      const raw = await fs.readFile(await this.indexPath(), 'utf-8')
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  private async writeIndex(index: SavedCrawlMeta[]): Promise<void> {
    await fs.writeFile(await this.indexPath(), JSON.stringify(index, null, 2), 'utf-8')
  }

  /**
   * Save a crawl. Returns the metadata entry.
   */
  async save(seedUrl: string, results: CrawlResults): Promise<SavedCrawlMeta> {
    const dir = await this.dir()
    const brokenCount = results.allLinks.filter((l) => l.isBroken).length
    const redirectCount = results.allLinks.filter((l) => l.redirectChain.length > 0).length

    const id = `${Date.now()}-${results.pages.length}`
    const meta: SavedCrawlMeta = {
      id,
      seedUrl,
      savedAt: Date.now(),
      pageCount: results.pages.length,
      brokenCount,
      redirectCount,
      seoIssueCount: results.progress.seoIssuesCount,
    }

    const payload: SavedCrawl = { meta, results }
    await fs.writeFile(path.join(dir, `${id}.json`), JSON.stringify(payload), 'utf-8')

    const index = await this.readIndex()
    index.unshift(meta)
    await this.writeIndex(index)

    return meta
  }

  /**
   * List saved crawl metadata, newest first.
   */
  async list(): Promise<SavedCrawlMeta[]> {
    const index = await this.readIndex()
    return index.slice().sort((a, b) => b.savedAt - a.savedAt)
  }

  /**
   * Load a full saved crawl by id.
   */
  async load(id: string): Promise<SavedCrawl | null> {
    try {
      const raw = await fs.readFile(path.join(await this.dir(), `${id}.json`), 'utf-8')
      return JSON.parse(raw) as SavedCrawl
    } catch {
      return null
    }
  }

  /**
   * Delete a saved crawl by id.
   */
  async delete(id: string): Promise<boolean> {
    const dir = await this.dir()
    try {
      await fs.unlink(path.join(dir, `${id}.json`))
    } catch {
      // File may already be gone — still prune the index.
    }
    const index = await this.readIndex()
    await this.writeIndex(index.filter((m) => m.id !== id))
    return true
  }
}
