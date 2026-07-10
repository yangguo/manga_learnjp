import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SavedWord, WordAnalysis } from './types'
import { getJLPTDictionary } from './jlpt-dictionary'
import { addWord, isSaved, reclassifySavedWords, removeWord, toSavedWord, toggleWord } from './word-bank'

export const migrateWordBankState = (persisted: unknown) => {
  const state = persisted as { words?: unknown }
  return {
    words: Array.isArray(state?.words) ? state.words as SavedWord[] : [],
    calibrationStatus: 'idle' as const
  }
}

interface WordBankState {
  words: SavedWord[]
  calibrationStatus: 'idle' | 'loading' | 'ready' | 'error'
  addWord: (word: WordAnalysis, sourceSentence: string | null) => void
  removeWord: (word: string, reading: string) => void
  toggleWord: (word: WordAnalysis, sourceSentence: string | null) => void
  isSaved: (word: string, reading: string) => boolean
  clearAll: () => void
  calibrateWords: () => Promise<void>
}

export const useWordBankStore = create<WordBankState>()(persist(
  (set, get) => ({
    words: [],
    calibrationStatus: 'idle',
    addWord: (word, sourceSentence) => set(state => ({
      words: addWord(state.words, toSavedWord(word, sourceSentence, new Date().toISOString()))
    })),
    removeWord: (word, reading) => set(state => ({
      words: removeWord(state.words, word, reading)
    })),
    toggleWord: (word, sourceSentence) => set(state => ({
      words: toggleWord(state.words, toSavedWord(word, sourceSentence, new Date().toISOString()))
    })),
    isSaved: (word, reading) => isSaved(get().words, word, reading),
    clearAll: () => set({ words: [] }),
    calibrateWords: async () => {
      const status = get().calibrationStatus
      if (status === 'loading' || status === 'ready') return
      set({ calibrationStatus: 'loading' })
      const result = await getJLPTDictionary()
      if (result.status === 'error') {
        set({ calibrationStatus: 'error' })
        return
      }
      set(state => ({
        words: reclassifySavedWords(state.words, result.dictionary),
        calibrationStatus: 'ready'
      }))
    }
  }),
  {
    name: 'word-bank-storage',
    version: 2,
    migrate: persisted => migrateWordBankState(persisted),
    partialize: state => ({ ...state, calibrationStatus: 'idle' as const })
  }
))
