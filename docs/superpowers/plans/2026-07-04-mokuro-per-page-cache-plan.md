# Mokuro Per-Page Cache & Batch UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the single Mokuro analysis cache file into per-page files under a `mokuro-analysis-cache/` subdirectory (with auto-migration), and let users flip pages and view cached results while a multi-page batch runs.

**Architecture:** New per-page serialize/parse helpers in `src/lib/mokuro.ts` (tested). `planMokuroDirectoryImport` returns page-file entries plus a legacy file. `MokuroReader.persistAnalysisCache` becomes `persistPageCache(pageIndex, ...)` which writes one page file in directory mode and falls back to a single localStorage blob. Load merges all page files (and the legacy file) and migrates the legacy file in directory mode. Block buttons drop the `isBatchAnalyzing` disable so cached results are viewable mid-batch.

**Tech Stack:** React, TypeScript, Tailwind, Vitest, File System Access API.

---

### Task 1: Add per-page cache helpers with tests

**Files:**
- Modify: `src/lib/mokuro.ts`
- Modify: `src/lib/mokuro.test.ts`

- [ ] **Step 1.1: Add the `MOKURO_ANALYSIS_CACHE_DIRNAME` constant**

In `src/lib/mokuro.ts`, right after the existing `MOKURO_ANALYSIS_CACHE_FILENAME` constant (around line 21), add:

```ts
export const MOKURO_ANALYSIS_CACHE_DIRNAME = 'mokuro-analysis-cache'
```

- [ ] **Step 1.2: Add `getPageCacheFilename`**

Append to `src/lib/mokuro.ts`:

```ts
// 1-based, zero-padded to the page count's digit width (min 3).
export const getPageCacheFilename = (pageIndex: number, pageCount: number): string => {
  const width = Math.max(3, String(pageCount).length)
  return `page-${String(pageIndex + 1).padStart(width, '0')}.json`
}
```

- [ ] **Step 1.3: Add `serializeMokuroPageAnalysisCache` and `parseMokuroPageAnalysisCacheContent`**

Append to `src/lib/mokuro.ts`:

```ts
export const serializeMokuroPageAnalysisCache = (
  pageIndex: number,
  analyses: Record<string, AnalysisResult>
): string => {
  const file = {
    version: 1 as const,
    savedAt: new Date().toISOString(),
    pageIndex,
    analyses
  }
  return `${JSON.stringify(file, null, 2)}\n`
}

export interface ParsedMokuroPageAnalysisCache {
  pageIndex: number
  analyses: Record<string, AnalysisResult>
}

export const parseMokuroPageAnalysisCacheContent = (content: string): ParsedMokuroPageAnalysisCache => {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('Mokuro page analysis cache must contain valid JSON')
  }

  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.analyses)) {
    throw new Error('Mokuro page analysis cache has an invalid format')
  }

  const analyses: Record<string, AnalysisResult> = {}
  Object.entries(parsed.analyses).forEach(([key, value]) => {
    if (isAnalysisResult(value)) {
      analyses[key] = value
    }
  })

  return {
    pageIndex: isFiniteNumber(parsed.pageIndex) ? parsed.pageIndex : -1,
    analyses
  }
}
```

- [ ] **Step 1.4: Add `groupAnalysesByPageIndex` and `filterAnalysesByPageIndex`**

Append to `src/lib/mokuro.ts`. The cacheKey format is `provider:language:pageIndex:blockIndex`, so `pageIndex` is the third `:`-segment.

```ts
const pageIndexFromCacheKey = (key: string): number | null => {
  const parts = key.split(':')
  const pageIndex = Number(parts[2])
  return Number.isFinite(pageIndex) ? pageIndex : null
}

export const groupAnalysesByPageIndex = (
  analyses: Record<string, AnalysisResult>
): Map<number, Record<string, AnalysisResult>> => {
  const groups = new Map<number, Record<string, AnalysisResult>>()
  for (const [key, value] of Object.entries(analyses)) {
    const pageIndex = pageIndexFromCacheKey(key)
    if (pageIndex === null) continue
    const group = groups.get(pageIndex) ?? {}
    group[key] = value
    groups.set(pageIndex, group)
  }
  return groups
}

export const filterAnalysesByPageIndex = (
  analyses: Record<string, AnalysisResult>,
  pageIndex: number
): Record<string, AnalysisResult> => {
  const result: Record<string, AnalysisResult> = {}
  for (const [key, value] of Object.entries(analyses)) {
    if (pageIndexFromCacheKey(key) === pageIndex) {
      result[key] = value
    }
  }
  return result
}
```

- [ ] **Step 1.5: Write the failing tests**

Append to `src/lib/mokuro.test.ts`. Add the new imports to the existing import block at the top:

```ts
import {
  MOKURO_ANALYSIS_CACHE_FILENAME,
  MOKURO_ANALYSIS_CACHE_DIRNAME,
  clampPageRange,
  createMokuroAnalysisCacheKey,
  createMokuroImageLookup,
  filterAnalysesByPageIndex,
  findMokuroPageImageFile,
  getPageCacheFilename,
  getMokuroBlockText,
  groupAnalysesByPageIndex,
  parseMokuroAnalysisCacheContent,
  parseMokuroPageAnalysisCacheContent,
  planMokuroDirectoryImport,
  serializeMokuroAnalysisCache,
  serializeMokuroPageAnalysisCache,
  parseMokuroFileContent
} from './mokuro'
```

Then append these test blocks at the end of the file:

```ts
describe('getPageCacheFilename', () => {
  it('zero-pads to the page count width (min 3)', () => {
    expect(getPageCacheFilename(0, 220)).toBe('page-001.json')
    expect(getPageCacheFilename(219, 220)).toBe('page-220.json')
  })

  it('uses at least 3 digits even for small volumes', () => {
    expect(getPageCacheFilename(0, 5)).toBe('page-001.json')
  })

  it('widens for 1000+ pages', () => {
    expect(getPageCacheFilename(999, 1000)).toBe('page-1000.json')
  })
})

describe('serializeMokuroPageAnalysisCache / parseMokuroPageAnalysisCacheContent', () => {
  const key = createMokuroAnalysisCacheKey({ provider: 'openai-format', language: 'zh', pageIndex: 2, blockIndex: 0 })
  const analyses: Record<string, AnalysisResult> = {
    [key]: {
      extractedText: 'こんにちは',
      sentences: [],
      translation: 'Hello',
      summary: 'greeting',
      provider: 'openai-format'
    }
  }

  it('round-trips a page cache file', () => {
    const content = serializeMokuroPageAnalysisCache(2, analyses)
    const parsed = parseMokuroPageAnalysisCacheContent(content)
    expect(parsed.pageIndex).toBe(2)
    expect(parsed.analyses[key]).toEqual(analyses[key])
  })

  it('throws on invalid JSON', () => {
    expect(() => parseMokuroPageAnalysisCacheContent('{not json')).toThrow('valid JSON')
  })
})

describe('groupAnalysesByPageIndex / filterAnalysesByPageIndex', () => {
  const page0 = createMokuroAnalysisCacheKey({ provider: 'openai-format', language: 'zh', pageIndex: 0, blockIndex: 0 })
  const page1 = createMokuroAnalysisCacheKey({ provider: 'openai-format', language: 'zh', pageIndex: 1, blockIndex: 0 })
  const analyses: Record<string, AnalysisResult> = {
    [page0]: { extractedText: 'a', sentences: [], translation: 'a', summary: 'a', provider: 'openai-format' },
    [page1]: { extractedText: 'b', sentences: [], translation: 'b', summary: 'b', provider: 'openai-format' }
  }

  it('groups entries by page index', () => {
    const groups = groupAnalysesByPageIndex(analyses)
    expect(groups.size).toBe(2)
    expect(groups.get(0)).toHaveProperty(page0)
    expect(groups.get(1)).toHaveProperty(page1)
  })

  it('filters to a single page', () => {
    const filtered = filterAnalysesByPageIndex(analyses, 1)
    expect(Object.keys(filtered)).toEqual([page1])
  })
})
```

- [ ] **Step 1.6: Run the tests to verify they pass**

Run: `npm test -- src/lib/mokuro.test.ts`
Expected: PASS — all `mokuro` tests green, including the new helpers.

- [ ] **Step 1.7: Commit**

```bash
git add src/lib/mokuro.ts src/lib/mokuro.test.ts
git commit -m "feat(mokuro): add per-page cache serialize/parse helpers"
```

---

### Task 2: Update `planMokuroDirectoryImport` to surface page-cache files and the legacy file

**Files:**
- Modify: `src/lib/mokuro.ts`
- Modify: `src/lib/mokuro.test.ts`

- [ ] **Step 2.1: Update the `MokuroDirectoryImportPlan` interface**

Find the `MokuroDirectoryImportPlan` interface (around line 8) and replace its `cacheFile` field with two fields:

```ts
export interface MokuroDirectoryImportPlan<T extends MokuroImageCandidate> {
  mokuroFile: T
  imageFiles: T[]
  cachePageFiles: T[]
  legacyCacheFile: T | null
}
```

- [ ] **Step 2.2: Update `planMokuroDirectoryImport`**

Replace the function body's `return` block (around line 180-184) with:

```ts
  const isPageCacheFile = (file: T): boolean => {
    const path = (file.webkitRelativePath ?? file.name).replace(/\\/g, '/')
    return /(^|\/)mokuro-analysis-cache\/page-\d+\.json$/.test(path)
  }

  return {
    mokuroFile: sortedMokuroFiles[0],
    imageFiles: files.filter(file => isImageFileName(file.name)),
    cachePageFiles: files.filter(isPageCacheFile),
    legacyCacheFile: files.find(file => file.name === MOKURO_ANALYSIS_CACHE_FILENAME) ?? null
  }
```

- [ ] **Step 2.3: Update the existing `planMokuroDirectoryImport` test**

Find the existing test for `planMokuroDirectoryImport` in `src/lib/mokuro.test.ts` (the one that asserts `.mokuroFile` / `.imageFiles` / `.cacheFile`). Update its assertions from `plan.cacheFile` to `plan.legacyCacheFile` and `plan.cachePageFiles`. Example (adjust to the existing test's data):

```ts
  it('plans the mokuro file, image files, and cache files', () => {
    const plan = planMokuroDirectoryImport(files)
    expect(plan.mokuroFile.name).toBe('spy6.mokuro')
    expect(plan.imageFiles.length).toBeGreaterThan(0)
    expect(plan.cachePageFiles).toEqual([])
    expect(plan.legacyCacheFile?.name).toBe(MOKURO_ANALYSIS_CACHE_FILENAME)
  })
```

(If the existing test builds a `files` array with a `mokuro-analysis-cache.json` entry, keep that entry so `legacyCacheFile` is non-null. Add a `mokuro-analysis-cache/page-001.json` entry to a second case if you want to assert page-file detection — but minimally update the existing assertions so the test compiles.)

- [ ] **Step 2.4: Run the tests**

Run: `npm test -- src/lib/mokuro.test.ts`
Expected: PASS.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/mokuro.ts src/lib/mokuro.test.ts
git commit -m "feat(mokuro): plan import surfaces page-cache files and legacy file"
```

---

### Task 3: Switch MokuroReader persistence and loading to per-page files

**Files:**
- Modify: `src/components/MokuroReader.tsx`

- [ ] **Step 3.1: Update imports from `@/lib/mokuro`**

Add the new helpers to the existing import block (around line 23-32). The final import list should include:

```ts
import {
  MOKURO_ANALYSIS_CACHE_DIRNAME,
  MOKURO_ANALYSIS_CACHE_FILENAME,
  clampPageRange,
  createMokuroAnalysisCacheKey,
  createMokuroImageLookup,
  filterAnalysesByPageIndex,
  findMokuroPageImageFile,
  getPageCacheFilename,
  getMokuroBlockText,
  parseMokuroAnalysisCacheContent,
  parseMokuroFileContent,
  parseMokuroPageAnalysisCacheContent,
  planMokuroDirectoryImport,
  serializeMokuroAnalysisCache,
  serializeMokuroPageAnalysisCache,
  type MokuroImageCandidate
} from '@/lib/mokuro'
```

- [ ] **Step 3.2: Replace `persistAnalysisCache` with `persistPageCache`**

Find `persistAnalysisCache` (around line 315-342) and replace the whole function with:

```ts
  const persistPageCache = useCallback(async (
    pageIndex: number,
    nextCache: Record<string, AnalysisResult>,
    sourceMokuroFile = mokuroFile,
    sourceMokuroName = mokuroName
  ) => {
    const fallbackContent = () => serializeMokuroAnalysisCache(nextCache, {
      title: sourceMokuroFile?.title ?? sourceMokuroName ?? undefined,
      pageCount: sourceMokuroFile?.pages.length
    })

    try {
      if (directoryHandleRef.current && sourceMokuroFile) {
        const cacheDir = await directoryHandleRef.current.getDirectoryHandle(MOKURO_ANALYSIS_CACHE_DIRNAME, { create: true })
        const filename = getPageCacheFilename(pageIndex, sourceMokuroFile.pages.length)
        const fileHandle = await cacheDir.getFileHandle(filename, { create: true })
        const pageAnalyses = filterAnalysesByPageIndex(nextCache, pageIndex)
        const writable = await fileHandle.createWritable()
        await writable.write(serializeMokuroPageAnalysisCache(pageIndex, pageAnalyses))
        await writable.close()
        setCacheStatus(UI_TEXT[analysisLanguage].savedDirectory)
        return
      }

      window.localStorage.setItem(getBrowserCacheKey(sourceMokuroName), fallbackContent())
      setCacheStatus(UI_TEXT[analysisLanguage].savedBrowser)
    } catch (saveError) {
      console.error('Failed to persist Mokuro page analysis cache:', saveError)
      window.localStorage.setItem(getBrowserCacheKey(sourceMokuroName), fallbackContent())
      setCacheStatus(UI_TEXT[analysisLanguage].savedBrowser)
    }
  }, [analysisLanguage, mokuroFile, mokuroName])
```

- [ ] **Step 3.3: Update `analyzeSelection` to call `persistPageCache`**

In `analyzeSelection` (the single-block analysis), find the persistence call:

```ts
      await persistAnalysisCache(nextCache)
```

Replace with:

```ts
      await persistPageCache(selection.pageIndex, nextCache)
```

- [ ] **Step 3.4: Update `analyzeCurrentPage` to call `persistPageCache`**

In `analyzeCurrentPage`, find:

```ts
        await persistAnalysisCache(nextCache)
```

Replace with:

```ts
        await persistPageCache(currentPageIndex, nextCache)
```

- [ ] **Step 3.5: Update `analyzePageRange` to call `persistPageCache`**

In `analyzePageRange`, inside the block loop, find:

```ts
          await persistAnalysisCache(nextCache)
```

Replace with:

```ts
          await persistPageCache(pageIdx, nextCache)
```

- [ ] **Step 3.6: Update `importDirectoryFiles` loading + migration**

Find the cache-loading section in `importDirectoryFiles` (around line 366-378). It currently reads `plan.cacheFile` and falls back to localStorage. Replace the cache-loading block (the `if (plan.cacheFile) { ... } else if (storageMode === 'browser') { ... }` block) with:

```ts
    let loadedCache: Record<string, AnalysisResult> = {}

    for (const cachePageFile of plan.cachePageFiles) {
      try {
        const parsed = parseMokuroPageAnalysisCacheContent(await cachePageFile.file.text())
        loadedCache = { ...loadedCache, ...parsed.analyses }
      } catch (cacheError) {
        console.warn('Failed to parse Mokuro page analysis cache:', cacheError)
      }
    }

    if (plan.legacyCacheFile) {
      try {
        const legacy = parseMokuroAnalysisCacheContent(await plan.legacyCacheFile.file.text())
        loadedCache = { ...legacy.analyses, ...loadedCache }
      } catch (cacheError) {
        console.warn('Failed to parse legacy Mokuro analysis cache:', cacheError)
      }
    } else if (storageMode === 'browser') {
      const browserCache = window.localStorage.getItem(getBrowserCacheKey(plan.mokuroFile.name))
      if (browserCache) {
        try {
          loadedCache = { ...parseMokuroAnalysisCacheContent(browserCache).analyses, ...loadedCache }
        } catch (cacheError) {
          console.warn('Failed to parse browser Mokuro analysis cache:', cacheError)
        }
      }
    }

    // Migrate the legacy single file into per-page files (directory mode only).
    if (directoryHandleRef.current && parsedMokuro && plan.legacyCacheFile) {
      try {
        const cacheDir = await directoryHandleRef.current.getDirectoryHandle(MOKURO_ANALYSIS_CACHE_DIRNAME, { create: true })
        const groups = groupAnalysesByPageIndex(loadedCache)
        for (const [pageIndex, pageAnalyses] of groups) {
          const filename = getPageCacheFilename(pageIndex, parsedMokuro.pages.length)
          const fileHandle = await cacheDir.getFileHandle(filename, { create: true })
          const writable = await fileHandle.createWritable()
          await writable.write(serializeMokuroPageAnalysisCache(pageIndex, pageAnalyses))
          await writable.close()
        }
        await directoryHandleRef.current.removeEntry(MOKURO_ANALYSIS_CACHE_FILENAME)
      } catch (migrationError) {
        console.warn('Failed to migrate legacy Mokuro analysis cache:', migrationError)
      }
    }
```

You also need to import `groupAnalysesByPageIndex` — add it to the `@/lib/mokuro` import list (Step 3.1 already includes it).

- [ ] **Step 3.7: Verify lint and build**

Run: `npm run lint && npm run build`
Expected: lint with 0 new errors, build compiles. (The `persistAnalysisCache` reference is gone; all callers updated.)

- [ ] **Step 3.8: Commit**

```bash
git add src/components/MokuroReader.tsx
git commit -m "feat(mokuro): persist and load per-page cache files with migration"
```

---

### Task 4: Batch UX — allow viewing cached results mid-batch

**Files:**
- Modify: `src/components/MokuroReader.tsx`

- [ ] **Step 4.1: Remove `isBatchAnalyzing` from the overlay block buttons**

Find the OCR overlay block button (around line 760-770) and remove `disabled={isBatchAnalyzing}` so only the empty-text guard remains. The button should look like:

```tsx
                        <button
                          key={`${currentPageIndex}-${blockIndex}`}
                          type="button"
                          aria-label={`OCR block ${blockIndex + 1}: ${text}`}
                          title={text || 'Empty OCR block'}
                          onClick={() => handleBlockSelect(blockIndex, text)}
                          style={getBlockStyle(block, currentPage)}
                          className={`absolute rounded-sm border transition-colors ${
                            selected
                              ? 'border-amber-300 bg-amber-300/25 shadow-[0_0_0_2px_rgba(251,191,36,0.35)]'
                              : analyzed
                                ? 'border-emerald-300/80 bg-emerald-300/10 hover:bg-emerald-300/25'
                                : 'border-cyan-300/70 bg-cyan-400/15 hover:bg-cyan-300/35'
                          }`}
                        >
                          <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{text}</span>
                        </button>
```

(The key change: the `disabled={isBatchAnalyzing}` attribute is removed. Keep whatever `analyzed`/`selected` classes the current code already has.)

- [ ] **Step 4.2: Remove `isBatchAnalyzing` from the sidebar list block buttons**

Find the sidebar list block button (around line 815) and change its `disabled` to only guard empty text:

```tsx
                      disabled={!text}
```

(Remove `|| isBatchAnalyzing` from the existing `disabled={!text || isBatchAnalyzing}`.)

- [ ] **Step 4.3: Verify lint and build**

Run: `npm run lint && npm run build`
Expected: lint with 0 new errors, build compiles.

- [ ] **Step 4.4: Commit**

```bash
git add src/components/MokuroReader.tsx
git commit -m "feat(mokuro): allow viewing cached blocks during batch analysis"
```

---

### Task 5: Verify end-to-end

- [ ] **Step 5.1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new per-page cache helper tests.

- [ ] **Step 5.2: Manual browser verification**

If the dev server is not running, start it: `npm run dev`. Open `http://localhost:3000`, switch to Mokuro Reader, and load a Mokuro directory (e.g., `output/pdf/spy6-mokuro` or `spy1-mokuro-output`).

Verify:
- After analyzing a block, the selected directory contains `mokuro-analysis-cache/page-001.json` (not a single `mokuro-analysis-cache.json`).
- Reloading the directory loads the per-page files and shows the blocks as analyzed (green).
- A directory that still has an old `mokuro-analysis-cache.json` is migrated: per-page files appear and the old file is gone after load.
- During a multi-page batch (set From/To and click "批量分析范围"), flipping pages works, the progress bar stays visible showing "第 X / Y 页", and clicking an already-analyzed (green) block shows its result instantly.
- The "Analyze page" and "Analyze range" buttons stay disabled during the batch.

- [ ] **Step 5.3: Final lint + build**

Run: `npm run lint && npm run build`
Expected: both pass.

---

## Self-Review

**Spec coverage:**
- Per-page directory `mokuro-analysis-cache/page-NNN.json` → Task 1.1/1.2, Task 3.2/3.6.
- Per-page serialize/parse format → Task 1.3, Task 3.2/3.6.
- `persistPageCache(pageIndex)` writes only that page → Task 3.2; callers pass pageIndex → Task 3.3/3.4/3.5.
- Load merges `page-*.json` + legacy file → Task 3.6.
- Migration writes page files + deletes legacy in directory mode → Task 3.6.
- localStorage fallback keeps single blob → Task 3.2 (`fallbackContent`).
- Page navigation not blocked (already works) → no change needed; verified in Task 5.2.
- Progress bar stays visible (already global) → no change needed; verified in Task 5.2.
- Block buttons not disabled during batch → Task 4.1/4.2.
- "Analyze page" / "Analyze range" stay disabled during batch → unchanged (Task 4 only touches block buttons).
- Acceptance criteria (lint/build/test + manual) → Task 5.

**Placeholder scan:** None. All steps include concrete code or commands.

**Type consistency:** `persistPageCache(pageIndex, nextCache, sourceMokuroFile?, sourceMokuroName?)` signature is defined in Task 3.2 and called identically in Task 3.3/3.4/3.5. `MokuroDirectoryImportPlan` gains `cachePageFiles` and `legacyCacheFile` in Task 2.1, consumed in Task 3.6. `getPageCacheFilename`, `serializeMokuroPageAnalysisCache`, `parseMokuroPageAnalysisCacheContent`, `groupAnalysesByPageIndex`, `filterAnalysesByPageIndex` are defined in Task 1 and consumed in Task 3.
