<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import type { CrawlSettings } from '../types'

const props = defineProps<{
  settings: CrawlSettings
  isCrawling: boolean
}>()

const emit = defineEmits<{
  update: [settings: Partial<CrawlSettings>]
}>()

const concurrency = ref(props.settings.concurrency)
const maxPages = ref(props.settings.maxPages)
const rateLimitMs = ref(props.settings.rateLimitMs)
const userAgent = ref(props.settings.userAgent || '')
const defaultUA = ref('')

onMounted(async () => {
  defaultUA.value = await window.spider.getDefaultUserAgent()
})

// Sync props → local refs
watch(() => props.settings, (s) => {
  concurrency.value = s.concurrency
  maxPages.value = s.maxPages
  rateLimitMs.value = s.rateLimitMs
  userAgent.value = s.userAgent || ''
}, { deep: true })

function updateConcurrency() {
  const val = Math.max(1, Math.min(50, concurrency.value))
  concurrency.value = val
  emit('update', { concurrency: val })
}

function updateMaxPages() {
  const val = Math.max(1, maxPages.value)
  maxPages.value = val
  emit('update', { maxPages: val })
}

function updateRateLimit() {
  const val = Math.max(0, rateLimitMs.value)
  rateLimitMs.value = val
  emit('update', { rateLimitMs: val })
}

function updateUserAgent() {
  emit('update', { userAgent: userAgent.value })
}

function resetUserAgent() {
  userAgent.value = defaultUA.value
  emit('update', { userAgent: defaultUA.value })
}
</script>

<template>
  <div class="settings-container animate-fade-in">
    <div class="settings-card glass">
      <h2 class="settings-title">Crawl Settings</h2>
      <p class="settings-subtitle">Configure how the crawler behaves. Changes take effect on the next crawl.</p>

      <div class="settings-grid">
        <!-- Concurrency -->
        <div class="setting-group">
          <label class="setting-label" for="setting-concurrency">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            Concurrent Requests
          </label>
          <p class="setting-description">Number of pages to crawl simultaneously (1-50)</p>
          <input
            id="setting-concurrency"
            v-model.number="concurrency"
            type="number"
            class="input input-sm setting-input"
            min="1"
            max="50"
            :disabled="isCrawling"
            @change="updateConcurrency"
          />
        </div>

        <!-- Max Pages -->
        <div class="setting-group">
          <label class="setting-label" for="setting-max-pages">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Max Pages
          </label>
          <p class="setting-description">Maximum number of pages to crawl before stopping (default: 800)</p>
          <input
            id="setting-max-pages"
            v-model.number="maxPages"
            type="number"
            class="input input-sm setting-input"
            min="1"
            :disabled="isCrawling"
            @change="updateMaxPages"
          />
        </div>

        <!-- Rate Limit -->
        <div class="setting-group">
          <label class="setting-label" for="setting-rate-limit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Rate Limit (ms)
          </label>
          <p class="setting-description">Delay in milliseconds between requests. Set to 0 for no delay.</p>
          <input
            id="setting-rate-limit"
            v-model.number="rateLimitMs"
            type="number"
            class="input input-sm setting-input"
            min="0"
            step="50"
            :disabled="isCrawling"
            @change="updateRateLimit"
          />
        </div>

        <!-- User Agent -->
        <div class="setting-group setting-group-wide">
          <label class="setting-label" for="setting-user-agent">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            User-Agent String
          </label>
          <p class="setting-description">The User-Agent header sent with each request. Defaults to Chrome.</p>
          <div class="ua-input-group">
            <input
              id="setting-user-agent"
              v-model="userAgent"
              type="text"
              class="input input-sm"
              :disabled="isCrawling"
              @change="updateUserAgent"
            />
            <button
              id="reset-ua-btn"
              class="btn btn-ghost btn-sm"
              :disabled="isCrawling || userAgent === defaultUA"
              @click="resetUserAgent"
            >
              Reset to Default
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-card glass">
      <h2 class="settings-title">About</h2>
      <div class="about-content">
        <p><strong>Trawlr</strong> — Web Crawler & Link Auditor v1.0</p>
        <p class="about-detail">Crawls websites to discover pages and links, detect broken links, track redirects, and audit SEO meta tags.</p>
        <div class="about-features">
          <div class="feature-item">
            <span class="badge badge-pass">✓</span>
            <span>Broken link detection (4xx/5xx)</span>
          </div>
          <div class="feature-item">
            <span class="badge badge-redirect">→</span>
            <span>Redirect chain tracking (301, 302, 307, 308)</span>
          </div>
          <div class="feature-item">
            <span class="badge badge-internal">🔍</span>
            <span>SEO meta tag auditing</span>
          </div>
          <div class="feature-item">
            <span class="badge badge-external">📄</span>
            <span>CSV export</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-container {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 800px;
}

.settings-card {
  border-radius: 12px;
  padding: 24px;
}

.settings-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 4px;
}

.settings-subtitle {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  margin-bottom: 24px;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.setting-group-wide {
  grid-column: 1 / -1;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-primary);
  font-size: 0.875rem;
  font-weight: 600;
}

.setting-label svg {
  color: var(--color-accent);
}

.setting-description {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  line-height: 1.4;
}

.setting-input {
  max-width: 160px;
}

.ua-input-group {
  display: flex;
  gap: 10px;
  align-items: center;
}

.ua-input-group .input {
  flex: 1;
}

.about-content {
  margin-top: 12px;
}

.about-content p {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.about-detail {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.about-features {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-text-secondary);
  font-size: 0.8125rem;
}
</style>
