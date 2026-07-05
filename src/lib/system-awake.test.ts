import { afterEach, describe, expect, it, vi } from 'vitest'
import { startSystemAwake, stopSystemAwake } from './system-awake'

describe('system awake client API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts the local system awake assertion', async () => {
    const responseBody = { supported: true, active: true, pid: 2468 }
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(responseBody), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(startSystemAwake()).resolves.toEqual(responseBody)

    expect(fetchMock).toHaveBeenCalledWith('/api/system-awake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' })
    })
  })

  it('stops the local system awake assertion', async () => {
    const responseBody = { supported: true, active: false }
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(responseBody), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(stopSystemAwake()).resolves.toEqual(responseBody)

    expect(fetchMock).toHaveBeenCalledWith('/api/system-awake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop' })
    })
  })

  it('surfaces route errors to the caller', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: 'Unsupported action' }),
      { status: 400, statusText: 'Bad Request' }
    )))

    await expect(startSystemAwake()).rejects.toThrow('Unsupported action')
  })
})
