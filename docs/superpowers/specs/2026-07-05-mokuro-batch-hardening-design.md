# Mokuro Batch Analysis Hardening (Retroactive Design)

> Written retroactively to document the production-hardening layer added on top
> of the page-range-batch and per-page-cache work. The layer shipped without a
> spec; this doc captures the decisions so reviewers and future work have a
> reference, and records the deviations from the prior specs.

## Goal

Make Mokuro Reader batch analysis robust for long page-range runs: bounded
concurrency, request timeouts, transient-error retry, cancellation that actually
stops in-flight work, and a screen wake lock so the device doesn't sleep
mid-batch.

Both prior specs (`2026-07-04-mokuro-page-range-batch-design.md` and
`2026-07-04-mokuro-per-page-cache-design.md`) list "No parallel block analysis"
as Out of Scope. This hardening **deliberately relaxes** that to bounded
parallelism (see Concurrency below).

## Modules

All four are pure, dependency-injectable for testing, and free of React coupling.
Each has a co-located Vitest file.

### `src/lib/concurrency.ts` — `runConcurrentTasks`
Worker pool over `items`. Workers pull the next index synchronously (race-free
under JS's single thread), so result ordering is preserved by writing to
`results[index]`. One task's rejection stores a `rejected` result and the worker
continues — siblings are never aborted. `shouldContinue()` gates *scheduling*;
`onSettled` reports each settled result. `concurrency` is clamped to
`[1, items.length]` (non-finite / ≤ 0 → 1).

### `src/lib/fetch-timeout.ts` — `fetchWithTimeout`
Wraps `fetch` with an `AbortController` + `setTimeout`. Forwards an external
`init.signal` (abort propagation) to the internal controller and distinguishes a
timeout-caused abort (`timeoutFired` flag) from an external abort, throwing a
transient-classifiable `Error("...timed out...")` only on timeout. `timeoutMs
=== 0` bypasses the timeout. Pre-aborted signal short-circuits before calling
fetch. Both the timeout and the abort listener are cleaned up in `finally`.
- `DEFAULT_ANALYSIS_FETCH_TIMEOUT_MS = 90_000` (server→provider).
- `CLIENT_ANALYSIS_FETCH_TIMEOUT_MS = 280_000` (client→server; see Timeout below).

### `src/lib/transient-analysis.ts` — `runWithTransientAnalysisRetry`
Retries an operation on transient errors: HTTP 408/429/502/503/504, or messages
matching `fetch failed|failed to fetch|network|timeout|timed out|econnreset|
econnrefused|temporarily unavailable`. Exponential backoff with additive jitter:
`base * 2^(attempt-1) + random(0, base*0.25)`. Default 3 attempts, 300ms base → ~300/600/1200ms
(+ up to 25% of base). `delayMs: 0` short-circuits to 0 (tests opt out of waiting). Throws
the last error after `maxAttempts`.

### `src/lib/wake-lock.ts` — `runWithScreenWakeLock`
Acquires a screen wake lock for the duration of an operation, re-acquires on
sentinel `release` and on `visibilitychange`→visible, and releases in `finally`
(even on throw). An `active` flag handles the race where a re-acquire request
resolves after the operation already finished — the late sentinel is released,
not stored/leaked. No-op when the Wake Lock API is absent (SSR / unsupported).

### `src/lib/batch-awake.ts` — `runWithBatchAwake`
Composition layer used by `MokuroReader` (replaces direct `runWithScreenWakeLock`
calls at the batch entry points). Starts the host-level system awake lock, runs
the operation inside the screen wake lock, and stops the system awake lock in
`finally`. Start errors are swallowed via `onSystemAwakeError` so the batch still
runs with screen-wake-lock-only if the host awake API is unavailable.

### `src/lib/system-awake.ts` + `system-awake-server.ts` — host awake (caffeinate)
`system-awake.ts` (client) calls `/api/system-awake`; the route drives a
process-level manager (`system-awake-server.ts`) that spawns `caffeinate -dimsu`
on macOS and reports `supported: false` on other platforms. A global singleton is
registered for `process.exit` cleanup. On non-macOS hosts such as Netlify/Linux,
the route reports `supported: false` (or may be unavailable, depending on the
deployment surface), so `runWithBatchAwake` degrades to screen-wake-lock-only.

## Key Decisions

### Concurrency: capped at 4
`getMokuroPageAnalysisConcurrency(pendingCount)` returns
`min(pendingCount, MAX_MOKURO_PAGE_ANALYSIS_CONCURRENCY = 4)`. The original
implementation returned `pendingCount` unchanged (unbounded), which fired dozens
of simultaneous provider calls — rate-limit storms on hosted providers, overload
on local Ollama/LM Studio, and retry thundering-herd. 4 is a bounded relaxation
of the sequential model the prior specs assumed.

### Retry: the server owns it
`client-api.ts`'s `analyzeText` does **not** retry; `route.ts` wraps each
provider call in `runWithTransientAnalysisRetry` (3 attempts) and then falls
back to the next provider. Rationale: the server sees the real upstream error and
can distinguish provider-specific transience; stacking client (3) × server (3) ×
provider-fallback (2) retries caused up to 9–18 upstream calls per block.

### Cancellation: AbortSignal plumbed end-to-end (client side)
`cancelBatch` sets `cancelBatchRef = true` **and** aborts an `AbortController`
held in `batchAbortControllerRef`. The signal flows
`analyzePageBlocks` → `analyzeText(options.signal)` → `fetchWithTimeout(init.signal)`
→ the internal `AbortController`. `runConcurrentTasks.shouldContinue` stops
*scheduling* new tasks; the `AbortController` stops tasks already awaiting a
response. Aborts during cancel are not recorded as failures (`isAbortError` +
`signal?.aborted` guard in `onSettled`).

**Scope:** the client→server fetch is aborted. Server→provider calls are **not**
aborted — the server does not forward `request.signal` to `aiService`/
`fetchWithTimeout`. With concurrency capped at 4, at most 4 provider calls run to
completion after Cancel — bounded and acceptable. Forwarding `request.signal`
through `ai-service.ts` is a documented follow-up.

### Backoff: exponential + jitter
`computeBackoff(attempt, base) = base * 2^(attempt-1) + jitter` (jitter ∈
`[0, base * 0.25)`). Jitter matters because up to 4 requests retry concurrently;
without it, concurrent transient failures would all retry on the same beat.

### Client timeout: 280s < server `maxDuration` 300s
`CLIENT_ANALYSIS_FETCH_TIMEOUT_MS = 280_000` stays below `route.ts`'s
`maxDuration = 300`. If the client waited longer than the platform allows, the
function would be killed mid-flight and the client would see a network error
(classified transient) and retry work the server already started. 280s gives the
client a clean timeout before the platform kills the function.

### Wake-lock lifecycle
Acquire on start → re-acquire on sentinel `release` and on `visibilitychange`→
visible → release in `finally` (even on throw) → release a late-resolving
re-acquire sentinel if the operation already finished.

### System awake (host-level, macOS-only)
`runWithBatchAwake` additionally starts `caffeinate -dimsu` via the
`/api/system-awake` route so a long range batch doesn't let the host machine
sleep (the screen wake lock only prevents display sleep, not system sleep). It is
a no-op off macOS and degrades gracefully when the route is unavailable (Netlify).

## Netlify Mirror

`fetch-timeout.ts` + `transient-analysis.ts` are copied to `netlify/src/lib/`;
`netlify/src/lib/ai-service.ts` is synced with `src/lib/ai-service.ts` (uses
`fetchWithTimeout` at all provider call sites); `netlify/functions/analyze.ts`
wraps provider calls in `runWithTransientAnalysisRetry` (mirrors `route.ts`).
`concurrency.ts` + `wake-lock.ts` are client-only and need no mirror.

⚠️ `netlify/` is excluded from `tsconfig.json`, so `npm run build` does **not**
type-check the mirror. Sync manually when editing `src/lib` files that exist
under `netlify/src/lib`.

## Known Follow-ups

- **`Retry-After` header.** `runWithTransientAnalysisRetry` does not yet honor
  the `Retry-After` header on 429/503. Doing so requires enriching
  `ai-service.ts` provider errors with `retryAfterMs` (read
  `response.headers.get('retry-after')`) at the ~9 throw sites, then passing a
  `getRetryAfter` hook to the retry wrapper (and mirroring to Netlify). Deferred
  — exponential + jitter already bounds the thundering-herd risk for 429s.
- **Server-side `AbortSignal` forwarding.** `request.signal` is not forwarded
  through `route.ts` → `aiService` → `fetchWithTimeout`, so Cancel does not abort
  server→provider calls. Bounded by the concurrency cap (≤ 4 in-flight after
  Cancel).
- **Single-page "unfinished" wording.** `isMokuroPageAnalysisComplete` returns
  false when `failed > 0`, so a single-page batch with one failure shows
  "N unfinished sentences" (the count includes failed blocks). The range path is
  unaffected — it uses `shouldStopMokuroRangeAfterPageAnalysis`, which only
  stops on cancel, and accumulates failures into `rangeCompleteWithFailures`.
  Minor wording fix deferred.
- **`/api/system-awake` has no auth.** Any client can `POST {action:"start"}` to
  spawn `caffeinate` on a macOS host. Fine for local dev; on a shared macOS
  deployment it could be triggered by anyone. Netlify (Linux) is unaffected
  (`supported: false`). Consider gating to dev/localhost or a shared secret.

## Acceptance Criteria (current state)

- [x] Cancel aborts in-flight client requests (AbortSignal plumbed through).
- [x] Client timeout < server `maxDuration` (280s < 300s).
- [x] Concurrency capped at 4.
- [x] Retry consolidated to the server layer; client does not retry.
- [x] 429/transient backoff is exponential + jitter.
- [x] Wake-lock lifecycle covered by tests (acquire, release, re-acquire on
      sentinel-release and visibilitychange, rejection, active-flag race).
- [x] Netlify mirror synced (ai-service, analyze, new modules).
- [x] Edge-case tests for all four modules (abort propagation, `timeoutMs=0`,
      abort-before-start, `maxAttempts` boundary, `onRetry`, status
      classification, backoff growth, non-positive/NaN concurrency, empty items,
      ordering with interleaved rejections, cancel mid-flight).
- [x] Host + screen awake during batch (`runWithBatchAwake` wraps caffeinate +
      screen wake lock; macOS-only, degrades gracefully off-platform).
- [x] `npm test` (78 pass), `npm run lint` (0 errors), `npm run build` (passes).
