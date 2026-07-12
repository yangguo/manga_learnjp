# Flat Grammar List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Mokuro grammar as one compact, text-ordered list without JLPT target controls or level groups.

**Architecture:** Keep ordering and filtering in `src/lib/analysis-order.ts`, so the React panel only renders the resulting list. The existing `filterLearningGrammar` rule remains authoritative for removing blank grammar patterns.

**Tech Stack:** TypeScript, React, Vitest, Tailwind CSS.

## Global Constraints

- Keep existing blank grammar-pattern filtering through `filterLearningGrammar`.
- Preserve grammar-card explanation, example, JLPT badge, and collection controls.
- Do not change persistence, API contracts, or the global default N4 setting.

---

### Task 1: Ordered Learning Grammar Helper

**Files:**
- Modify: `src/lib/analysis-order.ts`
- Modify: `src/lib/analysis-order.test.ts`

**Interfaces:**
- Consumes: `SentenceAnalysis[]` and `filterLearningGrammar`.
- Produces: `getLearningGrammarInTextOrder(sentences): GrammarPattern[]`.

- [x] **Step 1: Write the failing test**

```ts
expect(getLearningGrammarInTextOrder([
  { grammar: [firstPattern, blankPattern] },
  { grammar: [secondPattern, thirdPattern] }
]).map(pattern => pattern.pattern)).toEqual(['first', 'second', 'third'])
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/analysis-order.test.ts`

Expected: FAIL because `getLearningGrammarInTextOrder` is not exported.

- [x] **Step 3: Write minimal implementation**

```ts
export const getLearningGrammarInTextOrder = (
  sentences: Pick<SentenceAnalysis, 'grammar'>[]
): GrammarPattern[] => filterLearningGrammar(sentences.flatMap(sentence => sentence.grammar))
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/analysis-order.test.ts`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/lib/analysis-order.ts src/lib/analysis-order.test.ts
git commit -m "test(jlpt): cover flat grammar ordering"
```

### Task 2: Flat Grammar Panel

**Files:**
- Modify: `src/components/MokuroAnalysisPanel.tsx`

**Interfaces:**
- Consumes: `getLearningGrammarInTextOrder(analysisResult.sentences)`.
- Produces: One grammar `<ul>` in source order, or the existing empty state.

- [x] **Step 1: Replace grouped grammar data with the helper**

```ts
const learningGrammar = getLearningGrammarInTextOrder(analysisResult.sentences)
```

- [x] **Step 2: Render one compact list**

Render `learningGrammar` as a single `ul` of `GrammarCard` instances, preserving the existing empty state for a zero-length list.

- [x] **Step 3: Remove obsolete level UI**

Remove `JLPTTargetSelector`, `useJLPTTargetStore`, `groupGrammarByTarget`, level-range imports, group-only copy, `GrammarGroup`, and `ChevronDown`.

- [x] **Step 4: Verify source checks**

Run: `npm test -- src/lib/analysis-order.test.ts && npm run lint -- --quiet`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/components/MokuroAnalysisPanel.tsx
git commit -m "fix(reader): flatten grammar analysis list"
```

### Task 3: Final Verification

**Files:**
- Modify: `docs/superpowers/specs/2026-07-12-flat-grammar-list-design.md`

- [x] **Step 1: Record completed validation in the design document**

Set status to `已完成` and list the source-order, filtering, test, lint, build, and browser checks completed.

- [x] **Step 2: Run complete verification**

Run: `npm test && npm run lint -- --quiet && npm run build && git diff --check`

Expected: all commands exit 0.

- [x] **Step 3: Commit and push**

```bash
git add docs/superpowers/specs/2026-07-12-flat-grammar-list-design.md
git commit -m "docs(jlpt): record flat grammar delivery"
git push origin main
```
