import { describe, expect, it, vi } from 'vitest'
import { runWithScreenWakeLock } from './wake-lock'

describe('runWithScreenWakeLock', () => {
  it('requests a screen wake lock and releases it after the operation finishes', async () => {
    const release = vi.fn(async () => undefined)
    const request = vi.fn(async () => ({ release, released: false }))
    const navigatorLike = { wakeLock: { request } }

    const result = await runWithScreenWakeLock(
      async () => 'done',
      { navigator: navigatorLike }
    )

    expect(result).toBe('done')
    expect(request).toHaveBeenCalledWith('screen')
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('still runs the operation when wake lock is unavailable', async () => {
    const result = await runWithScreenWakeLock(
      async () => 'done',
      { navigator: {} }
    )

    expect(result).toBe('done')
  })

  it('reacquires the wake lock when it is released while the operation is still running', async () => {
    const releaseListeners: Array<() => void> = []
    const sentinels = [
      {
        released: false,
        release: vi.fn(async () => undefined),
        addEventListener: vi.fn((_event: 'release', listener: () => void) => {
          releaseListeners.push(listener)
        })
      },
      {
        released: false,
        release: vi.fn(async () => undefined),
        addEventListener: vi.fn()
      }
    ]
    const request = vi.fn(async () => sentinels[request.mock.calls.length - 1])
    const navigatorLike = { wakeLock: { request } }
    const documentLike = {
      visibilityState: 'visible',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
    let finishOperation: (() => void) | undefined

    const running = runWithScreenWakeLock(
      async () => new Promise<string>(resolve => {
        finishOperation = () => resolve('done')
      }),
      { navigator: navigatorLike, document: documentLike }
    )
    await Promise.resolve()

    sentinels[0].released = true
    releaseListeners[0]()
    await Promise.resolve()
    await Promise.resolve()

    expect(request).toHaveBeenCalledTimes(2)

    finishOperation?.()
    await expect(running).resolves.toBe('done')
    expect(sentinels[1].release).toHaveBeenCalledTimes(1)
  })

  it('reacquires the wake lock after visibility returns to visible', async () => {
    const releaseListeners: Array<() => void> = []
    const visibilityListeners: Array<() => void> = []
    const sentinels = [
      {
        released: false,
        release: vi.fn(async () => undefined),
        addEventListener: vi.fn((_event: 'release', listener: () => void) => {
          releaseListeners.push(listener)
        })
      },
      {
        released: false,
        release: vi.fn(async () => undefined),
        addEventListener: vi.fn()
      }
    ]
    const request = vi.fn(async () => sentinels[request.mock.calls.length - 1])
    const navigatorLike = { wakeLock: { request } }
    const documentLike = {
      visibilityState: 'visible' as DocumentVisibilityState,
      addEventListener: vi.fn((event: string, listener: () => void) => {
        if (event === 'visibilitychange') visibilityListeners.push(listener)
      }),
      removeEventListener: vi.fn()
    }
    let finishOperation: (() => void) | undefined

    const running = runWithScreenWakeLock(
      async () => new Promise<string>(resolve => {
        finishOperation = () => resolve('done')
      }),
      { navigator: navigatorLike, document: documentLike }
    )
    await Promise.resolve()
    await Promise.resolve()
    expect(request).toHaveBeenCalledTimes(1)

    // Tab hidden: browser releases the sentinel; handleRelease nulls it but
    // requestLock returns early because visibility is hidden.
    documentLike.visibilityState = 'hidden'
    sentinels[0].released = true
    releaseListeners[0]()
    await Promise.resolve()
    expect(request).toHaveBeenCalledTimes(1)

    // Tab visible again: visibilitychange fires, sentinel is null, re-requests.
    documentLike.visibilityState = 'visible'
    visibilityListeners[0]()
    await Promise.resolve()
    await Promise.resolve()
    expect(request).toHaveBeenCalledTimes(2)

    finishOperation?.()
    await expect(running).resolves.toBe('done')
  })

  it('releases the wake lock even when the operation rejects', async () => {
    const release = vi.fn(async () => undefined)
    const sentinel = {
      released: false,
      release,
      addEventListener: vi.fn()
    }
    const navigatorLike = { wakeLock: { request: vi.fn(async () => sentinel) } }
    const documentLike = {
      visibilityState: 'visible' as DocumentVisibilityState,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }

    await expect(runWithScreenWakeLock(
      async () => { throw new Error('boom') },
      { navigator: navigatorLike, document: documentLike }
    )).rejects.toThrow('boom')

    expect(release).toHaveBeenCalledTimes(1)
  })

  it('releases a re-acquired sentinel if the operation finishes while it is being requested', async () => {
    const releaseListeners: Array<() => void> = []
    let resolveSecondRequest: ((sentinel: unknown) => void) | undefined
    const sentinel0 = {
      released: false,
      release: vi.fn(async () => undefined),
      addEventListener: vi.fn((_event: 'release', listener: () => void) => {
        releaseListeners.push(listener)
      })
    }
    const sentinel1 = {
      released: false,
      release: vi.fn(async () => undefined),
      addEventListener: vi.fn()
    }
    const request = vi.fn(async () => {
      // First call returns immediately; second call (the re-acquire) stays
      // pending until resolveSecondRequest is invoked.
      if (request.mock.calls.length === 1) {
        return sentinel0
      }
      return new Promise<unknown>(resolve => {
        resolveSecondRequest = resolve
      })
    })
    const navigatorLike = { wakeLock: { request } }
    const documentLike = {
      visibilityState: 'visible' as DocumentVisibilityState,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
    let finishOperation: (() => void) | undefined

    const running = runWithScreenWakeLock(
      async () => new Promise<string>(resolve => {
        finishOperation = () => resolve('done')
      }),
      { navigator: navigatorLike, document: documentLike }
    )
    await Promise.resolve()
    await Promise.resolve()
    expect(request).toHaveBeenCalledTimes(1)

    // sentinel0 releases mid-operation -> handleRelease -> re-acquire (call #2)
    // is now pending on resolveSecondRequest.
    sentinel0.released = true
    releaseListeners[0]()
    await Promise.resolve()
    await Promise.resolve()
    expect(request).toHaveBeenCalledTimes(2)

    // Operation finishes (active -> false) while the re-acquire is still pending.
    finishOperation?.()
    await Promise.resolve()
    await expect(running).resolves.toBe('done')

    // The re-acquire resolves after active already flipped to false, so the
    // late sentinel must be released (not stored/leaked).
    resolveSecondRequest?.(sentinel1)
    await Promise.resolve()
    await Promise.resolve()
    expect(sentinel1.release).toHaveBeenCalledTimes(1)
  })
})
