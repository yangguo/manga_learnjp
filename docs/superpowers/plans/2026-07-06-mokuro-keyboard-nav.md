# Mokuro Keyboard Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add keyboard shortcuts to Mokuro Reader so users can navigate OCR text blocks (↑/↓), turn pages (←/→, manga right-to-left), analyze the selected block (Enter), and clear/jump (Esc/Home/End) without a mouse.

**Architecture:** A pure, DOM-independent module `src/lib/mokuro-keyboard-nav.ts` holds the key→action mapping, block-index computation, and input-focus gating — fully unit-testable in Node. A thin React hook `src/components/useMokuroKeyboardNav.ts` wires a `window` keydown listener to `MokuroReader`'s existing handlers via refs (no stale closures, no re-subscription) and scrolls the selected block into view. `MokuroReader` gains a `selectBlock` function (select-only, no API call) and a `blockIndices` memo; analysis still goes through the existing `analyzeSelection`.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest (Node environment, no jsdom).

**Spec:** `docs/superpowers/specs/2026-07-06-mokuro-keyboard-nav-design.md`

---

## File Structure

- **Create** `src/lib/mokuro-keyboard-nav.ts` — pure functions: `shouldHandleKey`, `computeNextBlockIndex`, `resolveAction`, plus `KeyboardNavAction` / `KeyboardNavState` / `KeyTargetContext` types.
- **Create** `src/lib/mokuro-keyboard-nav.test.ts` — Vitest unit tests for the pure module.
- **Create** `src/components/useMokuroKeyboardNav.ts` — `'use client'` React hook: window keydown listener, ref-based handler/state wiring, scroll-into-view.
- **Modify** `src/components/MokuroReader.tsx` — add `selectBlock`, `keyboardBlockIndices` memo, wire the hook, attach `listContainerRef`, add `data-block-index` to block list buttons.

---

## Task 1: Pure keyboard-nav module (TDD)

**Files:**
- Create: `src/lib/mokuro-keyboard-nav.ts`
- Test: `src/lib/mokuro-keyboard-nav.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/lib/mokuro-keyboard-nav.test.ts`:

```ts
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

  it('disables block navigation and Enter while analyzing, but keeps paging and clear/home/end', () => {
    const analyzing = state({ isAnalyzing: true })
    expect(resolveAction('ArrowUp', analyzing)).toBeNull()
    expect(resolveAction('ArrowDown', analyzing)).toBeNull()
    expect(resolveAction('Enter', analyzing)).toBeNull()
    expect(resolveAction('ArrowLeft', analyzing)).toBe('next-page')
    expect(resolveAction('ArrowRight', analyzing)).toBe('prev-page')
    expect(resolveAction('Escape', analyzing)).toBe('clear')
    expect(resolveAction('Home', analyzing)).toBe('home')
    expect(resolveAction('End', analyzing)).toBe('end')
  })

  it('returns null for unknown keys', () => {
    expect(resolveAction('a', state())).toBeNull()
    expect(resolveAction('Space', state())).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/mokuro-keyboard-nav.test.ts`
Expected: FAIL — `Failed to resolve import "./mokuro-keyboard-nav"` (module does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/mokuro-keyboard-nav.ts`:

```ts
export type KeyboardNavAction =
  | 'prev-block'
  | 'next-block'
  | 'next-page'
  | 'prev-page'
  | 'analyze'
  | 'clear'
  | 'home'
  | 'end'

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

  if (state.isAnalyzing) return null

  if (key === 'ArrowUp') return 'prev-block'
  if (key === 'ArrowDown') return 'next-block'
  if (key === 'Enter') return 'analyze'

  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/mokuro-keyboard-nav.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mokuro-keyboard-nav.ts src/lib/mokuro-keyboard-nav.test.ts
git commit -m "feat(mokuro): add pure keyboard-nav helpers"
```

---

## Task 2: `useMokuroKeyboardNav` hook

**Files:**
- Create: `src/components/useMokuroKeyboardNav.ts`

This hook is not unit-tested (no jsdom in the Vitest config); it is covered by the manual test checklist in Task 4. It is kept thin so all branch logic lives in the tested pure module.

- [ ] **Step 1: Write the hook**

Create `src/components/useMokuroKeyboardNav.ts`:

```ts
'use client'

import { useEffect, useRef } from 'react'
import {
  computeNextBlockIndex,
  resolveAction,
  shouldHandleKey,
  type KeyboardNavState
} from '@/lib/mokuro-keyboard-nav'

export interface MokuroKeyboardNavHandlers {
  selectBlock: (blockIndex: number) => void
  analyzeSelected: () => void
  goToNextPage: () => void
  goToPreviousPage: () => void
  clearSelection: () => void
}

export interface UseMokuroKeyboardNavArgs {
  handlers: MokuroKeyboardNavHandlers
  state: KeyboardNavState
}

const getTargetContext = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return null
  return {
    tagName: target.tagName,
    isContentEditable: target.isContentEditable
  }
}

// Global keyboard navigation for the Mokuro reader. Handlers and state are
// mirrored into refs so the window listener subscribes once and always reads
// the latest values without re-binding on every render.
export const useMokuroKeyboardNav = ({ handlers, state }: UseMokuroKeyboardNavArgs) => {
  const listContainerRef = useRef<HTMLDivElement | null>(null)
  const handlersRef = useRef(handlers)
  const stateRef = useRef(state)

  useEffect(() => {
    handlersRef.current = handlers
    stateRef.current = state
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = stateRef.current
      if (!current.enabled) return
      if (!shouldHandleKey(getTargetContext(event.target))) return

      const action = resolveAction(event.key, current)
      if (!action) return

      event.preventDefault()

      const h = handlersRef.current
      switch (action) {
        case 'prev-block': {
          const next = computeNextBlockIndex(current.blockIndices, current.selectedIndex, 'prev')
          if (next !== null) h.selectBlock(next)
          break
        }
        case 'next-block': {
          const next = computeNextBlockIndex(current.blockIndices, current.selectedIndex, 'next')
          if (next !== null) h.selectBlock(next)
          break
        }
        case 'next-page':
          h.goToNextPage()
          break
        case 'prev-page':
          h.goToPreviousPage()
          break
        case 'analyze':
          h.analyzeSelected()
          break
        case 'clear':
          h.clearSelection()
          break
        case 'home':
          if (current.blockIndices.length > 0) h.selectBlock(current.blockIndices[0])
          break
        case 'end':
          if (current.blockIndices.length > 0) {
            h.selectBlock(current.blockIndices[current.blockIndices.length - 1])
          }
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const selectedIndex = state.selectedIndex
    if (selectedIndex === null) return
    const container = listContainerRef.current
    if (!container) return
    const el = container.querySelector(`[data-block-index="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [state.selectedIndex])

  return listContainerRef
}
```

- [ ] **Step 2: Type-check the hook in isolation**

Run: `npx tsc --noEmit`
Expected: no errors. (If other pre-existing errors appear, ignore anything unrelated to `useMokuroKeyboardNav.ts` / `mokuro-keyboard-nav.ts`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/useMokuroKeyboardNav.ts
git commit -m "feat(mokuro): add useMokuroKeyboardNav hook"
```

---

## Task 3: Wire the hook into `MokuroReader`

**Files:**
- Modify: `src/components/MokuroReader.tsx`

- [ ] **Step 1: Add the import**

In `src/components/MokuroReader.tsx`, add the hook import alongside the other component imports. After the existing `import MokuroAnalysisPanel from '@/components/MokuroAnalysisPanel'` line, add:

```ts
import { useMokuroKeyboardNav } from '@/components/useMokuroKeyboardNav'
```

- [ ] **Step 2: Add the `keyboardBlockIndices` memo**

Locate the `currentBlocks` memo (around `src/components/MokuroReader.tsx:342`):

```ts
  const currentBlocks = useMemo<PageBlock[]>(() => {
    if (!currentPage) return []
    return currentPage.blocks.map((block, blockIndex) => ({
      block,
      blockIndex,
      text: getMokuroBlockText(block)
    }))
  }, [currentPage])
```

Immediately after it, add:

```ts
  // Indices of blocks with text on the current page; empty blocks are skipped
  // so keyboard navigation never lands on an unanalyzable target.
  const keyboardBlockIndices = useMemo(
    () => currentBlocks.filter(b => b.text.length > 0).map(b => b.blockIndex),
    [currentBlocks]
  )
```

- [ ] **Step 3: Add the `selectBlock` function**

Locate `handleBlockSelect` (around `src/components/MokuroReader.tsx:863`):

```ts
  const handleBlockSelect = (blockIndex: number, text: string) => {
    if (!text) {
      toast.error(UI_TEXT[analysisLanguage].noText)
      return
    }

    void analyzeSelection({
      pageIndex: currentPageIndex,
      blockIndex,
      text
    })
  }
```

Immediately before it, add the select-only function:

```ts
  const selectBlock = (blockIndex: number) => {
    const block = currentBlocks.find(b => b.blockIndex === blockIndex)
    if (!block || !block.text) return
    setSelectedBlock({ pageIndex: currentPageIndex, blockIndex, text: block.text })
  }
```

- [ ] **Step 4: Wire the hook**

Immediately after the `selectBlock` function added in Step 3, add the hook call:

```ts
  const listContainerRef = useMokuroKeyboardNav({
    handlers: {
      selectBlock,
      analyzeSelected: () => {
        const targetIndex =
          selectedBlock && selectedBlock.pageIndex === currentPageIndex
            ? selectedBlock.blockIndex
            : keyboardBlockIndices[0] ?? null
        if (targetIndex === null) return
        const block = currentBlocks.find(b => b.blockIndex === targetIndex)
        if (!block || !block.text) return
        void analyzeSelection({
          pageIndex: currentPageIndex,
          blockIndex: targetIndex,
          text: block.text
        })
      },
      goToNextPage: () => goToPage(currentPageIndex + 1),
      goToPreviousPage: () => goToPage(currentPageIndex - 1),
      clearSelection: () => setSelectedBlock(null)
    },
    state: {
      enabled: Boolean(mokuroFile) && !isBatchAnalyzing,
      isAnalyzing,
      blockIndices: keyboardBlockIndices,
      selectedIndex:
        selectedBlock && selectedBlock.pageIndex === currentPageIndex ? selectedBlock.blockIndex : null
    }
  })
```

- [ ] **Step 5: Attach `listContainerRef` to the block list container**

Locate the OCR blocks list container (around `src/components/MokuroReader.tsx:1241`):

```tsx
              <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
```

Replace with:

```tsx
              <div ref={listContainerRef} className="max-h-[360px] space-y-2 overflow-auto pr-1">
```

- [ ] **Step 6: Add `data-block-index` to block list buttons**

Locate the block list button (around `src/components/MokuroReader.tsx:1248`):

```tsx
                    <button
                      key={`block-list-${blockIndex}`}
                      type="button"
                      onClick={() => handleBlockSelect(blockIndex, text)}
                      disabled={!text}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
```

Replace with (adding the `data-block-index` attribute):

```tsx
                    <button
                      key={`block-list-${blockIndex}`}
                      type="button"
                      data-block-index={blockIndex}
                      onClick={() => handleBlockSelect(blockIndex, text)}
                      disabled={!text}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
```

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors in the modified files.

- [ ] **Step 8: Commit**

```bash
git add src/components/MokuroReader.tsx
git commit -m "feat(mokuro): wire keyboard navigation into reader"
```

---

## Task 4: Verification

**Files:** none (test + build only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new `src/lib/mokuro-keyboard-nav.test.ts`.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual test checklist**

Start the dev server with `npm run dev`, open http://localhost:3000, switch to Mokuro Reader, and load a Mokuro directory. Verify each:

1. `↓` selects the first text block (no API call); panel shows nothing or cached result. Pressing `↓` again moves to the next block.
2. `↑` moves to the previous block; at the first block it stays put (no page change).
3. `←` goes to the next page; `→` goes to the previous page (manga right-to-left).
4. On page 1, `→` does nothing (no error). On the last page, `←` does nothing.
5. `Enter` on a selected block triggers analysis (shows analyzing spinner, then result). Pressing `Enter` on an already-analyzed block shows the cached result without a new API call.
6. `Enter` with no block selected analyzes the first text block on the page.
7. `Esc` clears the selection (highlight removed).
8. `Home` jumps to the first block; `End` jumps to the last block.
9. When the block list is longer than its container, navigating with `↓` scrolls the newly selected block into view (only as far as needed).
10. Click the page-number input, press `↓`/`←`/`Enter`: the page scrolls/changes do NOT happen; typing works normally. Same for the batch-range From/To inputs.
11. Start a batch analysis (Analyze All Text On Page or Analyze range). While running, `↓`/`↑`/`Enter` are ignored, but `←`/`→` (page turn) and `Esc` still work.
12. The image-side overlay block highlights in sync with the keyboard-selected block; the left image pane does not scroll.
13. The mouse still works: clicking an overlay block or a list item selects + analyzes as before.

- [ ] **Step 5: Final commit (if any fixups were needed)**

If the manual test surfaced fixes, commit them. Otherwise no commit needed.

```bash
git add -A
git commit -m "fix(mokuro): keyboard nav manual-test fixes"
```
