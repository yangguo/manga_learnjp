# Text analysis timeout & robustness — design

Date: 2026-07-14
Status: approved (pending implementation)

## Problem

Text analysis fails with:

```
Analysis Failed
All batches failed to process: Analysis request timed out after 90000ms
```

Root cause is three layered problems, not one:

1. **Per-batch 90s timeout is too tight for the work asked.** `fetch-timeout.ts:1`
   sets `DEFAULT_ANALYSIS_FETCH_TIMEOUT_MS = 90_000`. When routed through the
   `openai` provider path (e.g. Volcengine ARK via `OPENAI_BASE_URL`),
   `analyzeSingleBatch` sends the full `ANALYSIS_PROMPT` — sentence-by-sentence
   words/reading/meaning/grammar/context for up to 800 chars, `max_tokens: 2000`.
   On a slower endpoint, generating that structured JSON per batch can exceed 90s.
   Every batch times out → `combineBatchResults` throws
   `All batches failed to process: <first error>` (`text-batching.ts:99`).

2. **Batches run strictly sequentially.** `ai-service.ts:1175` (`OpenAIService`)
   and `:1628` (`OpenAIFormatService`) are plain `for` loops. Total time is the
   sum of per-batch times; even when nothing times out, 4 batches × 40s = 160s.

3. **Route-level retry amplifies the failure past the platform limit.** This is
   the most damaging. `route.ts:70` wraps the whole multi-batch `analyzeText` in
   `runWithTransientAnalysisRetry`. `transient-analysis.ts:30` classifies any
   message matching `timed out` as transient → the entire multi-batch analysis
   is retried up to **3×**. A full timeout cascade becomes `3 × N × 90s`; for
   N≥2 batches that **exceeds the 300s route `maxDuration`** (`route.ts:17`) →
   the platform kills the function → the client sees a raw network error instead
   of the friendly message.

   The client side already had this exact stacking problem fixed
   (`client-api.ts:36-39` comment: retrying there "stacked the two layers, up to
   9-18 upstream calls"). The server-side retry has the same stacking problem but
   was left in.

A wall-clock timeout fired by *our own* `AbortController` is not a network blip
— it means "the model is slow / our budget expired." Retrying immediately will
not help and only burns time toward `maxDuration`.

## Approach chosen

Mirror the proven Mokuro batch-hardening pattern for the text path, reusing the
existing tested helpers (`runConcurrentTasks`, `runWithTransientAnalysisRetry`,
bounded-concurrency sizing) rather than inventing new ones. Rejected: response
streaming (fragile JSON parsing, large change, out of scope for a timeout fix).

## Changes

### 1. Stop retrying our own wall-clock timeout (core fix)

**File:** `src/lib/transient-analysis.ts` — `isTransientAnalysisError`.

Add an exclusion that short-circuits **before** the generic `timed out` regex:
if the message matches our own timeout format
(`/Analysis request timed out after \d+ms/`), return `false`. Our message
contains the substring `timed out`, so without ordering the exclusion first it
would be caught by the existing generic alternation. The status-code path at the
top of the function runs first and is unaffected - upstream timeouts that arrive
with a retryable HTTP status (408/504) still return `true` and retry. The
exclusion is precise: an upstream body message like "request timed out" does not
match our `Analysis request timed out after …ms` pattern, so it is unaffected.

This makes the "all batches failed" timeout cascade retry **once**, not 3×,
which alone eliminates the `maxDuration` blowup. Both the batch-level and
route-level retry see the message string; our timeout message is unambiguous, so
a `.name`/`.code` marker is unnecessary.

### 2. Bounded concurrency for batches

**File:** `src/lib/ai-service.ts` — `OpenAIService.analyzeText` and
`OpenAIFormatService.analyzeText`.

Replace the two sequential `for` loops with `runConcurrentTasks`
(`@/lib/concurrency`), the same helper `MokuroReader` uses for block analysis.
New constant `MAX_TEXT_BATCH_CONCURRENCY = 3` and helper
`getTextBatchConcurrency(batchCount)` shaped exactly like
`getMokuroPageAnalysisConcurrency`. Results land in original batch index so
`combineBatchResults` is unaffected.

3 (not 4) because the text path's batches can be heavier than Mokuro block
calls; modest concurrency avoids ARK rate-limit storms while cutting a 4-batch
run from ~4× to ~2× wall time.

### 3. Per-batch transient retry

**File:** same two `analyzeText` methods, wrapping each `analyzeSingleBatch` call.

Wrap the single-batch call in `runWithTransientAnalysisRetry({ maxAttempts: 2 })`
(1 retry). This handles a transient network blip on *one* batch cheaply, instead
of letting it fail the batch and relying on the route to re-run *everything*.
Because of fix #1, a timeout is not retried here either — only genuine blips
(`fetch failed`, 429, 503).

Net layering after the fix:
- **All batches timeout** → 1 attempt each, route retries 0× = **N calls total**
  (was 3N). Fixes the bug.
- **One batch network-blip** → batch retried once, succeeds, route never sees it.
- **All batches network-down** → bounded fast-fail (connection refused is fast,
  not a slow timeout), so no `maxDuration` risk.

### 4. Raise the per-batch timeout; make it env-tunable

**File:** `src/lib/fetch-timeout.ts`.

`DEFAULT_ANALYSIS_FETCH_TIMEOUT_MS` 90s → **120s**, and read
`ANALYSIS_FETCH_TIMEOUT_MS` from env so different endpoints (fast OpenAI vs slow
ARK vs local Ollama) can tune without code edits. The app is explicitly
provider-agnostic, so this is justified.

Ceiling check: with concurrency 3 and ≤6 batches (the common case), worst case =
2 waves × 120s = 240s, under both the 280s client timeout and the 300s route
`maxDuration`. Documented in the code comment (replacing the current one).

### 5. Netlify mirror

Per `CLAUDE.md`, every change mirrors to `netlify/src/lib/` and
`netlify/functions/analyze.ts` (which has its own `Promise.race` timeout +
`isTimeout` handling to reconcile). Each change is mirrored; the handoff is
gated on `npx tsc --noEmit -p netlify/tsconfig.json`.

## Out of scope

- `MAX_BATCH_CHARS` (800) stays — smaller batches mean more batches and more
  overhead; concurrency is the right lever.
- Route-level retry stays at 3× (shared with image/reading/manga modes that have
  no batch-level retry) — just fixed so timeouts don't amplify.
- Very large inputs (e.g. 100KB → 125 batches) remain a separate concern; the
  concurrency fix helps but a hard input cap there is out of scope.

## Tests

- New: a timeout error message matching our format is **not** transient (locks
  fix #1).
- New: `getTextBatchConcurrency` bounds correctly (mirrors the Mokuro test).
- Existing `combineBatchResults` and transient tests stay green; update any that
  asserted our timeout message is transient.

## Handoff

`npm test`, `npm run lint`, `npm run build`, and
`npx tsc --noEmit -p netlify/tsconfig.json` before handoff. End-to-end: restart
dev server, confirm a text analysis against the configured provider returns 200
instead of the timeout error.
