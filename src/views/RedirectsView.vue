<script setup lang="ts">
import { ref, computed } from 'vue'
import type { DiscoveredLink } from '../types'

const props = defineProps<{
  links: DiscoveredLink[]
}>()

const filterText = ref('')

const filteredLinks = computed(() => {
  if (!filterText.value) return props.links
  const q = filterText.value.toLowerCase()
  return props.links.filter(
    (l) =>
      l.targetUrl.toLowerCase().includes(q) ||
      l.sourceUrl.toLowerCase().includes(q)
  )
})

function formatRedirectChain(link: DiscoveredLink): string {
  return link.redirectChain
    .map((hop) => `${hop.statusCode} → ${hop.url}`)
    .join('\n')
}
</script>

<template>
  <div class="view-container animate-fade-in">
    <div class="view-header">
      <input
        id="filter-redirects"
        v-model="filterText"
        class="input input-sm filter-input"
        placeholder="Filter redirects..."
      />
      <span class="result-count">{{ filteredLinks.length }} redirects</span>
    </div>

    <div v-if="links.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
        <polyline points="15 14 20 9 15 4" />
        <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
      </svg>
      <p class="empty-title">No redirects found</p>
      <p class="empty-subtitle">Redirects will appear here after a crawl</p>
    </div>

    <div v-else class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Original URL</th>
            <th>Type</th>
            <th>Redirect Chain</th>
            <th>Final Status</th>
            <th>Found On</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(link, i) in filteredLinks" :key="i">
            <td class="url-cell" :title="link.targetUrl">{{ link.targetUrl }}</td>
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
            <td class="url-cell" :title="link.sourceUrl">{{ link.sourceUrl }}</td>
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
  color: var(--color-warning);
  font-size: 0.8125rem;
  font-weight: 600;
}

.table-wrapper {
  flex: 1;
  overflow: auto;
}

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
  color: var(--color-warning);
  opacity: 0.5;
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
</style>
