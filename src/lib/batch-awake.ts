import { startSystemAwake, stopSystemAwake, type SystemAwakeStatus } from './system-awake'
import { runWithScreenWakeLock, type ScreenWakeLockOptions } from './wake-lock'

type RunWithScreenWakeLock = <T>(
  operation: () => Promise<T>,
  options?: ScreenWakeLockOptions
) => Promise<T>

interface BatchAwakeOptions extends Pick<ScreenWakeLockOptions, 'document' | 'navigator'> {
  onSystemAwakeError?: (error: unknown) => void
  onWakeLockError?: (error: unknown) => void
  startSystemAwake?: () => Promise<SystemAwakeStatus>
  stopSystemAwake?: () => Promise<SystemAwakeStatus>
  runWithScreenWakeLock?: RunWithScreenWakeLock
}

export async function runWithBatchAwake<T>(
  operation: () => Promise<T>,
  options: BatchAwakeOptions = {}
): Promise<T> {
  const startAwake = options.startSystemAwake ?? startSystemAwake
  const stopAwake = options.stopSystemAwake ?? stopSystemAwake
  const runScreenLock = options.runWithScreenWakeLock ?? runWithScreenWakeLock

  try {
    await startAwake()
  } catch (error) {
    options.onSystemAwakeError?.(error)
  }

  try {
    return await runScreenLock(operation, {
      document: options.document,
      navigator: options.navigator,
      onError: options.onWakeLockError
    })
  } finally {
    try {
      await stopAwake()
    } catch (error) {
      options.onSystemAwakeError?.(error)
    }
  }
}
