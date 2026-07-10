<script setup lang="ts">
import type { CrawledPage } from '../types'
import { useDataTable, type FacetDef } from '../composables/useDataTable'
import TableToolbar from '../components/TableToolbar.vue'
import UrlCell from '../components/UrlCell.vue'
import { inlinkCountFor } from '../lib/analysis'

const props = defineProps<{
  pages: CrawledPage[]
  inlinks: Map<string, number>
}>()

function statusBucket(code: number): string {
  if (code >= 200 && code < 300) return '2xx'
  if (code >= 300 && code < 400) return '3xx'
  if (code >= 400 && code < 500) return '4xx'
  if (code >= 500) return '5xx'
  return 'other'
}

const facets: Array<FacetDef<CrawledPage>> = [
  {
    key: 'statusBucket',
    label: 'Status',
    options: [
      { value: '2xx', label: '2xx', tone: 'pass' },
      { value: '3xx', label: '3xx', tone: 'redirect' },
      { value: '4xx', label: '4xx', tone: 'missing' },
      { value: '5xx', label: '5xx', tone: 'missing' },
    ],
    accessor: (p) => statusBucket(p.statusCode),
  },
  {
    key: 'titleStatus',
    label: 'Title',
    options: [
      { value: 'pass', label: 'Pass', tone: 'pass' },
      { value: 'warning', label: 'Warning', tone: 'warning' },
      { value: 'missing', label: 'Missing', tone: 'missing' },
    ],
    accessor: (p) => p.seo?.title.status,
  },
  {
    key: 'descStatus',
    label: 'Description',
    options: [
      { value: 'pass', label: 'Pass', tone: 'pass' },
      { value: 'warning', label: 'Warning', tone: 'warning' },
      { value: 'missing', label: 'Missing', tone: 'missing' },
    ],
    accessor: (p) => p.seo?.metaDescription.status,
  },
  {
    key: 'kwStatus',
    label: 'Keywords',
    options: [
      { value: 'pass', label: 'Pass', tone: 'pass' },
      { value: 'missing', label: 'Missing', tone: 'missing' },
    ],
    accessor: (p) => p.seo?.metaKeywords.status,
  },
]

const table = useDataTable<CrawledPage>({
  rows: () => props.pages,
  searchAccessors: (p) => [p.url, p.seo?.title.value],
  sortAccessors: {
    url: (p) => p.url,
    status: (p) => p.statusCode,
    title: (p) => p.seo?.title.value ?? '',
    titleStatus: (p) => p.seo?.title.status ?? '',
    descStatus: (p) => p.seo?.metaDescription.status ?? '',
    kwStatus: (p) => p.seo?.metaKeywords.status ?? '',
    links: (p) => p.links.length,
    inlinks: (p) => inlinkCountFor(p, props.inlinks),
  },
  facets,
  defaultSort: { key: 'url', dir: 'asc' },
  storageKey: 'trawlr.all-pages',
})

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
    <TableToolbar
      :table="table"
      :facets="facets"
      input-id="filter-all-pages"
      search-placeholder="Filter pages by URL or title..."
      count-noun="pages"
      count-tone="muted"
    />

    <div v-if="pages.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
      <p class="empty-title">No pages crawled yet</p>
      <p class="empty-subtitle">Enter a URL and start a crawl to see results</p>
    </div>

    <div v-else-if="table.rows.value.length === 0" class="empty-state">
      <p class="empty-title">No pages match your filters</p>
      <p class="empty-subtitle">Try clearing or adjusting the filters above</p>
    </div>

    <div v-else class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th class="sortable" :aria-sort="table.ariaSort('url')" @click="table.toggleSort('url')">URL{{ table.sortIndicator('url') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('status')" @click="table.toggleSort('status')">Status{{ table.sortIndicator('status') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('title')" @click="table.toggleSort('title')">Title{{ table.sortIndicator('title') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('titleStatus')" @click="table.toggleSort('titleStatus')">Title{{ table.sortIndicator('titleStatus') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('descStatus')" @click="table.toggleSort('descStatus')">Description{{ table.sortIndicator('descStatus') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('kwStatus')" @click="table.toggleSort('kwStatus')">Keywords{{ table.sortIndicator('kwStatus') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('links')" @click="table.toggleSort('links')">Links{{ table.sortIndicator('links') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('inlinks')" @click="table.toggleSort('inlinks')" title="Internal links pointing to this page">Inlinks{{ table.sortIndicator('inlinks') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="page in table.rows.value" :key="page.url">
            <UrlCell :url="page.url" />
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
            <td :class="{ 'orphan-cell': inlinkCountFor(page, props.inlinks) === 0 }">
              {{ inlinkCountFor(page, props.inlinks) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.orphan-cell {
  color: var(--color-warning);
  font-weight: 600;
}
</style>
