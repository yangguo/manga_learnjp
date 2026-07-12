# Review Return And Vocabulary Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the exact reader state when entering and leaving review, while rendering vocabulary in selected-text order without JLPT grouping.

**Architecture:** Reader-originated review runs in a fixed full-screen overlay owned by `Home`, so `MokuroReader` and image readers remain mounted with their in-memory state and file handles intact. Standalone `/review` remains available. Two pure helpers define the review-entry mode and sentence/word flattening order; components consume those helpers and browser acceptance proves the reader DOM survives the round trip.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Zustand, Vitest, Tailwind CSS, Playwright CLI.

## Global Constraints

- Do not change `word-bank-storage`, `grammar-bank-storage`, Mokuro cache, or Mokuro progress schemas.
- Keep FSRS queue creation and rating behavior unchanged.
- Keep JLPT badges on vocabulary cards; remove only vocabulary grouping and vocabulary-level target controls.
- Keep grammar foundation/focus/stretch/unclassified grouping and the shared JLPT target selector.
- Reader-originated review must not route away from `/` or unmount the active reader.
- Standalone `/review` and `/words` must remain usable.
- Use existing dependencies only; do not add a component-test framework.

---

### Task 1: Preserve Analysis Vocabulary Order

**Files:**
- Create: `src/lib/analysis-order.ts`
- Create: `src/lib/analysis-order.test.ts`
- Modify: `src/components/MokuroAnalysisPanel.tsx`

**Interfaces:**
- Consumes: `SentenceAnalysis[]` and each sentence's existing `words: WordAnalysis[]`.
- Produces: `getVocabularyInTextOrder(sentences: Pick<SentenceAnalysis, 'words'>[]): WordAnalysis[]`.

- [ ] **Step 1: Write the failing order tests**

```ts
import { describe, expect, it } from 'vitest'
import { getVocabularyInTextOrder } from './analysis-order'
import type { SentenceAnalysis } from './types'

const sentence = (words: SentenceAnalysis['words']): Pick<SentenceAnalysis, 'words'> => ({ words })
const word = (value: string) => ({
  word: value,
  reading: value,
  meaning: value,
  partOfSpeech: 'test'
})

describe('getVocabularyInTextOrder', () => {
  it('keeps sentence order and word order regardless of JLPT level', () => {
    const input = [
      sentence([{ ...word('first'), jlpt: { level: 'N1', source: 'open-anki-jlpt-decks', datasetVersion: 'test', match: 'exact' } }]),
      sentence([
        { ...word('second'), jlpt: { level: 'N5', source: 'open-anki-jlpt-decks', datasetVersion: 'test', match: 'exact' } },
        word('third')
      ])
    ] satisfies Pick<SentenceAnalysis, 'words'>[]

    expect(getVocabularyInTextOrder(input).map(item => item.word)).toEqual(['first', 'second', 'third'])
  })

  it('returns a new array without mutating sentence word arrays', () => {
    const input = [sentence([word('one'), word('two')])]
    const snapshot = structuredClone(input)
    const result = getVocabularyInTextOrder(input)

    expect(result).not.toBe(input[0].words)
    expect(input).toEqual(snapshot)
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test -- src/lib/analysis-order.test.ts
```

Expected: FAIL because `./analysis-order` does not exist.

- [ ] **Step 3: Implement the minimal order helper**

```ts
import type { SentenceAnalysis, WordAnalysis } from './types'

export const getVocabularyInTextOrder = (
  sentences: Pick<SentenceAnalysis, 'words'>[]
): WordAnalysis[] => sentences.flatMap(sentence => sentence.words)
```

- [ ] **Step 4: Replace grouped vocabulary rendering**

In `MokuroAnalysisPanel.tsx`:

1. Import `getVocabularyInTextOrder`.
2. Replace the vocabulary `flatMap` plus `groupVocabularyByTarget` call with `getVocabularyInTextOrder(analysisResult.sentences)`.
3. Remove `groupVocabularyByTarget` from imports.
4. Remove `JLPTTargetSelector` from the vocabulary section.
5. Replace four `VocabularyGroup` instances with one ordered list:

```tsx
{vocabulary.length > 0 ? (
  <ul className="mt-3 space-y-2">
    {vocabulary.map((word, index) => (
      <VocabularyCard
        key={`${word.word}-${word.reading}-${index}`}
        word={word}
        language={language}
        sourceSentence={selectedText}
        persistJLPT={persistJLPT}
      />
    ))}
  </ul>
) : (
  <p className="mt-3 rounded-lg border border-white/10 bg-gray-950/40 p-3 text-sm text-gray-400">
    {t.noVocabulary}
  </p>
)}
```

6. Add `noVocabulary` to both UI language dictionaries.
7. Delete the unused `VocabularyGroup` interface and component.
8. Render `JLPTTargetSelector` once in the grammar section before `GrammarGroup` components.

- [ ] **Step 5: Verify GREEN and static checks**

Run:

```bash
npm test -- src/lib/analysis-order.test.ts src/lib/jlpt-target.test.ts
npm run lint -- --quiet
```

Expected: both test files pass and lint exits 0.

- [ ] **Step 6: Commit ordered vocabulary**

```bash
git add src/lib/analysis-order.ts src/lib/analysis-order.test.ts src/components/MokuroAnalysisPanel.tsx
git commit -m "fix(reader): preserve vocabulary text order"
```

---

### Task 2: Define Reader And Standalone Review Entry Modes

**Files:**
- Create: `src/lib/review-entry.ts`
- Create: `src/lib/review-entry.test.ts`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/WordBank.tsx`

**Interfaces:**
- Consumes: optional `onStartReview?: () => void` supplied by a reader owner.
- Produces: `resolveReviewEntry(onStartReview): { mode: 'inline'; onStart: () => void } | { mode: 'route'; href: '/review' }`.

- [ ] **Step 1: Write the failing entry-mode tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import { resolveReviewEntry } from './review-entry'

describe('resolveReviewEntry', () => {
  it('uses inline review when the reader supplies a start callback', () => {
    const onStart = vi.fn()
    expect(resolveReviewEntry(onStart)).toEqual({ mode: 'inline', onStart })
  })

  it('keeps standalone pages on the review route', () => {
    expect(resolveReviewEntry()).toEqual({ mode: 'route', href: '/review' })
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test -- src/lib/review-entry.test.ts
```

Expected: FAIL because `./review-entry` does not exist.

- [ ] **Step 3: Implement the entry resolver**

```ts
export type ReviewEntry =
  | { mode: 'inline'; onStart: () => void }
  | { mode: 'route'; href: '/review' }

export const resolveReviewEntry = (onStart?: () => void): ReviewEntry =>
  onStart ? { mode: 'inline', onStart } : { mode: 'route', href: '/review' }
```

- [ ] **Step 4: Make Header choose the correct entry mode**

Add `onOpenReview?: () => void` to `HeaderProps`, resolve it once, and render either:

```tsx
const reviewClassName = 'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-gray-200 transition-colors hover:bg-white/10 sm:px-3'
const reviewContent = (
  <>
    <Brain className="h-4 w-4" />
    <span className="hidden sm:inline">复习</span>
    {hydrated && reviewCount > 0 ? (
      <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-xs font-medium text-emerald-300">
        {reviewCount}
      </span>
    ) : null}
  </>
)

return reviewEntry.mode === 'inline' ? (
  <button type="button" onClick={reviewEntry.onStart} aria-label="开始复习" title="开始复习" className={reviewClassName}>
    {reviewContent}
  </button>
) : (
  <Link href={reviewEntry.href} aria-label="开始复习" title="开始复习" className={reviewClassName}>
    {reviewContent}
  </Link>
)
```

Use the current review control classes as `reviewClassName`. Keep the review count calculation unchanged.

- [ ] **Step 5: Make WordBank choose the correct entry mode**

Add `onStartReview?: () => void` to `WordBankProps`. Resolve it once and render:

```tsx
const reviewDisabled = !hydrated || words.length === 0
const reviewClassName = `flex h-8 items-center gap-1.5 rounded-md border border-emerald-500/30 px-3 text-sm text-emerald-200 transition-colors hover:bg-emerald-500/10 ${
  reviewDisabled ? 'pointer-events-none opacity-40' : ''
}`
const reviewContent = <><Brain size={15} /><span>{t.startReview}</span></>

{reviewEntry.mode === 'inline' ? (
  <button
    type="button"
    onClick={reviewEntry.onStart}
    disabled={reviewDisabled}
    className={reviewClassName}
  >
    {reviewContent}
  </button>
) : (
  <Link href={reviewEntry.href} aria-disabled={reviewDisabled} className={reviewClassName}>
    {reviewContent}
  </Link>
)}
```

This preserves the disabled state when hydration has not completed or no words are saved.

- [ ] **Step 6: Verify GREEN and static checks**

Run:

```bash
npm test -- src/lib/review-entry.test.ts
npm run lint -- --quiet
```

Expected: test passes and lint exits 0.

- [ ] **Step 7: Commit the entry boundary**

```bash
git add src/lib/review-entry.ts src/lib/review-entry.test.ts src/components/Header.tsx src/components/WordBank.tsx
git commit -m "refactor(review): distinguish reader and route entry"
```

---

### Task 3: Keep The Reader Mounted During Review

**Files:**
- Create: `src/components/ReaderReviewOverlay.tsx`
- Modify: `src/components/ReviewSession.tsx`
- Modify: `src/components/WordBankDrawer.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `ReaderReviewOverlay({ open, onClose })`, `ReviewSession({ onExit?, exitLabel? })`, `WordBankDrawer({ open, onClose, onStartReview? })`.
- Produces: a modal review surface that never navigates away from or unmounts `Home` readers.

- [ ] **Step 1: Establish the browser RED reproduction**

Start the app:

```bash
npm run dev -- --port 3001
```

Using Playwright CLI, open `/`, select Mokuro mode, and retain the element handle returned by `page.getByRole('heading', { name: 'Mokuro Reader' }).elementHandle()`. Click the Header review link, assert `page.url()` ends with `/review`, then evaluate `element.isConnected` through the retained handle and assert it is `false`. This is the expected pre-fix failure proving the route transition disconnects the reader DOM.

- [ ] **Step 2: Add ReviewSession exit support**

Define:

```ts
interface ReviewSessionProps {
  onExit?: () => void
  exitLabel?: string
}
```

When `onExit` exists:

- Render an `ArrowLeft` button labeled `exitLabel ?? '返回阅读'` in the active-session header.
- Render the same action in loading, error, and completion states.
- Add `Escape` handling to the existing keyboard effect only when `!isSubmitting`; call `onExit()` and return before review hotkeys.
- Keep standalone route links to `/words` when `onExit` is absent.

- [ ] **Step 3: Create ReaderReviewOverlay**

Implement a fixed overlay that keeps its parent page mounted:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import ReviewSession from '@/components/ReviewSession'

export default function ReaderReviewOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      returnFocusRef.current?.focus()
    }
  }, [open])

  if (!open) return null
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="reader-review-title" className="fixed inset-0 z-[70] overflow-y-auto bg-gray-950">
      <h1 id="reader-review-title" className="sr-only">词汇复习</h1>
      <main className="mx-auto min-h-screen w-full px-4 sm:px-6">
        <ReviewSession onExit={onClose} exitLabel="返回阅读" />
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Wire Home, Header, and drawer without route navigation**

In `Home`:

```ts
const [isReviewOpen, setIsReviewOpen] = useState(false)
const openReview = () => {
  setIsWordBankOpen(false)
  setIsReviewOpen(true)
}
```

Pass `onOpenReview={openReview}` to `Header`, pass `onStartReview={openReview}` to `WordBankDrawer`, and render:

```tsx
<ReaderReviewOverlay open={isReviewOpen} onClose={() => setIsReviewOpen(false)} />
```

Update `WordBankDrawer` to pass its optional callback through to `WordBank`. Leave `src/app/review/page.tsx` unchanged so it continues using `<ReviewSession />` without an exit callback.

- [ ] **Step 5: Verify browser GREEN behavior**

In one Playwright browser session:

1. Open `/`, select Mokuro, retain the `Mokuro Reader` heading element handle, and record `window.scrollY`.
2. Start review from Header; assert URL remains `/`, the dialog is visible, and the retained heading handle reports `isConnected === true`.
3. Exit during review; assert the dialog is gone, the same heading handle remains connected, and `window.scrollY` is restored.
4. Start review from the collection drawer and repeat.
5. Complete or reach the empty queue; verify “返回阅读” closes the overlay.
6. Set viewport to `375x812`; assert `scrollWidth === clientWidth`.
7. Open `/words`, start review, and assert navigation to `/review` still occurs.

- [ ] **Step 6: Run focused and production checks**

Run:

```bash
npm test -- src/lib/review-entry.test.ts src/lib/analysis-order.test.ts
npm run lint -- --quiet
npm run build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit reader-preserving review**

```bash
git add src/components/ReaderReviewOverlay.tsx src/components/ReviewSession.tsx src/components/WordBankDrawer.tsx src/app/page.tsx
git commit -m "fix(review): return to preserved reader state"
```

---

### Task 4: Final Regression And Delivery

**Files:**
- Modify: `docs/superpowers/specs/2026-07-12-review-return-and-vocabulary-order-design.md`

**Interfaces:**
- Consumes: completed Tasks 1-3.
- Produces: final verification evidence and delivery status.

- [ ] **Step 1: Run the full suite from a clean worktree**

```bash
npm test
npm run lint -- --quiet
npm run build
git diff --check
```

Expected: every command exits 0; no new warnings beyond known environment notices.

- [ ] **Step 2: Perform a completion audit against the design**

Verify each completion item directly:

- Reader stays mounted during inline review.
- Active, error, and complete review states expose an exit action.
- Vocabulary is flat and ordered; grammar remains grouped.
- `/words -> /review` standalone flow still works.
- Desktop and 375px browser acceptance have no overflow or overlap.

- [ ] **Step 3: Record delivery status**

Change the design document status to:

```text
状态: 已完成
```

Append the exact test counts and browser flows verified in this run.

- [ ] **Step 4: Commit delivery documentation**

```bash
git add docs/superpowers/specs/2026-07-12-review-return-and-vocabulary-order-design.md
git commit -m "docs(review): record reader return delivery"
```

- [ ] **Step 5: Push main after final verification**

```bash
git push origin main
```

Expected: `main` advances to the final delivery commit and `git status --short --branch` reports synchronization with `origin/main`.
