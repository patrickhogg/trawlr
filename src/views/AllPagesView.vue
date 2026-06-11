<script setup lang="ts">
import { ref, computed } from 'vue'
import type { CrawledPage } from '../types'

const props = defineProps<{
  pages: CrawledPage[]
}>()

const sortKey = ref<string>('url')
const sortDir = ref<'asc' | 'desc'>('asc')
const filterText = ref('')

const filteredPages = computed(() => {
  let result = props.pages
  if (filterText.value) {
    const q = filterText.value.toLowerCase()
    result = result.filter(
      (p) =>
        p.url.toLowerCase().includes(q) ||
        (p.seo?.title.value || '').toLowerCase().includes(q)
    )
  }
  return result.slice().sort((a, b) => {
    let aVal: any, bVal: any
    switch (sortKey.value) {
      case 'url': aVal = a.url; bVal = b.url; break
      case 'status': aVal = a.statusCode; bVal = b.statusCode; break
      case 'title': aVal = a.seo?.title.value || ''; bVal = b.seo?.title.value || ''; break
      case 'titleStatus': aVal = a.seo?.title.status || ''; bVal = b.seo?.title.status || ''; break
      case 'descStatus': aVal = a.seo?.metaDescription.status || ''; bVal = b.seo?.metaDescription.status || ''; break
      case 'kwStatus': aVal = a.seo?.metaKeywords.status || ''; bVal = b.seo?.metaKeywords.status || ''; break
      case 'links': aVal = a.links.length; bVal = b.links.length; break
      default: aVal = a.url; bVal = b.url
    }
    if (aVal < bVal) return sortDir.value === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDir.value === 'asc' ? 1 : -1
    return 0
  })
})

function toggleSort(key: string) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

function sortIndicator(key: string): string {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'asc' ? ' ↑' : ' ↓'
}

function statusBadgeClass(code: number): string {
  if (code >= 200 && code < 300) return 'badge badge-pass'
  if (code >= 300 && code < 400) return 'badge badge-redirect'
  if (code >= 400) return 'badge badge-broken'
  return 'badge'
}

function seoBadgeClass(status: string): string {
  switch (status) {
    case 'pass': return 'badge badge-pass'
    case 'warning': return 'badge badge-warning'
    case 'missing': return 'badge badge-missing'
    default: return 'badge'
  }
}

function seoStatusIcon(status: string): string {
  switch (status) {
    case 'pass': return '✓'
    case 'warning': return '⚠'
    case 'missing': return '✕'
    default: return '?'
  }
}
</script>

<template>
  <div class="view-container animate-fade-in">
    <div class="view-header">
      <input
        id="filter-all-pages"
        v-model="filterText"
        class="input input-sm filter-input"
        placeholder="Filter pages by URL or title..."
      />
      <span class="result-count">{{ filteredPages.length }} pages</span>
    </div>

    <div v-if="pages.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
      <p class="empty-title">No pages crawled yet</p>
      <p class="empty-subtitle">Enter a URL and start a crawl to see results</p>
    </div>

    <div v-else class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th @click="toggleSort('url')">URL{{ sortIndicator('url') }}</th>
            <th @click="toggleSort('status')">Status{{ sortIndicator('status') }}</th>
            <th @click="toggleSort('title')">Title{{ sortIndicator('title') }}</th>
            <th @click="toggleSort('titleStatus')">Title{{ sortIndicator('titleStatus') }}</th>
            <th @click="toggleSort('descStatus')">Description{{ sortIndicator('descStatus') }}</th>
            <th @click="toggleSort('kwStatus')">Keywords{{ sortIndicator('kwStatus') }}</th>
            <th @click="toggleSort('links')">Links{{ sortIndicator('links') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="page in filteredPages" :key="page.url">
            <td class="url-cell" :title="page.url">{{ page.url }}</td>
            <td>
              <span :class="statusBadgeClass(page.statusCode)">{{ page.statusCode }}</span>
            </td>
            <td :title="page.seo?.title.value || 'N/A'">
              {{ page.seo?.title.value || '—' }}
            </td>
            <td>
              <span v-if="page.seo" :class="seoBadgeClass(page.seo.title.status)" :title="page.seo.title.message">
                {{ seoStatusIcon(page.seo.title.status) }} {{ page.seo.title.status }}
              </span>
              <span v-else class="text-muted">—</span>
            </td>
            <td>
              <span v-if="page.seo" :class="seoBadgeClass(page.seo.metaDescription.status)" :title="page.seo.metaDescription.message">
                {{ seoStatusIcon(page.seo.metaDescription.status) }} {{ page.seo.metaDescription.status }}
              </span>
              <span v-else class="text-muted">—</span>
            </td>
            <td>
              <span v-if="page.seo" :class="seoBadgeClass(page.seo.metaKeywords.status)" :title="page.seo.metaKeywords.message">
                {{ seoStatusIcon(page.seo.metaKeywords.status) }} {{ page.seo.metaKeywords.status }}
              </span>
              <span v-else class="text-muted">—</span>
            </td>
            <td>{{ page.links.length }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.filter-input {
  max-width: 350px;
}

.result-count {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
}

.table-wrapper {
  flex: 1;
  overflow: auto;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
}

.empty-icon {
  color: var(--color-text-muted);
  opacity: 0.4;
}

.empty-title {
  color: var(--color-text-secondary);
  font-size: 1rem;
  font-weight: 600;
}

.empty-subtitle {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.text-muted {
  color: var(--color-text-muted);
}
</style>
