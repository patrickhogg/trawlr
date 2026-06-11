<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  isCrawling: boolean
}>()

const emit = defineEmits<{
  start: [url: string]
  cancel: []
}>()

const seedUrl = ref('')

function handleStart() {
  const url = seedUrl.value.trim()
  if (!url) return

  // Ensure URL has protocol
  let normalizedUrl = url
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl
  }

  emit('start', normalizedUrl)
}
</script>

<template>
  <div class="crawl-controls">
    <div class="url-input-group">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="input-icon">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        id="seed-url-input"
        v-model="seedUrl"
        type="url"
        class="url-input"
        placeholder="Enter website URL to crawl (e.g., example.com)"
        :disabled="isCrawling"
        @keydown.enter="handleStart"
      />
    </div>

    <button
      v-if="!isCrawling"
      id="start-crawl-btn"
      class="btn btn-primary"
      :disabled="!seedUrl.trim()"
      @click="handleStart"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
      Start Crawl
    </button>

    <button
      v-else
      id="cancel-crawl-btn"
      class="btn btn-danger"
      @click="$emit('cancel')"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      </svg>
      Stop Crawl
    </button>
  </div>
</template>

<style scoped>
.crawl-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  max-width: 700px;
}

.url-input-group {
  position: relative;
  flex: 1;
}

.input-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}

.url-input {
  width: 100%;
  padding: 10px 14px 10px 36px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-primary);
  font-size: 0.875rem;
  font-family: var(--font-mono);
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.url-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
}

.url-input::placeholder {
  font-family: var(--font-sans);
  color: var(--color-text-muted);
}

.url-input:disabled {
  opacity: 0.6;
}
</style>
