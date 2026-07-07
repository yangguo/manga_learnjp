import { describe, expect, it } from 'vitest'
import {
  computeNextBlockIndex,
  resolveAction,
  shouldHandleKey,
  type KeyboardNavState
} from './mokuro-keyboard-nav'

const state = (overrides: Partial<KeyboardNavState> = {}): KeyboardNavState => ({
  enabled: true,
  isAnalyzing: false,
  blockIndices: [0, 2, 5],
  selectedIndex: null,
  ...overrides
})

describe('shouldHandleKey', () => {
  it('returns true when there is no target', () => {
    expect(shouldHandleKey(null)).toBe(true)
  })

  it('returns false for input, textarea, and select tags', () => {
    expect(shouldHandleKey({ tagName: 'INPUT', isContentEditable: false })).toBe(false)
    expect(shouldHandleKey({ tagName: 'input', isContentEditable: false })).toBe(false)
    expect(shouldHandleKey({ tagName: 'TEXTAREA', isContentEditable: false })).toBe(false)
    expect(shouldHandleKey({ tagName: 'SELECT', isContentEditable: false })).toBe(false)
  })

  it('returns false for contenteditable elements', () => {
    expect(shouldHandleKey({ tagName: 'DIV', isContentEditable: true })).toBe(false)
  })

  it('returns true for other elements', () => {
    expect(shouldHandleKey({ tagName: 'BUTTON', isContentEditable: false })).toBe(true)
    expect(shouldHandleKey({ tagName: 'DIV', isContentEditable: false })).toBe(true)
  })
})

describe('computeNextBlockIndex', () => {
  it('returns null when there are no blocks', () => {
    expect(computeNextBlockIndex([], null, 'next')).toBeNull()
    expect(computeNextBlockIndex([], null, 'prev')).toBeNull()
  })

  it('selects the first block when nothing is selected', () => {
    expect(computeNextBlockIndex([0, 2, 5], null, 'next')).toBe(0)
    expect(computeNextBlockIndex([0, 2, 5], null, 'prev')).toBe(0)
  })

  it('moves to the previous block', () => {
    expect(computeNextBlockIndex([0, 2, 5], 2, 'prev')).toBe(0)
    expect(computeNextBlockIndex([0, 2, 5], 5, 'prev')).toBe(2)
  })

  it('stops at the first block instead of crossing pages', () => {
    expect(computeNextBlockIndex([0, 2, 5], 0, 'prev')).toBe(0)
  })

  it('moves to the next block', () => {
    expect(computeNextBlockIndex([0, 2, 5], 0, 'next')).toBe(2)
    expect(computeNextBlockIndex([0, 2, 5], 2, 'next')).toBe(5)
  })

  it('stops at the last block instead of crossing pages', () => {
    expect(computeNextBlockIndex([0, 2, 5], 5, 'next')).toBe(5)
  })

  it('falls back to the first block when the selection is not in the list', () => {
    expect(computeNextBlockIndex([0, 2, 5], 99, 'next')).toBe(0)
  })
})

describe('resolveAction', () => {
  it('returns null when disabled', () => {
    expect(resolveAction('ArrowDown', state({ enabled: false }))).toBeNull()
    expect(resolveAction('ArrowLeft', state({ enabled: false }))).toBeNull()
  })

  it('maps left to next-page and right to prev-page (manga right-to-left)', () => {
    expect(resolveAction('ArrowLeft', state())).toBe('next-page')
    expect(resolveAction('ArrowRight', state())).toBe('prev-page')
  })

  it('maps up/down to block navigation', () => {
    expect(resolveAction('ArrowUp', state())).toBe('prev-block')
    expect(resolveAction('ArrowDown', state())).toBe('next-block')
  })

  it('maps Enter, Escape, Home, End', () => {
    expect(resolveAction('Enter', state())).toBe('analyze')
    expect(resolveAction('Escape', state())).toBe('clear')
    expect(resolveAction('Home', state())).toBe('home')
    expect(resolveAction('End', state())).toBe('end')
  })

  it('maps left-hand w/s to scroll the analysis panel', () => {
    expect(resolveAction('w', state())).toBe('scroll-analysis-up')
    expect(resolveAction('W', state())).toBe('scroll-analysis-up')
    expect(resolveAction('s', state())).toBe('scroll-analysis-down')
    expect(resolveAction('S', state())).toBe('scroll-analysis-down')
  })

  it('disables block navigation and Enter while analyzing, but keeps paging, clear/home/end, and panel scrolling', () => {
    const analyzing = state({ isAnalyzing: true })
    expect(resolveAction('ArrowUp', analyzing)).toBeNull()
    expect(resolveAction('ArrowDown', analyzing)).toBeNull()
    expect(resolveAction('Enter', analyzing)).toBeNull()
    expect(resolveAction('ArrowLeft', analyzing)).toBe('next-page')
    expect(resolveAction('ArrowRight', analyzing)).toBe('prev-page')
    expect(resolveAction('Escape', analyzing)).toBe('clear')
    expect(resolveAction('Home', analyzing)).toBe('home')
    expect(resolveAction('End', analyzing)).toBe('end')
    expect(resolveAction('w', analyzing)).toBe('scroll-analysis-up')
    expect(resolveAction('s', analyzing)).toBe('scroll-analysis-down')
  })

  it('returns null for unknown keys', () => {
    expect(resolveAction('a', state())).toBeNull()
    expect(resolveAction('Space', state())).toBeNull()
  })
})
