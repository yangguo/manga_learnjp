import { describe, expect, it, vi } from 'vitest'
import { isTransientAnalysisError, runWithTransientAnalysisRetry } from './transient-analysis'

describe('runWithTransientAnalysisRetry', () => {
  it('retries transient analysis failures', async () => {
    let attempts = 0

    const result = await runWithTransientAnalysisRetry(async () => {
      attempts += 1
      if (attempts === 1) {
        throw new Error('fetch failed')
      }
      return 'ok'
    }, { delayMs: 0 })

    expect(result).toBe('ok')
    expect(attempts).toBe(2)
  })

  it('does not retry non-transient analysis failures', async () => {
    let attempts = 0

    await expect(runWithTransientAnalysisRetry(async () => {
      attempts += 1
      throw new Error('No AI service configured')
    }, { delayMs: 0 })).rejects.toThrow('No AI service configured')

    expect(attempts).toBe(1)
  })

  it('gives up after maxAttempts and rethrows the last error', async () => {
    let attempts = 0

    await expect(runWithTransientAnalysisRetry(async () => {
      attempts += 1
      throw new Error('timeout')
    }, { maxAttempts: 3, delayMs: 0 })).rejects.toThrow('timeout')

    expect(attempts).toBe(3)
  })

  it('retries retryable HTTP status errors by status property', async () => {
    let attempts = 0

    const result = await runWithTransientAnalysisRetry(async () => {
      attempts += 1
      if (attempts === 1) {
        throw Object.assign(new Error('OpenAI API error'), { status: 429 })
      }
      return 'ok'
    }, { delayMs: 0 })

    expect(result).toBe('ok')
    expect(attempts).toBe(2)
  })

  it('retries retryable HTTP status errors embedded in provider messages', async () => {
    let attempts = 0

    const result = await runWithTransientAnalysisRetry(async () => {
      attempts += 1
      if (attempts === 1) {
        throw new Error('OpenAI-format API error: 503 - temporarily overloaded')
      }
      return 'ok'
    }, { delayMs: 0 })

    expect(result).toBe('ok')
    expect(attempts).toBe(2)
  })

  it('invokes onRetry with the error and the next attempt number', async () => {
    const retries: Array<{ message: string, nextAttempt: number }> = []

    await runWithTransientAnalysisRetry(async (attempt) => {
      if (attempt < 3) {
        throw new Error('timeout')
      }
      return 'ok'
    }, {
      delayMs: 0,
      onRetry: (error, nextAttempt) => {
        retries.push({
          message: error instanceof Error ? error.message : String(error),
          nextAttempt
        })
      }
    })

    expect(retries).toEqual([
      { message: 'timeout', nextAttempt: 2 },
      { message: 'timeout', nextAttempt: 3 }
    ])
  })

  it('uses exponential backoff that grows across attempts', async () => {
    const delays: number[] = []
    const originalSetTimeout = globalThis.setTimeout.bind(globalThis)
    const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((cb: (...args: unknown[]) => void, ms?: number) => {
      delays.push(ms ?? 0)
      return originalSetTimeout(cb, 0)
    }) as typeof globalThis.setTimeout)

    await runWithTransientAnalysisRetry(async (attempt) => {
      if (attempt < 3) {
        throw new Error('timeout')
      }
      return 'ok'
    }, { delayMs: 100, maxAttempts: 3 })

    spy.mockRestore()
    expect(delays).toHaveLength(2)
    expect(delays[0]).toBeGreaterThanOrEqual(100)
    // Second wait is ~2x the first (exponential), plus jitter.
    expect(delays[1]).toBeGreaterThan(delays[0])
  })
})

describe('isTransientAnalysisError', () => {
  it('treats browser fetch failures as transient', () => {
    expect(isTransientAnalysisError('Failed to fetch')).toBe(true)
  })

  it('classifies retryable HTTP statuses as transient', () => {
    for (const status of [408, 429, 502, 503, 504]) {
      expect(isTransientAnalysisError('request failed', status)).toBe(true)
    }
  })

  it('does not classify non-retryable HTTP statuses as transient', () => {
    expect(isTransientAnalysisError('bad request', 400)).toBe(false)
    expect(isTransientAnalysisError('internal error', 500)).toBe(false)
  })

  it('extracts retryable HTTP statuses from provider error messages', () => {
    expect(isTransientAnalysisError('OpenAI API error: 429')).toBe(true)
    expect(isTransientAnalysisError('OpenAI-format API error: 503 - overloaded')).toBe(true)
  })

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
})
