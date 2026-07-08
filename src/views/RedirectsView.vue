<script setup lang="ts">
import type { DiscoveredLink } from '../types'
import { useDataTable, type FacetDef } from '../composables/useDataTable'
import TableToolbar from '../components/TableToolbar.vue'
import UrlCell from '../components/UrlCell.vue'

const props = defineProps<{
  links: DiscoveredLink[]
}>()

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
    key: 'finalStatus',
    label: 'Final Status',
    options: [
      { value: 'ok', label: '2xx OK', tone: 'pass' },
      { value: 'other', label: 'Non-2xx', tone: 'warning' },
    ],
    accessor: (l) => (l.statusCode >= 200 && l.statusCode < 300 ? 'ok' : 'other'),
  },
]

const table = useDataTable<DiscoveredLink>({
  rows: () => props.links,
  searchAccessors: (l) => [l.targetUrl, l.sourceUrl],
  sortAccessors: {
    target: (l) => l.targetUrl,
    type: (l) => l.type,
    status: (l) => l.statusCode,
    hops: (l) => l.redirectChain.length,
    source: (l) => l.sourceUrl,
  },
  facets,
  defaultSort: { key: 'target', dir: 'asc' },
  storageKey: 'trawlr.redirects',
})
</script>

<template>
  <div class="view-container animate-fade-in">
    <TableToolbar
      :table="table"
      :facets="facets"
      input-id="filter-redirects"
      search-placeholder="Filter redirects..."
      count-noun="redirects"
      count-tone="warning"
    />

    <div v-if="links.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon warning">
        <polyline points="15 14 20 9 15 4" />
        <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
      </svg>
      <p class="empty-title">No redirects found</p>
      <p class="empty-subtitle">Redirects will appear here after a crawl</p>
    </div>

    <div v-else-if="table.rows.value.length === 0" class="empty-state">
      <p class="empty-title">No redirects match your filters</p>
      <p class="empty-subtitle">Try clearing or adjusting the filters above</p>
    </div>

    <div v-else class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th class="sortable" :aria-sort="table.ariaSort('target')" @click="table.toggleSort('target')">Original URL{{ table.sortIndicator('target') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('type')" @click="table.toggleSort('type')">Type{{ table.sortIndicator('type') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('hops')" @click="table.toggleSort('hops')">Redirect Chain{{ table.sortIndicator('hops') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('status')" @click="table.toggleSort('status')">Final Status{{ table.sortIndicator('status') }}</th>
            <th class="sortable" :aria-sort="table.ariaSort('source')" @click="table.toggleSort('source')">Found On{{ table.sortIndicator('source') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(link, i) in table.rows.value" :key="i">
            <UrlCell :url="link.targetUrl" />
            <td>
              <span :class="link.type === 'internal' ? 'badge badge-internal' : 'badge badge-external'">
                {{ link.type }}
              </span>
            </td>
            <td class="chain-cell">
              <div class="redirect-chain">
                <div v-for="(hop, j) in link.redirectChain" :key="j" class="chain-hop">
                  <span class="badge badge-redirect">{{ hop.statusCode }}</span>
                  <span class="chain-url" :title="hop.url">{{ hop.url }}</span>
                  <svg v-if="j < link.redirectChain.length - 1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chain-arrow">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            </td>
            <td>
              <span class="badge" :class="link.statusCode >= 200 && link.statusCode < 300 ? 'badge-pass' : 'badge-warning'">
                {{ link.statusCode }}
              </span>
            </td>
            <UrlCell :url="link.sourceUrl" />
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.chain-cell {
  max-width: 500px;
}

.redirect-chain {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chain-hop {
  display: flex;
  align-items: center;
  gap: 6px;
}

.chain-url {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 350px;
}

.chain-arrow {
  color: var(--color-text-muted);
  flex-shrink: 0;
}
</style>
