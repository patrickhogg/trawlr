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
const checkExternalLinks = ref(props.settings.checkExternalLinks)
const useSitemap = ref(props.settings.useSitemap !== false)
const titleMinLength = ref(props.settings.titleMinLength)
const titleMaxLength = ref(props.settings.titleMaxLength)
const descriptionMinLength = ref(props.settings.descriptionMinLength)
const descriptionMaxLength = ref(props.settings.descriptionMaxLength)
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
  checkExternalLinks.value = s.checkExternalLinks
  useSitemap.value = s.useSitemap !== false
  titleMinLength.value = s.titleMinLength
  titleMaxLength.value = s.titleMaxLength
  descriptionMinLength.value = s.descriptionMinLength
  descriptionMaxLength.value = s.descriptionMaxLength
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

function toggleCheckExternalLinks() {
  emit('update', { checkExternalLinks: checkExternalLinks.value })
}

function toggleUseSitemap() {
  emit('update', { useSitemap: useSitemap.value })
}

function updateSeoLimits() {
  emit('update', {
    titleMinLength: Math.max(0, titleMinLength.value),
    titleMaxLength: Math.max(titleMinLength.value, titleMaxLength.value),
    descriptionMinLength: Math.max(0, descriptionMinLength.value),
    descriptionMaxLength: Math.max(descriptionMinLength.value, descriptionMaxLength.value),
  })
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

        <!-- Check External Links -->
        <div class="setting-group">
          <label class="setting-label" for="setting-check-external">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Check External Links
          </label>
          <p class="setting-description">When enabled, external links will be checked for broken status. Disabling speeds up crawls.</p>
          <label class="toggle-wrapper">
            <input
              id="setting-check-external"
              v-model="checkExternalLinks"
              type="checkbox"
              class="toggle-input"
              :disabled="isCrawling"
              @change="toggleCheckExternalLinks"
            />
            <span class="toggle-slider" />
            <span class="toggle-label">{{ checkExternalLinks ? 'On' : 'Off' }}</span>
          </label>
        </div>

        <!-- Use Sitemap -->
        <div class="setting-group">
          <label class="setting-label" for="setting-use-sitemap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            Discover &amp; Use Sitemap
          </label>
          <p class="setting-description">Fetch the site's XML sitemap to seed the crawl (finds unlinked pages) and enable orphan-page analysis.</p>
          <label class="toggle-wrapper">
            <input
              id="setting-use-sitemap"
              v-model="useSitemap"
              type="checkbox"
              class="toggle-input"
              :disabled="isCrawling"
              @change="toggleUseSitemap"
            />
            <span class="toggle-slider" />
            <span class="toggle-label">{{ useSitemap ? 'On' : 'Off' }}</span>
          </label>
        </div>

        <!-- SEO Title Limits -->
        <div class="setting-group">
          <label class="setting-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 7V4h16v3" />
              <path d="M9 20h6" />
              <path d="M12 4v16" />
            </svg>
            Title Tag Length
          </label>
          <p class="setting-description">Accepted character range for page titles</p>
          <div class="range-inputs">
            <div class="range-field">
              <label for="setting-title-min">Min</label>
              <input
                id="setting-title-min"
                v-model.number="titleMinLength"
                type="number"
                class="input input-sm setting-input"
                min="0"
                :disabled="isCrawling"
                @change="updateSeoLimits"
              />
            </div>
            <span class="range-separator">–</span>
            <div class="range-field">
              <label for="setting-title-max">Max</label>
              <input
                id="setting-title-max"
                v-model.number="titleMaxLength"
                type="number"
                class="input input-sm setting-input"
                min="1"
                :disabled="isCrawling"
                @change="updateSeoLimits"
              />
            </div>
          </div>
        </div>

        <!-- SEO Description Limits -->
        <div class="setting-group">
          <label class="setting-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="17" y1="10" x2="3" y2="10" />
              <line x1="21" y1="6" x2="3" y2="6" />
              <line x1="21" y1="14" x2="3" y2="14" />
              <line x1="17" y1="18" x2="3" y2="18" />
            </svg>
            Description Length
          </label>
          <p class="setting-description">Accepted character range for meta descriptions</p>
          <div class="range-inputs">
            <div class="range-field">
              <label for="setting-desc-min">Min</label>
              <input
                id="setting-desc-min"
                v-model.number="descriptionMinLength"
                type="number"
                class="input input-sm setting-input"
                min="0"
                :disabled="isCrawling"
                @change="updateSeoLimits"
              />
            </div>
            <span class="range-separator">–</span>
            <div class="range-field">
              <label for="setting-desc-max">Max</label>
              <input
                id="setting-desc-max"
                v-model.number="descriptionMaxLength"
                type="number"
                class="input input-sm setting-input"
                min="1"
                :disabled="isCrawling"
                @change="updateSeoLimits"
              />
            </div>
          </div>
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

.range-inputs {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.range-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.range-field label {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.range-field .input {
  max-width: 80px;
}

.range-separator {
  color: var(--color-text-muted);
  font-size: 1rem;
  padding-bottom: 6px;
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

/* Toggle Switch */
.toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  margin-top: 4px;
}

.toggle-input {
  display: none;
}

.toggle-slider {
  position: relative;
  width: 40px;
  height: 22px;
  background: var(--color-bg-hover);
  border-radius: 11px;
  border: 1px solid var(--color-border);
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.toggle-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: var(--color-text-muted);
  border-radius: 50%;
  transition: all 0.2s ease;
}

.toggle-input:checked + .toggle-slider {
  background: rgba(56, 189, 248, 0.3);
  border-color: var(--color-accent);
}

.toggle-input:checked + .toggle-slider::after {
  left: 20px;
  background: var(--color-accent);
}

.toggle-input:disabled + .toggle-slider {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-label {
  color: var(--color-text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
}
</style>
