<script setup lang="ts">
import { computed } from 'vue'
import type { CrawlProgress } from '../types'

const props = defineProps<{
  progress: CrawlProgress
  isCrawling: boolean
}>()

const progressPercent = computed(() => {
  if (props.progress.maxPages === 0) return 0
  return Math.min(100, (props.progress.pagesCrawled / props.progress.maxPages) * 100)
})

const elapsedFormatted = computed(() => {
  const ms = props.progress.elapsedMs
  if (ms === 0) return '0s'
  const secs = Math.floor(ms / 1000)
  const mins = Math.floor(secs / 60)
  const remainingSecs = secs % 60
  if (mins > 0) return `${mins}m ${remainingSecs}s`
  return `${secs}s`
})

const statusLabel = computed(() => {
  switch (props.progress.status) {
    case 'idle': return 'Ready'
    case 'crawling': return 'Crawling...'
    case 'paused': return 'Paused'
    case 'completed': return 'Completed'
    case 'cancelled': return 'Cancelled'
    default: return ''
  }
})

const statusClass = computed(() => {
  switch (props.progress.status) {
    case 'crawling': return 'status-crawling'
    case 'completed': return 'status-completed'
    case 'cancelled': return 'status-cancelled'
    default: return 'status-idle'
  }
})
</script>

<template>
  <div class="progress-container" :class="{ visible: progress.status !== 'idle' }">
    <div class="progress-bar-track">
      <div
        class="progress-bar-fill"
        :class="{ crawling: isCrawling }"
        :style="{ width: `${progressPercent}%` }"
      />
    </div>

    <div class="progress-stats">
      <div class="stat-group">
        <span class="stat-label" :class="statusClass">
          <span v-if="isCrawling" class="pulse-dot" />
          {{ statusLabel }}
        </span>
        <span class="stat-divider">|</span>
        <span class="stat">
          <span class="stat-value">{{ progress.pagesCrawled }}</span>
          <span class="stat-unit">/ {{ progress.maxPages }} pages</span>
        </span>
        <span class="stat-divider">|</span>
        <span class="stat">
          <span class="stat-value">{{ progress.pagesDiscovered }}</span>
          <span class="stat-unit">discovered</span>
        </span>
      </div>

      <div class="stat-group">
        <span class="stat stat-broken" v-if="progress.brokenLinksCount > 0">
          <span class="stat-value">{{ progress.brokenLinksCount }}</span>
          <span class="stat-unit">broken</span>
        </span>
        <span class="stat stat-redirect" v-if="progress.redirectCount > 0">
          <span class="stat-value">{{ progress.redirectCount }}</span>
          <span class="stat-unit">redirects</span>
        </span>
        <span class="stat stat-seo" v-if="progress.seoIssuesCount > 0">
          <span class="stat-value">{{ progress.seoIssuesCount }}</span>
          <span class="stat-unit">SEO issues</span>
        </span>
        <span class="stat">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="clock-icon">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span class="stat-value">{{ elapsedFormatted }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.progress-container {
  flex-shrink: 0;
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition: max-height 0.3s ease, opacity 0.3s ease;
}

.progress-container.visible {
  max-height: 60px;
  opacity: 1;
}

.progress-bar-track {
  height: 3px;
  background: var(--color-bg-hover);
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #818cf8);
  transition: width 0.3s ease;
  border-radius: 0 2px 2px 0;
}

.progress-bar-fill.crawling {
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.5);
}

.progress-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 20px;
  background: var(--color-bg-secondary);
  font-size: 0.75rem;
}

.stat-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stat {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-secondary);
}

.stat-value {
  color: var(--color-text-primary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.stat-unit {
  color: var(--color-text-muted);
}

.stat-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.stat-divider {
  color: var(--color-border);
}

.status-crawling { color: var(--color-accent); }
.status-completed { color: var(--color-success); }
.status-cancelled { color: var(--color-warning); }
.status-idle { color: var(--color-text-muted); }

.stat-broken .stat-value { color: var(--color-danger); }
.stat-redirect .stat-value { color: var(--color-warning); }
.stat-seo .stat-value { color: var(--color-warning); }

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-accent);
  animation: pulse-glow 2s infinite;
}

.clock-icon {
  color: var(--color-text-muted);
}
</style>
