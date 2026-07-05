# Mokuro Page-Range Batch Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user pick a start/end page in Mokuro Reader and batch-analyze every OCR block across that range in one run, with a cancel button and a page-aware progress panel.

**Architecture:** All changes are in `src/components/MokuroReader.tsx` plus a small pure helper `clampPageRange` in `src/lib/mokuro.ts` (tested via `src/lib/mokuro.test.ts`). The new `analyzePageRange` function reuses the existing `analysisCacheRef` cache-update pattern and `batchProgress` state. A `cancelBatchRef` enables cancellation.

**Tech Stack:** React (App Router, `'use client'`), TypeScript, Tailwind, Vitest, lucide-react.

---

### Task 1: Add `clampPageRange` helper with tests

**Files:**
- Modify: `src/lib/mokuro.ts` (add `clampPageRange`)
- Modify: `src/lib/mokuro.test.ts` (add tests)

- [ ] **Step 1.1: Write the failing tests**

Append to `src/lib/mokuro.test.ts`:

```ts
import { clampPageRange } from './mokuro'

describe('clampPageRange', () => {
  it('returns null when from > to', () => {
    expect(clampPageRange(5, 3, 10)).toBeNull()
  })

  it('clamps to the page bounds', () => {
    expect(clampPageRange(0, 20, 10)).toEqual({ from: 1, to: 10 })
  })

  it('passes through a valid range unchanged', () => {
    expect(clampPageRange(3, 7, 10)).toEqual({ from: 3, to: 7 })
  })

  it('clamps start below 1 to 1', () => {
    expect(clampPageRange(-2, 4, 10)).toEqual({ from: 1, to: 4 })
  })
})
```

- [ ] **Step 1.2: Run the tests to verify they fail**

Run: `npm test -- src/lib/mokuro.test.ts`
Expected: FAIL — `clampPageRange` is not exported.

- [ ] **Step 1.3: Implement `clampPageRange`**

Append to `src/lib/mokuro.ts`:

```ts
export interface PageRange {
  from: number
  to: number
}

// Validate and clamp a 1-based inclusive page range. Returns null when the
// range is empty (from > to) or the document has no pages.
export const clampPageRange = (from: number, to: number, pageCount: number): PageRange | null => {
  if (!Number.isFinite(from) || !Number.isFinite(to) || pageCount <= 0) return null
  if (from > to) return null

  const clampedFrom = Math.min(Math.max(Math.floor(from), 1), pageCount)
  const clampedTo = Math.min(Math.max(Math.floor(to), 1), pageCount)

  if (clampedFrom > clampedTo) return null
  return { from: clampedFrom, to: clampedTo }
}
```

- [ ] **Step 1.4: Run the tests to verify they pass**

Run: `npm test -- src/lib/mokuro.test.ts`
Expected: PASS — all `clampPageRange` cases green.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/mokuro.ts src/lib/mokuro.test.ts
git commit -m "feat(mokuro): add clampPageRange helper with tests"
```

---

### Task 2: Extend `BatchProgress` type and add i18n strings

**Files:**
- Modify: `src/components/MokuroReader.tsx`

- [ ] **Step 2.1: Extend the `BatchProgress` interface**

Find the `interface BatchProgress` (around line 87) and add optional range fields:

```ts
interface BatchProgress {
  total: number
  completed: number
  skipped: number
  failed: number
  currentPage?: number
  totalPages?: number
}
```

- [ ] **Step 2.2: Add zh strings**

In the `UI_TEXT.zh` object (the `as const` block starting around line 110), add these keys alongside the existing ones (e.g. after `batchComplete`):

```ts
    analyzeRange: '批量分析范围',
    analyzingRange: '正在分析范围...',
    cancelBatch: '取消',
    fromPageLabel: '从第',
    toPageLabel: '页到第',
    rangeInvalid: '起始页不能大于结束页',
    rangeComplete: '范围批量分析完成',
    rangeCancelled: '已取消范围批量分析',
    page: '页',
    pageOf: '第 {current} / {total} 页'
```

- [ ] **Step 2.3: Add en strings**

In the `UI_TEXT.en` object (around line 150), add the matching keys:

```ts
    analyzeRange: 'Analyze range',
    analyzingRange: 'Analyzing range...',
    cancelBatch: 'Cancel',
    fromPageLabel: 'From page',
    toPageLabel: 'to page',
    rangeInvalid: 'Start page must not exceed end page',
    rangeComplete: 'Range batch analysis complete',
    rangeCancelled: 'Range batch analysis cancelled',
    page: 'Page',
    pageOf: 'Page {current} / {total}'
```

- [ ] **Step 2.4: Verify build still passes**

Run: `npm run build`
Expected: compiles successfully (the new keys are unused so far but `satisfies Record<...>` requires both languages to have the same keys).

- [ ] **Step 2.5: Commit**

```bash
git add src/components/MokuroReader.tsx
git commit -m "feat(mokuro): add page-range i18n strings and extend BatchProgress"
```

---

### Task 3: Implement `analyzePageRange` and cancellation

**Files:**
- Modify: `src/components/MokuroReader.tsx`

- [ ] **Step 3.1: Add the `cancelBatchRef` and range-input state**

Near the other `useRef`/`useState` declarations (around line 240, next to `isBatchAnalyzing`), add:

```ts
  const [batchRangeFrom, setBatchRangeFrom] = useState('1')
  const [batchRangeTo, setBatchRangeTo] = useState('1')
  const cancelBatchRef = useRef(false)
```

- [ ] **Step 3.2: Add the `analyzePageRange` function**

Add this next to `analyzeCurrentPage` (after it ends, around line 513). It reuses the same cache pattern. Import `clampPageRange` at the top of the file (add it to the existing `@/lib/mokuro` import).

```ts
  const analyzePageRange = async () => {
    if (!mokuroFile || isBatchAnalyzing) return

    const range = clampPageRange(
      Number(batchRangeFrom),
      Number(batchRangeTo),
      mokuroFile.pages.length
    )
    if (!range) return

    const t = UI_TEXT[analysisLanguage]
    cancelBatchRef.current = false
    setIsBatchAnalyzing(true)
    setBatchProgress({
      total: 0,
      completed: 0,
      skipped: 0,
      failed: 0,
      currentPage: range.from,
      totalPages: range.to - range.from + 1
    })
    setError(null)

    let completed = 0
    let skipped = 0
    let failed = 0
    let cancelled = false

    for (let pageIdx = range.from - 1; pageIdx <= range.to - 1; pageIdx += 1) {
      if (cancelBatchRef.current) {
        cancelled = true
        break
      }

      const page = mokuroFile.pages[pageIdx]
      const blocks = (page?.blocks ?? [])
        .map((block, blockIndex) => ({ block, blockIndex, text: getMokuroBlockText(block) }))
        .filter(block => block.text.length > 0)

      setBatchProgress(prev => ({
        ...(prev ?? { completed: 0, skipped: 0, failed: 0, total: blocks.length }),
        total: blocks.length,
        completed: 0,
        skipped: 0,
        failed: 0,
        currentPage: pageIdx + 1
      }))

      for (const block of blocks) {
        if (cancelBatchRef.current) {
          cancelled = true
          break
        }

        const cacheKey = getCacheKey({
          pageIndex: pageIdx,
          blockIndex: block.blockIndex,
          text: block.text
        })

        if (analysisCacheRef.current[cacheKey]) {
          skipped += 1
          setBatchProgress(prev => ({
            ...(prev ?? { total: blocks.length, completed: 0, skipped: 0, failed: 0 }),
            skipped: (prev?.skipped ?? 0) + 1
          }))
          continue
        }

        try {
          const result = await analyzeText(block.text, {
            provider: selectedProvider,
            language: analysisLanguage
          })
          const nextCache = {
            ...analysisCacheRef.current,
            [cacheKey]: result
          }
          analysisCacheRef.current = nextCache
          setAnalysisCache(nextCache)
          completed += 1
          setBatchProgress(prev => ({
            ...(prev ?? { total: blocks.length, completed: 0, skipped: 0, failed: 0 }),
            completed: (prev?.completed ?? 0) + 1
          }))
          await persistAnalysisCache(nextCache)
        } catch (batchError) {
          failed += 1
          setBatchProgress(prev => ({
            ...(prev ?? { total: blocks.length, completed: 0, skipped: 0, failed: 0 }),
            failed: (prev?.failed ?? 0) + 1
          }))
          console.error('Failed to analyze Mokuro page block:', batchError)
        }
      }

      if (cancelled) break
    }

    setIsBatchAnalyzing(false)
    setBatchProgress(null)
    if (cancelled) {
      toast.error(t.rangeCancelled)
    } else {
      toast.success(t.rangeComplete)
    }
  }
```

- [ ] **Step 3.3: Add the cancel handler**

Add a small handler near `analyzePageRange`:

```ts
  const cancelBatch = () => {
    cancelBatchRef.current = true
  }
```

- [ ] **Step 3.4: Sync the default "to" input when a mokuro file loads**

In the existing `handleMokuroFileChange` success branch (where `setMokuroFile(parsed)` is called) and in `importDirectoryFiles` (where `setMokuroFile(parsedMokuro)` is called) and in `resetReader`, keep the range inputs in sync. The simplest approach: update them wherever `setMokuroFile` is called.

In `handleMokuroFileChange`, after `setMokuroFile(parsed)`:
```ts
    setBatchRangeFrom('1')
    setBatchRangeTo(String(parsed.pages.length))
```

In `importDirectoryFiles`, after `setMokuroFile(parsedMokuro)`:
```ts
    setBatchRangeFrom('1')
    setBatchRangeTo(String(parsedMokuro.pages.length))
```

In `resetReader`, after `setMokuroFile(null)`:
```ts
    setBatchRangeFrom('1')
    setBatchRangeTo('1')
```

- [ ] **Step 3.5: Verify build passes**

Run: `npm run build`
Expected: compiles successfully (the new function is unused in the UI yet, but the logic must type-check).

- [ ] **Step 3.6: Commit**

```bash
git add src/components/MokuroReader.tsx
git commit -m "feat(mokuro): implement analyzePageRange with cancellation"
```

---

### Task 4: Add range UI controls and extend the progress panel

**Files:**
- Modify: `src/components/MokuroReader.tsx`

- [ ] **Step 4.1: Add the range control next to the "Analyze page" button**

Find the existing single-page button block (around line 622-632):

```tsx
          {mokuroFile && (
            <button
              type="button"
              onClick={() => void analyzeCurrentPage()}
              disabled={isBatchAnalyzing || currentBlocks.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-500/20 px-3 py-2 text-sm font-medium text-purple-100 transition-colors hover:bg-purple-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBatchAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              {isBatchAnalyzing ? t.analyzingPage : t.analyzePage}
            </button>
          )}
```

Add a new range control block right after it (still inside the `{mokuroFile && (...)}` or as a sibling):

```tsx
          {mokuroFile && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400">{t.fromPageLabel}</span>
              <input
                type="number"
                min={1}
                max={mokuroFile.pages.length}
                value={batchRangeFrom}
                onChange={event => setBatchRangeFrom(event.target.value)}
                disabled={isBatchAnalyzing}
                className="h-9 w-20 rounded-lg border border-white/10 bg-gray-950 px-2 text-center text-sm text-white disabled:opacity-50"
              />
              <span className="text-xs text-gray-400">{t.toPageLabel}</span>
              <input
                type="number"
                min={1}
                max={mokuroFile.pages.length}
                value={batchRangeTo}
                onChange={event => setBatchRangeTo(event.target.value)}
                disabled={isBatchAnalyzing}
                className="h-9 w-20 rounded-lg border border-white/10 bg-gray-950 px-2 text-center text-sm text-white disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void analyzePageRange()}
                disabled={isBatchAnalyzing}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-500/20 px-3 py-2 text-sm font-medium text-purple-100 transition-colors hover:bg-purple-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBatchAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Layers size={16} />}
                {isBatchAnalyzing ? t.analyzingRange : t.analyzeRange}
              </button>
              {isBatchAnalyzing && (
                <button
                  type="button"
                  onClick={cancelBatch}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/20"
                >
                  <X size={16} />
                  {t.cancelBatch}
                </button>
              )}
              {Number(batchRangeFrom) > Number(batchRangeTo) && !isBatchAnalyzing && (
                <span className="text-xs text-red-300">{t.rangeInvalid}</span>
              )}
            </div>
          )}
```

- [ ] **Step 4.2: Ensure `Layers` and `X` icons are imported**

Update the `lucide-react` import at the top of the file to include `Layers` and `X` (add to the existing import list).

- [ ] **Step 4.3: Extend the progress panel to show the page indicator**

Find the existing progress panel (around line 665-685). Update the label line to show the current page when `batchProgress.currentPage` is set. Replace the line:

```tsx
              <span>{t.analyzePage}</span>
```

with:

```tsx
              <span>
                {batchProgress.currentPage
                  ? t.pageOf
                      .replace('{current}', String(batchProgress.currentPage))
                      .replace('{total}', String(batchProgress.totalPages ?? 0))
                  : t.analyzePage}
              </span>
```

- [ ] **Step 4.4: Verify lint and build pass**

Run: `npm run lint && npm run build`
Expected: lint with 0 new errors, build compiles.

- [ ] **Step 4.5: Commit**

```bash
git add src/components/MokuroReader.tsx
git commit -m "feat(mokuro): add page-range batch UI and progress indicator"
```

---

### Task 5: Verify end-to-end

- [ ] **Step 5.1: Run the test suite**

Run: `npm test`
Expected: all tests pass, including the new `clampPageRange` tests.

- [ ] **Step 5.2: Manual browser verification**

If the dev server is not running, start it: `npm run dev`. Open `http://localhost:3000`, switch to Mokuro Reader, and load `output/pdf/spy6-mokuro/spy6.mokuro`.

Verify:
- The range inputs appear (From / To) defaulting to 1 and the page count.
- Setting From=1, To=3 and clicking "Analyze range" analyzes blocks on pages 1-3, skipping already-cached blocks.
- The progress panel shows "第 1 / 3 页", "第 2 / 3 页", etc., with the per-page block bar updating.
- Clicking "Cancel" mid-run stops the analysis; cached results so far are kept.
- Block buttons and the single-page "Analyze page" button are disabled during the run.
- Entering From > To shows the "起始页不能大于结束页" hint and disables the run (or the run is a no-op).

- [ ] **Step 5.3: Final lint + build**

Run: `npm run lint && npm run build`
Expected: both pass.

---

## Self-Review

**Spec coverage:**
- Range inputs (from/to) → Task 4.1.
- `analyzePageRange(from, to)` sequential with skip-cached → Task 3.2.
- Cancel button + `cancelBatchRef` → Task 3.3 + 4.1.
- Page indicator in progress panel → Task 4.3.
- Block/single-page button locking during run → already covered by existing `isBatchAnalyzing` guards (Task 3 reuses the same flag).
- Invalid range handling → `clampPageRange` (Task 1) + UI hint (Task 4.1).
- zh/en strings → Task 2.
- Acceptance criteria (lint/build/test) → Task 5.

**Placeholder scan:** None. All steps include concrete code or commands.

**Type consistency:** `BatchProgress` fields (`currentPage`, `totalPages`) are added in Task 2 and read in Task 4.3. `clampPageRange` returns `{ from, to }` (Task 1) and is consumed in Task 3.2. `cancelBatchRef` is created in Task 3.1 and read in Task 3.2 / set in Task 3.3.

**Note:** `analyzePageRange` uses `getMokuroBlockText` and `getCacheKey` which already exist in the file. `persistAnalysisCache` and `analysisCacheRef` already exist from the prior cache fix. No new dependencies beyond `clampPageRange` and the two icons.
