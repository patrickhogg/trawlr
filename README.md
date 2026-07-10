<div align="center">

# 🌊 Trawlr

### Open-Source Desktop Web Crawler & Link Auditor

**Find broken links, track redirects, and audit SEO meta tags — all from your desktop.**

[![Electron](https://img.shields.io/badge/Electron-30+-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)

---

*A fast, free, open-source alternative to Screaming Frog SEO Spider — built with Electron, Vue 3, and Tailwind CSS.*

</div>

---

## ✨ Features

### 🔗 Broken Link Detection
- Discovers every link on every page of your website
- Flags **4xx and 5xx** HTTP status codes as broken
- Shows which page(s) contain each broken link
- Uses HEAD-first requests with GET fallback for accuracy

### 🔀 Redirect Chain Tracking
- Detects all redirect types: **301, 302, 303, 307, 308**
- Records the full redirect chain with HTTP status codes per hop
- Visualizes the complete path from original URL to final destination

### 🏷️ SEO Auditing
- Validates `<title>` tags (recommended: 30–60 characters)
- Validates `<meta name="description">` (recommended: 120–160 characters)
- **Headings** — flags missing or multiple `<h1>` tags
- **Canonical** — detects a missing `<link rel="canonical">`
- **Image alt text** — reports images missing an `alt` attribute
- **Indexability** — surfaces `noindex` (robots/googlebot meta)
- **Open Graph** — checks `og:title` / `og:description` / `og:image`
- **Viewport, `lang`, structured data (JSON-LD)**, and per-page word count
- **Cross-page duplicates** — flags pages sharing the same title or description
- Checks for `<meta name="keywords">` presence
- Color-coded status badges: ✅ Pass, ⚠️ Warning, ❌ Missing

### 🗺️ Sitemap & Orphan Analysis
- Auto-discovers XML sitemaps via `robots.txt` and conventional paths (following sitemap-index files)
- Seeds the crawl from the sitemap so pages that aren't linked internally are still found
- **Orphan pages** — crawled pages with zero internal inlinks
- **Coverage gaps** — URLs in the sitemap that weren't crawled, and crawled pages missing from the sitemap
- Per-page **inlink counts** in the All Pages report

### 🕓 Crawl History & Comparison
- Completed crawls are **saved to disk automatically**
- Reopen any past crawl from the **History** tab
- **Compare** two crawls to catch regressions over time — new vs. resolved broken links, SEO regressions/improvements, added/removed pages, and status-code changes

### 🔍 Link Classification
- Automatically classifies every link as **Internal** or **External**
- Subdomains are treated as internal (e.g., `blog.example.com` → internal when crawling `example.com`)
- Only follows internal links; external links are checked but not crawled

### ⚙️ Configurable Settings
- **Concurrent requests** — crawl up to 50 pages simultaneously (default: 10)
- **Max pages cap** — prevent runaway crawls (default: 800, adjustable)
- **Rate limiting** — tunable delay between requests to avoid overwhelming servers
- **User-Agent** — defaults to Chrome; fully editable with one-click reset
- **Sitemap discovery** — toggle sitemap-seeded crawling on/off
- **Robots.txt** — always respected

### 📊 In-App Reports & CSV Export
- **All Pages** — sortable, filterable table with status codes, SEO results, and inlink counts
- **Broken Links** — focused view of broken URLs with source pages
- **Redirects** — redirect chains with per-hop status codes
- **SEO Issues** — pages failing SEO checks, with faceted status filters and duplicate detection
- **Sitemap** — orphan pages and sitemap coverage gaps
- **History** — saved crawls with load, delete, and compare
- Faceted **filter chips** and click-to-sort columns across every report
- Export any view to **CSV** with one click

---

## 🖥️ Screenshots

> *Coming soon — screenshots of the dark-themed UI with glassmorphism design*

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm (included with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/patrickhogg/trawlr.git
cd trawlr

# Install dependencies
npm install

# Start the app in development mode
npm run dev
```

### Build Installers

Build a distributable installer for your platform. Output goes to the `release/` directory.

#### macOS

```bash
npm run build:mac
```

Produces:
- `Trawlr-1.3.0-mac-arm64.dmg` — drag-to-Applications installer
- `Trawlr-1.3.0-mac-arm64.zip` — portable zip

#### Windows

```bash
npm run build:win
```

Produces:
- `Trawlr-1.3.0-win-x64.exe` — NSIS installer (custom install directory)
- `Trawlr-1.3.0-win-x64.exe` — portable executable

#### Linux

```bash
npm run build:linux
```

Produces:
- `Trawlr-1.3.0-linux-x86_64.AppImage` — portable AppImage
- `Trawlr-1.3.0-linux-amd64.deb` — Debian package

#### All Platforms

```bash
npm run build
```

> **Note**: Cross-compilation has limitations. Building Windows installers on macOS requires [Wine](https://www.winehq.org/). For best results, build on the target platform or use CI/CD.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Desktop Shell** | [Electron](https://www.electronjs.org/) v30+ |
| **Frontend** | [Vue 3](https://vuejs.org/) (Composition API) |
| **Build Tool** | [Vite](https://vitejs.dev/) via [electron-vite](https://github.com/electron-vite) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) v4 |
| **HTML Parsing** | [cheerio](https://cheerio.js.org/) |
| **Concurrency** | [p-queue](https://github.com/sindresorhus/p-queue) |
| **Language** | TypeScript |

---

## 📁 Project Structure

```
trawlr/
├── electron/                      # Electron main process
│   ├── main.ts                    # Window creation, IPC registration
│   ├── preload.ts                 # contextBridge API
│   ├── crawler/
│   │   ├── CrawlEngine.ts         # Core BFS crawler with concurrency
│   │   ├── HttpClient.ts          # HTTP client with redirect tracking
│   │   ├── SeoAuditor.ts          # On-page SEO audit engine
│   │   ├── RobotsParser.ts        # robots.txt compliance + sitemap discovery
│   │   └── SitemapParser.ts       # XML sitemap discovery & parsing
│   ├── persistence/
│   │   └── CrawlStore.ts          # Save/load/list/delete saved crawls
│   └── ipc/
│       └── crawlHandlers.ts       # IPC bridge + CSV export + history
├── src/                           # Vue 3 renderer
│   ├── App.vue                    # Root layout with tabs
│   ├── types.ts                   # TypeScript interfaces
│   ├── style.css                  # Tailwind + dark theme design system
│   ├── composables/
│   │   └── useDataTable.ts        # Reusable search/facet/sort engine
│   ├── lib/
│   │   ├── analysis.ts            # Duplicates, inlinks, orphan/sitemap coverage
│   │   └── diff.ts                # Crawl-to-crawl comparison
│   ├── components/
│   │   ├── CrawlControls.vue      # URL input + start/stop
│   │   ├── ProgressBar.vue        # Live crawl statistics
│   │   ├── TableToolbar.vue       # Search + faceted filter chips
│   │   └── UrlCell.vue            # Click-to-copy full-URL popover
│   └── views/
│       ├── AllPagesView.vue       # All crawled pages table (+ inlinks)
│       ├── BrokenLinksView.vue    # Broken link report
│       ├── RedirectsView.vue      # Redirect chain visualization
│       ├── SeoIssuesView.vue      # SEO audit results + duplicates
│       ├── SitemapView.vue        # Orphan pages + sitemap coverage
│       ├── HistoryView.vue        # Saved crawls + comparison
│       └── SettingsView.vue       # Crawl configuration
├── build/icon.png                 # App icon (1024×1024)
├── docs/architecture.md           # Architecture reference
├── index.html                     # Entry point
├── vite.config.ts                 # Vite + Electron + Tailwind config
└── package.json
```

---

## 🎯 How It Works

1. **Enter a URL** — type any website URL into the input bar
2. **Click "Start Crawl"** — Trawlr begins discovering pages using BFS traversal
3. **Watch live progress** — see pages discovered, crawled, and issues found in real time
4. **Review results** — switch between tabs to analyze broken links, redirects, and SEO issues
5. **Export to CSV** — save any report for further analysis

### Crawl Engine Architecture

```
Seed URL → URL Queue (BFS)
              ↓
    ┌─── Concurrency Pool (p-queue) ───┐
    │                                   │
    │  HTTP Request (HEAD → GET)        │
    │  ↓                                │
    │  Redirect Chain Tracking          │
    │  ↓                                │
    │  HTML Parsing (cheerio)           │
    │  ├── Link Extraction              │
    │  ├── Link Classification          │
    │  └── SEO Meta Tag Audit           │
    │                                   │
    └───────────────────────────────────┘
              ↓
    Results → IPC → Vue Renderer → Live UI Updates
```

---

## 🔧 Configuration

All settings are accessible from the **Settings** tab within the app:

| Setting | Default | Description |
|---|---|---|
| Concurrent Requests | 10 | Number of pages crawled simultaneously (1–50) |
| Max Pages | 800 | Total page limit before crawl stops |
| Rate Limit | 100ms | Delay between requests |
| Check External Links | Off | HTTP-check external links for broken status |
| Discover & Use Sitemap | On | Fetch the XML sitemap to seed the crawl and enable orphan analysis |
| User-Agent | Chrome 125 | HTTP User-Agent header (editable, resettable) |

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Inspired by [Screaming Frog SEO Spider](https://www.screamingfrog.co.uk/)
- Built with [Electron](https://www.electronjs.org/), [Vue 3](https://vuejs.org/), and [Tailwind CSS](https://tailwindcss.com/)
- HTML parsing powered by [cheerio](https://cheerio.js.org/)

---

<div align="center">

**⭐ Star this repo if Trawlr helps your SEO workflow!**

*Built with ❤️ for the SEO community*

</div>
