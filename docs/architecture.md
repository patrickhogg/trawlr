# Trawlr — Software Architecture

> **Version**: 1.3.0
> **Last Updated**: 2026-07-10

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [System Architecture](#system-architecture)
4. [Process Model](#process-model)
5. [Main Process — Crawl Engine](#main-process--crawl-engine)
6. [Main Process — HTTP Client](#main-process--http-client)
7. [Main Process — SEO Auditor](#main-process--seo-auditor)
8. [Main Process — Robots.txt Parser](#main-process--robotstxt-parser)
9. [Main Process — Sitemap Parser](#main-process--sitemap-parser)
10. [Main Process — Crawl Store (Persistence)](#main-process--crawl-store-persistence)
11. [IPC Layer](#ipc-layer)
12. [Preload Bridge](#preload-bridge)
13. [Renderer Process — Vue 3 Frontend](#renderer-process--vue-3-frontend)
14. [Cross-Page Analysis & Diff](#cross-page-analysis--diff)
15. [Type System](#type-system)
16. [Data Flow](#data-flow)
17. [Configuration & Settings](#configuration--settings)
18. [Build & Packaging](#build--packaging)
19. [Design Decisions](#design-decisions)
20. [File Structure](#file-structure)

---

## Overview

Trawlr is an open-source desktop application that crawls websites to discover pages and links, detect broken links, track redirect chains, and audit SEO meta tags. It is a free alternative to Screaming Frog SEO Spider.

The application uses a two-process Electron architecture:
- **Main Process** — runs the crawl engine, HTTP client, and all Node.js operations
- **Renderer Process** — runs the Vue 3 UI, displaying results in real time

Communication between the two processes is handled via Electron's IPC (Inter-Process Communication) with a secure `contextBridge` preload script.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Desktop Shell | Electron 30+ | Native desktop window, filesystem access, IPC |
| Frontend | Vue 3 (Composition API) | Reactive UI with tabbed views |
| Build Tool | Vite 5 + vite-plugin-electron | Fast HMR dev server, production bundling |
| Styling | Tailwind CSS 4 | Utility-first CSS with dark theme |
| HTML Parsing | cheerio | Server-side jQuery-like HTML parsing |
| Concurrency | p-queue | Promise-based concurrency control |
| HTTP | Node.js native `fetch` | HTTP requests with manual redirect following |
| Language | TypeScript | Full type safety across both processes |
| Packaging | electron-builder | macOS, Windows, Linux installers |

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     ELECTRON MAIN PROCESS                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                    CrawlEngine                            │    │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────────┐  │    │
│  │  │ URL Queue  │  │ Visited Set │  │ Link Check Cache │  │    │
│  │  │ (BFS)      │  │ (dedup)     │  │ (ext. URLs)      │  │    │
│  │  └─────┬──────┘  └─────────────┘  └──────────────────┘  │    │
│  │        │                                                  │    │
│  │  ┌─────▼──────────────────────────────────────────────┐  │    │
│  │  │ Page Crawl Queue (p-queue, concurrency: N)         │  │    │
│  │  │  → HttpClient.fetch(url, getBody=true)             │  │    │
│  │  │  → cheerio.load(html)                              │  │    │
│  │  │  → extractLinks() → classifyLink()                 │  │    │
│  │  │  → SeoAuditor.audit(html)                          │  │    │
│  │  └────────────────────────────────────────────────────┘  │    │
│  │                                                          │    │
│  │  ┌────────────────────────────────────────────────────┐  │    │
│  │  │ Link Check Queue (p-queue, concurrency: 3×N)       │  │    │
│  │  │  → HttpClient.fetch(url, getBody=false)  [HEAD]    │  │    │
│  │  │  → No rate limiting — fast parallel checks         │  │    │
│  │  └────────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ HttpClient   │  │ SeoAuditor   │  │ RobotsParser          │  │
│  │ - HEAD/GET   │  │ - <title>    │  │ - fetch robots.txt    │  │
│  │ - redirect   │  │ - <meta desc>│  │ - parse User-agent: * │  │
│  │   chain      │  │ - <meta keys>│  │ - isAllowed(url)      │  │
│  │ - rate limit │  │ - limits cfg │  │ - trailing slash fix  │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
│                          │                                       │
│              ┌───────────▼─────────────┐                        │
│              │  IPC Handlers           │                        │
│              │  crawl:start            │                        │
│              │  crawl:cancel           │                        │
│              │  crawl:results          │                        │
│              │  crawl:progress (push)  │                        │
│              │  crawl:page (push)      │                        │
│              │  crawl:export-csv       │                        │
│              │  crawl:default-ua       │                        │
│              └───────────┬─────────────┘                        │
└──────────────────────────┼──────────────────────────────────────┘
                           │ contextBridge (preload.ts)
                           │ window.spider API
┌──────────────────────────┼──────────────────────────────────────┐
│               ELECTRON RENDERER PROCESS                         │
│                                                                  │
│  ┌───────────────────────▼─────────────────────────────────┐    │
│  │                    App.vue                                │    │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐   │    │
│  │  │ CrawlControls│  │ ProgressBar  │  │ Tab Navigation│   │    │
│  │  │ URL + Start  │  │ Live stats   │  │               │   │    │
│  │  └─────────────┘  └──────────────┘  └───────┬───────┘   │    │
│  │                                              │           │    │
│  │    ┌──────────┬──────────┬──────────┬────────▼─────┐    │    │
│  │    │All Pages │Broken    │Redirects │SEO Issues    │    │    │
│  │    │View      │Links View│View      │View          │    │    │
│  │    └──────────┴──────────┴──────────┴──────────────┘    │    │
│  │                                              │           │    │
│  │                                    ┌─────────▼────────┐ │    │
│  │                                    │ SettingsView     │ │    │
│  │                                    └──────────────────┘ │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Process Model

Trawlr follows the standard Electron two-process model with strict process isolation:

### Main Process (`electron/main.ts`)
- Creates and manages the `BrowserWindow`
- Registers IPC handlers **once** (guarded by a `handlersRegistered` flag to prevent duplicate registration on macOS window reopen)
- Runs all crawl engine logic in Node.js
- Has full access to Node.js APIs (filesystem, network, etc.)

### Renderer Process (`src/`)
- Vue 3 application running in a Chromium webview
- **No direct Node.js access** — `nodeIntegration: false`, `contextIsolation: true`
- Communicates with the main process exclusively through the `window.spider` API exposed by the preload script

### Preload Script (`electron/preload.ts`)
- Runs in an isolated context with access to both Electron IPC and the renderer's `window` object
- Uses `contextBridge.exposeInMainWorld()` to safely expose a typed API
- Exposes both invoke-based methods (request/response) and event-based listeners (streaming)

---

## Main Process — Crawl Engine

**File**: `electron/crawler/CrawlEngine.ts`

The CrawlEngine is the core of Trawlr. It coordinates URL discovery, link classification, broken link detection, redirect tracking, and SEO auditing.

### Algorithm: BFS Crawl

1. **Seed** — normalize the seed URL, add to `visited` set and `urlQueue`
2. **Fetch robots.txt** — parse and cache disallow rules for `User-agent: *`
3. **Process queue** — pull batches of URLs from `urlQueue`, add to the `p-queue` concurrency pool
4. **For each page**:
   - Check robots.txt allowance
   - Fetch HTML via `HttpClient` (rate-limited)
   - Parse HTML with `cheerio`
   - Run SEO audit via `SeoAuditor`
   - Extract all `<a href>` links
   - Classify each link as internal or external
   - **Internal links**: add to `urlQueue` if not visited; status filled when eventually crawled
   - **External links**: if `checkExternalLinks` is enabled, queue a parallel HEAD check on a dedicated high-concurrency queue
5. **Backfill** — when a page is crawled, update any previously-discovered links pointing to that URL with the actual status code
6. **Complete** — when `urlQueue` is empty or `maxPages` is reached, wait for link check queue to drain, then emit `completed`

### Two Queues Architecture

| Queue | Purpose | Concurrency | Rate Limiting |
|---|---|---|---|
| **Page Crawl Queue** | Full page fetches (GET + parse) | `settings.concurrency` (default: 10) | Yes — `rateLimitMs` per request |
| **Link Check Queue** | External link HEAD checks | `3 × concurrency` (default: 30) | None — fast parallel checks |

This separation is the key performance optimization. Internal links need zero extra HTTP requests (their status is captured when crawled). External links are batch-checked in parallel with no rate limiting and results are cached.

### Link Classification

Links are classified based on the **root domain** of the URL:

```
classifyLink("https://blog.example.com/post") → "internal"  (when seed is example.com)
classifyLink("https://twitter.com/example")   → "external"
```

The `extractRootDomain()` method handles common two-part TLDs (e.g., `.co.uk`, `.com.au`).

### Key Properties

| Property | Type | Description |
|---|---|---|
| `visited` | `Set<string>` | Normalized URLs already queued or crawled |
| `checkedLinks` | `Map<string, {...}>` | Cache of external link check results |
| `urlQueue` | `string[]` | BFS queue of URLs to crawl |
| `pages` | `CrawledPage[]` | All crawled page records |
| `allLinks` | `DiscoveredLink[]` | Every link discovered across all pages |

---

## Main Process — HTTP Client

**File**: `electron/crawler/HttpClient.ts`

Handles all HTTP requests with manual redirect following to capture full redirect chains.

### Request Strategy

1. **Page fetches** (`fetchBody=true`): `GET` request to retrieve HTML content
2. **Link checks** (`fetchBody=false`): `HEAD` request first; if the server returns 4xx (some block HEAD), retry with `GET`

### Redirect Handling

All requests are made with `redirect: 'manual'` to prevent the browser's automatic redirect following. The client manually follows each hop, recording:

```typescript
interface RedirectHop {
  url: string       // The URL that redirected
  statusCode: number // 301, 302, 303, 307, or 308
}
```

The chain is capped at `MAX_REDIRECTS = 10` to prevent infinite loops.

### Configuration

| Constant | Value | Description |
|---|---|---|
| `DEFAULT_USER_AGENT` | Chrome 125 UA string | Mimics a real browser to avoid blocks |
| `MAX_REDIRECTS` | 10 | Max hops before aborting |
| `REQUEST_TIMEOUT_MS` | 30,000ms | Per-request timeout via `AbortController` |

### Rate Limiting

The main `HttpClient` instance applies a configurable delay (`rateLimitMs`) before each request using `await this.delay(ms)`. The link check client uses a separate instance with `rateLimitMs = 0` for maximum throughput.

---

## Main Process — SEO Auditor

**File**: `electron/crawler/SeoAuditor.ts`

Extracts and validates on-page SEO signals from HTML content using `cheerio`.

### Audited Signals

| Signal | Validation |
|---|---|
| `<title>` | Present, non-empty, within length range (default 30–60) |
| `<meta name="description">` | Present, non-empty, within length range (default 120–160) |
| `<meta name="keywords">` | Present, non-empty (presence only) |
| `<h1>` | Exactly one (missing = `missing`, multiple = `warning`) |
| `<link rel="canonical">` | Present (`warning` when absent) |
| Images `alt` | Counts `<img>` missing an `alt` attribute |
| Indexability | `noindex` in `robots`/`googlebot` meta → `warning` |
| Open Graph | `og:title` / `og:description` / `og:image` presence |
| `<meta name="viewport">` | Present (mobile-friendliness) |
| `<html lang>` | Present |
| Structured data | Count of `application/ld+json` blocks |
| Word count | Approximate body word count (thin-content signal) |

The `audit()` method returns a single `SeoResult` object with one sub-object per signal. Only **title, description, H1, canonical, images, and indexability** gate a page as "having an SEO issue" (`hasSeoIssues()`); the remaining signals are informational. **Cross-page duplicate** title/description detection is computed in the renderer (see [Cross-Page Analysis & Diff](#cross-page-analysis--diff)), since it requires the full page set.

### Statuses

| Status | Meaning |
|---|---|
| `pass` | Tag is present and within the configured character range |
| `warning` | Tag is present but outside the recommended length |
| `missing` | Tag is not found or empty |

### Configurable Limits

All length limits are configurable via the `SeoLimits` interface:

```typescript
interface SeoLimits {
  titleMin: number        // default: 30
  titleMax: number        // default: 60
  descriptionMin: number  // default: 120
  descriptionMax: number  // default: 160
}
```

Limits can be updated at runtime via `setLimits()` and are passed from the crawl settings at the start of each crawl.

---

## Main Process — Robots.txt Parser

**File**: `electron/crawler/RobotsParser.ts`

Fetches, parses, and enforces `robots.txt` rules. Trawlr always respects robots.txt.

### Parsing Logic

1. Fetches `{origin}/robots.txt` with a 10-second timeout
2. Splits on `\r?\n` (handles both Unix and Windows line endings)
3. Extracts `Disallow` and `Allow` rules for the `User-agent: *` block
4. Handles **multi-agent blocks** (consecutive `User-agent:` lines)
5. Caches rules per origin domain

### URL Matching

- Converts robots.txt patterns to regex (`*` → `.*`, `$` anchor preserved)
- **Trailing slash fix**: when checking a URL like `/admin`, also tests `/admin/` to match rules like `Disallow: /admin/`
- `Allow` rules take precedence over `Disallow` (checked first)

### API

```typescript
fetchRobotsTxt(baseUrl: string, userAgent: string): Promise<void>
isAllowed(url: string): boolean
getSitemaps(origin: string): string[]   // Sitemap: directives from robots.txt
clear(): void
```

`Sitemap:` directives are captured during parsing (they are global, not tied to a user-agent block) and handed to the [Sitemap Parser](#main-process--sitemap-parser).

---

## Main Process — Sitemap Parser

**File**: `electron/crawler/SitemapParser.ts`

Discovers and parses XML sitemaps to (a) seed the crawl so unlinked pages are still found and (b) power orphan/coverage analysis.

### Discovery Strategy

1. **robots.txt declarations** — sitemaps named in `Sitemap:` directives (authoritative).
2. **Cross-host fallback** — if a declared sitemap is on a *different host* than the crawl origin (a common typo/stale-export failure), the **same path on the crawled origin** is also tried.
3. **Conventional paths** — `/sitemap.xml`, `/sitemap_index.xml`, `/wp-sitemap.xml` are **always** probed as well, so a broken or absent declaration doesn't suppress discovery.

### Parsing

Each document is parsed with `cheerio` in XML mode:
- `<sitemapindex>` → each `<loc>` is a **child sitemap**, fetched recursively.
- `<urlset>` → each `<loc>` is a **page URL**, collected.

### Guards

| Constant | Value | Purpose |
|---|---|---|
| `MAX_SITEMAPS` | 50 | Cap on sitemap documents fetched (index fan-out guard) |
| `MAX_URLS` | 50,000 | Cap on page URLs collected |
| `FETCH_TIMEOUT_MS` | 15,000 | Per-document fetch timeout |

Any fetch/parse failure is swallowed — a missing sitemap simply disables orphan analysis. The engine keeps only **internal** discovered URLs, normalized to match crawled-page/link data.

---

## Main Process — Crawl Store (Persistence)

**File**: `electron/persistence/CrawlStore.ts`

Persists completed crawls to disk so they can be reopened and compared later.

### Storage Layout

- Directory: `<userData>/crawls/`
- One JSON file per crawl (`<id>.json`) holding `{ meta, results }`
- A lightweight `index.json` of metadata for fast listing

### API

```typescript
save(seedUrl: string, results: CrawlResults): Promise<SavedCrawlMeta>
list(): Promise<SavedCrawlMeta[]>          // newest first
load(id: string): Promise<SavedCrawl | null>
delete(id: string): Promise<boolean>
```

Completed crawls (with content) are **auto-saved** by the `crawl:start` handler. The `SavedCrawlMeta` index entry records seed URL, timestamp, and headline counts (pages, broken, redirects, SEO issues) so the History tab renders without loading every full crawl.

---

## IPC Layer

**File**: `electron/ipc/crawlHandlers.ts`

The IPC layer bridges the main process crawl engine with the renderer UI. It uses Electron's `ipcMain.handle()` for request/response patterns and `win.webContents.send()` for streaming events.

### Registered Channels

| Channel | Direction | Description |
|---|---|---|
| `crawl:start` | Renderer → Main | Start a crawl with given settings. Returns final results. |
| `crawl:cancel` | Renderer → Main | Cancel the current crawl. Returns partial results. |
| `crawl:results` | Renderer → Main | Get the latest crawl results. |
| `crawl:progress:get` | Renderer → Main | Get the current progress snapshot. |
| `crawl:export-csv` | Renderer → Main | Export results to CSV. Opens a save dialog. |
| `crawl:default-ua` | Renderer → Main | Get the default User-Agent string. |
| `history:save` | Renderer → Main | Manually persist the latest results. |
| `history:list` | Renderer → Main | List saved crawl metadata (newest first). |
| `history:load` | Renderer → Main | Load a full saved crawl by id. |
| `history:delete` | Renderer → Main | Delete a saved crawl by id. |
| `crawl:progress` | Main → Renderer | **Push event**: progress updates during crawl. |
| `crawl:page` | Main → Renderer | **Push event**: emitted when each page is crawled. |

### CSV Export

The IPC layer includes CSV generators for four export types:

| Type | Filename | Contents |
|---|---|---|
| `all-pages` | `trawlr-all-pages.csv` | All crawled pages with status, SEO data |
| `broken-links` | `trawlr-broken-links.csv` | Only broken links with source pages |
| `redirects` | `trawlr-redirects.csv` | Links with redirect chains |
| `seo-issues` | `trawlr-seo-issues.csv` | Pages with SEO issues, incl. H1/canonical/alt/indexability/OG/word count |

### Handler Registration Guard

Handlers are registered **once** using a `handlersRegistered` boolean flag in `main.ts`. This prevents the "Attempted to register a second handler" error that occurs on macOS when the window is closed and reopened via the dock icon (Electron's main process persists across window lifecycle events on macOS).

---

## Preload Bridge

**File**: `electron/preload.ts`

Exposes the `window.spider` API to the renderer via `contextBridge.exposeInMainWorld()`.

### Exposed API

```typescript
interface TrawlrAPI {
  // Invoke-based (request/response)
  startCrawl(settings: CrawlSettings): Promise<CrawlResponse>
  cancelCrawl(): Promise<{ success: boolean; error?: string }>
  getResults(): Promise<CrawlResults | null>
  getProgress(): Promise<CrawlProgress | null>
  exportCsv(type: string): Promise<{ success: boolean; filePath?: string; error?: string }>
  getDefaultUserAgent(): Promise<string>

  // History / persistence
  saveCrawl(): Promise<{ success: boolean; meta?: SavedCrawlMeta; error?: string }>
  listCrawls(): Promise<SavedCrawlMeta[]>
  loadCrawl(id: string): Promise<SavedCrawl | null>
  deleteCrawl(id: string): Promise<{ success: boolean; error?: string }>

  // Event-based (streaming) — return cleanup functions
  onProgress(callback: (progress: CrawlProgress) => void): () => void
  onPage(callback: (page: CrawledPage) => void): () => void
}
```

Event listeners return a **cleanup function** for proper teardown when components unmount.

---

## Renderer Process — Vue 3 Frontend

**File**: `src/App.vue` and `src/views/*.vue`

### Component Architecture

```
App.vue (root)
├── CrawlControls.vue     — URL input bar + Start/Stop button
├── ProgressBar.vue        — Live crawl statistics
├── Tab Navigation         — All Pages | Broken Links | Redirects | SEO Issues | Sitemap | History | Settings
│
├── AllPagesView.vue       — Sortable table of all crawled pages (+ inlink counts)
├── BrokenLinksView.vue    — Filtered view of 4xx/5xx links
├── RedirectsView.vue      — Redirect chains with per-hop status codes
├── SeoIssuesView.vue      — SEO audit results + cross-page duplicates
├── SitemapView.vue        — Orphan pages + sitemap coverage gaps
├── HistoryView.vue        — Saved crawls: load / delete / compare
└── SettingsView.vue       — All crawl configuration options

Shared building blocks:
├── components/TableToolbar.vue  — Search box + faceted filter chips + clear
├── components/UrlCell.vue       — Truncated URL with click-to-copy popover
└── composables/useDataTable.ts  — Generic search / facet / sort engine (per-tab persisted)
```

All report tables are driven by the `useDataTable` composable: it owns free-text search, faceted chip filters (OR within a facet, AND across facets), and click-to-sort state, persisting each tab's filters to `localStorage`.

### State Management

Trawlr uses Vue 3's `reactive()` and `ref()` for state management — no external state library (Vuex/Pinia). All state lives in `App.vue` and is passed to child components via props and events.

| State | Type | Description |
|---|---|---|
| `settings` | `reactive<CrawlSettings>` | All crawl configuration |
| `results` | `ref<CrawlResults>` | Crawl results (pages + links) |
| `progress` | `ref<CrawlProgress>` | Live progress data |
| `isCrawling` | `ref<boolean>` | Whether a crawl is in progress |
| `activeTab` | `ref<string>` | Currently active results tab |

### Real-Time Updates

The renderer subscribes to `window.spider.onProgress()` and `window.spider.onPage()` during a crawl. Each event triggers a reactive state update, which Vue automatically re-renders.

### UI Design

- **Dark theme** with glassmorphism design (frosted glass cards, subtle borders)
- Color-coded status badges: ✅ pass (green), ⚠️ warning (amber), ❌ missing/broken (red)
- Sortable, filterable tables for all data views
- One-click CSV export from any tab

---

## Cross-Page Analysis & Diff

**Files**: `src/lib/analysis.ts`, `src/lib/diff.ts`

Some signals can only be derived from the *whole* result set, so they live in the renderer (framework-agnostic helpers) rather than the per-page auditor. `App.vue` exposes them as computed values passed to the views.

### `analysis.ts`

| Helper | Produces |
|---|---|
| `pageHasSeoIssue(page)` | Mirrors the engine's issue gate (title/desc/H1/canonical/images/indexability) |
| `computeDuplicates(pages)` | Sets of title/description values that occur on more than one page |
| `computeInlinkCounts(links)` | `Map<normalizedUrl, count>` of internal inlinks per page |
| `computeSitemapCoverage(pages, links, sitemapUrls, seed)` | Orphans, in-sitemap-not-crawled, crawled-not-in-sitemap |

URLs are normalized (hash stripped, trailing slash trimmed) to match the engine so sitemap, link, and page data line up.

### `diff.ts`

`diffCrawls(current, baseline)` compares two crawls (by normalized URL) and returns: pages added/removed, **broken links added/resolved**, SEO regressed/improved, and status-code changes. The History tab loads a saved crawl on demand and diffs it against the in-memory crawl.

---

## Type System

**File**: `src/types.ts`

All shared types are defined in a single file used by both the renderer and (conceptually) the main process. The main process has its own parallel type definitions in the engine files.

### Core Types

```typescript
CrawlSettings       — All user-configurable crawl parameters (incl. useSitemap)
CrawlProgress       — Live crawl status and statistics
CrawledPage          — A single crawled page with SEO data and links
DiscoveredLink       — A single discovered link with status and classification
SeoStatus            — 'pass' | 'warning' | 'missing'
SeoResult            — On-page SEO audit results (title, description, h1, canonical,
                       images, indexability, openGraph, viewport, lang, structuredData, …)
RedirectHop          — A single hop in a redirect chain
CrawlResults         — Aggregate of pages + links + progress + sitemapUrls
CrawlResponse        — IPC response wrapper with success/error
SavedCrawlMeta       — History index entry (id, seedUrl, savedAt, headline counts)
SavedCrawl           — Full persisted crawl { meta, results }
TrawlrAPI            — Full preload API type declaration
```

---

## Data Flow

### Starting a Crawl

```
User clicks "Start Crawl"
    │
    ▼
App.vue → window.spider.startCrawl(settings)
    │
    ▼ ipcRenderer.invoke('crawl:start')
    │
    ▼
crawlHandlers.ts → new CrawlEngine() → engine.start(settings, onProgress, onPage)
    │
    ├── onProgress callback → win.webContents.send('crawl:progress', data)
    │       │
    │       ▼ ipcRenderer.on('crawl:progress')
    │       │
    │       ▼ App.vue updates progress ref → UI re-renders
    │
    ├── onPage callback → win.webContents.send('crawl:page', data)
    │       │
    │       ▼ ipcRenderer.on('crawl:page')
    │       │
    │       ▼ App.vue pushes page to results → table updates live
    │
    └── engine.start() resolves → final CrawlResults returned via IPC
            │
            ▼
        App.vue receives final results, sets isCrawling = false
```

### Exporting CSV

```
User clicks "Export CSV"
    │
    ▼
App.vue → window.spider.exportCsv('broken-links')
    │
    ▼ ipcRenderer.invoke('crawl:export-csv', 'broken-links')
    │
    ▼
crawlHandlers.ts → generateBrokenLinksCsv(results.allLinks)
    │
    ▼
dialog.showSaveDialog() → User picks file location
    │
    ▼
writeFile(filePath, csv, 'utf-8') → { success: true, filePath }
```

---

## Configuration & Settings

All settings are user-configurable from the Settings tab and are passed to the crawl engine at crawl start.

| Setting | Default | Range | Description |
|---|---|---|---|
| Concurrent Requests | 10 | 1–50 | Number of pages crawled simultaneously |
| Max Pages | 800 | 1–∞ | Total page cap before crawl stops |
| Rate Limit | 100ms | 0–∞ | Delay between page fetch requests |
| Check External Links | Off | On/Off | Whether to HTTP-check external links |
| Discover & Use Sitemap | On | On/Off | Fetch the XML sitemap to seed the crawl and enable orphan analysis |
| Title Min Length | 30 | 0–∞ | Minimum acceptable title tag length |
| Title Max Length | 60 | 1–∞ | Maximum acceptable title tag length |
| Description Min Length | 120 | 0–∞ | Minimum acceptable meta description length |
| Description Max Length | 160 | 1–∞ | Maximum acceptable meta description length |
| User-Agent | Chrome 125 | Any string | HTTP User-Agent header sent with requests |

---

## Build & Packaging

### Development

```bash
npm run dev          # Start Vite dev server + Electron with HMR
```

### Production Builds

| Command | Target | Output |
|---|---|---|
| `npm run build` | Current platform | Auto-detected |
| `npm run build:mac` | macOS | `.dmg` + `.zip` |
| `npm run build:win` | Windows | `.exe` (NSIS installer) + portable `.exe` |
| `npm run build:linux` | Linux | `.AppImage` + `.deb` |

All build output goes to the `release/` directory (gitignored).

### Build Configuration

Defined in `package.json` under the `"build"` key:

- **App ID**: `com.trawlr.app`
- **Product Name**: `Trawlr`
- **Category**: `public.app-category.developer-tools`
- **Icon**: `build/icon.png` (1024×1024 PNG, auto-converted to `.icns`/`.ico`)

---

## Design Decisions

| # | Decision | Resolution | Rationale |
|---|---|---|---|
| 1 | Subdomain handling | Subdomains are **internal** | `blog.example.com` should be crawled when crawling `example.com` |
| 2 | Robots.txt | Always **respected** | Standard web etiquette; prevents crawling restricted areas |
| 3 | Max pages cap | **800** default, configurable | Prevents runaway crawls on large sites |
| 4 | JS rendering | **No** — static HTML only | Keeps the engine fast and dependency-light (no Puppeteer) |
| 5 | External link checking | **Off** by default | Dramatically speeds up crawls; toggle on when needed |
| 6 | Depth limit | **None** | BFS traversal naturally bounded by internal link graph |
| 7 | State management | **Vue 3 reactivity** (no Vuex/Pinia) | App is simple enough; avoids unnecessary abstraction |
| 8 | IPC handler registration | **Once** with guard flag | Prevents Electron crash on macOS window reopen |
| 9 | Link check architecture | **Two separate queues** | Page fetches rate-limited; external link checks run at full speed |
| 10 | robots.txt trailing slash | **Match both with and without** | `/admin` should be blocked by `Disallow: /admin/` |
| 11 | Sitemap seeding | **On** by default | Finds pages not reachable via internal links; enables orphan analysis |
| 12 | Sitemap discovery fallback | **Always probe conventional paths + cross-host same-path** | Broken/typo'd `Sitemap:` declarations shouldn't hide a real sitemap |
| 13 | Crawl persistence | **Auto-save completed crawls to `userData`** | Enables reopening and cross-crawl comparison without a database |
| 14 | Cross-page analysis | **Computed in the renderer** | Duplicates/inlinks/orphans need the full result set, not per-page data |

---

## File Structure

```
trawlr/
├── electron/                          # Electron main process
│   ├── main.ts                        # App entry, window creation, IPC guard
│   ├── preload.ts                     # contextBridge → window.spider API
│   ├── electron-env.d.ts              # Electron type declarations
│   ├── crawler/
│   │   ├── CrawlEngine.ts            # Core BFS crawler with dual queues
│   │   ├── HttpClient.ts             # HTTP client with redirect chain capture
│   │   ├── SeoAuditor.ts             # On-page SEO audit engine
│   │   ├── RobotsParser.ts           # robots.txt fetch, parse, enforce + sitemaps
│   │   └── SitemapParser.ts          # XML sitemap discovery & parsing
│   ├── persistence/
│   │   └── CrawlStore.ts             # Save/list/load/delete saved crawls
│   └── ipc/
│       └── crawlHandlers.ts          # IPC handlers + CSV generators + history
├── src/                               # Vue 3 renderer
│   ├── main.ts                        # Vue app bootstrap
│   ├── App.vue                        # Root layout, state, tab navigation
│   ├── types.ts                       # TypeScript interfaces (shared types)
│   ├── style.css                      # Tailwind + dark theme design system
│   ├── vite-env.d.ts                  # Vite type declarations
│   ├── composables/
│   │   └── useDataTable.ts           # Reusable search / facet / sort engine
│   ├── lib/
│   │   ├── analysis.ts               # Duplicates, inlinks, orphan/sitemap coverage
│   │   └── diff.ts                   # Crawl-to-crawl comparison
│   ├── components/
│   │   ├── CrawlControls.vue         # URL input + start/cancel buttons
│   │   ├── ProgressBar.vue           # Live crawl progress display
│   │   ├── TableToolbar.vue          # Search + faceted filter chips
│   │   └── UrlCell.vue               # Click-to-copy full-URL popover
│   └── views/
│       ├── AllPagesView.vue           # Sortable table of all crawled pages
│       ├── BrokenLinksView.vue        # Broken link report with source pages
│       ├── RedirectsView.vue          # Redirect chain visualization
│       ├── SeoIssuesView.vue          # SEO audit results + duplicates
│       ├── SitemapView.vue            # Orphan pages + sitemap coverage
│       ├── HistoryView.vue            # Saved crawls + comparison
│       └── SettingsView.vue           # All crawl configuration options
├── build/
│   └── icon.png                       # App icon (1024×1024 PNG)
├── docs/
│   └── architecture.md                # This file
├── index.html                         # Vite entry HTML
├── package.json                       # Dependencies + electron-builder config
├── vite.config.ts                     # Vite + Electron plugin configuration
├── tsconfig.json                      # TypeScript config
├── LICENSE                            # MIT License
└── README.md                          # Project documentation
```
