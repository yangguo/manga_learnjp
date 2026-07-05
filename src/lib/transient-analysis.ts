const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_DELAY_MS = 300
const MAX_JITTER_RATIO = 0.25

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const RETRYABLE_HTTP_STATUSES = [408, 429, 502, 503, 504]

const extractHttpStatus = (message: string): number | undefined => {
  const match = message.match(/\b(408|429|502|503|504)\b/)
  return match ? Number(match[1]) : undefined
}

const getErrorStatus = (error: unknown): number | undefined => {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = Number((error as { status?: unknown }).status)
    if (Number.isFinite(status)) return status
  }

  const message = error instanceof Error ? error.message : String(error)
  return extractHttpStatus(message)
}

export const isTransientAnalysisError = (message: string, status?: number): boolean => {
  const resolvedStatus = status ?? extractHttpStatus(message)
  if (resolvedStatus && RETRYABLE_HTTP_STATUSES.includes(resolvedStatus)) {
    return true
  }

  return /fetch failed|failed to fetch|network|timeout|timed out|econnreset|econnrefused|temporarily unavailable/i.test(message)
}

// Exponential backoff with full jitter on top of the exponential delay. Jitter
// matters because batch analysis runs up to MAX_MOKURO_PAGE_ANALYSIS_CONCURRENCY
// requests concurrently; without jitter, concurrent transient failures would all
// retry on the same beat (thundering herd). delayMs <= 0 short-circuits to 0 so
// tests can opt out of waiting.
const computeBackoff = (attempt: number, baseDelayMs: number): number => {
  if (baseDelayMs <= 0) return 0
  const exponential = baseDelayMs * 2 ** (attempt - 1)
  const jitter = Math.random() * (baseDelayMs * MAX_JITTER_RATIO)
  return Math.max(0, exponential + jitter)
}

interface TransientRetryOptions {
  maxAttempts?: number
  delayMs?: number
  isTransient?: (error: unknown) => boolean
  onRetry?: (error: unknown, nextAttempt: number) => void
}

export async function runWithTransientAnalysisRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: TransientRetryOptions = {}
): Promise<T> {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS))
  const delayMs = Math.max(0, Math.floor(options.delayMs ?? DEFAULT_DELAY_MS))
  const isTransient = options.isTransient ?? ((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    return isTransientAnalysisError(message, getErrorStatus(error))
  })

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt)
    } catch (error) {
      if (attempt >= maxAttempts || !isTransient(error)) {
        throw error
      }

      options.onRetry?.(error, attempt + 1)
      await wait(computeBackoff(attempt, delayMs))
    }
  }

  throw new Error('Failed to complete analysis')
}
