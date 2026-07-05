# Mokuro Page-Range Batch Analysis

## Goal
Let the user pick a start and end page in Mokuro Reader and batch-analyze every OCR block across that page range in one run, instead of analyzing one page at a time.

## Approach (chosen: A — stay put + progress panel)
The current page view does not change during a range batch. A new range control sits next to the existing "Analyze page" button. The existing block progress bar is reused and extended with a page indicator. A Cancel button stops the run.

## UI Changes

In `src/components/MokuroReader.tsx`, next to the existing single-page "Analyze page" button (around line 622-632), add a page-range control that renders when `mokuroFile` is loaded:

- A "From page" number input (default 1).
- A "To page" number input (default `mokuroFile.pages.length`).
- An "Analyze range" button (purple, matches existing style).
- A "Cancel" button shown only while a range batch is running.

Inputs are clamped to `[1, pageCount]`. If `from > to`, the button is disabled with a hint, or the values are swapped on run — chosen: disable with a small inline hint (simpler, no magic swap).

The existing single-page "Analyze page" button stays as-is.

## Behavior

### `analyzePageRange(fromPage, toPage)`
New async function. 1-based page numbers, inclusive range.

1. Guard: if no `mokuroFile`, or `isBatchAnalyzing`, or `from > to`, or out of bounds → return.
2. Set `isBatchAnalyzing = true`, reset `cancelBatchRef.current = false`.
3. Initialize `batchProgress` with `totalPages = to - from + 1`, `currentPage = from`, block counters per current page.
4. For each page index `i` from `from-1` to `to-1`:
   a. If `cancelBatchRef.current` → break.
   b. Update `batchProgress.currentPage = i + 1`.
   c. Read `mokuroFile.pages[i]` blocks (not `currentPage`, since the view stays put).
   d. For each block with non-empty text:
      - If `cancelBatchRef.current` → break outer.
      - If `analysisCacheRef.current[cacheKey]` exists → increment `skipped`.
      - Else call `analyzeText(block.text, { provider, language })`, update `analysisCacheRef` + `setAnalysisCache` + `persistAnalysisCache` (same pattern as `analyzeCurrentPage`), increment `completed` (or `failed` on error).
      - Update `batchProgress` after each block.
   e. Increment `completedPages`.
5. On finish/cancel: `setIsBatchAnalyzing(false)`, toast success or cancelled.

### Cancellation
- `cancelBatchRef = useRef(false)`.
- "Cancel" button sets `cancelBatchRef.current = true`.
- The loop checks the ref after each block and at the top of each page; breaks when true.
- A cancelled run keeps whatever was cached before cancellation.

### Block-button locking
The existing `disabled={isBatchAnalyzing}` guards on the overlay and list block buttons already cover range mode (same flag). The single-page "Analyze page" button is also already disabled by `isBatchAnalyzing`.

## State

- New: `batchRangeFrom: string` and `batchRangeTo: string` (string state for controlled number inputs; parsed on run).
- New: `cancelBatchRef = useRef(false)`.
- Extend `BatchProgress` with optional range fields:
  ```ts
  interface BatchProgress {
    total: number       // blocks on the current page
    completed: number
    skipped: number
    failed: number
    // range-only (undefined for single-page batch):
    currentPage?: number
    totalPages?: number
  }
  ```
- Existing `analyzeCurrentPage` sets `currentPage/totalPages` to undefined (or omits them) so single-page mode is unchanged.

## Progress Panel
Extend the existing panel (lines 665-685): when `batchProgress.currentPage` is set, render a "Page X / Y" line above the block progress bar. The block progress bar still shows `completed+skipped+failed / total` for the current page.

## i18n
Add to both `UI_TEXT.zh` and `UI_TEXT.en`:
- `fromPage` / `fromPageLabel`
- `toPage` / `toPageLabel`
- `analyzeRange` (button) / `analyzingRange` (running state)
- `cancelBatch`
- `rangeInvalid` (hint for `from > to`)
- `rangeComplete` / `rangeCancelled` (toasts)
- `page` (label for "Page X/Y")

## Out of Scope
- No ETA / time-remaining display.
- No per-page navigation during the run.
- No persistence of the chosen range across sessions.
- No parallel block analysis (sequential, one block at a time, same as today).

## Acceptance Criteria
- [ ] User can enter from/to page numbers and click "Analyze range" to batch-analyze all blocks in that range.
- [ ] Already-cached blocks are skipped (not re-analyzed).
- [ ] Progress panel shows current page (X/Y) and per-page block progress bar.
- [ ] Cancel button stops the run; cached results so far are kept.
- [ ] Block buttons and single-page button are disabled during the run.
- [ ] Invalid range (from > to, or out of bounds) disables the run button with a hint.
- [ ] zh/en strings present for all new UI text.
- [ ] `npm run lint`, `npm run build`, `npm test` pass.
