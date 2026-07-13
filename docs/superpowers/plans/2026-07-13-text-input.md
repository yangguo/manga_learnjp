# 纯文本输入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户粘贴日文文本或上传 `.txt` 文件进行分析,复用现有 AI 讲解/JLPT/生词本/SRS 闭环,并修复 `analyzeText` 共享路径的三个分批债务。

**Architecture:** 抽出 `src/lib/text-batching.ts` 承载切句/分批/合并三个纯函数(带测试),`ai-service.ts` 的两个 `analyzeText` 实现改为导入并使用修复后的版本。新增 `AnalysisMode = 'text'` 与 `TextInput` 组件作为输入入口,新增 `TextViewer` 复用 `MokuroAnalysisPanel` 展示无图分析结果。`page.tsx` 增加 text 模式分支。

**Tech Stack:** TypeScript, React (App Router, 'use client'), Vitest, Tailwind CSS。

## Global Constraints

- TypeScript, two-space indentation, single quotes, no trailing semicolons.
- Import via `@/` alias for app code; functional React components with `'use client'`.
- `AIProvider = 'openai' | 'openai-format'`(`src/lib/types.ts`),两处 `analyzeText` 实现都要改。
- 中文 `'zh'` 是 Image Analyzer 与纯文本默认语言(CLAUDE.md 约定)。
- `MAX_BATCH_CHARS = 800`(初值,提为常量),`analyzeSingleBatch` 输出 `max_tokens: 2000`。
- 测试与被测模块同级 `src/lib/*.test.ts`,Vitest。
- 不做 `.txt` 以外格式、内联展开视图、自动编码检测。
- `netlify/src/lib/` 若有 `ai-service` 镜像需同步(本计划 Task 7 检查)。

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `src/lib/text-batching.ts` | 切句 / 字符预算分批 / 合并(含失败占位句) 三个纯函数 + 常量 | Create |
| `src/lib/text-batching.test.ts` | 上述纯函数单元测试 | Create |
| `src/lib/ai-service.ts` | 删除内部三个函数,改 import;两个 `analyzeText` 用新分批+失败标记 | Modify |
| `src/lib/types.ts` | `AnalysisMode` 增加 `'text'` | Modify |
| `src/lib/analysis-modes.ts` | `ANALYSIS_MODE_OPTIONS` 增加 text 选项 | Modify |
| `src/lib/analysis-modes.test.ts` | 锁 text 选项存在 | Modify |
| `src/components/TextInput.tsx` | 粘贴框 + .txt 上传入口 | Create |
| `src/components/TextViewer.tsx` | 无图分析结果展示,复用 `MokuroAnalysisPanel` | Create |
| `src/components/TextAnalyzer.tsx` | 死代码,删除 | Delete |
| `src/app/page.tsx` | text 模式分支 + 渲染 TextInput/TextViewer | Modify |

`text-batching.ts` 独立是因为 `ai-service.ts` 已 2245+ 行,三个纯函数抽出既可测又改善聚焦。`TextViewer` 独立于 `ImagePageAnalysisViewer` 是因为后者强依赖图片左栏,文本无图。

---

### Task 1: 抽出 text-batching 纯函数(TDD)

**Files:**
- Create: `src/lib/text-batching.ts`
- Create: `src/lib/text-batching.test.ts`

**Interfaces:**
- Produces: `splitTextIntoSentences(text: string): string[]`、`createTextBatches(sentences: string[], maxBatchChars = MAX_BATCH_CHARS): string[][]`、`combineBatchResults(batches: BatchResult[]): AnalysisResult`、`MAX_BATCH_CHARS = 800`、`BatchResult` 类型。

`BatchResult` 定义(本任务产出,供 Task 3 消费):

```ts
export interface BatchResult {
  sentences: SentenceAnalysis[]
  translation: string
  extractedText: string
  summary: string
  status: 'ok' | 'failed'
  error?: string
}
```

`SentenceAnalysis` 与 `AnalysisResult` 从 `./types` 导入。`combineBatchResults` 返回 `AnalysisResult`(不含 provider,由调用方补)。

- [ ] **Step 1: Write the failing test (splitTextIntoSentences)**

Create `src/lib/text-batching.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { splitTextIntoSentences, MAX_BATCH_CHARS } from './text-batching'

describe('splitTextIntoSentences', () => {
  it('returns empty for empty or whitespace-only text', () => {
    expect(splitTextIntoSentences('')).toEqual([])
    expect(splitTextIntoSentences('   ')).toEqual([])
  })

  it('splits on Japanese sentence endings and keeps the ending character', () => {
    expect(splitTextIntoSentences('こんにちは。さようなら！')).toEqual(['こんにちは。', 'さようなら！'])
  })

  it('treats ellipsis tilde and music notes as endings', () => {
    expect(splitTextIntoSentences('あ…い～')).toEqual(['あ…', 'い～'])
  })

  it('keeps trailing text without an ending as one sentence', () => {
    expect(splitTextIntoSentences('こんにちは')).toEqual(['こんにちは'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/text-batching.test.ts`
Expected: FAIL — module `./text-batching` not found.

- [ ] **Step 3: Write minimal implementation for splitTextIntoSentences**

Create `src/lib/text-batching.ts`:

```ts
import type { AnalysisResult, SentenceAnalysis } from './types'

export const MAX_BATCH_CHARS = 800

export interface BatchResult {
  sentences: SentenceAnalysis[]
  translation: string
  extractedText: string
  summary: string
  status: 'ok' | 'failed'
  error?: string
}

const SENTENCE_ENDINGS = /[。！？…～♪♫]/

export const splitTextIntoSentences = (text: string): string[] => {
  if (!text || text.trim().length === 0) {
    return []
  }

  const sentences: string[] = []
  let currentSentence = ''

  for (const char of text) {
    currentSentence += char
    if (SENTENCE_ENDINGS.test(char)) {
      sentences.push(currentSentence.trim())
      currentSentence = ''
    }
  }

  if (currentSentence.trim().length > 0) {
    sentences.push(currentSentence.trim())
  }

  return sentences.filter(s => s.trim().length > 0)
}
```

(Leave `createTextBatches` and `combineBatchResults` for Steps 5/9 — but to satisfy imports in the test file header, add stub exports now that throw, OR write tests incrementally. We add real exports in later steps; to keep this step's test compiling, only import `splitTextIntoSentences` and `MAX_BATCH_CHARS` in this step's test. Adjust the test import line to: `import { splitTextIntoSentences, MAX_BATCH_CHARS } from './text-batching'`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/text-batching.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test (createTextBatches)**

Append to `src/lib/text-batching.test.ts`:

```ts
import { createTextBatches } from './text-batching'

describe('createTextBatches', () => {
  it('returns empty for no sentences', () => {
    expect(createTextBatches([])).toEqual([])
  })

  it('groups sentences under the char budget into one batch without splitting a sentence', () => {
    const sentences = ['短い。', '短い。', '短い。']
    expect(createTextBatches(sentences)).toEqual([['短い。', '短い。', '短い。']])
  })

  it('starts a new batch when adding the next sentence would exceed the budget', () => {
    const long = 'あ'.repeat(MAX_BATCH_CHARS - 5) + '。'
    const next = 'い'.repeat(MAX_BATCH_CHARS - 5) + '。'
    expect(createTextBatches([long, next])).toEqual([[long], [next]])
  })

  it('gives an over-budget single sentence its own batch instead of splitting it', () => {
    const huge = 'あ'.repeat(MAX_BATCH_CHARS + 50) + '。'
    expect(createTextBatches([huge])).toEqual([[huge]])
  })

  it('preserves sentence order across batches', () => {
    const sentences = ['あ。', 'い。', 'う。', 'え。', 'お。']
    const batches = createTextBatches(sentences, 10)
    expect(batches.flat()).toEqual(sentences)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/lib/text-batching.test.ts`
Expected: FAIL — `createTextBatches` not exported.

- [ ] **Step 7: Write minimal implementation for createTextBatches**

Append to `src/lib/text-batching.ts`:

```ts
export const createTextBatches = (
  sentences: string[],
  maxBatchChars: number = MAX_BATCH_CHARS
): string[][] => {
  if (sentences.length === 0) return []

  const batches: string[][] = []
  let current: string[] = []
  let currentLen = 0

  for (const sentence of sentences) {
    // An over-budget sentence gets its own batch so we never split a sentence.
    if (sentence.length > maxBatchChars) {
      if (current.length > 0) {
        batches.push(current)
        current = []
        currentLen = 0
      }
      batches.push([sentence])
      continue
    }

    if (currentLen + sentence.length > maxBatchChars && current.length > 0) {
      batches.push(current)
      current = []
      currentLen = 0
    }

    current.push(sentence)
    currentLen += sentence.length
  }

  if (current.length > 0) {
    batches.push(current)
  }

  return batches
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- src/lib/text-batching.test.ts`
Expected: PASS.

- [ ] **Step 9: Write the failing test (combineBatchResults)**

Append to `src/lib/text-batching.test.ts`:

```ts
import type { BatchResult } from './text-batching'
import { combineBatchResults } from './text-batching'

const okBatch = (sentences: SentenceAnalysis[], translation: string): BatchResult => ({
  sentences,
  translation,
  extractedText: sentences.map(s => s.sentence).join(''),
  summary: 'single summary',
  status: 'ok'
})

describe('combineBatchResults', () => {
  it('throws when given no batches', () => {
    expect(() => combineBatchResults([])).toThrow('No batch results to combine')
  })

  it('returns the single batch directly when only one batch is provided', () => {
    const batch = okBatch([{ sentence: 'テスト。', translation: '', vocabulary: [], grammar: [], context: '' } as unknown as SentenceAnalysis], '翻訳')
    const result = combineBatchResults([batch])
    expect(result.summary).toBe('single summary')
    expect(result.sentences).toHaveLength(1)
  })

  it('merges sentences translations and extractedText across batches', () => {
    const b1 = okBatch([{ sentence: 'あ。', translation: '', vocabulary: [], grammar: [], context: '' } as unknown as SentenceAnalysis], 'A')
    const b2 = okBatch([{ sentence: 'い。', translation: '', vocabulary: [], grammar: [], context: '' } as unknown as SentenceAnalysis], 'B')
    const result = combineBatchResults([b1, b2])
    expect(result.sentences.map(s => s.sentence)).toEqual(['あ。', 'い。'])
    expect(result.translation).toBe('A B')
    expect(result.extractedText).toBe('あ。い。')
  })

  it('marks the summary as multi-batch combined instead of faking an overall summary', () => {
    const b1 = okBatch([{ sentence: 'あ。', translation: '', vocabulary: [], grammar: [], context: '' } as unknown as SentenceAnalysis], 'A')
    const b2 = okBatch([{ sentence: 'い。', translation: '', vocabulary: [], grammar: [], context: '' } as unknown as SentenceAnalysis], 'B')
    const result = combineBatchResults([b1, b2])
    expect(result.summary).toContain('2')
    expect(result.summary).not.toBe('single summary')
  })

  it('inserts a placeholder sentence for a failed batch so content does not silently vanish', () => {
    const ok = okBatch([{ sentence: 'あ。', translation: '', vocabulary: [], grammar: [], context: '' } as unknown as SentenceAnalysis], 'A')
    const failed: BatchResult = { sentences: [], translation: '', extractedText: '', summary: '', status: 'failed', error: 'timeout' }
    const result = combineBatchResults([ok, failed])
    expect(result.sentences).toHaveLength(2)
    expect(result.sentences[1].sentence).toContain('失败')
    expect(result.sentences[1].grammar).toEqual([])
    expect(result.sentences[1].vocabulary).toEqual([])
  })

  it('throws when every batch failed', () => {
    const failed: BatchResult = { sentences: [], translation: '', extractedText: '', summary: '', status: 'failed', error: 'x' }
    expect(() => combineBatchResults([failed])).toThrow('All batches failed to process')
  })
})
```

Add `import type { SentenceAnalysis } from './types'` to the test file top.

- [ ] **Step 10: Run test to verify it fails**

Run: `npm test -- src/lib/text-batching.test.ts`
Expected: FAIL — `combineBatchResults`/`BatchResult` not exported.

- [ ] **Step 11: Write minimal implementation for combineBatchResults**

Append to `src/lib/text-batching.ts`:

```ts
const PLACEHOLDER_VOCABULARY: SentenceAnalysis['vocabulary'] = []
const PLACEHOLDER_GRAMMAR: SentenceAnalysis['grammar'] = []

const failedPlaceholderSentence = (batchIndex: number, error: string): SentenceAnalysis => ({
  sentence: `[第${batchIndex + 1}段分析失败: ${error}]`,
  translation: '',
  vocabulary: PLACEHOLDER_VOCABULARY,
  grammar: PLACEHOLDER_GRAMMAR,
  context: ''
} as unknown as SentenceAnalysis)

export const combineBatchResults = (batches: BatchResult[]): Omit<AnalysisResult, 'provider'> => {
  if (batches.length === 0) {
    throw new Error('No batch results to combine')
  }

  if (batches.every(b => b.status === 'failed')) {
    throw new Error('All batches failed to process')
  }

  if (batches.length === 1 && batches[0].status === 'ok') {
    const b = batches[0]
    return {
      extractedText: b.extractedText,
      sentences: b.sentences,
      translation: b.translation,
      summary: b.summary,
      context: ''
    }
  }

  const allSentences: SentenceAnalysis[] = []
  const translations: string[] = []
  const extractedTexts: string[] = []
  let okCount = 0

  batches.forEach((batch, index) => {
    if (batch.status === 'ok') {
      okCount++
      allSentences.push(...batch.sentences)
      if (batch.translation) translations.push(batch.translation)
      if (batch.extractedText) extractedTexts.push(batch.extractedText)
    } else {
      allSentences.push(failedPlaceholderSentence(index, batch.error ?? 'unknown'))
    }
  })

  return {
    extractedText: extractedTexts.join(''),
    sentences: allSentences,
    translation: translations.join(' '),
    summary: `已合并 ${batches.length} 段分析结果(成功 ${okCount} 段,共 ${allSentences.length} 句)。整体总结见各段翻译与语法标注。`,
    context: ''
  }
}
```

Note: `SentenceAnalysis` exact field set is verified in `types.ts`; the `as unknown as SentenceAnalysis` cast is used only in tests for brevity. Production `analyzeText` (Task 3) builds real `BatchResult` from real `AnalysisResult`.

- [ ] **Step 12: Run test to verify it passes**

Run: `npm test -- src/lib/text-batching.test.ts`
Expected: PASS (all tests).

- [ ] **Step 13: Commit**

```bash
git add src/lib/text-batching.ts src/lib/text-batching.test.ts
git commit -m "feat(text): extract tested text-batching helpers"
```

---

### Task 2: 删除 ai-service 内部三函数,改用 text-batching

**Files:**
- Modify: `src/lib/ai-service.ts`(删除 `splitTextIntoSentences`/`createTextBatches`/`combineBatchResults` 内部定义,约行 235-300;顶部加 import)

**Interfaces:**
- Consumes: `splitTextIntoSentences`, `createTextBatches`, `combineBatchResults`, `BatchResult`, `MAX_BATCH_CHARS` from `./text-batching`(Task 1 产出)。
- Produces: 不变(对外 `analyzeText` 签名不变)。

- [ ] **Step 1: Add the import**

In `src/lib/ai-service.ts`, after the existing `import { fetchWithTimeout } from './fetch-timeout'` line (line 6), add:

```ts
import {
  splitTextIntoSentences,
  createTextBatches,
  combineBatchResults,
  MAX_BATCH_CHARS,
  type BatchResult
} from './text-batching'
```

- [ ] **Step 2: Delete the three internal functions**

Delete the block from `// Utility functions for text batching and sentence splitting` through the end of `combineBatchResults` (the function ending with `provider: batchResults[0]?.provider || 'unknown' }` and its closing `}`). This is approximately lines 230-300. Verify by searching: `grep -n "function splitTextIntoSentences\|function createTextBatches\|function combineBatchResults" src/lib/ai-service.ts` returns nothing after deletion.

- [ ] **Step 3: Verify it still typechecks (references not yet updated will error here — that's expected, fixed in Task 3)**

Run: `npx tsc --noEmit`
Expected: errors in the two `analyzeText` bodies (references to deleted `createTextBatches(sentences, 3)` etc.) — these are fixed in Task 3. Do not commit yet.

---

### Task 3: 两个 analyzeText 用新分批 + 失败标记

**Files:**
- Modify: `src/lib/ai-service.ts` — `OpenAIAIService.analyzeText` (line ~1250) and `OpenAIFormatService.analyzeText` (line ~1700)

**Interfaces:**
- Consumes: Task 1 helpers + `BatchResult`.
- Produces: `analyzeText` still returns `Promise<AnalysisResult>`; behavior change is internal (char-budget batching, failed-batch placeholders, honest multi-batch summary).

- [ ] **Step 1: Rewrite OpenAI analyzeText body**

Replace the body of `OpenDIAIService.analyzeText` (from `const sentences = splitTextIntoSentences(text)` through the final `return { ...combinedResult, provider: 'openai' as AIProvider }`) with:

```ts
    const sentences = splitTextIntoSentences(text)
    console.log(`OpenAI analyzeText: Split text into ${sentences.length} sentences`)

    if (sentences.length === 0) {
      return this.analyzeSingleBatch(text, language, excludeN5)
    }

    const batches = createTextBatches(sentences)
    console.log(`OpenAI analyzeText: Created ${batches.length} batches (max ${MAX_BATCH_CHARS} chars each)`)

    const batchResults: BatchResult[] = []
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const batchText = batch.join('')
      console.log(`OpenAI analyzeText: Processing batch ${i + 1}/${batches.length} with ${batch.length} sentences`)
      try {
        const batchResult = await this.analyzeSingleBatch(batchText, language, excludeN5)
        batchResults.push({
          sentences: batchResult.sentences ?? [],
          translation: batchResult.translation ?? '',
          extractedText: batchResult.extractedText ?? '',
          summary: batchResult.summary ?? '',
          status: 'ok'
        })
      } catch (error) {
        console.error(`OpenAI analyzeText: Error processing batch ${i + 1}:`, error)
        batchResults.push({
          sentences: [],
          translation: '',
          extractedText: batch.join(''),
          summary: '',
          status: 'failed',
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    const combinedResult = combineBatchResults(batchResults)
    console.log(`OpenAI analyzeText: Combined ${batchResults.length} batch results`)
    return {
      ...combinedResult,
      provider: 'openai' as AIProvider
    }
```

Note: the old `if (sentences.length <= 3) return this.analyzeSingleBatch(text, ...)` single-batch fast path is removed — `createTextBatches` naturally produces one batch for short text, and `combineBatchResults` returns the single batch's summary directly (verified by Task 1 test). The `sentences.length === 0` guard keeps a direct call for input that splits to nothing (e.g. text with no Japanese endings still yields ≥1 sentence, so this is a safety net).

- [ ] **Step 2: Rewrite OpenAI-format analyzeText body**

Apply the identical rewrite to `OpenAIFormatService.analyzeText` (line ~1700), changing only the log prefix to `OpenAI-format analyzeText` and the provider to `'openai-format' as AIProvider`. Remove the old `<= 2` sentence threshold and `createTextBatches(sentences, 2)` — both now use char-budget batching uniformly.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 4: Run existing client-api tests (regression)**

Run: `npm test -- src/lib/client-api.test.ts`
Expected: PASS (analyzeText contract unchanged).

- [ ] **Step 5: Run full lib test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Lint**

Run: `npm run lint -- --quiet`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai-service.ts
git commit -m "fix(ai-service): char-budget batching and visible failed-batch placeholders"
```

---

### Task 4: 增加 text 分析模式

**Files:**
- Modify: `src/lib/types.ts:245` — `AnalysisMode`
- Modify: `src/lib/analysis-modes.ts` — `ANALYSIS_MODE_OPTIONS`
- Modify: `src/lib/analysis-modes.test.ts`

**Interfaces:**
- Produces: `AnalysisMode = 'image' | 'mokuro' | 'text'`; `ANALYSIS_MODE_OPTIONS` includes a `text` entry.

- [ ] **Step 1: Write the failing test**

In `src/lib/analysis-modes.test.ts`, add (or extend the existing "options" test) an assertion that a `text` option exists:

```ts
import { ANALYSIS_MODE_OPTIONS } from './analysis-modes'

it('includes a text analyzer option', () => {
  expect(ANALYSIS_MODE_OPTIONS.some(o => o.mode === 'text')).toBe(true)
})
```

(If the file already imports `ANALYSIS_MODE_OPTIONS`, just add the `it` block. Match the existing test style in the file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/analysis-modes.test.ts`
Expected: FAIL — no `text` option.

- [ ] **Step 3: Add the type and option**

In `src/lib/types.ts:245`, change:

```ts
export type AnalysisMode = 'image' | 'mokuro'
```

to:

```ts
export type AnalysisMode = 'image' | 'mokuro' | 'text'
```

In `src/lib/analysis-modes.ts`, add a third entry to `ANALYSIS_MODE_OPTIONS`:

```ts
export const ANALYSIS_MODE_OPTIONS = [
  {
    mode: 'image',
    label: 'Image Analyzer',
    shortLabel: 'Image'
  },
  {
    mode: 'mokuro',
    label: 'Mokuro Reader',
    shortLabel: 'Mokuro'
  },
  {
    mode: 'text',
    label: 'Text Analyzer',
    shortLabel: 'Text'
  }
] as const satisfies readonly AnalysisModeOption[]
```

- [ ] **Step 4: Add text visual to ImageUploader's MODE_VISUALS**

`src/components/ImageUploader.tsx` has `MODE_VISUALS: Record<AnalysisMode, { icon; accent }>` (lines 18-27) which is a `Record<AnalysisMode,...>` - adding `'text'` to the union makes this a type error until a `text` entry is added. Add it:

```ts
const MODE_VISUALS: Record<AnalysisMode, { icon: LucideIcon; accent: string }> = {
  image: {
    icon: FileImage,
    accent: 'from-blue-500 to-cyan-500'
  },
  mokuro: {
    icon: FileJson,
    accent: 'from-amber-500 to-orange-500'
  },
  text: {
    icon: FileText,
    accent: 'from-purple-500 to-pink-500'
  }
}
```

Add `FileText` to the existing `lucide-react` import on line 4 (it already imports `Upload, FileImage, Loader2, ...`).

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/lib/analysis-modes.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck (CLAUDE.md: update types before response shapes)**

Run: `npx tsc --noEmit`
Expected: PASS (MODE_VISUALS now covers all AnalysisMode values).

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/analysis-modes.ts src/lib/analysis-modes.test.ts src/components/ImageUploader.tsx
git commit -m "feat(modes): add text analyzer mode"
```

---

### Task 5: TextInput 组件

**Files:**
- Create: `src/components/TextInput.tsx`

**Interfaces:**
- Consumes: `analyzeText` from `@/lib/client-api`, `AnalysisLanguage`/`AnalysisResult`/`AnalysisMode` from `@/lib/types`.
- Produces: `TextInput` component with props:
  ```ts
  interface TextInputProps {
    onAnalysisComplete: (result: AnalysisResult) => void
    onError: (message: string) => void
    analysisLanguage: AnalysisLanguage
    onAnalysisLanguageChange: (lang: AnalysisLanguage) => void
    analysisMode: AnalysisMode
    onModeChange: (mode: AnalysisMode) => void
  }
  ```
  This mirrors `ImageUploader`'s mode/language chrome so the mode switcher stays consistent. (If `ImageUploader` exposes a shared `ModeSwitcher`/language control, reuse it; otherwise replicate the minimal controls. Verify by reading `ImageUploader.tsx` header during implementation — the exact shared-control name, if any, is not locked here to avoid coupling the plan to a refactor.)

- [ ] **Step 1: Read ImageUploader to match mode/language control pattern**

Read `src/components/ImageUploader.tsx` top section to see how it renders the `analysisMode`/`onModeChange`/`analysisLanguage`/`onAnalysisLanguageChange` controls (the mode tabs and language toggle). `TextInput` should render the same controls so the header chrome is identical across modes. Note any shared subcomponent name; if none, inline the same markup.

- [ ] **Step 2: Create TextInput**

Create `src/components/TextInput.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { analyzeText } from '@/lib/client-api'
import type { AnalysisLanguage, AnalysisResult, AnalysisMode } from '@/lib/types'

const MAX_TEXT_BYTES = 100 * 1024 // 100KB

interface TextInputProps {
  onAnalysisComplete: (result: AnalysisResult) => void
  onError: (message: string) => void
  analysisLanguage: AnalysisLanguage
  onAnalysisLanguageChange: (lang: AnalysisLanguage) => void
  analysisMode: AnalysisMode
  onModeChange: (mode: AnalysisMode) => void
}

export default function TextInput({
  onAnalysisComplete,
  onError,
  analysisLanguage
}: TextInputProps) {
  const [text, setText] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleFile = (file: File) => {
    if (file.size > MAX_TEXT_BYTES) {
      onError('文件过大(超过 100KB),请截取后再试。')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      // Detect likely Shift-JIS garbage: high ratio of replacement chars.
      if (result.includes('�')) {
        onError('文件可能不是 UTF-8 编码(检测到乱码)。请用 UTF-8 重新保存后上传。')
        return
      }
      setText(result)
    }
    reader.onerror = () => onError('读取文件失败。')
    reader.readAsText(file, 'UTF-8')
  }

  const handleAnalyze = async () => {
    const trimmed = text.trim()
    if (!trimmed) {
      onError('请输入或上传日文文本。')
      return
    }
    setIsLoading(true)
    try {
      const result = await analyzeText(trimmed, { language: analysisLanguage })
      onAnalysisComplete(result)
    } catch (err) {
      onError(err instanceof Error ? err.message : '分析失败。')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-white/5 backdrop-blur-md rounded-2xl border border-gray-600 p-6 space-y-4">
      <div className="flex items-center gap-2 text-white">
        <FileText className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-semibold">文本分析</h2>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="粘贴日文文本,或上传 .txt 文件..."
        className="w-full h-48 p-3 rounded-lg bg-gray-900/60 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 font-japanese"
      />
      <div className="flex items-center gap-3">
        <label className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm cursor-pointer transition-colors">
          上传 .txt
          <input
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        </label>
        <button
          onClick={handleAnalyze}
          disabled={isLoading || !text.trim()}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {isLoading ? '分析中...' : '分析'}
        </button>
      </div>
    </div>
  )
}
```

Note: the `analysisMode`/`onModeChange`/`onAnalysisLanguageChange` props are accepted to match `ImageUploader`'s interface but the mode/language chrome rendering is deferred to Step 1's investigation — if `ImageUploader` uses a shared `ModeSwitcher` component, render it here the same way; if it inlines controls, inline the same. The core textarea/upload/analyze logic above is the locked deliverable. If matching the chrome reveals `ImageUploader` has a reusable header, import and render it; the plan does not forbid extracting a shared component if that is the cleanest match to existing patterns.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Lint**

Run: `npm run lint -- --quiet`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/TextInput.tsx
git commit -m "feat(text): add TextInput component"
```

---

### Task 6: TextViewer 组件 + 删除死代码 TextAnalyzer

**Files:**
- Create: `src/components/TextViewer.tsx`
- Delete: `src/components/TextAnalyzer.tsx`

**Interfaces:**
- Consumes: `MokuroAnalysisPanel` from `@/components/MokuroAnalysisPanel`, `AnalysisResult`/`AnalysisLanguage` from `@/lib/types`.
- Produces: `TextViewer` with props `{ analysisResult: AnalysisResult; language: AnalysisLanguage }`.

- [ ] **Step 1: Verify TextAnalyzer is dead code**

Run: `grep -rn "TextAnalyzer" src/ --include="*.tsx" --include="*.ts" | grep -v "TextAnalyzer.tsx:"`
Expected: no output (confirming it is imported nowhere). If output appears, stop and reconcile before deleting.

- [ ] **Step 2: Delete TextAnalyzer**

```bash
git rm src/components/TextAnalyzer.tsx
```

- [ ] **Step 3: Create TextViewer**

Create `src/components/TextViewer.tsx`:

```tsx
'use client'

import { FileText } from 'lucide-react'
import MokuroAnalysisPanel from '@/components/MokuroAnalysisPanel'
import type { AnalysisLanguage, AnalysisResult } from '@/lib/types'

const UI_TEXT = {
  zh: {
    title: '文本分析结果',
    subtitle: '词汇、语法与翻译显示在右侧。'
  },
  en: {
    title: 'Text Analysis',
    subtitle: 'Vocabulary, grammar, and translation appear on the right.'
  }
} satisfies Record<AnalysisLanguage, Record<string, string>>

interface TextViewerProps {
  analysisResult: AnalysisResult
  language: AnalysisLanguage
}

export default function TextViewer({ analysisResult, language }: TextViewerProps) {
  const t = UI_TEXT[language]
  return (
    <div className="w-full max-w-7xl mx-auto bg-white/5 backdrop-blur-md rounded-2xl border border-gray-600 p-6 space-y-4">
      <div className="flex items-center gap-2 text-white">
        <FileText className="w-5 h-5 text-purple-400" />
        <div>
          <h2 className="text-lg font-semibold">{t.title}</h2>
          <p className="text-sm text-gray-400">{t.subtitle}</p>
        </div>
      </div>
      <MokuroAnalysisPanel
        analysisResult={analysisResult}
        isAnalyzing={false}
        selectedText={null}
        language={language}
        hideSelectedText
      />
    </div>
  )
}
```

Note: verify `MokuroAnalysisPanel`'s exact props during implementation — the spec and `ImagePageAnalysisViewer` (which wraps it with `analysisResult` + `language`) confirm this signature, but read `MokuroAnalysisPanel.tsx` lines 12-20 to confirm before finalizing. If it requires additional props (e.g. a block index), pass sensible defaults. (Props already verified: `{ analysisResult, isAnalyzing, selectedText, language, hideSelectedText? }` - the JSX above passes all of them. Text mode uses `isAnalyzing={false}`, `selectedText={null}`, `hideSelectedText`.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `npm run lint -- --quiet`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/TextViewer.tsx
git commit -m "feat(text): add TextViewer, remove dead TextAnalyzer"
```

---

### Task 7: page.tsx 接入 text 模式

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `TextInput`, `TextViewer`, `AnalysisMode` now including `'text'`.

- [ ] **Step 1: Add imports**

In `src/app/page.tsx`, add to the existing imports:

```ts
import TextInput from '@/components/TextInput'
import TextViewer from '@/components/TextViewer'
```

- [ ] **Step 2: Render the input chrome per mode**

Replace the `<ImageUploader ... />` block (the `motion.div` wrapping it, around line 130) with a conditional that renders `TextInput` for text mode and `ImageUploader` otherwise:

```tsx
            {analysisMode === 'text' ? (
              <TextInput
                onAnalysisComplete={handleAnalysisComplete}
                onError={handleError}
                analysisLanguage={imageAnalysisLanguage}
                onAnalysisLanguageChange={setImageAnalysisLanguage}
                analysisMode={analysisMode}
                onModeChange={setMode}
              />
            ) : (
              <ImageUploader
                onAnalysisComplete={handleAnalysisComplete}
                onReadingModeComplete={handleReadingModeComplete}
                onOriginalImageChange={handleOriginalImageChange}
                onError={handleError}
                analysisMode={analysisMode}
                onModeChange={setMode}
                analysisLanguage={imageAnalysisLanguage}
                onAnalysisLanguageChange={setImageAnalysisLanguage}
              />
            )}
```

- [ ] **Step 3: Render the result viewer per mode**

In the results `motion.div` (around line 150), add a `text` branch. The existing chain is `mokuro ? MokuroReader : readingModeResult ? ReadingModeViewer : analysisResult ? ImagePageAnalysisViewer : null`. Change to:

```tsx
            {analysisMode === 'mokuro' ? (
              <MokuroReader />
            ) : analysisMode === 'text' ? (
              analysisResult ? (
                <TextViewer analysisResult={analysisResult} language={imageAnalysisLanguage} />
              ) : null
            ) : readingModeResult ? (
              <ReadingModeViewer
                key={readingModeResult.imageData}
                result={readingModeResult}
                language={imageAnalysisLanguage}
              />
            ) : analysisResult ? (
              <ImagePageAnalysisViewer
                analysisResult={analysisResult}
                imageData={originalImageData}
                language={imageAnalysisLanguage}
              />
            ) : null}
```

- [ ] **Step 4: Ensure mode switch clears text result**

The existing `setMode` already clears `analysisResult`/`readingModeResult`/`error` (verified in page.tsx lines 56-62). No change needed — confirm by reading. If `setMode` does not clear, add `setAnalysisResult(null)` to it.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Lint**

Run: `npm run lint -- --quiet`
Expected: PASS.

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(text): wire text analyzer mode into the page"
```

---

### Task 8: Netlify mirror 检查 + 最终验证

**Files:**
- Check: `netlify/src/lib/` for an `ai-service` or `text-batching` mirror.
- Modify: only if a mirror exists that needs the same batching fix.

- [ ] **Step 1: Check for Netlify mirror of ai-service**

Run: `ls netlify/src/lib/ 2>/dev/null && grep -rln "splitTextIntoSentences\|createTextBatches\|combineBatchResults\|analyzeText" netlify/ 2>/dev/null`
Expected: lists any mirrored files referencing the batching functions.

- [ ] **Step 2: Sync mirror if it exists**

If `netlify/src/lib/ai-service.ts` (or equivalent) mirrors the old internal functions, apply the same change as Tasks 2-3: import from a mirrored `text-batching.ts` (create `netlify/src/lib/text-batching.ts` as a copy if the Netlify runtime needs it standalone) and rewrite both `analyzeText` bodies identically. If no mirror references these functions, skip — record that in the commit message.

- [ ] **Step 3: Full verification**

Run: `npm test && npm run lint -- --quiet && npm run build`
Expected: all exit 0.

- [ ] **Step 4: Manual verification checklist**

- 短文本(≤几句):粘贴 -> 分析 -> 结果展示,summary 正常。
- 长文本(多段):粘贴长文本 -> 分析 -> 合并展示,无静默丢句;summary 标注多段合并。
- 故意构造失败:上传含极长无标点句的文本(触发单批超长)观察占位句可见(若 AI 仍成功则该路径未触发,可跳过)。
- `.txt` 上传:UTF-8 正常;Shift-JIS 文件提示转存。
- 中文语言默认;收藏一个纯文本来源的词 -> 进生词本 -> SRS 复习可见 -> Anki 导出含该词。
- 三模式切换:image/mokuro/text 互相切换清空旧结果。

- [ ] **Step 5: Commit any mirror sync**

```bash
git add netlify/
git commit -m "fix(netlify): mirror text-batching fix" || echo "No netlify mirror to sync"
```

- [ ] **Step 6: Push**

```bash
git push origin main
```
