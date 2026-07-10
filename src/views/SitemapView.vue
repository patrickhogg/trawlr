<script setup lang="ts">
import { ref, computed } from 'vue'
import type { CrawledPage } from '../types'
import type { SitemapCoverage } from '../lib/analysis'
import UrlCell from '../components/UrlCell.vue'

const props = defineProps<{
  coverage: SitemapCoverage
  hasCrawled: boolean
}>()

type Section = 'orphans' | 'missing' | 'notInSitemap'
const section = ref<Section>('orphans')

const sections = computed(() => [
  { id: 'orphans' as Section, label: 'Orphan pages', count: props.coverage.orphans.length, hint: 'Crawled pages with no internal links pointing to them' },
  { id: 'missing' as Section, label: 'In sitemap, not crawled', count: props.coverage.inSitemapNotCrawled.length, hint: 'Sitemap URLs the crawl never reached (blocked, errored, or unreachable)' },
  { id: 'notInSitemap' as Section, label: 'Crawled, not in sitemap', count: props.coverage.crawledNotInSitemap.length, hint: 'Pages found by crawling that are absent from the sitemap' },
])

const activeHint = computed(() => sections.value.find((s) => s.id === section.value)?.hint ?? '')

function pageList(): CrawledPage[] {
  if (section.value === 'orphans') return props.coverage.orphans
  if (section.value === 'notInSitemap') return props.coverage.crawledNotInSitemap
  return []
}
</script>

<template>
  <div class="view-container animate-fade-in">
    <div v-if="!hasCrawled" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
      <p class="empty-title">No sitemap data yet</p>
      <p class="empty-subtitle">Run a crawl — the sitemap is fetched automatically</p>
    </div>

    <template v-else>
      <div class="sitemap-header">
        <div class="stat-cards">
          <div class="stat-card">
            <span class="stat-value">{{ coverage.sitemapCount }}</span>
            <span class="stat-label">URLs in sitemap</span>
          </div>
          <div class="stat-card" :class="{ alert: coverage.orphans.length > 0 }">
            <span class="stat-value">{{ coverage.orphans.length }}</span>
            <span class="stat-label">Orphan pages</span>
          </div>
          <div class="stat-card" :class="{ alert: coverage.inSitemapNotCrawled.length > 0 }">
            <span class="stat-value">{{ coverage.inSitemapNotCrawled.length }}</span>
            <span class="stat-label">In sitemap, not crawled</span>
          </div>
        </div>
      </div>

      <div class="sub-tabs">
        <button
          v-for="s in sections"
          :key="s.id"
          class="sub-tab"
          :class="{ active: section === s.id }"
          @click="section = s.id"
        >
          {{ s.label }}
          <span class="sub-tab-count">{{ s.count }}</span>
        </button>
      </div>
      <p class="section-hint">{{ activeHint }}</p>

      <div v-if="coverage.sitemapCount === 0 && section === 'missing'" class="empty-state">
        <p class="empty-title">No sitemap found</p>
        <p class="empty-subtitle">No sitemap.xml was discovered via robots.txt or the conventional path</p>
      </div>

      <!-- URL-string list (sitemap URLs not crawled) -->
      <div v-else-if="section === 'missing'" class="table-wrapper">
        <div v-if="coverage.inSitemapNotCrawled.length === 0" class="empty-state">
          <p class="empty-title">Full coverage</p>
          <p class="empty-subtitle">Every sitemap URL was crawled</p>
        </div>
        <table v-else class="data-table">
          <thead><tr><th>Sitemap URL (not crawled)</th></tr></thead>
          <tbody>
            <tr v-for="url in coverage.inSitemapNotCrawled" :key="url">
              <UrlCell :url="url" />
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Page lists (orphans / crawled-not-in-sitemap) -->
      <div v-else class="table-wrapper">
        <div v-if="pageList().length === 0" class="empty-state">
          <p class="empty-title">Nothing to show</p>
          <p class="empty-subtitle">
            {{ section === 'orphans' ? 'Every crawled page has at least one internal inlink' : 'Every crawled page is present in the sitemap' }}
          </p>
        </div>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>URL</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="page in pageList()" :key="page.url">
              <UrlCell :url="page.url" />
              <td><span class="badge" :class="page.statusCode >= 200 && page.statusCode < 300 ? 'badge-pass' : 'badge-broken'">{{ page.statusCode || 'ERR' }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.sitemap-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.stat-cards {
  display: flex;
  gap: 12px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 16px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  min-width: 130px;
}

.stat-card.alert {
  border-color: rgba(251, 191, 36, 0.4);
}

.stat-value {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.stat-card.alert .stat-value {
  color: var(--color-warning);
}

.stat-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.sub-tabs {
  display: flex;
  gap: 4px;
  padding: 12px 20px 0;
  flex-shrink: 0;
}

.sub-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-secondary);
  font-size: 0.8125rem;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all 0.15s ease;
}

.sub-tab:hover { color: var(--color-text-primary); }

.sub-tab.active {
  color: var(--color-accent);
  border-color: var(--color-accent);
  background: rgba(56, 189, 248, 0.08);
}

.sub-tab-count {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--color-bg-hover);
}

.section-hint {
  padding: 8px 20px 12px;
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  flex-shrink: 0;
}
</style>
