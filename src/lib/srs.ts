import { createEmptyCard, fsrs, Rating, type Card } from 'ts-fsrs'

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

export interface SavedReviewCard {
  key: string
  due: string
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  state: 0 | 1 | 2 | 3
  lastReview: string | null
  introducedAt: string
}

const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: true
})

const RATING_MAP: Record<ReviewRating, Rating.Again | Rating.Hard | Rating.Good | Rating.Easy> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy
}

const fromFSRSCard = (
  card: Card,
  key: string,
  introducedAt: string
): SavedReviewCard => ({
  key,
  due: card.due.toISOString(),
  stability: card.stability,
  difficulty: card.difficulty,
  elapsedDays: card.elapsed_days,
  scheduledDays: card.scheduled_days,
  learningSteps: card.learning_steps,
  reps: card.reps,
  lapses: card.lapses,
  state: card.state,
  lastReview: card.last_review?.toISOString() ?? null,
  introducedAt
})

const toFSRSCard = (card: SavedReviewCard): Card => ({
  due: new Date(card.due),
  stability: card.stability,
  difficulty: card.difficulty,
  elapsed_days: card.elapsedDays,
  scheduled_days: card.scheduledDays,
  learning_steps: card.learningSteps,
  reps: card.reps,
  lapses: card.lapses,
  state: card.state,
  ...(card.lastReview ? { last_review: new Date(card.lastReview) } : {})
})

export const createSavedReviewCard = (key: string, now: Date): SavedReviewCard => {
  return fromFSRSCard(createEmptyCard(now), key, now.toISOString())
}

export const previewReviewIntervals = (
  card: SavedReviewCard,
  now: Date
): Record<ReviewRating, Date> => {
  const preview = scheduler.repeat(toFSRSCard(card), now)
  return {
    again: preview[Rating.Again].card.due,
    hard: preview[Rating.Hard].card.due,
    good: preview[Rating.Good].card.due,
    easy: preview[Rating.Easy].card.due
  }
}

export const scheduleReview = (
  card: SavedReviewCard,
  rating: ReviewRating,
  now: Date
): SavedReviewCard => {
  if (card.lastReview && now.getTime() < new Date(card.lastReview).getTime()) {
    throw new Error('Cannot review before the previous review; check the system clock')
  }
  const result = scheduler.next(toFSRSCard(card), now, RATING_MAP[rating])
  return fromFSRSCard(result.card, card.key, card.introducedAt)
}
