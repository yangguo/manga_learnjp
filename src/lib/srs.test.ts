import { describe, expect, it } from 'vitest'
import {
  createSavedReviewCard,
  previewReviewIntervals,
  scheduleReview,
  type ReviewRating
} from './srs'

const NOW = new Date('2026-07-12T08:00:00.000Z')

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
