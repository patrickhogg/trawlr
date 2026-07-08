<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'

/**
 * A table cell for URLs. Displays the URL truncated with an ellipsis, and on
 * click opens a small popover (teleported to <body> so it isn't clipped by the
 * table's overflow) showing the full, selectable URL with a Copy button.
 */
const props = defineProps<{
  url: string
}>()

const open = ref(false)
const copied = ref(false)
const x = ref(0)
const y = ref(0)

const POPOVER_WIDTH = 460

const posStyle = computed(() => {
  const left = Math.min(x.value, window.innerWidth - POPOVER_WIDTH - 16)
  const top = Math.min(y.value + 8, window.innerHeight - 120)
  return {
    left: `${Math.max(16, left)}px`,
    top: `${Math.max(16, top)}px`,
    width: `${POPOVER_WIDTH}px`,
  }
})

function openPopover(e: MouseEvent) {
  x.value = e.clientX
  y.value = e.clientY
  copied.value = false
  open.value = true
  window.addEventListener('keydown', onKeydown)
}

function close() {
  open.value = false
  window.removeEventListener('keydown', onKeydown)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

async function copy() {
  try {
    await navigator.clipboard.writeText(props.url)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch {
    // Clipboard unavailable — the text is still selectable in the popover.
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <td class="url-cell" :title="url" @click="openPopover">
    <span class="url-text">{{ url }}</span>

    <Teleport to="body">
      <div v-if="open" class="url-popover-backdrop" @click="close">
        <div class="url-popover glass-strong" :style="posStyle" @click.stop>
          <div class="url-popover-text">{{ url }}</div>
          <div class="url-popover-actions">
            <button class="btn btn-primary btn-sm" @click="copy">
              {{ copied ? '✓ Copied' : 'Copy URL' }}
            </button>
            <button class="btn btn-ghost btn-sm" @click="close">Close</button>
          </div>
        </div>
      </div>
    </Teleport>
  </td>
</template>

<style scoped>
.url-cell {
  cursor: pointer;
  position: relative;
}

.url-cell:hover .url-text {
  text-decoration: underline;
}

.url-popover-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.url-popover {
  position: fixed;
  border-radius: 10px;
  padding: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: calc(100vw - 32px);
}

.url-popover-text {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text-primary);
  word-break: break-all;
  user-select: text;
  line-height: 1.5;
  max-height: 40vh;
  overflow-y: auto;
}

.url-popover-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
