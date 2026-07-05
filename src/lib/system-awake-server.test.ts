import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { createSystemAwakeManager } from './system-awake-server'

class FakeAwakeProcess extends EventEmitter {
  pid = 2468
  kill = vi.fn((signal?: NodeJS.Signals) => {
    this.emit('exit', 0, signal)
    return true
  })
}

describe('createSystemAwakeManager', () => {
  it('starts one caffeinate process on macOS and reuses it while active', () => {
    const awakeProcess = new FakeAwakeProcess()
    const spawnProcess = vi.fn(() => awakeProcess)
    const manager = createSystemAwakeManager({
      platform: 'darwin',
      spawnProcess
    })

    expect(manager.start()).toEqual({ supported: true, active: true, pid: 2468 })
    expect(manager.start()).toEqual({ supported: true, active: true, pid: 2468 })

    expect(spawnProcess).toHaveBeenCalledTimes(1)
    expect(spawnProcess).toHaveBeenCalledWith('caffeinate', ['-dimsu'], { stdio: 'ignore' })
  })

  it('stops the active caffeinate process', () => {
    const awakeProcess = new FakeAwakeProcess()
    const manager = createSystemAwakeManager({
      platform: 'darwin',
      spawnProcess: vi.fn(() => awakeProcess)
    })

    manager.start()

    expect(manager.stop()).toEqual({ supported: true, active: false })
    expect(awakeProcess.kill).toHaveBeenCalledWith('SIGTERM')
  })

  it('clears the active process when caffeinate exits by itself', () => {
    const awakeProcess = new FakeAwakeProcess()
    const manager = createSystemAwakeManager({
      platform: 'darwin',
      spawnProcess: vi.fn(() => awakeProcess)
    })

    manager.start()
    awakeProcess.emit('exit', 0, null)

    expect(manager.status()).toEqual({ supported: true, active: false })
  })

  it('reports unsupported platforms without spawning a process', () => {
    const spawnProcess = vi.fn()
    const manager = createSystemAwakeManager({
      platform: 'linux',
      spawnProcess
    })

    expect(manager.start()).toEqual({
      supported: false,
      active: false,
      reason: 'System awake lock is only available on macOS'
    })
    expect(spawnProcess).not.toHaveBeenCalled()
  })
})
