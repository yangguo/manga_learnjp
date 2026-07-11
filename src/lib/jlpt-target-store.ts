import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isJLPTLevel } from './jlpt-levels'
import type { JLPTLevel } from './jlpt-levels'

export const DEFAULT_JLPT_TARGET: JLPTLevel = 'N4'

export const migrateJLPTTargetState = (persisted: unknown): { targetLevel: JLPTLevel } => {
  if (!persisted || typeof persisted !== 'object') {
    return { targetLevel: DEFAULT_JLPT_TARGET }
  }

  const targetLevel = (persisted as { targetLevel?: unknown }).targetLevel
  return { targetLevel: isJLPTLevel(targetLevel) ? targetLevel : DEFAULT_JLPT_TARGET }
}

interface JLPTTargetState {
  targetLevel: JLPTLevel
  setTargetLevel: (level: JLPTLevel) => void
}

export const useJLPTTargetStore = create<JLPTTargetState>()(persist(
  set => ({
    targetLevel: DEFAULT_JLPT_TARGET,
    setTargetLevel: targetLevel => set({ targetLevel })
  }),
  {
    name: 'jlpt-target-storage',
    version: 1,
    migrate: persisted => migrateJLPTTargetState(persisted),
    merge: (persisted, current) => ({
      ...current,
      ...migrateJLPTTargetState(persisted)
    }),
    partialize: state => ({ targetLevel: state.targetLevel })
  }
))
