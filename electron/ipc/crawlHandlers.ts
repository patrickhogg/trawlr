/**
 * IPC Crawl Handlers - Bridge between the Electron main process and the renderer.
 * Handles crawl start, cancel, progress streaming, and CSV export.
 */

import { ipcMain, BrowserWindow, dialog } from 'electron'
import { writeFile } from 'node:fs/promises'
import {
  CrawlEngine,
  type CrawlSettings,
  type CrawlProgress,
  type CrawledPage,
  type CrawlResults,
  type DiscoveredLink,
} from '../crawler/CrawlEngine'
import { HttpClient } from '../crawler/HttpClient'

let engine: CrawlEngine | null = null
let latestResults: CrawlResults | null = null

export function registerCrawlHandlers(win: BrowserWindow): void {
  // Start a crawl
  ipcMain.handle('crawl:start', async (_event, settings: CrawlSettings) => {
    engine = new CrawlEngine()

    const onProgress = (progress: CrawlProgress) => {
      if (!win.isDestroyed()) {
        win.webContents.send('crawl:progress', progress)
      }
    }

    const onPage = (page: CrawledPage) => {
      if (!win.isDestroyed()) {
        win.webContents.send('crawl:page', page)
      }
    }

    try {
      latestResults = await engine.start(settings, onProgress, onPage)
      return { success: true, results: latestResults }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Cancel the crawl
  ipcMain.handle('crawl:cancel', async () => {
    if (engine) {
      engine.cancel()
      latestResults = engine.getResults()
      return { success: true }
    }
    return { success: false, error: 'No crawl in progress' }
  })

  // Get current results
  ipcMain.handle('crawl:results', async () => {
    if (engine) {
      return engine.getResults()
    }
    return latestResults
  })

  // Get current progress
  ipcMain.handle('crawl:progress:get', async () => {
    if (engine) {
      return engine.getProgress()
    }
    return null
  })

  // Export to CSV
  ipcMain.handle('crawl:export-csv', async (_event, type: string) => {
    const results = latestResults || (engine ? engine.getResults() : null)
    if (!results) {
      return { success: false, error: 'No results to export' }
    }

    let csv = ''
    let defaultFilename = ''

    switch (type) {
      case 'all-pages':
        csv = generatePagesCsv(results.pages)
        defaultFilename = 'trawlr-all-pages.csv'
        break
      case 'broken-links':
        csv = generateBrokenLinksCsv(results.allLinks)
        defaultFilename = 'trawlr-broken-links.csv'
        break
      case 'redirects':
        csv = generateRedirectsCsv(results.allLinks)
        defaultFilename = 'trawlr-redirects.csv'
        break
      case 'seo-issues':
        csv = generateSeoCsv(results.pages)
        defaultFilename = 'trawlr-seo-issues.csv'
        break
      default:
        csv = generateAllCsv(results)
        defaultFilename = 'trawlr-full-report.csv'
    }

    try {
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        defaultPath: defaultFilename,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      })

      if (canceled || !filePath) {
        return { success: false, error: 'Export cancelled' }
      }

      await writeFile(filePath, csv, 'utf-8')
      return { success: true, filePath }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Get default user agent
  ipcMain.handle('crawl:default-ua', async () => {
    return HttpClient.getDefaultUserAgent()
  })
}

// ---- CSV Generators ----

function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function generatePagesCsv(pages: CrawledPage[]): string {
  const headers = [
    'URL',
    'Status Code',
    'Content Type',
    'Title',
    'Title Length',
    'Title Status',
    'Meta Description',
    'Description Length',
    'Description Status',
    'Meta Keywords',
    'Keywords Status',
    'Links Count',
    'Redirect Chain',
    'Error',
  ]

  const rows = pages.map((page) => [
    escapeCsvField(page.url),
    escapeCsvField(page.statusCode),
    escapeCsvField(page.contentType),
    escapeCsvField(page.seo?.title.value),
    escapeCsvField(page.seo?.title.length),
    escapeCsvField(page.seo?.title.status),
    escapeCsvField(page.seo?.metaDescription.value),
    escapeCsvField(page.seo?.metaDescription.length),
    escapeCsvField(page.seo?.metaDescription.status),
    escapeCsvField(page.seo?.metaKeywords.value),
    escapeCsvField(page.seo?.metaKeywords.status),
    escapeCsvField(page.links.length),
    escapeCsvField(
      page.redirectChain.map((r) => `${r.statusCode}: ${r.url}`).join(' → ')
    ),
    escapeCsvField(page.error),
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

function generateBrokenLinksCsv(links: DiscoveredLink[]): string {
  const broken = links.filter((l) => l.isBroken)
  const headers = [
    'Broken URL',
    'Found On Page',
    'Anchor Text',
    'Type',
    'Status Code',
    'Error',
  ]

  const rows = broken.map((link) => [
    escapeCsvField(link.targetUrl),
    escapeCsvField(link.sourceUrl),
    escapeCsvField(link.anchorText),
    escapeCsvField(link.type),
    escapeCsvField(link.statusCode),
    escapeCsvField(link.error),
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

function generateRedirectsCsv(links: DiscoveredLink[]): string {
  const redirects = links.filter((l) => l.redirectChain.length > 0)
  const headers = [
    'Original URL',
    'Found On Page',
    'Type',
    'Redirect Chain',
    'Final Status',
  ]

  const rows = redirects.map((link) => [
    escapeCsvField(link.targetUrl),
    escapeCsvField(link.sourceUrl),
    escapeCsvField(link.type),
    escapeCsvField(
      link.redirectChain.map((r) => `${r.statusCode}: ${r.url}`).join(' → ')
    ),
    escapeCsvField(link.statusCode),
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

function generateSeoCsv(pages: CrawledPage[]): string {
  const issues = pages.filter(
    (p) =>
      p.seo &&
      (p.seo.title.status !== 'pass' ||
        p.seo.metaDescription.status !== 'pass' ||
        p.seo.metaKeywords.status !== 'pass')
  )

  const headers = [
    'URL',
    'Title Status',
    'Title Message',
    'Description Status',
    'Description Message',
    'Keywords Status',
    'Keywords Message',
  ]

  const rows = issues.map((page) => [
    escapeCsvField(page.url),
    escapeCsvField(page.seo?.title.status),
    escapeCsvField(page.seo?.title.message),
    escapeCsvField(page.seo?.metaDescription.status),
    escapeCsvField(page.seo?.metaDescription.message),
    escapeCsvField(page.seo?.metaKeywords.status),
    escapeCsvField(page.seo?.metaKeywords.message),
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

function generateAllCsv(results: CrawlResults): string {
  return [
    '--- ALL PAGES ---',
    generatePagesCsv(results.pages),
    '',
    '--- BROKEN LINKS ---',
    generateBrokenLinksCsv(results.allLinks),
    '',
    '--- REDIRECTS ---',
    generateRedirectsCsv(results.allLinks),
    '',
    '--- SEO ISSUES ---',
    generateSeoCsv(results.pages),
  ].join('\n')
}
