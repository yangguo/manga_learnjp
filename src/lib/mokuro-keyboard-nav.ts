export type KeyboardNavAction =
  | 'prev-block'
  | 'next-block'
  | 'next-page'
  | 'prev-page'
  | 'analyze'
  | 'clear'
  | 'home'
  | 'end'
  | 'scroll-analysis-up'
  | 'scroll-analysis-down'

export interface KeyTargetContext {
  tagName: string | null
  isContentEditable: boolean
}

export interface KeyboardNavState {
  enabled: boolean
  isAnalyzing: boolean
  blockIndices: number[]
  selectedIndex: number | null
}

// True when the key event did not originate inside a form field or
// contenteditable host, so global reader shortcuts may act on it.
export const shouldHandleKey = (target: KeyTargetContext | null): boolean => {
  if (!target) return true
  if (target.isContentEditable) return false
  const tag = target.tagName?.toUpperCase() ?? null
  return tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT'
}

// Compute the next block index to select, given the page's non-empty block
// indices, the current selection, and a direction. Returns null only when the
// page has no blocks. Clamps at the ends so navigation never crosses pages.
export const computeNextBlockIndex = (
  blockIndices: number[],
  selectedIndex: number | null,
  direction: 'prev' | 'next'
): number | null => {
  if (blockIndices.length === 0) return null
  if (selectedIndex === null) return blockIndices[0]

  const currentIndex = blockIndices.indexOf(selectedIndex)
  if (currentIndex === -1) return blockIndices[0]

  if (direction === 'prev') {
    return blockIndices[Math.max(0, currentIndex - 1)]
  }
  return blockIndices[Math.min(blockIndices.length - 1, currentIndex + 1)]
}

// Map a key to a reader action given the current nav state. Page turns,
// clear, Home, and End stay available during single-block analysis; block
// navigation and Enter are gated off to avoid selection/analysis races.
export const resolveAction = (
  key: string,
  state: KeyboardNavState
): KeyboardNavAction | null => {
  if (!state.enabled) return null

  if (key === 'ArrowLeft') return 'next-page'
  if (key === 'ArrowRight') return 'prev-page'
  if (key === 'Escape') return 'clear'
  if (key === 'Home') return 'home'
  if (key === 'End') return 'end'

  // Scroll the analysis panel with left-hand keys; available even while a
  // single block is analyzing so the reader can review its content.
  const lowerKey = key.toLowerCase()
  if (lowerKey === 'w') return 'scroll-analysis-up'
  if (lowerKey === 's') return 'scroll-analysis-down'

  if (state.isAnalyzing) return null

  if (key === 'ArrowUp') return 'prev-block'
  if (key === 'ArrowDown') return 'next-block'
  if (key === 'Enter') return 'analyze'

  return null
}
