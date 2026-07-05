export interface WakeLockSentinelLike {
  released?: boolean
  release: () => Promise<void>
  addEventListener?: (event: 'release', listener: () => void, options?: { once?: boolean }) => void
  removeEventListener?: (event: 'release', listener: () => void) => void
}

export interface WakeLockNavigatorLike {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>
  }
}

export interface ScreenWakeLockOptions {
  navigator?: WakeLockNavigatorLike
  document?: {
    visibilityState?: DocumentVisibilityState
    addEventListener: (event: 'visibilitychange', listener: () => void) => void
    removeEventListener: (event: 'visibilitychange', listener: () => void) => void
  }
  onError?: (error: unknown) => void
}

const getDefaultNavigator = (): WakeLockNavigatorLike | undefined => {
  return typeof navigator === 'undefined'
    ? undefined
    : navigator as WakeLockNavigatorLike
}

export async function runWithScreenWakeLock<T>(
  operation: () => Promise<T>,
  options: ScreenWakeLockOptions = {}
): Promise<T> {
  const navigatorRef = options.navigator ?? getDefaultNavigator()
  const documentRef = options.document ?? (typeof document === 'undefined' ? undefined : document)
  const state: { sentinel: WakeLockSentinelLike | null } = { sentinel: null }
  let active = true

  const requestLock = async () => {
    if (!active || documentRef?.visibilityState === 'hidden') return

    try {
      const nextSentinel = await navigatorRef?.wakeLock?.request('screen') ?? null
      if (!active) {
        await nextSentinel?.release()
        return
      }

      state.sentinel = nextSentinel
      state.sentinel?.addEventListener?.('release', handleRelease, { once: true })
    } catch (error) {
      options.onError?.(error)
    }
  }

  const handleRelease = () => {
    state.sentinel?.removeEventListener?.('release', handleRelease)
    state.sentinel = null
    if (active) {
      void requestLock()
    }
  }

  const handleVisibilityChange = () => {
    if (documentRef?.visibilityState === 'visible' && !state.sentinel) {
      void requestLock()
    }
  }

  documentRef?.addEventListener('visibilitychange', handleVisibilityChange)
  await requestLock()

  try {
    return await operation()
  } finally {
    active = false
    documentRef?.removeEventListener('visibilitychange', handleVisibilityChange)
    const currentSentinel = state.sentinel
    state.sentinel = null
    if (currentSentinel && !currentSentinel.released) {
      currentSentinel.removeEventListener?.('release', handleRelease)
      try {
        await currentSentinel.release()
      } catch (error) {
        options.onError?.(error)
      }
    }
  }
}
