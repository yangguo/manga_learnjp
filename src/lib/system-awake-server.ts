import { spawn } from 'node:child_process'

export interface SystemAwakeStatus {
  supported: boolean
  active: boolean
  pid?: number
  reason?: string
}

type AwakeProcess = {
  pid?: number
  kill: (signal?: NodeJS.Signals) => boolean
  once: (event: 'exit' | 'error', listener: (...args: unknown[]) => void) => AwakeProcess
}

type SpawnAwakeProcess = (
  command: string,
  args: string[],
  options: { stdio: 'ignore' }
) => AwakeProcess

interface SystemAwakeManagerOptions {
  platform?: NodeJS.Platform | string
  spawnProcess?: SpawnAwakeProcess
}

export interface SystemAwakeManager {
  status: () => SystemAwakeStatus
  start: () => SystemAwakeStatus
  stop: () => SystemAwakeStatus
}

const UNSUPPORTED_REASON = 'System awake lock is only available on macOS'

export function createSystemAwakeManager({
  platform = process.platform,
  spawnProcess = spawn as SpawnAwakeProcess
}: SystemAwakeManagerOptions = {}): SystemAwakeManager {
  let awakeProcess: AwakeProcess | null = null
  const supported = platform === 'darwin'

  const status = (): SystemAwakeStatus => {
    if (!supported) {
      return {
        supported: false,
        active: false,
        reason: UNSUPPORTED_REASON
      }
    }

    return {
      supported: true,
      active: Boolean(awakeProcess),
      ...(awakeProcess?.pid ? { pid: awakeProcess.pid } : {})
    }
  }

  const clearProcess = (processRef: AwakeProcess) => {
    if (awakeProcess === processRef) {
      awakeProcess = null
    }
  }

  return {
    status,
    start: () => {
      if (!supported || awakeProcess) {
        return status()
      }

      try {
        const nextProcess = spawnProcess('caffeinate', ['-dimsu'], { stdio: 'ignore' })
        awakeProcess = nextProcess
        nextProcess.once('exit', () => clearProcess(nextProcess))
        nextProcess.once('error', () => clearProcess(nextProcess))
      } catch (error) {
        awakeProcess = null
        return {
          supported: true,
          active: false,
          reason: error instanceof Error ? error.message : 'Failed to start system awake lock'
        }
      }

      return status()
    },
    stop: () => {
      const currentProcess = awakeProcess
      awakeProcess = null
      currentProcess?.kill('SIGTERM')
      return status()
    }
  }
}

const globalAwakeState = globalThis as typeof globalThis & {
  __mangaLearnJpSystemAwakeManager?: SystemAwakeManager
  __mangaLearnJpSystemAwakeCleanupRegistered?: boolean
}

export function getSystemAwakeManager(): SystemAwakeManager {
  globalAwakeState.__mangaLearnJpSystemAwakeManager ??= createSystemAwakeManager()

  if (!globalAwakeState.__mangaLearnJpSystemAwakeCleanupRegistered) {
    process.once('exit', () => {
      globalAwakeState.__mangaLearnJpSystemAwakeManager?.stop()
    })
    globalAwakeState.__mangaLearnJpSystemAwakeCleanupRegistered = true
  }

  return globalAwakeState.__mangaLearnJpSystemAwakeManager
}
