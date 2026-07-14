import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchWithTimeout, DEFAULT_ANALYSIS_FETCH_TIMEOUT_MS } from './fetch-timeout'

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('aborts and rejects timed out fetches with a transient-classifiable error', async () => {
    vi.useFakeTimers()
    let capturedSignal: AbortSignal | undefined
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined
      return new Promise<Response>((_resolve, reject) => {
        capturedSignal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const request = fetchWithTimeout('/slow', {}, { timeoutMs: 10 }).catch(error => error as Error)
    await vi.advanceTimersByTimeAsync(10)

    const error = await request
    expect(error.message).toContain('timed out')
    expect(capturedSignal?.aborted).toBe(true)
  })

  it('returns successful responses before the timeout fires', async () => {
    vi.useFakeTimers()
    const response = new Response(JSON.stringify({ ok: true }), { status: 200 })
    vi.stubGlobal('fetch', vi.fn(async () => response))

    await expect(fetchWithTimeout('/ok', {}, { timeoutMs: 10 })).resolves.toBe(response)
  })

  it('bypasses the timeout entirely when timeoutMs is 0', async () => {
    const response = new Response(JSON.stringify({ ok: true }), { status: 200 })
    const fetchMock = vi.fn(async () => response)
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchWithTimeout('/ok', {}, { timeoutMs: 0 })).resolves.toBe(response)
  })

  it('throws before calling fetch when the source signal is already aborted', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    controller.abort()

    await expect(fetchWithTimeout('/ok', { signal: controller.signal }, { timeoutMs: 1000 })).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('aborts the in-flight fetch when the source signal aborts mid-request', async () => {
    let capturedSignal: AbortSignal | undefined
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined
      return new Promise<Response>((_resolve, reject) => {
        capturedSignal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    const request = fetchWithTimeout('/slow', { signal: controller.signal }, { timeoutMs: 5000 }).catch(error => error as Error)
    controller.abort()
    const error = await request

    expect(error).toBeInstanceOf(DOMException)
    expect(error.name).toBe('AbortError')
    expect(capturedSignal?.aborted).toBe(true)
  })

  it('defaults the timeout to 120s', () => {
    expect(DEFAULT_ANALYSIS_FETCH_TIMEOUT_MS).toBe(120_000)
  })
})
