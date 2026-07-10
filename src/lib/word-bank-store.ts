import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SavedWord, WordAnalysis } from './types'
import { addWord, isSaved, removeWord, toSavedWord, toggleWord } from './word-bank'

interface WordBankState {
  words: SavedWord[]
  addWord: (word: WordAnalysis, sourceSentence: string | null) => void
  removeWord: (word: string, reading: string) => void
  toggleWord: (word: WordAnalysis, sourceSentence: string | null) => void
  isSaved: (word: string, reading: string) => boolean
  clearAll: () => void
}

export const useWordBankStore = create<WordBankState>()(persist(
  (set, get) => ({
    words: [],
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
    clearAll: () => set({ words: [] })
  }),
  {
    name: 'word-bank-storage',
    version: 1
  }
))
