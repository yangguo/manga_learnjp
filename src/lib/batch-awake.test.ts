import { describe, expect, it, vi } from 'vitest'
import { runWithBatchAwake } from './batch-awake'

describe('runWithBatchAwake', () => {
  it('holds system awake around the screen wake lock operation', async () => {
    const calls: string[] = []

    const result = await runWithBatchAwake(
      async () => {
        calls.push('operation')
        return 'done'
      },
      {
        startSystemAwake: async () => {
          calls.push('system-start')
          return { supported: true, active: true, pid: 2468 }
        },
        stopSystemAwake: async () => {
          calls.push('system-stop')
          return { supported: true, active: false }
        },
        runWithScreenWakeLock: async operation => {
          calls.push('screen-lock')
          return await operation()
        }
      }
    )

    expect(result).toBe('done')
    expect(calls).toEqual(['system-start', 'screen-lock', 'operation', 'system-stop'])
  })

  it('releases system awake when the operation fails', async () => {
    const stopSystemAwake = vi.fn(async () => ({ supported: true, active: false }))

    await expect(runWithBatchAwake(
      async () => {
        throw new Error('analysis failed')
      },
      {
        startSystemAwake: async () => ({ supported: true, active: true, pid: 2468 }),
        stopSystemAwake,
        runWithScreenWakeLock: async operation => await operation()
      }
    )).rejects.toThrow('analysis failed')

    expect(stopSystemAwake).toHaveBeenCalledTimes(1)
  })

  it('continues the operation when system awake cannot start', async () => {
    const onSystemAwakeError = vi.fn()
    const stopSystemAwake = vi.fn(async () => ({ supported: false, active: false }))

    const result = await runWithBatchAwake(
      async () => 'done',
      {
        startSystemAwake: async () => {
          throw new Error('caffeinate unavailable')
        },
        stopSystemAwake,
        runWithScreenWakeLock: async operation => await operation(),
        onSystemAwakeError
      }
    )

    expect(result).toBe('done')
    expect(stopSystemAwake).toHaveBeenCalledTimes(1)
    expect(onSystemAwakeError).toHaveBeenCalledWith(expect.any(Error))
  })
})
