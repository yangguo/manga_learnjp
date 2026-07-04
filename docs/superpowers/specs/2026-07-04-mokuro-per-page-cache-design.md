# Mokuro Per-Page Cache & Batch UX Improvements

## Goal
1. Split the single `mokuro-analysis-cache.json` into one file per page under a `mokuro-analysis-cache/` subdirectory, with auto-migration of the existing single-file cache.
2. During multi-page batch analysis, let the user keep flipping pages to read, keep the progress bar visible, and let them click already-analyzed blocks to view results immediately.

## Current State
- All block analyses are stored in one file `mokuro-analysis-cache.json` at the root of the selected Mokuro directory, rewritten in full on every block analysis.
- Format: `{ version: 1, savedAt, source: {title, pageCount}, analyses: { [cacheKey]: AnalysisResult } }` where `cacheKey = provider:language:pageIndex:blockIndex`.
- Block buttons are disabled (`disabled={isBatchAnalyzing}`) during any batch, so the user cannot click blocks to view cached results while a range batch runs.
- Page navigation is not disabled during batch, and `analyzePageRange` reads pages by index (independent of the current view).

## Design

### 1. Cache storage: per-page files

**Directory & files**
- New subdirectory `mokuro-analysis-cache/` under the selected Mokuro directory (replaces the single `mokuro-analysis-cache.json` file).
- One file per page: `page-NNN.json` where `NNN` is the 1-based page index, zero-padded to `String(pageCount).length` digits (minimum 3). Example for a 220-page volume: `page-001.json` … `page-220.json`.

**File content**
```ts
interface MokuroPageAnalysisCacheFile {
  version: 1
  savedAt: string
  pageIndex: number
  analyses: Record<string, AnalysisResult>  // only this page's entries; cacheKey stays provider:language:pageIndex:blockIndex
}
```
The in-memory cache map (`Record<fullCacheKey, AnalysisResult>`) is unchanged — each page file just holds the subset of entries whose `pageIndex` matches the file.

**Persistence**
- `persistAnalysisCache(nextCache)` is replaced by `persistPageCache(pageIndex, nextCache)`, which writes only `page-NNN.json` for that page.
- Callers all know the page index:
  - `analyzeSelection` → `persistPageCache(selection.pageIndex, nextCache)`
  - `analyzeCurrentPage` → `persistPageCache(currentPageIndex, nextCache)`
  - `analyzePageRange` → `persistPageCache(pageIdx, nextCache)` inside the block loop
- In directory mode: `directoryHandle.getDirectoryHandle('mokuro-analysis-cache', {create:true})`, then `getFileHandle('page-NNN.json', {create:true})`, write JSON.
- In localStorage fallback mode: keep writing the whole cache as a single JSON blob to `localStorage[getBrowserCacheKey(name)]` (no per-page split — localStorage is key/value and does not benefit from splitting).

**Loading**
- `planMokuroDirectoryImport` returns `cachePageFiles: T[]` (all files whose relative path matches `mokuro-analysis-cache/page-*.json`) instead of the single `cacheFile`.
- `importDirectoryFiles` parses each page file and merges `analyses` into the in-memory cache. Unreadable files are skipped with a console warning (one bad page file must not break the whole load).

**Migration (chosen: A — auto-migrate)**
- On load, if the old `mokuro-analysis-cache.json` exists at the directory root (alongside the .mokuro file), parse it with the existing `parseMokuroAnalysisCacheContent`, group entries by `pageIndex`, and write each group to `mokuro-analysis-cache/page-NNN.json`.
- After successfully writing all page files, delete the old `mokuro-analysis-cache.json`.
- If migration fails partway, keep whatever page files were written and leave the old file (next load retries).
- Migration only runs in directory mode (where we can write files). In localStorage mode, the existing blob is read as-is.

### 2. Batch UX

- **Page navigation**: already not disabled during batch; confirm `analyzePageRange` reads `mokuroFile.pages[pageIdx]` directly (it does). No change needed.
- **Progress bar**: stays in the header card, driven by global `batchProgress`. It already shows `第 X / Y 页` + per-page block progress during a range batch. No change needed.
- **Already-analyzed results visible**:
  - Remove `disabled={isBatchAnalyzing}` from the OCR block buttons (both the image overlay buttons and the sidebar list buttons). Keep `disabled={!text}` for empty blocks.
  - `analyzeSelection` already hits the cache first and only calls the API if uncached, so clicking a cached block during a batch shows its result instantly with no API call. Clicking an uncached block runs `analyzeSelection` concurrently — safe because `analysisCacheRef` serializes cache updates.
  - The block "analyzed" highlight (green) is derived from `analysisCache`, so when the batch updates the cache and the user navigates to that page, blocks light up immediately.
- The "Analyze page" and "Analyze range" buttons stay `disabled={isBatchAnalyzing}` to prevent two batches at once.

## Out of Scope
- localStorage mode is not split per page (keeps single blob).
- No sub-namespacing by provider/language (cacheKey already disambiguates inside a page file).
- No parallel block analysis (still sequential).
- No new migration UI or version-bump prompt — migration is silent and automatic.

## Acceptance Criteria
- [ ] After analyzing blocks, the selected directory contains `mokuro-analysis-cache/page-NNN.json` files (one per analyzed page), not a single `mokuro-analysis-cache.json`.
- [ ] Only the changed page's file is written when a block finishes (not the whole cache).
- [ ] Reloading a directory loads all `page-*.json` files and merges them into the in-memory cache.
- [ ] A directory with an old `mokuro-analysis-cache.json` is migrated to per-page files on load, and the old file is deleted.
- [ ] During a range batch, the user can flip pages (prev/next, page number input) and the progress bar stays visible showing the batch's current page.
- [ ] During a range batch, clicking an already-analyzed block shows its result instantly (no API call); the "Analyze page" / "Analyze range" buttons remain disabled.
- [ ] localStorage fallback still works (single blob).
- [ ] `npm run lint`, `npm run build`, `npm test` pass.
