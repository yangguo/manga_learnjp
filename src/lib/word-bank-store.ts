import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
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
  ReviewWordUnavailableError,
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

const WORD_BANK_STORAGE_KEY = 'word-bank-storage'

interface WordBankSnapshot {
  words: SavedWord[]
  reviewCards: Record<string, SavedReviewCard>
}

const getBrowserStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

const readWordBankSnapshot = (fallback: WordBankSnapshot): WordBankSnapshot => {
  const storage = getBrowserStorage()
  if (!storage) return fallback
  const raw = storage.getItem(WORD_BANK_STORAGE_KEY)
  if (raw === null) return fallback
  const envelope = JSON.parse(raw) as { state?: unknown }
  const migrated = migrateWordBankState(envelope.state)
  return { words: migrated.words, reviewCards: migrated.reviewCards }
}

const writeWordBankSnapshot = (snapshot: WordBankSnapshot): void => {
  const storage = getBrowserStorage()
  if (!storage) return
  storage.setItem(WORD_BANK_STORAGE_KEY, JSON.stringify({
    state: {
      words: snapshot.words,
      reviewCards: snapshot.reviewCards,
      calibrationStatus: 'idle'
    },
    version: 3
  }))
}

let suppressNextPersistWrite = false

const transactionalStateStorage: StateStorage = {
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

const serverStateStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
}

const wordBankPersistStorage = createJSONStorage(() => {
  return typeof window === 'undefined' ? serverStateStorage : transactionalStateStorage
})

const withWordBankStorageLock = async <T>(operation: () => T | Promise<T>): Promise<T> => {
  if (typeof window !== 'undefined' && window.navigator?.locks) {
    return window.navigator.locks.request(WORD_BANK_STORAGE_KEY, operation)
  }
  return operation()
}

interface WordBankState {
  words: SavedWord[]
  reviewCards: Record<string, SavedReviewCard>
  calibrationStatus: 'idle' | 'loading' | 'ready' | 'error'
  addWord: (word: WordAnalysis, sourceSentence: string | null, persistJLPT: boolean) => Promise<void>
  removeWord: (word: string, reading: string) => Promise<void>
  toggleWord: (word: WordAnalysis, sourceSentence: string | null, persistJLPT: boolean) => Promise<void>
  isSaved: (word: string, reading: string) => boolean
  clearAll: () => Promise<void>
  startReviewSession: (now: Date) => Promise<readonly string[]>
  rateReview: (key: string, rating: ReviewRating, now: Date) => Promise<void>
  calibrateWords: () => Promise<void>
}

export const useWordBankStore = create<WordBankState>()(persist(
  (set, get) => {
    const setWithoutPersist = (state: Partial<WordBankState>) => {
      suppressNextPersistWrite = true
      try {
        set(state)
      } finally {
        suppressNextPersistWrite = false
      }
    }

    const commit = async <T>(
      mutate: (snapshot: WordBankSnapshot) => { snapshot: WordBankSnapshot; result: T },
      runtimeState: Partial<WordBankState> = {}
    ): Promise<T> => withWordBankStorageLock(() => {
      const state = get()
      const latest = readWordBankSnapshot({
        words: state.words,
        reviewCards: state.reviewCards
      })
      const mutation = mutate(latest)
      writeWordBankSnapshot(mutation.snapshot)
      setWithoutPersist({ ...mutation.snapshot, ...runtimeState })
      return mutation.result
    })

    return {
      words: [],
      reviewCards: {},
      calibrationStatus: 'idle',
      addWord: (word, sourceSentence, persistJLPT) => commit(snapshot => ({
        snapshot: {
          ...snapshot,
          words: addWord(
            snapshot.words,
            toSavedWord(word, sourceSentence, new Date().toISOString(), persistJLPT)
          )
        },
        result: undefined
      })),
      removeWord: (word, reading) => commit(snapshot => {
        const key = savedWordKey(word, reading)
        return {
          snapshot: {
            words: removeWord(snapshot.words, word, reading),
            reviewCards: removeSavedReviewCard(snapshot.reviewCards, key)
          },
          result: undefined
        }
      }),
      toggleWord: (word, sourceSentence, persistJLPT) => commit(snapshot => {
        const key = savedWordKey(word.word, word.reading)
        const removing = isSaved(snapshot.words, word.word, word.reading)
        return {
          snapshot: {
            words: toggleWord(
              snapshot.words,
              toSavedWord(word, sourceSentence, new Date().toISOString(), persistJLPT)
            ),
            reviewCards: removing
              ? removeSavedReviewCard(snapshot.reviewCards, key)
              : snapshot.reviewCards
          },
          result: undefined
        }
      }),
      isSaved: (word, reading) => isSaved(get().words, word, reading),
      clearAll: () => commit(() => ({
        snapshot: { words: [], reviewCards: {} },
        result: undefined
      })),
      startReviewSession: now => commit(snapshot => {
        const queue = buildDailyReviewQueue(snapshot.words, snapshot.reviewCards, now)
        return {
          snapshot: { words: snapshot.words, reviewCards: queue.reviewCards },
          result: queue.queueKeys
        }
      }),
      rateReview: (key, rating, now) => commit(snapshot => {
        const stillSaved = snapshot.words.some(
          word => savedWordKey(word.word, word.reading) === key
        )
        if (!stillSaved) throw new ReviewWordUnavailableError()
        const card = snapshot.reviewCards[key]
        if (!card) throw new Error('Review card not found')
        return {
          snapshot: {
            words: snapshot.words,
            reviewCards: {
              ...snapshot.reviewCards,
              [key]: scheduleReview(card, rating, now)
            }
          },
          result: undefined
        }
      }),
      calibrateWords: async () => {
        const status = get().calibrationStatus
        if (status === 'loading' || status === 'ready') return
        setWithoutPersist({ calibrationStatus: 'loading' })
        const result = await getJLPTDictionary()
        if (result.status === 'error') {
          setWithoutPersist({ calibrationStatus: 'error' })
          return
        }
        await commit(snapshot => ({
          snapshot: {
            ...snapshot,
            words: reclassifySavedWords(snapshot.words, result.dictionary)
          },
          result: undefined
        }), { calibrationStatus: 'ready' })
      }
    }
  },
  {
    name: WORD_BANK_STORAGE_KEY,
    storage: wordBankPersistStorage,
    version: 3,
    migrate: persisted => migrateWordBankState(persisted),
    partialize: state => ({
      words: state.words,
      reviewCards: state.reviewCards,
      calibrationStatus: 'idle' as const
    })
  }
))
