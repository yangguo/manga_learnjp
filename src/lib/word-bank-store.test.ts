import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSavedReviewCard } from './srs'
import { savedWordKey } from './word-bank'
import { migrateWordBankState, useWordBankStore } from './word-bank-store'
import type { SavedWord, WordAnalysis } from './types'

const NOW = new Date('2026-07-12T08:00:00.000Z')

const word: SavedWord = {
  word: '橋',
  reading: 'はし',
  meaning: 'bridge',
  partOfSpeech: 'noun',
  difficulty: 'N3',
  sourceSentence: '橋を渡る',
  savedAt: '2026-07-10T00:00:00.000Z'
}

const analysis: WordAnalysis = {
  word: word.word,
  reading: word.reading,
  meaning: word.meaning,
  partOfSpeech: word.partOfSpeech
}

const key = savedWordKey(word.word, word.reading)

const persistedState = (
  words: SavedWord[],
  reviewCards: Record<string, ReturnType<typeof createSavedReviewCard>>
) => JSON.stringify({
  state: { words, reviewCards, calibrationStatus: 'idle' },
  version: 3
})

describe('migrateWordBankState', () => {
  it('preserves v1 word identity and learning context', () => {
    expect(migrateWordBankState({ words: [word] })).toEqual({
      words: [word],
      reviewCards: {},
      calibrationStatus: 'idle'
    })
  })

  it('preserves valid v2 words while adding empty review state', () => {
    expect(migrateWordBankState({ words: [word], calibrationStatus: 'ready' })).toEqual({
      words: [word],
      reviewCards: {},
      calibrationStatus: 'idle'
    })
  })

  it('keeps valid cards and drops malformed or orphan cards', () => {
    const valid = createSavedReviewCard(key, NOW)
    const malformed = { ...valid, key: 'malformed', due: 'not-a-date' }
    const orphan = createSavedReviewCard('orphan', NOW)

    expect(migrateWordBankState({
      words: [word],
      reviewCards: {
        [key]: valid,
        malformed,
        orphan
      }
    })).toEqual({
      words: [word],
      reviewCards: { [key]: valid },
      calibrationStatus: 'idle'
    })
  })
})

describe('word bank review state', () => {
  beforeEach(() => {
    useWordBankStore.setState({
      words: [],
      reviewCards: {},
      calibrationStatus: 'idle'
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('persists newly introduced cards and review ratings', async () => {
    useWordBankStore.setState({ words: [word] })

    await expect(useWordBankStore.getState().startReviewSession(NOW)).resolves.toEqual([key])
    expect(useWordBankStore.getState().reviewCards[key].reps).toBe(0)

    await useWordBankStore.getState().rateReview(key, 'good', NOW)

    expect(useWordBankStore.getState().reviewCards[key]).toMatchObject({
      key,
      reps: 1,
      lastReview: NOW.toISOString()
    })
  })

  it('removes review state when removeWord deletes a word', async () => {
    useWordBankStore.setState({
      words: [word],
      reviewCards: { [key]: createSavedReviewCard(key, NOW) }
    })

    await useWordBankStore.getState().removeWord(word.word, word.reading)

    expect(useWordBankStore.getState().reviewCards).toEqual({})
  })

  it('removes review state when toggleWord deletes a word', async () => {
    useWordBankStore.setState({
      words: [word],
      reviewCards: { [key]: createSavedReviewCard(key, NOW) }
    })

    await useWordBankStore.getState().toggleWord(analysis, null, false)

    expect(useWordBankStore.getState().reviewCards).toEqual({})
  })

  it('clears words and review state together', async () => {
    useWordBankStore.setState({
      words: [word],
      reviewCards: { [key]: createSavedReviewCard(key, NOW) }
    })

    await useWordBankStore.getState().clearAll()

    expect(useWordBankStore.getState()).toMatchObject({ words: [], reviewCards: {} })
  })

  it('does not change the in-memory card when durable storage rejects a rating', async () => {
    const card = createSavedReviewCard(key, NOW)
    useWordBankStore.setState({ words: [word], reviewCards: { [key]: card } })
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => persistedState([word], { [key]: card }),
        setItem: () => { throw new Error('quota exceeded') }
      }
    })

    await expect(useWordBankStore.getState().rateReview(key, 'good', NOW)).rejects.toThrow('quota exceeded')
    expect(useWordBankStore.getState().reviewCards[key]).toEqual(card)
  })

  it('does not restore a word deleted in another browser tab', async () => {
    const card = createSavedReviewCard(key, NOW)
    const setItem = vi.fn()
    useWordBankStore.setState({ words: [word], reviewCards: { [key]: card } })
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => persistedState([], {}),
        setItem
      }
    })

    await expect(useWordBankStore.getState().rateReview(key, 'good', NOW)).rejects.toThrow('no longer saved')
    expect(setItem).not.toHaveBeenCalled()
    expect(useWordBankStore.getState().reviewCards[key]).toEqual(card)
  })

  it('does not create review cards when durable storage cannot be read', async () => {
    useWordBankStore.setState({ words: [word], reviewCards: {} })
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => { throw new Error('storage denied') },
        setItem: vi.fn()
      }
    })

    await expect(useWordBankStore.getState().startReviewSession(NOW)).rejects.toThrow('storage denied')
    expect(useWordBankStore.getState().reviewCards).toEqual({})
  })

  it('uses the same exclusive browser lock for ratings and word deletion', async () => {
    const card = createSavedReviewCard(key, NOW)
    const request = vi.fn(async (_name: string, callback: () => unknown) => callback())
    vi.stubGlobal('window', {
      navigator: { locks: { request } },
      localStorage: {
        getItem: () => persistedState([word], { [key]: card }),
        setItem: vi.fn()
      }
    })
    useWordBankStore.setState({ words: [word], reviewCards: { [key]: card } })

    await useWordBankStore.getState().rateReview(key, 'good', NOW)
    await useWordBankStore.getState().removeWord(word.word, word.reading)

    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls.every(call => call[0] === 'word-bank-storage')).toBe(true)
  })
})
