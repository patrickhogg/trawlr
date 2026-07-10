<script setup lang="ts">
import type { CrawledPage, SeoStatus } from '../types'
import { useDataTable, type FacetDef } from '../composables/useDataTable'
import TableToolbar from '../components/TableToolbar.vue'
import UrlCell from '../components/UrlCell.vue'
import { type DuplicateSets, isDuplicateTitle, isDuplicateDescription } from '../lib/analysis'

const props = defineProps<{
  pages: CrawledPage[]
  duplicates: DuplicateSets
}>()

function dupTags(p: CrawledPage): string[] {
  const tags: string[] = []
  if (isDuplicateTitle(p, props.duplicates)) tags.push('title')
  if (isDuplicateDescription(p, props.duplicates)) tags.push('desc')
  return tags
}

const statusOptions = [
  { value: 'pass', label: 'Pass', tone: 'pass' as const },
  { value: 'warning', label: 'Warning', tone: 'warning' as const },
  { value: 'missing', label: 'Missing', tone: 'missing' as const },
]
const passWarnOptions = [
  { value: 'pass', label: 'Pass', tone: 'pass' as const },
  { value: 'warning', label: 'Warning', tone: 'warning' as const },
]

const facets: Array<FacetDef<CrawledPage>> = [
  { key: 'titleStatus', label: 'Title', options: statusOptions, accessor: (p) => p.seo?.title.status },
  { key: 'descStatus', label: 'Description', options: statusOptions, accessor: (p) => p.seo?.metaDescription.status },
  { key: 'h1Status', label: 'H1', options: statusOptions, accessor: (p) => p.seo?.h1.status },
  { key: 'canonicalStatus', label: 'Canonical', options: passWarnOptions, accessor: (p) => p.seo?.canonical.status },
  { key: 'imagesStatus', label: 'Images', options: passWarnOptions, accessor: (p) => p.seo?.images.status },
  {
    key: 'indexability',
    label: 'Indexability',
    options: [
      { value: 'indexable', label: 'Indexable', tone: 'pass' },
      { value: 'noindex', label: 'Noindex', tone: 'missing' },
    ],
    accessor: (p) => (p.seo ? (p.seo.indexability.indexable ? 'indexable' : 'noindex') : undefined),
  },
  {
    key: 'duplicate',
    label: 'Duplicate',
    options: [
      { value: 'title', label: 'Dup title', tone: 'warning' },
      { value: 'desc', label: 'Dup description', tone: 'warning' },
    ],
    accessor: (p) => dupTags(p),
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
    h1Status: (p) => p.seo?.h1.status ?? '',
    canonicalStatus: (p) => p.seo?.canonical.status ?? '',
    imagesStatus: (p) => p.seo?.images.missingAlt ?? 0,
    indexable: (p) => (p.seo?.indexability.indexable ? 1 : 0),
    words: (p) => p.seo?.wordCount ?? 0,
  },
  facets,
  defaultSort: { key: 'url', dir: 'asc' },
  storageKey: 'trawlr.seo-issues',
})

function badgeClass(status: SeoStatus | undefined): string {
  switch (status) {
    case 'pass': return 'badge badge-pass'
    case 'warning': return 'badge badge-warning'
    case 'missing': return 'badge badge-missing'
    default: return 'badge'
  }
}

function icon(status: SeoStatus | undefined): string {
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
      search-placeholder="Filter by URL, title, or description..."
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
            <th class="sortable" :aria-sort="table.ariaSort('titleStatus')" @click="table.toggleSort('titleStatus')">Title{{ table.sortIndicator('titleStatus') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('descStatus')" @click="table.toggleSort('descStatus')">Desc{{ table.sortIndicator('descStatus') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('h1Status')" @click="table.toggleSort('h1Status')">H1{{ table.sortIndicator('h1Status') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('canonicalStatus')" @click="table.toggleSort('canonicalStatus')">Canonical{{ table.sortIndicator('canonicalStatus') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('imagesStatus')" @click="table.toggleSort('imagesStatus')">Images{{ table.sortIndicator('imagesStatus') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('indexable')" @click="table.toggleSort('indexable')">Index{{ table.sortIndicator('indexable') }}</th>
            <th>Duplicate</th>
            <th class="sortable" :aria-sort="table.ariaSort('words')" @click="table.toggleSort('words')">Words{{ table.sortIndicator('words') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="page in table.rows.value" :key="page.url">
            <UrlCell :url="page.url" />
            <td class="content-cell" :title="page.seo?.title.value || ''">{{ page.seo?.title.value || '—' }}</td>
            <td>
              <span v-if="page.seo" :class="badgeClass(page.seo.title.status)" :title="page.seo.title.message">
                {{ icon(page.seo.title.status) }}<span v-if="page.seo.title.length" class="badge-detail"> {{ page.seo.title.length }}</span>
              </span>
            </td>
            <td>
              <span v-if="page.seo" :class="badgeClass(page.seo.metaDescription.status)" :title="page.seo.metaDescription.message">
                {{ icon(page.seo.metaDescription.status) }}<span v-if="page.seo.metaDescription.length" class="badge-detail"> {{ page.seo.metaDescription.length }}</span>
              </span>
            </td>
            <td>
              <span v-if="page.seo" :class="badgeClass(page.seo.h1.status)" :title="page.seo.h1.message">
                {{ icon(page.seo.h1.status) }}<span v-if="page.seo.h1.count > 1" class="badge-detail"> {{ page.seo.h1.count }}</span>
              </span>
            </td>
            <td>
              <span v-if="page.seo" :class="badgeClass(page.seo.canonical.status)" :title="page.seo.canonical.message">
                {{ icon(page.seo.canonical.status) }}
              </span>
            </td>
            <td>
              <span v-if="page.seo" :class="badgeClass(page.seo.images.status)" :title="page.seo.images.message">
                {{ icon(page.seo.images.status) }}<span v-if="page.seo.images.missingAlt" class="badge-detail"> {{ page.seo.images.missingAlt }}</span>
              </span>
            </td>
            <td>
              <span v-if="page.seo" :class="page.seo.indexability.indexable ? 'badge badge-pass' : 'badge badge-missing'" :title="page.seo.indexability.message">
                {{ page.seo.indexability.indexable ? '✓' : 'noindex' }}
              </span>
            </td>
            <td>
              <span v-for="tag in dupTags(page)" :key="tag" class="badge badge-warning dup-badge">
                {{ tag === 'title' ? 'title' : 'desc' }}
              </span>
              <span v-if="dupTags(page).length === 0" class="text-muted">—</span>
            </td>
            <td class="num-cell">{{ page.seo?.wordCount ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.content-cell {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.badge-detail {
  opacity: 0.7;
  font-size: 0.65rem;
}

.dup-badge {
  margin-right: 3px;
}

.num-cell {
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary);
}
</style>
