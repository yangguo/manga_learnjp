import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SavedWord, WordAnalysis } from './types'
import { getJLPTDictionary } from './jlpt-dictionary'
import {
  addWord,
  isSaved,
  reclassifySavedWords,
  removeSavedReviewCard,
  removeWord,
  savedWordKey,
  toSavedWord,
  toggleWord
} from './word-bank'
import {
  buildDailyReviewQueue,
  scheduleReview,
  type ReviewRating,
  type SavedReviewCard
} from './srs'

const isValidDate = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))

const isNonNegativeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const isSavedReviewCard = (value: unknown, key: string): value is SavedReviewCard => {
  if (!value || typeof value !== 'object') return false
  const card = value as Partial<SavedReviewCard>
  return card.key === key
    && isValidDate(card.due)
    && isNonNegativeNumber(card.stability)
    && isNonNegativeNumber(card.difficulty)
    && isNonNegativeNumber(card.elapsedDays)
    && isNonNegativeNumber(card.scheduledDays)
    && isNonNegativeNumber(card.learningSteps)
    && isNonNegativeNumber(card.reps)
    && isNonNegativeNumber(card.lapses)
    && Number.isInteger(card.state)
    && card.state !== undefined
    && card.state >= 0
    && card.state <= 3
    && (card.lastReview === null || isValidDate(card.lastReview))
    && isValidDate(card.introducedAt)
}

export const migrateWordBankState = (persisted: unknown) => {
  const state = persisted as { words?: unknown; reviewCards?: unknown }
  const words = Array.isArray(state?.words) ? state.words as SavedWord[] : []
  const validKeys = new Set(words.map(word => savedWordKey(word.word, word.reading)))
  const reviewCards = state?.reviewCards && typeof state.reviewCards === 'object'
    ? Object.fromEntries(Object.entries(state.reviewCards).filter(
      ([key, card]) => validKeys.has(key) && isSavedReviewCard(card, key)
    ))
    : {}
  return {
    words,
    reviewCards,
    calibrationStatus: 'idle' as const
  }
}

interface WordBankState {
  words: SavedWord[]
  reviewCards: Record<string, SavedReviewCard>
  calibrationStatus: 'idle' | 'loading' | 'ready' | 'error'
  addWord: (word: WordAnalysis, sourceSentence: string | null, persistJLPT: boolean) => void
  removeWord: (word: string, reading: string) => void
  toggleWord: (word: WordAnalysis, sourceSentence: string | null, persistJLPT: boolean) => void
  isSaved: (word: string, reading: string) => boolean
  clearAll: () => void
  startReviewSession: (now: Date) => string[]
  rateReview: (key: string, rating: ReviewRating, now: Date) => void
  calibrateWords: () => Promise<void>
}

export const useWordBankStore = create<WordBankState>()(persist(
  (set, get) => ({
    words: [],
    reviewCards: {},
    calibrationStatus: 'idle',
    addWord: (word, sourceSentence, persistJLPT) => set(state => ({
      words: addWord(state.words, toSavedWord(word, sourceSentence, new Date().toISOString(), persistJLPT))
    })),
    removeWord: (word, reading) => set(state => {
      const key = savedWordKey(word, reading)
      return {
        words: removeWord(state.words, word, reading),
        reviewCards: removeSavedReviewCard(state.reviewCards, key)
      }
    }),
    toggleWord: (word, sourceSentence, persistJLPT) => set(state => {
      const key = savedWordKey(word.word, word.reading)
      const removing = isSaved(state.words, word.word, word.reading)
      return {
        words: toggleWord(
          state.words,
          toSavedWord(word, sourceSentence, new Date().toISOString(), persistJLPT)
        ),
        reviewCards: removing
          ? removeSavedReviewCard(state.reviewCards, key)
          : state.reviewCards
      }
    }),
    isSaved: (word, reading) => isSaved(get().words, word, reading),
    clearAll: () => set({ words: [], reviewCards: {} }),
    startReviewSession: now => {
      const state = get()
      const queue = buildDailyReviewQueue(state.words, state.reviewCards, now)
      set({ reviewCards: queue.reviewCards })
      return queue.queueKeys
    },
    rateReview: (key, rating, now) => set(state => {
      const card = state.reviewCards[key]
      if (!card) throw new Error('Review card not found')
      return {
        reviewCards: {
          ...state.reviewCards,
          [key]: scheduleReview(card, rating, now)
        }
      }
    }),
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
    version: 3,
    migrate: persisted => migrateWordBankState(persisted),
    partialize: state => ({
      words: state.words,
      reviewCards: state.reviewCards,
      calibrationStatus: 'idle' as const
    })
  }
))
