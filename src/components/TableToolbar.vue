<script setup lang="ts">
import type { FacetDef, UseDataTable } from '../composables/useDataTable'

/**
 * Shared toolbar for report tables: free-text search, faceted toggle-chip
 * filters, a live result count, and a "Clear filters" affordance. All state is
 * owned by the `table` composable instance passed in.
 */
const props = defineProps<{
  table: UseDataTable<any>
  facets?: Array<FacetDef<any>>
  searchPlaceholder?: string
  /** Noun for the result count, e.g. "pages with issues", "broken links". */
  countNoun: string
  /** Optional id for the search input (used by tests / a11y). */
  inputId?: string
  /** Color accent for the count text: matches the tab's semantic color. */
  countTone?: 'muted' | 'warning' | 'danger'
}>()

const toneClass: Record<string, string> = {
  muted: 'count-muted',
  warning: 'count-warning',
  danger: 'count-danger',
}
</script>

<template>
  <div class="table-toolbar">
    <div class="toolbar-row">
      <input
        :id="inputId"
        :value="props.table.search.value"
        @input="props.table.search.value = ($event.target as HTMLInputElement).value"
        class="input input-sm filter-input"
        :placeholder="searchPlaceholder || 'Filter...'"
      />

      <span
        class="result-count"
        :class="toneClass[countTone || 'muted']"
      >
        {{ props.table.filteredCount.value }}
        <template v-if="props.table.filteredCount.value !== props.table.total.value">
          / {{ props.table.total.value }}
        </template>
        {{ countNoun }}
      </span>

      <button
        v-if="props.table.activeFilterCount.value > 0"
        class="btn btn-ghost btn-sm clear-btn"
        @click="props.table.clearAll()"
      >
        Clear filters ({{ props.table.activeFilterCount.value }})
      </button>
    </div>

    <div v-if="facets && facets.length" class="facet-row">
      <div v-for="facet in facets" :key="facet.key" class="facet-group">
        <span class="facet-label">{{ facet.label }}:</span>
        <button
          v-for="opt in facet.options"
          :key="opt.value"
          type="button"
          class="chip"
          :class="[
            opt.tone ? `tone-${opt.tone}` : '',
            { 'chip-active': props.table.isFacetActive(facet.key, opt.value) },
          ]"
          :aria-pressed="props.table.isFacetActive(facet.key, opt.value)"
          @click="props.table.toggleFacet(facet.key, opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-input {
  max-width: 350px;
}

.result-count {
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
}

.count-muted {
  color: var(--color-text-muted);
  font-weight: 400;
}

.count-warning {
  color: var(--color-warning);
}

.count-danger {
  color: var(--color-danger);
}

.clear-btn {
  margin-left: auto;
}

.facet-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.facet-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.facet-label {
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  font-weight: 600;
}

.chip {
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  font-family: var(--font-sans);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  cursor: pointer;
  opacity: 0.65;
  transition: opacity 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
}

.chip:hover {
  opacity: 1;
}

.chip.chip-active {
  opacity: 1;
  border-color: currentColor;
}

/* Semantic tones — text color when idle, tinted fill when active. */
.chip.tone-pass { color: var(--color-success); }
.chip.tone-warning,
.chip.tone-redirect { color: var(--color-warning); }
.chip.tone-missing { color: var(--color-danger); }
.chip.tone-internal { color: var(--color-accent); }
.chip.tone-external { color: #a78bfa; }

.chip.tone-pass.chip-active { background: rgba(74, 222, 128, 0.15); }
.chip.tone-warning.chip-active,
.chip.tone-redirect.chip-active { background: rgba(251, 191, 36, 0.15); }
.chip.tone-missing.chip-active { background: rgba(248, 113, 113, 0.15); }
.chip.tone-internal.chip-active { background: rgba(56, 189, 248, 0.15); }
.chip.tone-external.chip-active { background: rgba(167, 139, 250, 0.15); }
</style>
