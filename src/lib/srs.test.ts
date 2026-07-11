import { describe, expect, it } from 'vitest'
import {
  buildDailyReviewQueue,
  createSavedReviewCard,
  getReviewSummary,
  localDateKey,
  previewReviewIntervals,
  scheduleReview,
  type ReviewRating
} from './srs'
import type { SavedWord } from './types'

const NOW = new Date('2026-07-12T08:00:00.000Z')

const makeWord = (word: string, savedAt = '2026-07-12T00:00:00.000Z'): SavedWord => ({
  word,
  reading: `${word}-reading`,
  meaning: `${word}-meaning`,
  partOfSpeech: 'noun',
  sourceSentence: null,
  savedAt
})

const keyFor = (word: SavedWord): string => JSON.stringify([word.word, word.reading])

describe('FSRS adapter', () => {
  it('creates a JSON-safe new card at the requested time', () => {
    expect(createSavedReviewCard('word-key', NOW)).toEqual({
      key: 'word-key',
      due: NOW.toISOString(),
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      learningSteps: 0,
      reps: 0,
      lapses: 0,
      state: 0,
      lastReview: null,
      introducedAt: NOW.toISOString()
    })
  })

  it('previews all four outcomes without mutating the card', () => {
    const card = createSavedReviewCard('word-key', NOW)
    const snapshot = structuredClone(card)

    const preview = previewReviewIntervals(card, NOW)

    expect(Object.keys(preview)).toEqual(['again', 'hard', 'good', 'easy'])
    for (const due of Object.values(preview)) {
      expect(due.getTime()).toBeGreaterThanOrEqual(NOW.getTime())
    }
    expect(card).toEqual(snapshot)
  })

  it.each<ReviewRating>(['again', 'hard', 'good', 'easy'])(
    'schedules a %s rating as a persisted card',
    rating => {
      const card = createSavedReviewCard('word-key', NOW)
      const next = scheduleReview(card, rating, NOW)

      expect(next.key).toBe(card.key)
      expect(next.introducedAt).toBe(card.introducedAt)
      expect(next.reps).toBe(1)
      expect(next.lastReview).toBe(NOW.toISOString())
      expect(new Date(next.due).getTime()).toBeGreaterThanOrEqual(NOW.getTime())
    }
  )

  it('rejects reviews before the previous review time', () => {
    const card = {
      ...createSavedReviewCard('word-key', NOW),
      lastReview: '2026-07-12T09:00:00.000Z'
    }

    expect(() => scheduleReview(card, 'good', NOW)).toThrow('system clock')
  })
})

describe('daily review queue', () => {
  it('uses a stable local calendar key', () => {
    expect(localDateKey(new Date(2026, 6, 2, 23, 59))).toBe('2026-07-02')
  })

  it('puts due cards first in due order and ignores future cards', () => {
    const words = [makeWord('new'), makeWord('first'), makeWord('second'), makeWord('future')]
    const existingCard = (word: SavedWord) => ({
      ...createSavedReviewCard(keyFor(word), NOW),
      introducedAt: '2026-07-11T08:00:00.000Z'
    })
    const first = { ...existingCard(words[1]), due: '2026-07-12T07:00:00.000Z' }
    const second = { ...existingCard(words[2]), due: '2026-07-12T07:30:00.000Z' }
    const future = { ...existingCard(words[3]), due: '2026-07-13T08:00:00.000Z' }

    const result = buildDailyReviewQueue(words, {
      [second.key]: second,
      [future.key]: future,
      [first.key]: first
    }, NOW, 1)

    expect(result.queueKeys).toEqual([first.key, second.key, keyFor(words[0])])
    expect(result.reviewCards[future.key]).toEqual(future)
  })

  it('limits new cards by how many were already introduced today', () => {
    const words = Array.from({ length: 12 }, (_, index) => makeWord(`word-${index}`))
    const introduced = {
      ...createSavedReviewCard(keyFor(words[0]), NOW),
      due: '2026-07-13T08:00:00.000Z'
    }

    const result = buildDailyReviewQueue(words, { [introduced.key]: introduced }, NOW, 3)

    expect(result.queueKeys).toEqual([keyFor(words[1]), keyFor(words[2])])
    expect(Object.keys(result.reviewCards)).toHaveLength(3)
    expect(getReviewSummary(words, { [introduced.key]: introduced }, NOW, 3)).toEqual({
      dueCount: 0,
      newCount: 2,
      total: 2
    })
  })

  it('filters orphan cards and does not mutate inputs', () => {
    const words = [makeWord('saved')]
    const orphan = createSavedReviewCard('missing-key', NOW)
    const cards = { [orphan.key]: orphan }
    const wordsSnapshot = structuredClone(words)
    const cardsSnapshot = structuredClone(cards)

    const result = buildDailyReviewQueue(words, cards, NOW, 0)

    expect(result.queueKeys).toEqual([])
    expect(result.reviewCards).toEqual({})
    expect(words).toEqual(wordsSnapshot)
    expect(cards).toEqual(cardsSnapshot)
  })
})
