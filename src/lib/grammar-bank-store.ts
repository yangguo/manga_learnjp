import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { SavedGrammar } from './types'
import { addGrammar, isSavedGrammar, normalizeGrammarPattern, removeGrammar, toggleGrammar } from './grammar-bank'

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

export const migrateGrammarBankState = (persisted: unknown): GrammarBankSnapshot => {
  const state = persisted as { grammars?: unknown }
  const seen = new Set<string>()
  return {
    grammars: Array.isArray(state?.grammars)
      ? state.grammars.filter((grammar): grammar is SavedGrammar => {
        if (!isValidSavedGrammar(grammar)) return false
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
  storage.setItem(STORAGE_KEY, JSON.stringify({ state: snapshot, version: 1 }))
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
  addGrammar: (entry: SavedGrammar) => Promise<void>
  removeGrammar: (pattern: string) => Promise<void>
  toggleGrammar: (entry: SavedGrammar) => Promise<void>
  isSaved: (pattern: string) => boolean
  clearAll: () => Promise<void>
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
      addGrammar: entry => commit(snapshot => ({ grammars: addGrammar(snapshot.grammars, entry) })),
      removeGrammar: pattern => commit(snapshot => ({ grammars: removeGrammar(snapshot.grammars, pattern) })),
      toggleGrammar: entry => commit(snapshot => ({ grammars: toggleGrammar(snapshot.grammars, entry) })),
      isSaved: pattern => isSavedGrammar(get().grammars, pattern),
      clearAll: () => commit(() => ({ grammars: [] }))
    }
  },
  {
    name: STORAGE_KEY,
    storage: persistStorage,
    version: 1,
    migrate: persisted => migrateGrammarBankState(persisted),
    merge: (persisted, current) => ({
      ...current,
      ...migrateGrammarBankState(persisted)
    }),
    partialize: state => ({ grammars: state.grammars })
  }
))
