<script setup lang="ts">
import { ref } from 'vue'
import type { CrawledPage, DiscoveredLink, SavedCrawlMeta } from '../types'
import { diffCrawls, type CrawlDiff } from '../lib/diff'

const props = defineProps<{
  crawls: SavedCrawlMeta[]
  currentPages: CrawledPage[]
  currentLinks: DiscoveredLink[]
  hasCurrent: boolean
}>()

const emit = defineEmits<{
  load: [id: string]
  delete: [id: string]
}>()

const baselineMeta = ref<SavedCrawlMeta | null>(null)
const diff = ref<CrawlDiff | null>(null)
const comparing = ref(false)

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

async function compareToCurrent(meta: SavedCrawlMeta) {
  if (!props.hasCurrent) return
  comparing.value = true
  try {
    const saved = await window.spider.loadCrawl(meta.id)
    if (!saved) return
    baselineMeta.value = meta
    diff.value = diffCrawls(
      { pages: props.currentPages, allLinks: props.currentLinks },
      { pages: saved.results.pages, allLinks: saved.results.allLinks }
    )
  } finally {
    comparing.value = false
  }
}

function clearCompare() {
  diff.value = null
  baselineMeta.value = null
}
</script>

<template>
  <div class="view-container animate-fade-in">
    <div v-if="crawls.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
        <path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" />
      </svg>
      <p class="empty-title">No saved crawls yet</p>
      <p class="empty-subtitle">Completed crawls are saved here automatically</p>
    </div>

    <template v-else>
      <div class="view-header">
        <span class="result-count muted">{{ crawls.length }} saved crawl{{ crawls.length === 1 ? '' : 's' }}</span>
      </div>

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Site</th>
              <th>Pages</th>
              <th>Broken</th>
              <th>Redirects</th>
              <th>SEO Issues</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in crawls" :key="c.id">
              <td class="nowrap">{{ formatDate(c.savedAt) }}</td>
              <td class="url-cell" :title="c.seedUrl">{{ c.seedUrl }}</td>
              <td>{{ c.pageCount }}</td>
              <td :class="{ 'text-danger': c.brokenCount > 0 }">{{ c.brokenCount }}</td>
              <td>{{ c.redirectCount }}</td>
              <td :class="{ 'text-warning': c.seoIssueCount > 0 }">{{ c.seoIssueCount }}</td>
              <td class="actions">
                <button class="btn btn-ghost btn-sm" @click="emit('load', c.id)">Load</button>
                <button
                  class="btn btn-ghost btn-sm"
                  :disabled="!hasCurrent || comparing"
                  :title="hasCurrent ? 'Compare against the currently loaded crawl' : 'Load or run a crawl first'"
                  @click="compareToCurrent(c)"
                >Compare</button>
                <button class="btn btn-ghost btn-sm danger" @click="emit('delete', c.id)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Comparison panel -->
        <div v-if="diff && baselineMeta" class="compare-panel">
          <div class="compare-head">
            <div>
              <span class="compare-title">Comparison</span>
              <span class="compare-sub">current vs. {{ formatDate(baselineMeta.savedAt) }}</span>
            </div>
            <button class="btn btn-ghost btn-sm" @click="clearCompare">Close</button>
          </div>

          <div class="diff-grid">
            <div class="diff-stat good"><span class="diff-num">+{{ diff.pagesAdded.length }}</span><span>pages added</span></div>
            <div class="diff-stat bad"><span class="diff-num">−{{ diff.pagesRemoved.length }}</span><span>pages removed</span></div>
            <div class="diff-stat bad"><span class="diff-num">+{{ diff.brokenAdded.length }}</span><span>new broken links</span></div>
            <div class="diff-stat good"><span class="diff-num">−{{ diff.brokenResolved.length }}</span><span>broken resolved</span></div>
            <div class="diff-stat bad"><span class="diff-num">{{ diff.seoRegressed.length }}</span><span>SEO regressed</span></div>
            <div class="diff-stat good"><span class="diff-num">{{ diff.seoImproved.length }}</span><span>SEO improved</span></div>
            <div class="diff-stat"><span class="diff-num">{{ diff.statusChanged.length }}</span><span>status changed</span></div>
          </div>

          <div v-if="diff.brokenAdded.length" class="diff-list">
            <p class="diff-list-title bad">New broken links</p>
            <ul>
              <li v-for="(l, i) in diff.brokenAdded.slice(0, 50)" :key="i" :title="l.targetUrl">
                <span class="badge badge-broken">{{ l.statusCode || 'ERR' }}</span> {{ l.targetUrl }}
              </li>
            </ul>
            <p v-if="diff.brokenAdded.length > 50" class="diff-more">…and {{ diff.brokenAdded.length - 50 }} more</p>
          </div>

          <div v-if="diff.statusChanged.length" class="diff-list">
            <p class="diff-list-title">Status code changes</p>
            <ul>
              <li v-for="(c, i) in diff.statusChanged.slice(0, 50)" :key="i" :title="c.url">
                <span class="badge badge-warning">{{ c.from }} → {{ c.to }}</span> {{ c.url }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.view-header {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.result-count.muted {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
}

.nowrap { white-space: nowrap; color: var(--color-text-secondary); }
.text-danger { color: var(--color-danger); font-weight: 600; }
.text-warning { color: var(--color-warning); font-weight: 600; }

.actions {
  display: flex;
  gap: 6px;
}

.btn-ghost.danger:hover:not(:disabled) {
  color: var(--color-danger);
  border-color: rgba(248, 113, 113, 0.4);
}

.compare-panel {
  margin: 16px 20px 24px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg-secondary);
  overflow: hidden;
}

.compare-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.compare-title { font-weight: 700; margin-right: 8px; }
.compare-sub { color: var(--color-text-muted); font-size: 0.8125rem; }

.diff-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  padding: 16px;
}

.diff-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--color-bg-primary);
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.diff-num { font-size: 1.25rem; font-weight: 700; color: var(--color-text-primary); }
.diff-stat.good .diff-num { color: var(--color-success); }
.diff-stat.bad .diff-num { color: var(--color-danger); }

.diff-list {
  padding: 0 16px 16px;
}

.diff-list-title {
  font-weight: 600;
  font-size: 0.8125rem;
  margin-bottom: 6px;
}

.diff-list-title.bad { color: var(--color-danger); }

.diff-list ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.diff-list li {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diff-more { color: var(--color-text-muted); font-size: 0.75rem; margin-top: 4px; }
</style>
