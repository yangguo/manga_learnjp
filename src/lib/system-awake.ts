import type { SystemAwakeStatus } from './system-awake-server'

type SystemAwakeAction = 'start' | 'stop'

async function setSystemAwake(action: SystemAwakeAction): Promise<SystemAwakeStatus> {
  const response = await fetch('/api/system-awake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
  }

  return await response.json() as SystemAwakeStatus
}

export async function startSystemAwake(): Promise<SystemAwakeStatus> {
  return await setSystemAwake('start')
}

export async function stopSystemAwake(): Promise<SystemAwakeStatus> {
  return await setSystemAwake('stop')
}

export type { SystemAwakeStatus }
