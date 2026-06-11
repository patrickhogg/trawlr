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
      l.sourceUrl.toLowerCase().includes(q) ||
      l.anchorText.toLowerCase().includes(q)
  )
})
</script>

<template>
  <div class="view-container animate-fade-in">
    <div class="view-header">
      <input
        id="filter-broken-links"
        v-model="filterText"
        class="input input-sm filter-input"
        placeholder="Filter broken links..."
      />
      <span class="result-count">{{ filteredLinks.length }} broken links</span>
    </div>

    <div v-if="links.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        <line x1="4" y1="4" x2="20" y2="20" stroke-dasharray="4 2" />
      </svg>
      <p class="empty-title">No broken links found</p>
      <p class="empty-subtitle" v-if="links.length === 0 && $parent">
        {{ links.length === 0 ? 'Broken links will appear here after a crawl' : 'All links are healthy!' }}
      </p>
    </div>

    <div v-else class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Broken URL</th>
            <th>Status</th>
            <th>Type</th>
            <th>Found On</th>
            <th>Anchor Text</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(link, i) in filteredLinks" :key="i">
            <td class="url-cell" :title="link.targetUrl">{{ link.targetUrl }}</td>
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
            <td class="url-cell" :title="link.sourceUrl">{{ link.sourceUrl }}</td>
            <td :title="link.anchorText">{{ link.anchorText || '—' }}</td>
            <td class="error-cell">{{ link.error || '—' }}</td>
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
  color: var(--color-danger);
  font-size: 0.8125rem;
  font-weight: 600;
}

.table-wrapper {
  flex: 1;
  overflow: auto;
}

.error-cell {
  color: var(--color-danger);
  font-size: 0.75rem;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
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
  color: var(--color-success);
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
