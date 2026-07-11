import { beforeEach, describe, expect, it } from 'vitest'
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

  it('persists newly introduced cards and review ratings', () => {
    useWordBankStore.setState({ words: [word] })

    expect(useWordBankStore.getState().startReviewSession(NOW)).toEqual([key])
    expect(useWordBankStore.getState().reviewCards[key].reps).toBe(0)

    useWordBankStore.getState().rateReview(key, 'good', NOW)

    expect(useWordBankStore.getState().reviewCards[key]).toMatchObject({
      key,
      reps: 1,
      lastReview: NOW.toISOString()
    })
  })

  it('removes review state when removeWord deletes a word', () => {
    useWordBankStore.setState({
      words: [word],
      reviewCards: { [key]: createSavedReviewCard(key, NOW) }
    })

    useWordBankStore.getState().removeWord(word.word, word.reading)

    expect(useWordBankStore.getState().reviewCards).toEqual({})
  })

  it('removes review state when toggleWord deletes a word', () => {
    useWordBankStore.setState({
      words: [word],
      reviewCards: { [key]: createSavedReviewCard(key, NOW) }
    })

    useWordBankStore.getState().toggleWord(analysis, null, false)

    expect(useWordBankStore.getState().reviewCards).toEqual({})
  })

  it('clears words and review state together', () => {
    useWordBankStore.setState({
      words: [word],
      reviewCards: { [key]: createSavedReviewCard(key, NOW) }
    })

    useWordBankStore.getState().clearAll()

    expect(useWordBankStore.getState()).toMatchObject({ words: [], reviewCards: {} })
  })
})
