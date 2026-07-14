# Text Analysis Timeout Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop text analysis from failing with `All batches failed to process: Analysis request timed out after 90000ms` by fixing the timeout-retry amplification, adding bounded batch concurrency and per-batch retry, and making the per-batch timeout env-tunable.

**Architecture:** Four layered fixes mirroring the existing Mokuro batch-hardening pattern (reusing `runConcurrentTasks` and `runWithTransientAnalysisRetry`): (1) stop classifying our own wall-clock timeout as transient, (2) run batches with bounded concurrency, (3) retry each batch transiently, (4) raise/tune the per-batch timeout. All changes mirror to the Netlify backend.

**Tech Stack:** TypeScript, Next.js App Router, Vitest, Netlify Functions. Project conventions: two-space indent, single quotes, no trailing semicolons, `@/` alias for app code, `camelCase` functions, `SCREAMING_SNAKE_CASE` constants.

## Global Constraints

- Two-space indentation, single quotes, no trailing semicolons (enforced by ESLint).
- Every change to `src/lib/X` that has a `netlify/src/lib/X` mirror must be applied to both identically (the three affected mirrors are byte-identical to source today: `ai-service.ts`, `transient-analysis.ts`, `fetch-timeout.ts`, `text-batching.ts`).
- `npx tsc --noEmit -p netlify/tsconfig.json` must pass (it excludes `netlify/` from the root project, so the mirror is type-checked separately).
- `npm test`, `npm run lint`, `npm run build` must pass before handoff.
- No new runtime dependencies. `runConcurrentTasks` (`src/lib/concurrency.ts`) is pure JS with no browser/DOM deps, so it is safe to mirror to `netlify/src/lib/concurrency.ts`.
- Bare `timed out` (without `after Nms`) must REMAIN transient - existing tests and real upstream fast-refusals depend on it. Only `timed out after \d+ms` (our wall-clock abort signature) is excluded.

---

## File Structure

- `src/lib/transient-analysis.ts` (modify) + `netlify/src/lib/transient-analysis.ts` (mirror) - the core fix: exclude our wall-clock timeout from transient classification.
- `src/lib/fetch-timeout.ts` (modify) + `netlify/src/lib/fetch-timeout.ts` (mirror) - raise default timeout to 120s, read `ANALYSIS_FETCH_TIMEOUT_MS` from env.
- `src/lib/text-batching.ts` (modify) + `netlify/src/lib/text-batching.ts` (mirror) - add `MAX_TEXT_BATCH_CONCURRENCY` and `getTextBatchConcurrency`.
- `src/lib/concurrency.ts` (no change) - existing `runConcurrentTasks`; mirrored as a new file.
- `netlify/src/lib/concurrency.ts` (create) - byte-identical mirror of `src/lib/concurrency.ts` (needed because the mirrored `ai-service.ts` now imports it).
- `src/lib/ai-service.ts` (modify) + `netlify/src/lib/ai-service.ts` (mirror) - replace sequential batch loops with `runConcurrentTasks` + per-batch `runWithTransientAnalysisRetry`, in both `OpenAIService.analyzeText` and `OpenAIFormatService.analyzeText`.
- `src/lib/transient-analysis.test.ts` (modify) - add test that our timeout message is NOT transient.
- `src/lib/text-batching.test.ts` (modify) - add tests for `getTextBatchConcurrency`.

---

### Task 1: Stop classifying our own wall-clock timeout as transient (core fix)

This is the fix that kills the `3 × N × 90s` amplification past `maxDuration`. Without it, the other changes still help speed but the failure mode persists.

**Files:**
- Modify: `src/lib/transient-analysis.ts:24-31`
- Modify: `netlify/src/lib/transient-analysis.ts:24-31` (identical change)
- Test: `src/lib/transient-analysis.test.ts`

**Interfaces:**
- Produces: `isTransientAnalysisError(message, status?)` now returns `false` for messages matching `/timed out after \d+ms/`. Signature unchanged.

- [ ] **Step 1: Write the failing test**

Add this `describe` block (or append the `it` cases to the existing `describe('isTransientAnalysisError', …)` block at `src/lib/transient-analysis.test.ts:119-139`):

```typescript
  it('does not classify our own wall-clock timeout as transient', () => {
    expect(isTransientAnalysisError('Analysis request timed out after 90000ms')).toBe(false)
    expect(isTransientAnalysisError('Analysis request timed out after 120000ms')).toBe(false)
  })

  it('still classifies a bare timeout (no "after Nms") as transient', () => {
    expect(isTransientAnalysisError('timeout')).toBe(true)
    expect(isTransientAnalysisError('The operation timed out')).toBe(true)
  })

  it('excludes the Netlify withTimeout wall-clock message too', () => {
    expect(isTransientAnalysisError('analyzeText timed out after 25000ms')).toBe(false)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/transient-analysis.test.ts`
Expected: FAIL - the first and third cases expect `false` but get `true` (current regex matches `timed out`). The bare-timeout case passes already.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/transient-analysis.ts`, replace the `isTransientAnalysisError` function (lines 24-31) with:

```typescript
export const isTransientAnalysisError = (message: string, status?: number): boolean => {
  const resolvedStatus = status ?? extractHttpStatus(message)
  if (resolvedStatus && RETRYABLE_HTTP_STATUSES.includes(resolvedStatus)) {
    return true
  }

  // Our own wall-clock abort (fetchWithTimeout's "Analysis request timed out
  // after Nms" and Netlify's "<label> timed out after Nms") means the model is
  // slow or our budget expired - retrying immediately won't help and only burns
  // time toward the route's maxDuration. Exclude it BEFORE the generic
  // `timed out` alternation, which would otherwise catch it. Upstream timeouts
  // with a retryable HTTP status are already handled above; a bare "timed out"
  // (no "after Nms") stays transient.
  if (/timed out after \d+ms/i.test(message)) {
    return false
  }

  return /fetch failed|failed to fetch|network|timeout|timed out|econnreset|econnrefused|temporarily unavailable/i.test(message)
}
```

- [ ] **Step 4: Mirror the change to Netlify**

Apply the exact same replacement to `netlify/src/lib/transient-analysis.ts` (lines 24-31). The file is byte-identical to source, so the `old_string`/`new_string` match is identical.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/transient-analysis.test.ts`
Expected: PASS - all cases, including the pre-existing ones (bare `timeout` stays transient, `fetch failed` transient, HTTP-status classification).

- [ ] **Step 6: Verify the Netlify mirror type-checks**

Run: `npx tsc --noEmit -p netlify/tsconfig.json`
Expected: no output (exit 0).

- [ ] **Step 7: Commit**

```bash
git add src/lib/transient-analysis.ts src/lib/transient-analysis.test.ts netlify/src/lib/transient-analysis.ts
git commit -m "$(cat <<'EOF'
fix(transient): stop retrying our own wall-clock timeout

A fetchWithTimeout abort ("Analysis request timed out after Nms") was
classified transient, so the route retried the entire multi-batch
analyzeText up to 3x - 3 × N × 90s blows past the 300s maxDuration and
the platform kills the function. Exclude "timed out after Nms" (also
covers Netlify's withTimeout) before the generic alternation. Bare
"timed out" without the suffix stays transient.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Raise the per-batch timeout and make it env-tunable

**Files:**
- Modify: `src/lib/fetch-timeout.ts:1`
- Modify: `netlify/src/lib/fetch-timeout.ts:1` (identical change)

**Interfaces:**
- Produces: `DEFAULT_ANALYSIS_FETCH_TIMEOUT_MS` is now `120_000` and resolves from `ANALYSIS_FETCH_TIMEOUT_MS` env var when set.

- [ ] **Step 1: Write the failing test**

The existing test at `src/lib/fetch-timeout.test.ts:10-29` already asserts the timeout fires. Add a test asserting the default constant is 120s and env override is honored. Append to the existing `describe('fetchWithTimeout', …)` block:

```typescript
  it('defaults the timeout to 120s', () => {
    expect(DEFAULT_ANALYSIS_FETCH_TIMEOUT_MS).toBe(120_000)
  })
```

And add the import of the constant to the top of the file (line 2):

```typescript
import { fetchWithTimeout, DEFAULT_ANALYSIS_FETCH_TIMEOUT_MS } from './fetch-timeout'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/fetch-timeout.test.ts`
Expected: FAIL - `DEFAULT_ANALYSIS_FETCH_TIMEOUT_MS` is currently `90_000`, expected `120_000`.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/fetch-timeout.ts`, replace lines 1-7 (the two constants and the comment) with:

```typescript
// Per-batch analysis fetch timeout. Tunable via ANALYSIS_FETCH_TIMEOUT_MS so
// different endpoints (fast OpenAI vs slow ARK vs local Ollama) can adjust
// without code edits. Default 120s: with bounded batch concurrency (3) and the
// common ≤6-batch case, worst case = 2 waves × 120s = 240s, under both the
// 280s client timeout (CLIENT_ANALYSIS_FETCH_TIMEOUT_MS) and the 300s route
// maxDuration. Raise this for very slow endpoints, lower it to fail faster.
const resolveDefaultTimeoutMs = (): number => {
  const fromEnv = Number(process.env.ANALYSIS_FETCH_TIMEOUT_MS)
  return Number.isFinite(fromEnv) && fromEnv > 0 ? Math.floor(fromEnv) : 120_000
}
export const DEFAULT_ANALYSIS_FETCH_TIMEOUT_MS = resolveDefaultTimeoutMs()
// Stay below the Next.js route `maxDuration` (300s in route.ts). If the client
// waits longer than the platform allows, the function is killed mid-flight and
// the client sees a network error (classified transient) instead of a clean
// timeout - which then retriggers work the server already started. 280s lets
// the client time out cleanly before the platform kills the function.
export const CLIENT_ANALYSIS_FETCH_TIMEOUT_MS = 280_000
```

- [ ] **Step 4: Mirror the change to Netlify**

Apply the exact same replacement to `netlify/src/lib/fetch-timeout.ts` (lines 1-7).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/fetch-timeout.test.ts`
Expected: PASS - including the pre-existing timeout-fires test (which passes `timeoutMs: 10` explicitly, so the default change doesn't affect it).

- [ ] **Step 6: Verify the Netlify mirror type-checks**

Run: `npx tsc --noEmit -p netlify/tsconfig.json`
Expected: no output (exit 0).

- [ ] **Step 7: Commit**

```bash
git add src/lib/fetch-timeout.ts src/lib/fetch-timeout.test.ts netlify/src/lib/fetch-timeout.ts
git commit -m "$(cat <<'EOF'
feat(fetch-timeout): raise default timeout to 120s, env-tunable

90s was too tight for the full analysis prompt on slower endpoints
(e.g. ARK), causing every batch to time out. 120s keeps worst-case
wall time under maxDuration with bounded batch concurrency. Add
ANALYSIS_FETCH_TIMEOUT_MS override for endpoint-specific tuning.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add bounded batch concurrency sizing to text-batching

**Files:**
- Modify: `src/lib/text-batching.ts` (add after line 3, beside `MAX_BATCH_CHARS`)
- Modify: `netlify/src/lib/text-batching.ts` (identical change)
- Test: `src/lib/text-batching.test.ts`

**Interfaces:**
- Produces: `MAX_TEXT_BATCH_CONCURRENCY: number` (= 3) and `getTextBatchConcurrency(batchCount: number): number` returning `min(max(0, batchCount), MAX_TEXT_BATCH_CONCURRENCY)`, mirroring `getMokuroPageAnalysisConcurrency`.

- [ ] **Step 1: Write the failing test**

Append this `describe` block to `src/lib/text-batching.test.ts` (the file already imports from `./text-batching`; add `getTextBatchConcurrency` to its import list):

```typescript
describe('getTextBatchConcurrency', () => {
  it('uses the batch count up to the cap', () => {
    expect(getTextBatchConcurrency(1)).toBe(1)
    expect(getTextBatchConcurrency(3)).toBe(3)
  })

  it('caps concurrency to avoid overwhelming the provider', () => {
    expect(getTextBatchConcurrency(4)).toBe(3)
    expect(getTextBatchConcurrency(30)).toBe(3)
  })

  it('returns zero when there are no batches', () => {
    expect(getTextBatchConcurrency(0)).toBe(0)
  })

  it('treats non-finite or negative input as zero', () => {
    expect(getTextBatchConcurrency(Number.NaN)).toBe(0)
    expect(getTextBatchConcurrency(-3)).toBe(0)
  })
})
```

Update the import at the top of `src/lib/text-batching.test.ts` to include the new export. The current import block imports `MAX_BATCH_CHARS` etc. from `./text-batching` - add `getTextBatchConcurrency` to it. (Read the file's existing import statement first and append the name to the existing import list rather than adding a duplicate import.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/text-batching.test.ts`
Expected: FAIL - `getTextBatchConcurrency` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/text-batching.ts`, immediately after line 3 (`export const MAX_BATCH_CHARS = 800`), add:

```typescript

// Cap concurrent batch analyses so a long text (many batches) does not fire
// many simultaneous requests at the AI provider (rate limits, local Ollama
// overload, retry thundering-herd). 3 (vs 4 for Mokuro blocks) because text
// batches can be heavier per call. Mirrors getMokuroPageAnalysisConcurrency.
export const MAX_TEXT_BATCH_CONCURRENCY = 3

export const getTextBatchConcurrency = (batchCount: number): number => {
  const count = Math.max(0, Math.floor(Number.isFinite(batchCount) ? batchCount : 0))
  return Math.min(count, MAX_TEXT_BATCH_CONCURRENCY)
}
```

- [ ] **Step 4: Mirror the change to Netlify**

Apply the exact same insertion to `netlify/src/lib/text-batching.ts` after its line 3.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/text-batching.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify the Netlify mirror type-checks**

Run: `npx tsc --noEmit -p netlify/tsconfig.json`
Expected: no output (exit 0).

- [ ] **Step 7: Commit**

```bash
git add src/lib/text-batching.ts src/lib/text-batching.test.ts netlify/src/lib/text-batching.ts
git commit -m "$(cat <<'EOF'
feat(text-batching): add bounded batch concurrency sizing

getTextBatchConcurrency caps text-batch analysis concurrency at 3,
mirroring the Mokuro block-analysis pattern, to avoid provider rate
limit storms while cutting multi-batch wall time.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Mirror concurrency.ts to the Netlify backend

The mirrored `ai-service.ts` (Task 5) will import `runConcurrentTasks`, which does not yet exist under `netlify/src/lib/`. This task creates the mirror first so Task 5 compiles.

**Files:**
- Create: `netlify/src/lib/concurrency.ts` (byte-identical copy of `src/lib/concurrency.ts`)

**Interfaces:**
- Produces: `runConcurrentTasks` and `ConcurrentTaskResult` available to `netlify/src/lib/ai-service.ts`.

- [ ] **Step 1: Create the mirror file**

Copy the entire contents of `src/lib/concurrency.ts` into `netlify/src/lib/concurrency.ts`. The file is pure JS (no imports, no browser/DOM access), so the copy is verbatim. (Use the Read tool on `src/lib/concurrency.ts` if needed, then Write the same content to the netlify path.)

- [ ] **Step 2: Verify the Netlify mirror type-checks**

Run: `npx tsc --noEmit -p netlify/tsconfig.json`
Expected: no output (exit 0) - the new file compiles and nothing references it yet (unused export is fine).

- [ ] **Step 3: Verify it is byte-identical to source**

Run: `diff src/lib/concurrency.ts netlify/src/lib/concurrency.ts`
Expected: no output (identical).

- [ ] **Step 4: Commit**

```bash
git add netlify/src/lib/concurrency.ts
git commit -m "$(cat <<'EOF'
chore(netlify): mirror concurrency.ts for server-side batch use

The mirrored ai-service will import runConcurrentTasks for bounded
batch concurrency; mirror the pure helper into netlify/src/lib so the
Netlify function backend compiles.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Run text batches concurrently with per-batch retry (OpenAIService)

**Files:**
- Modify: `src/lib/ai-service.ts` - `OpenAIService.analyzeText` (lines 1163-1207) and the import block (lines 6-13)
- Modify: `netlify/src/lib/ai-service.ts` (identical change)

**Interfaces:**
- Consumes: `runConcurrentTasks` from `./concurrency`; `runWithTransientAnalysisRetry` from `./transient-analysis`; `getTextBatchConcurrency` from `./text-batching` (Task 3); `isTransientAnalysisError` now excludes wall-clock timeouts (Task 1).
- Produces: `OpenAIService.analyzeText` returns the same `AnalysisResult` shape, batch order preserved.

- [ ] **Step 1: Add the imports**

In `src/lib/ai-service.ts`, the current import block (lines 6-13) is:

```typescript
import { fetchWithTimeout } from './fetch-timeout'
import {
  splitTextIntoSentences,
  createTextBatches,
  combineBatchResults,
  MAX_BATCH_CHARS,
  type BatchResult
} from './text-batching'
```

Replace it with:

```typescript
import { fetchWithTimeout } from './fetch-timeout'
import { runConcurrentTasks } from './concurrency'
import { runWithTransientAnalysisRetry } from './transient-analysis'
import {
  splitTextIntoSentences,
  createTextBatches,
  combineBatchResults,
  getTextBatchConcurrency,
  MAX_BATCH_CHARS,
  type BatchResult
} from './text-batching'
```

- [ ] **Step 2: Rewrite the batch loop in OpenAIService.analyzeText**

In `src/lib/ai-service.ts`, replace the body of `OpenAIService.analyzeText` (lines 1163-1207):

```typescript
  async analyzeText(text: string, language: AnalysisLanguage = 'en', excludeN5 = false): Promise<AnalysisResult> {
    const sentences = splitTextIntoSentences(text)
    console.log(`OpenAI analyzeText: Split text into ${sentences.length} sentences`)

    if (sentences.length === 0) {
      return this.analyzeSingleBatch(text, language, excludeN5)
    }

    const batches = createTextBatches(sentences)
    console.log(`OpenAI analyzeText: Created ${batches.length} batches (max ${MAX_BATCH_CHARS} chars each)`)

    // Run batches with bounded concurrency (mirrors Mokuro block analysis) and
    // retry each batch transiently on its own (maxAttempts: 2). A wall-clock
    // timeout is NOT retried (see transient-analysis.ts); only genuine network
    // blips are. Results land in original batch index so combineBatchResults
    // order is preserved.
    const results = await runConcurrentTasks<string[], BatchResult>({
      items: batches,
      concurrency: getTextBatchConcurrency(batches.length),
      task: async (batch) => {
        const batchText = batch.join('')
        try {
          const batchResult = await runWithTransientAnalysisRetry(
            () => this.analyzeSingleBatch(batchText, language, excludeN5),
            { maxAttempts: 2 }
          )
          return {
            sentences: batchResult.sentences,
            translation: batchResult.translation,
            extractedText: batchResult.extractedText,
            summary: batchResult.summary,
            status: 'ok'
          }
        } catch (error) {
          console.error(`OpenAI analyzeText: Error processing batch:`, error)
          return {
            sentences: [],
            translation: '',
            extractedText: batchText,
            summary: '',
            status: 'failed',
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    })

    // runConcurrentTasks preserves index order in its returned array.
    const batchResults = results.map(r => r.status === 'fulfilled' ? r.value : {
      sentences: [],
      translation: '',
      extractedText: '',
      summary: '',
      status: 'failed' as const,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason)
    })

    const combinedResult = combineBatchResults(batchResults)
    console.log(`OpenAI analyzeText: Combined ${batchResults.length} batch results`)
    return {
      ...combinedResult,
      provider: 'openai' as AIProvider
    }
  }
```

- [ ] **Step 3: Mirror both changes to Netlify**

Apply the identical import replacement (Step 1) and the identical `analyzeText` rewrite (Step 2) to `netlify/src/lib/ai-service.ts`. Both files are byte-identical to source today, so the `old_string`/`new_string` matches are identical.

- [ ] **Step 4: Verify the build and tests**

Run: `npx vitest run && npm run lint -- --quiet && npx tsc --noEmit -p netlify/tsconfig.json`
Expected: all tests PASS, lint clean, netlify type-check clean. (The existing `text-batching.test.ts` and `ai-service-url.test.ts` cover combineBatchResults and URL construction; no new ai-service test is added because the batch loop is integration-level and exercised end-to-end in the handoff.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-service.ts netlify/src/lib/ai-service.ts
git commit -m "$(cat <<'EOF'
perf(ai-service): run text batches concurrently with per-batch retry (OpenAI)

Replace the sequential batch loop in OpenAIService.analyzeText with
bounded concurrency (3) via runConcurrentTasks and wrap each batch in
runWithTransientAnalysisRetry (1 retry). A single batch's network blip
is now retried cheaply instead of failing the whole analysis; a
wall-clock timeout is not retried. Order preserved for combineBatchResults.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Run text batches concurrently with per-batch retry (OpenAIFormatService)

The second copy of the sequential loop, in `OpenAIFormatService.analyzeText` (lines 1616-1660). Identical transformation to Task 5.

**Files:**
- Modify: `src/lib/ai-service.ts` - `OpenAIFormatService.analyzeText` (lines 1616-1660)
- Modify: `netlify/src/lib/ai-service.ts` (identical change)

**Interfaces:**
- Consumes: same as Task 5 (imports already added there).
- Produces: `OpenAIFormatService.analyzeText` returns the same `AnalysisResult` shape, order preserved.

- [ ] **Step 1: Rewrite the batch loop in OpenAIFormatService.analyzeText**

In `src/lib/ai-service.ts`, replace the body of `OpenAIFormatService.analyzeText` (lines 1616-1660):

```typescript
  async analyzeText(text: string, language: AnalysisLanguage = 'en', excludeN5 = false): Promise<AnalysisResult> {
    const sentences = splitTextIntoSentences(text)
    console.log(`OpenAI-format analyzeText: Split text into ${sentences.length} sentences`)

    if (sentences.length === 0) {
      return this.analyzeSingleBatch(text, language, excludeN5)
    }

    const batches = createTextBatches(sentences)
    console.log(`OpenAI-format analyzeText: Created ${batches.length} batches (max ${MAX_BATCH_CHARS} chars each)`)

    // Run batches with bounded concurrency (mirrors Mokuro block analysis) and
    // retry each batch transiently on its own (maxAttempts: 2). A wall-clock
    // timeout is NOT retried (see transient-analysis.ts); only genuine network
    // blips are. Results land in original batch index so combineBatchResults
    // order is preserved.
    const results = await runConcurrentTasks<string[], BatchResult>({
      items: batches,
      concurrency: getTextBatchConcurrency(batches.length),
      task: async (batch) => {
        const batchText = batch.join('')
        try {
          const batchResult = await runWithTransientAnalysisRetry(
            () => this.analyzeSingleBatch(batchText, language, excludeN5),
            { maxAttempts: 2 }
          )
          return {
            sentences: batchResult.sentences,
            translation: batchResult.translation,
            extractedText: batchResult.extractedText,
            summary: batchResult.summary,
            status: 'ok'
          }
        } catch (error) {
          console.error(`OpenAI-format analyzeText: Error processing batch:`, error)
          return {
            sentences: [],
            translation: '',
            extractedText: batchText,
            summary: '',
            status: 'failed',
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    })

    const batchResults = results.map(r => r.status === 'fulfilled' ? r.value : {
      sentences: [],
      translation: '',
      extractedText: '',
      summary: '',
      status: 'failed' as const,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason)
    })

    const combinedResult = combineBatchResults(batchResults)
    console.log(`OpenAI-format analyzeText: Combined ${batchResults.length} batch results`)
    return {
      ...combinedResult,
      provider: 'openai-format' as AIProvider
    }
  }
```

- [ ] **Step 2: Mirror the change to Netlify**

Apply the identical replacement to `netlify/src/lib/ai-service.ts` (`OpenAIFormatService.analyzeText`).

- [ ] **Step 3: Verify the build and tests**

Run: `npx vitest run && npm run lint -- --quiet && npx tsc --noEmit -p netlify/tsconfig.json`
Expected: all PASS / clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai-service.ts netlify/src/lib/ai-service.ts
git commit -m "$(cat <<'EOF'
perf(ai-service): run text batches concurrently with per-batch retry (OpenAI-format)

Apply the same bounded-concurrency + per-batch-retry transform to
OpenAIFormatService.analyzeText that OpenAIService got in the previous
commit. Both provider paths now behave identically for text analysis.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Refresh .env.example and final handoff verification

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Document the new env var**

In `.env.example`, after the `OPENAI_BASE_URL` block (around line 13, after the `# OPENAI_BASE_URL=` line), add:

```
# Per-batch analysis fetch timeout in milliseconds (default 120000 = 120s).
# Raise for very slow endpoints, lower to fail faster. Must stay under the
# 280s client timeout and the 300s route maxDuration with your batch count.
# ANALYSIS_FETCH_TIMEOUT_MS=120000
```

- [ ] **Step 2: Run the full verification suite**

Run: `npm test && npm run lint && npm run build`
Expected: all PASS, build succeeds. (CLAUDE.md requires these three before handoff.)

- [ ] **Step 3: Verify the Netlify mirror type-checks once more**

Run: `npx tsc --noEmit -p netlify/tsconfig.json`
Expected: no output (exit 0).

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "$(cat <<'EOF'
docs(env): document ANALYSIS_FETCH_TIMEOUT_MS

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: End-to-end smoke test (manual)**

Restart the dev server (`npm run dev`), then exercise a text analysis against the configured provider (ARK via OPENAI_BASE_URL). Confirm:
- A normal-length text returns 200 with a real analysis (not the timeout error).
- A longer multi-batch text completes in visibly less wall time than before (concurrency).
- If the endpoint is genuinely slow, the failure is a clean timeout message, not a `maxDuration` platform kill / raw network error.

This step is manual; report the observed result rather than asserting success automatically.

---

## Self-Review (completed during planning)

**Spec coverage:**
- Spec §1 (stop retrying wall-clock timeout) -> Task 1. ✓
- Spec §2 (bounded concurrency) -> Tasks 3 + 5 + 6. ✓
- Spec §3 (per-batch retry) -> Tasks 5 + 6. ✓
- Spec §4 (raise/tune timeout) -> Task 2 + Task 7 (env doc). ✓
- Spec §5 (Netlify mirror) -> every task mirrors; Task 4 adds the missing `concurrency.ts` mirror. ✓
- Spec §Tests (timeout-not-transient, getTextBatchConcurrency) -> Tasks 1 + 3. ✓

**Placeholder scan:** none - every code step shows complete code, every command shows expected output.

**Type consistency:** `getTextBatchConcurrency(batchCount: number): number` (Task 3) is consumed identically in Tasks 5 and 6. `runConcurrentTasks<string[], BatchResult>` matches `runConcurrentTasks`'s generic `<T, R>` signature where `T` is one batch (`string[]`) and `R` is `BatchResult`; `items: batches` is `string[][]` = `readonly T[]`. `BatchResult` is imported from `./text-batching`. The `results.map` handles the `ConcurrentTaskResult` union (`'fulfilled' | 'rejected'`) per `concurrency.ts:1-13`.

**Risk noted:** Task 5/6 replace the sequential loop with concurrency. `combineBatchResults` relies on batch *order* (it emits placeholder sentences indexed by position, `text-batching.ts:124`); `runConcurrentTasks` preserves index order in its returned array (`concurrency.ts:36,50,62`), so order is preserved. No change to `combineBatchResults` needed.
