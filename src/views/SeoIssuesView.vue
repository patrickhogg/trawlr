<script setup lang="ts">
import { ref, computed } from 'vue'
import type { CrawledPage } from '../types'

const props = defineProps<{
  pages: CrawledPage[]
}>()

const filterText = ref('')

const filteredPages = computed(() => {
  if (!filterText.value) return props.pages
  const q = filterText.value.toLowerCase()
  return props.pages.filter((p) => p.url.toLowerCase().includes(q))
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
    <div class="view-header">
      <input
        id="filter-seo-issues"
        v-model="filterText"
        class="input input-sm filter-input"
        placeholder="Filter pages with SEO issues..."
      />
      <span class="result-count">{{ filteredPages.length }} pages with issues</span>
    </div>

    <div v-if="pages.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
      <p class="empty-title">No SEO issues found</p>
      <p class="empty-subtitle">SEO issues will appear here after a crawl</p>
    </div>

    <div v-else class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>URL</th>
            <th>Title</th>
            <th>Title Status</th>
            <th>Meta Description</th>
            <th>Description Status</th>
            <th>Keywords Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="page in filteredPages" :key="page.url">
            <td class="url-cell" :title="page.url">{{ page.url }}</td>
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
