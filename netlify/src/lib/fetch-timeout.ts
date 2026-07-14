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

interface FetchTimeoutOptions {
  timeoutMs?: number
  timeoutMessage?: string
}

const createTimeoutError = (timeoutMs: number, timeoutMessage?: string) => {
  return new Error(timeoutMessage ?? `Analysis request timed out after ${timeoutMs}ms`)
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchTimeoutOptions = {}
): Promise<Response> {
  const rawTimeoutMs = options.timeoutMs ?? DEFAULT_ANALYSIS_FETCH_TIMEOUT_MS
  const timeoutMs = Math.max(0, Math.floor(Number.isFinite(rawTimeoutMs) ? rawTimeoutMs : DEFAULT_ANALYSIS_FETCH_TIMEOUT_MS))
  if (timeoutMs === 0) {
    return fetch(input, init)
  }

  const controller = new AbortController()
  const sourceSignal = init.signal
  let timeoutFired = false

  if (sourceSignal?.aborted) {
    throw sourceSignal.reason instanceof Error ? sourceSignal.reason : new Error('Fetch aborted before it started')
  }

  const abortFromSource = () => {
    controller.abort(sourceSignal?.reason)
  }
  sourceSignal?.addEventListener('abort', abortFromSource, { once: true })

  const timeoutId = setTimeout(() => {
    timeoutFired = true
    controller.abort()
  }, timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    })
  } catch (error) {
    if (timeoutFired) {
      throw createTimeoutError(timeoutMs, options.timeoutMessage)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    sourceSignal?.removeEventListener('abort', abortFromSource)
  }
}
