<script setup lang="ts">
import type { CrawledPage } from '../types'
import { useDataTable, type FacetDef } from '../composables/useDataTable'
import TableToolbar from '../components/TableToolbar.vue'
import UrlCell from '../components/UrlCell.vue'

const props = defineProps<{
  pages: CrawledPage[]
}>()

const facets: Array<FacetDef<CrawledPage>> = [
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
  searchAccessors: (p) => [p.url, p.seo?.title.value, p.seo?.metaDescription.value],
  sortAccessors: {
    url: (p) => p.url,
    title: (p) => p.seo?.title.value ?? '',
    titleStatus: (p) => p.seo?.title.status ?? '',
    descStatus: (p) => p.seo?.metaDescription.status ?? '',
    kwStatus: (p) => p.seo?.metaKeywords.status ?? '',
  },
  facets,
  defaultSort: { key: 'url', dir: 'asc' },
  storageKey: 'trawlr.seo-issues',
})

function seoBadgeClass(status: string): string {
  switch (status) {
    case 'pass': return 'badge badge-pass'
    case 'warning': return 'badge badge-warning'
    case 'missing': return 'badge badge-missing'
    default: return 'badge'
  }
}

function seoIcon(status: string): string {
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
      input-id="filter-seo-issues"
      search-placeholder="Filter pages with SEO issues..."
      count-noun="pages with issues"
      count-tone="warning"
    />

    <div v-if="pages.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon success">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
      <p class="empty-title">No SEO issues found</p>
      <p class="empty-subtitle">SEO issues will appear here after a crawl</p>
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
            <th class="sortable" :aria-sort="table.ariaSort('title')" @click="table.toggleSort('title')">Title{{ table.sortIndicator('title') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('titleStatus')" @click="table.toggleSort('titleStatus')">Title Status{{ table.sortIndicator('titleStatus') }}</th>
            <th>Meta Description</th>
            <th class="sortable" :aria-sort="table.ariaSort('descStatus')" @click="table.toggleSort('descStatus')">Description Status{{ table.sortIndicator('descStatus') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('kwStatus')" @click="table.toggleSort('kwStatus')">Keywords Status{{ table.sortIndicator('kwStatus') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="page in table.rows.value" :key="page.url">
            <UrlCell :url="page.url" />
            <td class="content-cell" :title="page.seo?.title.value || ''">
              {{ page.seo?.title.value || '—' }}
            </td>
            <td>
              <span
                v-if="page.seo"
                :class="seoBadgeClass(page.seo.title.status)"
                :title="page.seo.title.message"
              >
                {{ seoIcon(page.seo.title.status) }} {{ page.seo.title.status }}
                <span v-if="page.seo.title.length" class="badge-detail">({{ page.seo.title.length }})</span>
              </span>
            </td>
            <td class="content-cell" :title="page.seo?.metaDescription.value || ''">
              {{ page.seo?.metaDescription.value || '—' }}
            </td>
            <td>
              <span
                v-if="page.seo"
                :class="seoBadgeClass(page.seo.metaDescription.status)"
                :title="page.seo.metaDescription.message"
              >
                {{ seoIcon(page.seo.metaDescription.status) }} {{ page.seo.metaDescription.status }}
                <span v-if="page.seo.metaDescription.length" class="badge-detail">({{ page.seo.metaDescription.length }})</span>
              </span>
            </td>
            <td>
              <span
                v-if="page.seo"
                :class="seoBadgeClass(page.seo.metaKeywords.status)"
                :title="page.seo.metaKeywords.message"
              >
                {{ seoIcon(page.seo.metaKeywords.status) }} {{ page.seo.metaKeywords.status }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.content-cell {
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.badge-detail {
  opacity: 0.7;
  font-size: 0.65rem;
  margin-left: 2px;
}
</style>
