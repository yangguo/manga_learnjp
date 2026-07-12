import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { GrammarJLPTClassification } from './jlpt-levels'
import type { SavedGrammar } from './types'
import {
  addGrammar,
  isSavedGrammar,
  normalizeGrammarPattern,
  reclassifySavedGrammar,
  removeGrammar,
  toggleGrammar
} from './grammar-bank'
import { GRAMMAR_JLPT_DATASET_SOURCE, isJLPTLevel } from './jlpt-levels'
import { getJLPTGrammarDictionary } from './jlpt-grammar-dictionary'

const STORAGE_KEY = 'grammar-bank-storage'

interface GrammarBankSnapshot {
  grammars: SavedGrammar[]
}

const isValidSavedGrammar = (value: unknown): value is SavedGrammar => {
  if (!value || typeof value !== 'object') return false
  const grammar = value as Partial<SavedGrammar>
  return typeof grammar.pattern === 'string'
    && normalizeGrammarPattern(grammar.pattern).length > 0
    && typeof grammar.explanation === 'string'
    && typeof grammar.example === 'string'
    && (grammar.sourceSentence === null || typeof grammar.sourceSentence === 'string')
    && (grammar.language === 'zh' || grammar.language === 'en')
    && typeof grammar.savedAt === 'string'
    && Number.isFinite(Date.parse(grammar.savedAt))
}

const hasValidGrammarJLPT = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false
  const jlpt = value as Partial<GrammarJLPTClassification>
  if (!isJLPTLevel(jlpt.level) && jlpt.level !== null) return false
  return jlpt.source === GRAMMAR_JLPT_DATASET_SOURCE
    && typeof jlpt.datasetVersion === 'string'
    && (jlpt.match === 'exact' || jlpt.match === 'normalized' || jlpt.match === 'none')
}

const sanitizeSavedGrammar = (grammar: SavedGrammar): SavedGrammar => {
  if (grammar.jlpt === undefined || hasValidGrammarJLPT(grammar.jlpt)) return grammar
  const { jlpt: _jlpt, ...savedGrammar } = grammar
  return savedGrammar
}

export const migrateGrammarBankState = (persisted: unknown): GrammarBankSnapshot => {
  const state = persisted as { grammars?: unknown }
  const seen = new Set<string>()
  return {
    grammars: Array.isArray(state?.grammars)
      ? state.grammars.filter(isValidSavedGrammar).map(sanitizeSavedGrammar).filter(grammar => {
        const key = normalizeGrammarPattern(grammar.pattern)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      : []
  }
}

const getBrowserStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

const readSnapshot = (fallback: GrammarBankSnapshot): GrammarBankSnapshot => {
  const storage = getBrowserStorage()
  if (!storage) return fallback
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) return fallback
  try {
    const parsed = JSON.parse(raw) as { state?: { grammars?: unknown } }
    return migrateGrammarBankState(parsed.state)
  } catch {
    return fallback
  }
}

const writeSnapshot = (snapshot: GrammarBankSnapshot): void => {
  const storage = getBrowserStorage()
  if (!storage) return
  storage.setItem(STORAGE_KEY, JSON.stringify({ state: snapshot, version: 2 }))
}

let suppressNextPersistWrite = false

const transactionalStorage: StateStorage = {
  getItem: name => window.localStorage.getItem(name),
  setItem: (name, value) => {
    if (suppressNextPersistWrite) {
      suppressNextPersistWrite = false
      return
    }
    window.localStorage.setItem(name, value)
  },
  removeItem: name => window.localStorage.removeItem(name)
}

const serverStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
}

const persistStorage = createJSONStorage(() =>
  typeof window === 'undefined' ? serverStorage : transactionalStorage
)

const withStorageLock = async <T>(operation: () => T | Promise<T>): Promise<T> => {
  if (typeof window !== 'undefined' && window.navigator?.locks) {
    return window.navigator.locks.request(STORAGE_KEY, operation)
  }
  return operation()
}

interface GrammarBankState {
  grammars: SavedGrammar[]
  calibrationStatus: 'idle' | 'loading' | 'ready' | 'error'
  addGrammar: (entry: SavedGrammar) => Promise<void>
  removeGrammar: (pattern: string) => Promise<void>
  toggleGrammar: (entry: SavedGrammar) => Promise<void>
  isSaved: (pattern: string) => boolean
  clearAll: () => Promise<void>
  calibrateGrammar: () => Promise<void>
}

export const useGrammarBankStore = create<GrammarBankState>()(persist(
  (set, get) => {
    const setWithoutPersist = (state: Partial<GrammarBankState>) => {
      suppressNextPersistWrite = true
      try {
        set(state)
      } finally {
        suppressNextPersistWrite = false
      }
    }

    const commit = async (mutate: (snapshot: GrammarBankSnapshot) => GrammarBankSnapshot): Promise<void> => {
      await withStorageLock(() => {
        const snapshot = readSnapshot({ grammars: get().grammars })
        const next = mutate(snapshot)
        writeSnapshot(next)
        setWithoutPersist(next)
      })
    }

    return {
      grammars: [],
      calibrationStatus: 'idle',
      addGrammar: entry => commit(snapshot => ({ grammars: addGrammar(snapshot.grammars, entry) })),
      removeGrammar: pattern => commit(snapshot => ({ grammars: removeGrammar(snapshot.grammars, pattern) })),
      toggleGrammar: entry => commit(snapshot => ({ grammars: toggleGrammar(snapshot.grammars, entry) })),
      isSaved: pattern => isSavedGrammar(get().grammars, pattern),
      clearAll: () => commit(() => ({ grammars: [] })),
      calibrateGrammar: async () => {
        const status = get().calibrationStatus
        if (status === 'loading' || status === 'ready') return
        setWithoutPersist({ calibrationStatus: 'loading' })
        const result = await getJLPTGrammarDictionary()
        if (result.status === 'error') {
          setWithoutPersist({ calibrationStatus: 'error' })
          return
        }
        await commit(snapshot => ({
          grammars: reclassifySavedGrammar(snapshot.grammars, result)
        }))
        setWithoutPersist({ calibrationStatus: 'ready' })
      }
    }
  },
  {
    name: STORAGE_KEY,
    storage: persistStorage,
    version: 2,
    migrate: persisted => migrateGrammarBankState(persisted),
    merge: (persisted, current) => ({
      ...current,
      ...migrateGrammarBankState(persisted)
    }),
    partialize: state => ({ grammars: state.grammars, calibrationStatus: 'idle' as const })
  }
))
