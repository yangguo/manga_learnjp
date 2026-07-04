# Mokuro Reader Layout & Analysis Display Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Mokuro Reader analysis result into the right sidebar and render a simplified view (translation, non-beginner vocabulary, grammar).

**Architecture:** Add a new focused component `MokuroAnalysisPanel` that consumes `AnalysisResult`. Update `MokuroReader` to render this panel in the right sidebar instead of `TextAnalyzer` at the bottom. Keep `TextAnalyzer` unchanged for other modes.

**Tech Stack:** React, TypeScript, Tailwind CSS, Next.js App Router, Lucide icons.

---

### Task 1: Create `MokuroAnalysisPanel` component

**Files:**
- Create: `src/components/MokuroAnalysisPanel.tsx`
- Reference: `src/lib/types.ts` for `AnalysisResult`, `SentenceAnalysis`, `WordAnalysis`, `GrammarPattern`
- Reference: `src/components/TextAnalyzer.tsx` for existing analysis presentation patterns

- [ ] **Step 1.1: Scaffold the component with props**

```tsx
'use client'

import { Loader2, BookOpen, Languages, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import type { AnalysisResult } from '@/lib/types'

interface MokuroAnalysisPanelProps {
  analysisResult: AnalysisResult | null
  isAnalyzing: boolean
  selectedText: string | null
}

export default function MokuroAnalysisPanel({
  analysisResult,
  isAnalyzing,
  selectedText
}: MokuroAnalysisPanelProps) {
  // implementation
}
```

- [ ] **Step 1.2: Render empty and loading states**

Empty state (no selected text):
```tsx
if (!selectedText) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
      <BookOpen className="mx-auto mb-2 h-8 w-8 text-gray-500" />
      <h3 className="font-semibold text-white">Selected Text</h3>
      <p className="mt-1 text-sm text-gray-400">
        Click a highlighted OCR block or choose one from the list.
      </p>
    </div>
  )
}
```

Loading state:
```tsx
if (isAnalyzing) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
      <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-purple-400" />
      <p className="text-sm text-purple-100">Analyzing selected text...</p>
    </div>
  )
}
```

- [ ] **Step 1.3: Compute filtered words and grammar**

```tsx
const allWords = analysisResult?.sentences?.flatMap(sentence => sentence.words ?? []) ?? []
const filteredWords = allWords.filter(word => word.difficulty !== 'beginner')

const allGrammar = analysisResult?.sentences?.flatMap(sentence => sentence.grammar ?? []) ?? []
```

- [ ] **Step 1.4: Render translation, vocabulary, and grammar sections**

Translation section:
```tsx
{analysisResult?.translation && (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-xl border border-white/10 bg-white/5 p-4"
  >
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
      <Languages size={16} className="text-green-300" />
      Translation
    </div>
    <p className="text-sm leading-relaxed text-gray-100">{analysisResult.translation}</p>
  </motion.div>
)}
```

Vocabulary section (non-beginner only):
```tsx
{filteredWords.length > 0 && (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-xl border border-white/10 bg-white/5 p-4"
  >
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
      <BookOpen size={16} className="text-blue-300" />
      Vocabulary
    </div>
    <div className="space-y-2">
      {filteredWords.map((word, index) => (
        <div
          key={index}
          className="rounded-lg border border-white/10 bg-gray-950/40 p-3"
        >
          <div className="flex items-center gap-2">
            <span className="font-japanese font-semibold text-white">{word.word}</span>
            <span className="font-japanese text-sm text-gray-400">({word.reading})</span>
            <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-300">
              {word.difficulty}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-400">{word.partOfSpeech}</p>
          <p className="mt-1 text-sm text-gray-200">{word.meaning}</p>
        </div>
      ))}
    </div>
  </motion.div>
)}
```

Grammar section:
```tsx
{allGrammar.length > 0 && (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-xl border border-white/10 bg-white/5 p-4"
  >
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
      <Sparkles size={16} className="text-orange-300" />
      Grammar
    </div>
    <div className="space-y-2">
      {allGrammar.map((grammar, index) => (
        <div
          key={index}
          className="rounded-lg border border-white/10 bg-gray-950/40 p-3"
        >
          <p className="font-japanese font-semibold text-white">{grammar.pattern}</p>
          <p className="mt-1 text-sm text-gray-300">{grammar.explanation}</p>
          <p className="mt-1 text-xs text-gray-500">{grammar.example}</p>
        </div>
      ))}
    </div>
  </motion.div>
)}
```

- [ ] **Step 1.5: Commit the new component**

```bash
git add src/components/MokuroAnalysisPanel.tsx
git commit -m "feat(mokuro): add simplified MokuroAnalysisPanel component"
```

---

### Task 2: Integrate `MokuroAnalysisPanel` into `MokuroReader`

**Files:**
- Modify: `src/components/MokuroReader.tsx`
- Remove import: `TextAnalyzer` from `src/components/TextAnalyzer`
- Add import: `MokuroAnalysisPanel` from `@/components/MokuroAnalysisPanel`

- [ ] **Step 2.1: Replace imports**

Remove:
```tsx
import TextAnalyzer from '@/components/TextAnalyzer'
```

Add:
```tsx
import MokuroAnalysisPanel from '@/components/MokuroAnalysisPanel'
```

- [ ] **Step 2.2: Replace "Selected Text" section with `MokuroAnalysisPanel`**

Find the right sidebar section starting around line 492 ("Selected Text" card). Replace the entire conditional block:

```tsx
<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
  <MokuroAnalysisPanel
    analysisResult={activeAnalysis}
    isAnalyzing={isAnalyzing}
    selectedText={selectedBlock?.text ?? null}
  />
</div>
```

- [ ] **Step 2.3: Remove bottom `TextAnalyzer` placement**

Remove:
```tsx
{activeAnalysis && (
  <TextAnalyzer analysisResult={activeAnalysis} />
)}
```

- [ ] **Step 2.4: Commit the integration**

```bash
git add src/components/MokuroReader.tsx
git commit -m "feat(mokuro): move analysis result to right sidebar"
```

---

### Task 3: Verify with local dev server

- [ ] **Step 3.1: Ensure dev server is running**

If not running:
```bash
npm run dev
```

- [ ] **Step 3.2: Load a Mokuro file in the browser**

Navigate to `http://localhost:3000`, switch to "Mokuro Reader" mode, upload:
- `/Users/vyang/Desktop/spaces/manga_learnjp/output/pdf/spy6-mokuro/spy6.mokuro`
- Optional: upload matching page images from the same folder.

- [ ] **Step 3.3: Click an OCR block with text**

Expected:
- The analysis result appears in the right sidebar.
- Right sidebar shows: selected Japanese text, Translation, Vocabulary (non-beginner only), Grammar.
- No result card appears at the bottom of the page.

- [ ] **Step 3.4: Verify beginner words are hidden**

Look at the Vocabulary section. Words with `difficulty: 'beginner'` should not appear. Intermediate and advanced words should appear.

- [ ] **Step 3.5: Run lint and build**

```bash
npm run lint
npm run build
```

Expected: `npm run lint` passes with no new errors. `npm run build` compiles successfully.

---

## Self-Review

**Spec coverage:**
- Move analysis to right sidebar → Task 2.
- Simplified display (translation, non-beginner vocabulary, grammar) → Task 1.
- Loading and empty states → Task 1.
- Keep `TextAnalyzer` for other modes → Task 2 removes it only from MokuroReader.

**Placeholder scan:** None. All steps include concrete code or commands.

**Type consistency:** `MokuroAnalysisPanel` props use `AnalysisResult | null`, matching `activeAnalysis` type in `MokuroReader`.
