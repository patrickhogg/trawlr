<script setup lang="ts">
import type { DiscoveredLink } from '../types'
import { useDataTable, type FacetDef } from '../composables/useDataTable'
import TableToolbar from '../components/TableToolbar.vue'
import UrlCell from '../components/UrlCell.vue'

const props = defineProps<{
  links: DiscoveredLink[]
}>()

function statusBucket(code: number): string {
  if (code >= 400 && code < 500) return '4xx'
  if (code >= 500) return '5xx'
  return 'err'
}

const facets: Array<FacetDef<DiscoveredLink>> = [
  {
    key: 'type',
    label: 'Type',
    options: [
      { value: 'internal', label: 'Internal', tone: 'internal' },
      { value: 'external', label: 'External', tone: 'external' },
    ],
    accessor: (l) => l.type,
  },
  {
    key: 'statusBucket',
    label: 'Status',
    options: [
      { value: '4xx', label: '4xx', tone: 'missing' },
      { value: '5xx', label: '5xx', tone: 'missing' },
      { value: 'err', label: 'Error', tone: 'missing' },
    ],
    accessor: (l) => statusBucket(l.statusCode),
  },
]

const table = useDataTable<DiscoveredLink>({
  rows: () => props.links,
  searchAccessors: (l) => [l.targetUrl, l.sourceUrl, l.anchorText],
  sortAccessors: {
    target: (l) => l.targetUrl,
    status: (l) => l.statusCode,
    type: (l) => l.type,
    source: (l) => l.sourceUrl,
    anchor: (l) => l.anchorText,
  },
  facets,
  defaultSort: { key: 'target', dir: 'asc' },
  storageKey: 'trawlr.broken-links',
})
</script>

<template>
  <div class="view-container animate-fade-in">
    <TableToolbar
      :table="table"
      :facets="facets"
      input-id="filter-broken-links"
      search-placeholder="Filter broken links..."
      count-noun="broken links"
      count-tone="danger"
    />

    <div v-if="links.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon success">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        <line x1="4" y1="4" x2="20" y2="20" stroke-dasharray="4 2" />
      </svg>
      <p class="empty-title">No broken links found</p>
      <p class="empty-subtitle">Broken links will appear here after a crawl</p>
    </div>

    <div v-else-if="table.rows.value.length === 0" class="empty-state">
      <p class="empty-title">No links match your filters</p>
      <p class="empty-subtitle">Try clearing or adjusting the filters above</p>
    </div>

    <div v-else class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th class="sortable" :aria-sort="table.ariaSort('target')" @click="table.toggleSort('target')">Broken URL{{ table.sortIndicator('target') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('status')" @click="table.toggleSort('status')">Status{{ table.sortIndicator('status') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('type')" @click="table.toggleSort('type')">Type{{ table.sortIndicator('type') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('source')" @click="table.toggleSort('source')">Found On{{ table.sortIndicator('source') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('anchor')" @click="table.toggleSort('anchor')">Anchor Text{{ table.sortIndicator('anchor') }}</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(link, i) in table.rows.value" :key="i">
            <UrlCell :url="link.targetUrl" />
            <td>
              <span class="badge badge-broken">
                {{ link.statusCode || 'ERR' }}
              </span>
            </td>
            <td>
              <span :class="link.type === 'internal' ? 'badge badge-internal' : 'badge badge-external'">
                {{ link.type }}
              </span>
            </td>
            <UrlCell :url="link.sourceUrl" />
            <td :title="link.anchorText">{{ link.anchorText || '—' }}</td>
            <td class="error-cell">{{ link.error || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.error-cell {
  color: var(--color-danger);
  font-size: 0.75rem;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
