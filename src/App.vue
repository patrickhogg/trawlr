<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import type {
  CrawlSettings,
  CrawlProgress,
  CrawledPage,
  CrawlResults,
  DiscoveredLink,
} from './types'
import CrawlControls from './components/CrawlControls.vue'
import ProgressBar from './components/ProgressBar.vue'
import AllPagesView from './views/AllPagesView.vue'
import BrokenLinksView from './views/BrokenLinksView.vue'
import RedirectsView from './views/RedirectsView.vue'
import SeoIssuesView from './views/SeoIssuesView.vue'
import SettingsView from './views/SettingsView.vue'

// ---- State ----
const activeTab = ref('all-pages')
const isCrawling = ref(false)
const pages = ref<CrawledPage[]>([])
const allLinks = ref<DiscoveredLink[]>([])
const progress = reactive<CrawlProgress>({
  status: 'idle',
  pagesDiscovered: 0,
  pagesCrawled: 0,
  maxPages: 800,
  brokenLinksCount: 0,
  redirectCount: 0,
  seoIssuesCount: 0,
  elapsedMs: 0,
})

const settings = reactive<CrawlSettings>({
  seedUrl: '',
  concurrency: 10,
  maxPages: 800,
  rateLimitMs: 100,
  checkExternalLinks: false,
  titleMinLength: 30,
  titleMaxLength: 60,
  descriptionMinLength: 120,
  descriptionMaxLength: 160,
  userAgent: '',
})

// ---- Computed ----
const brokenLinks = computed(() => allLinks.value.filter((l) => l.isBroken))
const redirectLinks = computed(() => allLinks.value.filter((l) => l.redirectChain.length > 0))
const seoIssuePages = computed(() =>
  pages.value.filter(
    (p) =>
      p.seo &&
      (p.seo.title.status !== 'pass' ||
        p.seo.metaDescription.status !== 'pass' ||
        p.seo.metaKeywords.status !== 'pass')
  )
)

const tabs = computed(() => [
  { id: 'all-pages', label: 'All Pages', count: pages.value.length },
  { id: 'broken-links', label: 'Broken Links', count: brokenLinks.value.length },
  { id: 'redirects', label: 'Redirects', count: redirectLinks.value.length },
  { id: 'seo-issues', label: 'SEO Issues', count: seoIssuePages.value.length },
  { id: 'settings', label: 'Settings', count: null },
])

// ---- Event Handlers ----
let unsubProgress: (() => void) | null = null
let unsubPage: (() => void) | null = null

onMounted(async () => {
  // Get default user agent
  const defaultUA = await window.spider.getDefaultUserAgent()
  if (!settings.userAgent) {
    settings.userAgent = defaultUA
  }

  // Subscribe to real-time events
  unsubProgress = window.spider.onProgress((p) => {
    Object.assign(progress, p)
  })

  unsubPage = window.spider.onPage((page) => {
    pages.value.push(page)
    for (const link of page.links) {
      allLinks.value.push(link)
    }
  })
})

onUnmounted(() => {
  unsubProgress?.()
  unsubPage?.()
})

async function handleStartCrawl(seedUrl: string) {
  // Reset state
  pages.value = []
  allLinks.value = []
  Object.assign(progress, {
    status: 'crawling',
    pagesDiscovered: 0,
    pagesCrawled: 0,
    maxPages: settings.maxPages,
    brokenLinksCount: 0,
    redirectCount: 0,
    seoIssuesCount: 0,
    elapsedMs: 0,
  })

  isCrawling.value = true
  settings.seedUrl = seedUrl

  try {
    const response = await window.spider.startCrawl({ ...settings })
    if (response.success && response.results) {
      pages.value = response.results.pages
      allLinks.value = response.results.allLinks
      Object.assign(progress, response.results.progress)
    }
  } catch (err: any) {
    console.error('Crawl error:', err)
  } finally {
    isCrawling.value = false
  }
}

async function handleCancelCrawl() {
  await window.spider.cancelCrawl()
  isCrawling.value = false
}

async function handleExportCsv(type: string) {
  await window.spider.exportCsv(type)
}

function handleSettingsUpdate(newSettings: Partial<CrawlSettings>) {
  Object.assign(settings, newSettings)
}
</script>

<template>
  <div class="app-container">
    <!-- Header -->
    <header class="app-header glass-strong">
      <div class="header-left">
        <div class="logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="logo-icon">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
          <h1 class="app-title">Trawlr</h1>
          <span class="app-subtitle">Web Crawler & Link Auditor</span>
        </div>
      </div>

      <CrawlControls
        :is-crawling="isCrawling"
        @start="handleStartCrawl"
        @cancel="handleCancelCrawl"
      />
    </header>

    <!-- Progress -->
    <ProgressBar :progress="progress" :is-crawling="isCrawling" />

    <!-- Tab Navigation -->
    <nav class="tab-nav">
      <div class="tab-list">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :id="`tab-${tab.id}`"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
          <span
            v-if="tab.count !== null"
            class="tab-count"
            :class="{
              'count-danger': tab.id === 'broken-links' && tab.count > 0,
              'count-warning': (tab.id === 'seo-issues' || tab.id === 'redirects') && tab.count > 0,
            }"
          >
            {{ tab.count }}
          </span>
        </button>
      </div>

      <button
        v-if="pages.length > 0"
        class="btn btn-ghost btn-sm"
        @click="handleExportCsv(activeTab)"
        id="export-csv-btn"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Export CSV
      </button>
    </nav>

    <!-- Tab Content -->
    <main class="tab-content">
      <AllPagesView v-if="activeTab === 'all-pages'" :pages="pages" />
      <BrokenLinksView v-if="activeTab === 'broken-links'" :links="brokenLinks" />
      <RedirectsView v-if="activeTab === 'redirects'" :links="redirectLinks" />
      <SeoIssuesView v-if="activeTab === 'seo-issues'" :pages="seoIssuePages" />
      <SettingsView
        v-if="activeTab === 'settings'"
        :settings="settings"
        :is-crawling="isCrawling"
        @update="handleSettingsUpdate"
      />
    </main>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* Header */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border);
  gap: 16px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  color: var(--color-accent);
  flex-shrink: 0;
}

.app-title {
  font-size: 1.25rem;
  font-weight: 700;
  background: linear-gradient(135deg, #38bdf8, #818cf8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.app-subtitle {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  font-weight: 400;
  padding-left: 10px;
  border-left: 1px solid var(--color-border);
}

/* Tab Navigation */
.tab-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  flex-shrink: 0;
}

.tab-list {
  display: flex;
  gap: 0;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  font-family: var(--font-sans);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.tab-btn:hover {
  color: var(--color-text-primary);
  background: rgba(56, 189, 248, 0.04);
}

.tab-btn.active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  font-size: 0.6875rem;
  font-weight: 600;
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.count-danger {
  background: rgba(248, 113, 113, 0.2);
  color: var(--color-danger);
}

.count-warning {
  background: rgba(251, 191, 36, 0.2);
  color: var(--color-warning);
}

/* Tab Content */
.tab-content {
  flex: 1;
  overflow: auto;
  padding: 0;
}
</style>
