import { createEmptyCard, fsrs, Rating, type Card } from 'ts-fsrs'
import { savedWordKey } from './word-bank'
import type { SavedWord } from './types'

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'
export type ReviewAction = 'reveal' | ReviewRating

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

export interface ReviewSummary {
  dueCount: number
  newCount: number
  total: number
}

export interface DailyReviewQueue {
  queueKeys: string[]
  reviewCards: Record<string, SavedReviewCard>
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

export const localDateKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const reviewActionForKey = (
  key: string,
  answerVisible: boolean
): ReviewAction | null => {
  if (!answerVisible) return key === ' ' ? 'reveal' : null
  return ({
    '1': 'again',
    '2': 'hard',
    '3': 'good',
    '4': 'easy'
  } as const)[key as '1' | '2' | '3' | '4'] ?? null
}

export const formatReviewInterval = (now: Date, due: Date): string => {
  const milliseconds = Math.max(0, due.getTime() - now.getTime())
  if (milliseconds < 60_000) return '<1分钟'
  const minutes = Math.round(milliseconds / 60_000)
  if (minutes < 60) return `${minutes}分钟`
  const hours = Math.round(milliseconds / 3_600_000)
  if (hours < 24) return `${hours}小时`
  const days = Math.round(milliseconds / 86_400_000)
  if (days < 30) return `${days}天`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}个月`
  return `${Math.round(days / 365)}年`
}

const getQueueParts = (
  words: SavedWord[],
  reviewCards: Record<string, SavedReviewCard>,
  now: Date,
  newLimit: number
) => {
  const validKeys = new Set(words.map(word => savedWordKey(word.word, word.reading)))
  const validCards = Object.fromEntries(
    Object.entries(reviewCards).filter(([key]) => validKeys.has(key))
  )
  const dueCards = Object.values(validCards)
    .filter(card => new Date(card.due).getTime() <= now.getTime())
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime())
  const today = localDateKey(now)
  const introducedToday = Object.values(validCards)
    .filter(card => localDateKey(new Date(card.introducedAt)) === today)
    .length
  const slots = Math.max(0, newLimit - introducedToday)
  const newWords = words
    .filter(word => !validCards[savedWordKey(word.word, word.reading)])
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    .slice(0, slots)

  return { validCards, dueCards, newWords }
}

export const getReviewSummary = (
  words: SavedWord[],
  reviewCards: Record<string, SavedReviewCard>,
  now: Date,
  newLimit = 10
): ReviewSummary => {
  const { dueCards, newWords } = getQueueParts(words, reviewCards, now, newLimit)
  return {
    dueCount: dueCards.length,
    newCount: newWords.length,
    total: dueCards.length + newWords.length
  }
}

export const buildDailyReviewQueue = (
  words: SavedWord[],
  reviewCards: Record<string, SavedReviewCard>,
  now: Date,
  newLimit = 10
): DailyReviewQueue => {
  const { validCards, dueCards, newWords } = getQueueParts(words, reviewCards, now, newLimit)
  const nextCards = { ...validCards }
  const newKeys = newWords.map(word => {
    const key = savedWordKey(word.word, word.reading)
    nextCards[key] = createSavedReviewCard(key, now)
    return key
  })
  return {
    queueKeys: [...dueCards.map(card => card.key), ...newKeys],
    reviewCards: nextCards
  }
}
