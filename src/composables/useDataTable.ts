import { computed, reactive, ref, type ComputedRef, type Ref } from 'vue'

/**
 * Generic, reusable filter + sort engine for the report tables.
 *
 * A view supplies the raw rows plus small accessor functions describing how to
 * search, facet, and sort them. The composable owns all UI state (search text,
 * active facet selections, sort key/direction) and returns the processed rows.
 *
 * Filtering semantics: within a single facet the selected chips are OR'd
 * together; across different facets the results are AND'd. Free-text search is
 * applied first and is also AND'd with the facets.
 */

export type SortDir = 'asc' | 'desc'

export interface FacetOption {
  /** The value compared against a row's facet accessor. */
  value: string
  /** Human-readable chip label. */
  label: string
  /** Optional semantic tone for coloring the chip (see TableToolbar tone-*). */
  tone?: 'pass' | 'warning' | 'missing' | 'internal' | 'external' | 'redirect'
}

export interface FacetDef<T> {
  /** Stable key for this facet (used in state + persistence). */
  key: string
  /** Group label shown before the chips. */
  label: string
  /** Selectable options. */
  options: FacetOption[]
  /**
   * Returns the row's value(s) for this facet, compared against option.value.
   * Return an array for rows that can match multiple options at once.
   */
  accessor: (row: T) => string | string[] | null | undefined
}

export interface DataTableConfig<T> {
  /** Getter for the raw rows (e.g. `() => props.pages`). */
  rows: () => T[]
  /** Fields searched by the free-text box. Nullish values are ignored. */
  searchAccessors?: (row: T) => Array<string | null | undefined>
  /** Sortable columns keyed by column id. */
  sortAccessors?: Record<string, (row: T) => string | number>
  /** Faceted (per-column) chip filters. */
  facets?: Array<FacetDef<T>>
  /** Initial sort. */
  defaultSort?: { key: string; dir: SortDir }
  /**
   * When set, filter/sort state is persisted to localStorage under this key so
   * it survives tab switches within a session.
   */
  storageKey?: string
}

interface PersistedState {
  search: string
  sortKey: string | null
  sortDir: SortDir
  facets: Record<string, string[]>
}

export interface UseDataTable<T> {
  search: Ref<string>
  sortKey: Ref<string | null>
  sortDir: Ref<SortDir>
  toggleSort: (key: string) => void
  sortIndicator: (key: string) => string
  ariaSort: (key: string) => 'ascending' | 'descending' | 'none'
  /** Selected values per facet key. */
  activeFacets: Record<string, Set<string>>
  toggleFacet: (facetKey: string, value: string) => void
  isFacetActive: (facetKey: string, value: string) => boolean
  clearAll: () => void
  /** Total selected chips + (1 if search is non-empty). */
  activeFilterCount: ComputedRef<number>
  /** Processed rows: search -> facets -> sort. */
  rows: ComputedRef<T[]>
  /** Count of raw rows before filtering. */
  total: ComputedRef<number>
  /** Count of rows after filtering. */
  filteredCount: ComputedRef<number>
}

function loadPersisted(storageKey: string | undefined): PersistedState | null {
  if (!storageKey) return null
  try {
    const raw = localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as PersistedState) : null
  } catch {
    return null
  }
}

export function useDataTable<T>(config: DataTableConfig<T>): UseDataTable<T> {
  const persisted = loadPersisted(config.storageKey)

  const search = ref(persisted?.search ?? '')
  const sortKey = ref<string | null>(
    persisted?.sortKey ?? config.defaultSort?.key ?? null
  )
  const sortDir = ref<SortDir>(persisted?.sortDir ?? config.defaultSort?.dir ?? 'asc')

  // Seed facet selections (persisted first, then empty sets for every facet).
  const activeFacets = reactive<Record<string, Set<string>>>({})
  for (const facet of config.facets ?? []) {
    const saved = persisted?.facets?.[facet.key]
    activeFacets[facet.key] = new Set(saved ?? [])
  }

  function persist() {
    if (!config.storageKey) return
    const facets: Record<string, string[]> = {}
    for (const key of Object.keys(activeFacets)) {
      facets[key] = Array.from(activeFacets[key])
    }
    try {
      localStorage.setItem(
        config.storageKey,
        JSON.stringify({
          search: search.value,
          sortKey: sortKey.value,
          sortDir: sortDir.value,
          facets,
        } satisfies PersistedState)
      )
    } catch {
      /* storage unavailable — non-fatal */
    }
  }

  function toggleSort(key: string) {
    if (sortKey.value === key) {
      sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey.value = key
      sortDir.value = 'asc'
    }
    persist()
  }

  function sortIndicator(key: string): string {
    if (sortKey.value !== key) return ''
    return sortDir.value === 'asc' ? ' ↑' : ' ↓'
  }

  function ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    if (sortKey.value !== key) return 'none'
    return sortDir.value === 'asc' ? 'ascending' : 'descending'
  }

  function toggleFacet(facetKey: string, value: string) {
    const set = activeFacets[facetKey]
    if (!set) return
    if (set.has(value)) set.delete(value)
    else set.add(value)
    persist()
  }

  function isFacetActive(facetKey: string, value: string): boolean {
    return activeFacets[facetKey]?.has(value) ?? false
  }

  function clearAll() {
    search.value = ''
    for (const key of Object.keys(activeFacets)) {
      activeFacets[key].clear()
    }
    persist()
  }

  const activeFilterCount = computed(() => {
    let n = search.value.trim() ? 1 : 0
    for (const key of Object.keys(activeFacets)) {
      n += activeFacets[key].size
    }
    return n
  })

  const total = computed(() => config.rows().length)

  const rows = computed<T[]>(() => {
    let result = config.rows()

    // 1. Free-text search
    const q = search.value.trim().toLowerCase()
    if (q && config.searchAccessors) {
      result = result.filter((row) =>
        config.searchAccessors!(row).some(
          (v) => typeof v === 'string' && v.toLowerCase().includes(q)
        )
      )
    }

    // 2. Facets (OR within a facet, AND across facets)
    for (const facet of config.facets ?? []) {
      const selected = activeFacets[facet.key]
      if (!selected || selected.size === 0) continue
      result = result.filter((row) => {
        const value = facet.accessor(row)
        if (value == null) return false
        if (Array.isArray(value)) return value.some((v) => selected.has(v))
        return selected.has(value)
      })
    }

    // 3. Sort
    const key = sortKey.value
    const accessor = key ? config.sortAccessors?.[key] : undefined
    if (accessor) {
      const dir = sortDir.value === 'asc' ? 1 : -1
      result = result.slice().sort((a, b) => {
        const aVal = accessor(a)
        const bVal = accessor(b)
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * dir
        }
        const aStr = String(aVal)
        const bStr = String(bVal)
        return aStr.localeCompare(bStr, undefined, { numeric: true }) * dir
      })
    }

    return result
  })

  const filteredCount = computed(() => rows.value.length)

  return {
    search,
    sortKey,
    sortDir,
    toggleSort,
    sortIndicator,
    ariaSort,
    activeFacets,
    toggleFacet,
    isFacetActive,
    clearAll,
    activeFilterCount,
    rows,
    total,
    filteredCount,
  }
}
