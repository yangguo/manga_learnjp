import { describe, expect, it } from 'vitest'
import { DEFAULT_JLPT_TARGET, migrateJLPTTargetState } from './jlpt-target-store'

describe('migrateJLPTTargetState', () => {
  it('preserves every valid target level', () => {
    for (const targetLevel of ['N5', 'N4', 'N3', 'N2', 'N1'] as const) {
      expect(migrateJLPTTargetState({ targetLevel })).toEqual({ targetLevel })
    }
  })

  it('falls back to N4 for missing, malformed, or unknown values', () => {
    expect(DEFAULT_JLPT_TARGET).toBe('N4')
    expect(migrateJLPTTargetState(undefined)).toEqual({ targetLevel: 'N4' })
    expect(migrateJLPTTargetState(null)).toEqual({ targetLevel: 'N4' })
    expect(migrateJLPTTargetState('N3')).toEqual({ targetLevel: 'N4' })
    expect(migrateJLPTTargetState({ targetLevel: 'N0' })).toEqual({ targetLevel: 'N4' })
  })
})
