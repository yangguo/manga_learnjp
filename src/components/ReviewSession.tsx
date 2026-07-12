'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, BookOpen, CheckCircle2, Eye, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import JLPTBadge from '@/components/JLPTBadge'
import { useHydrated } from '@/hooks/useHydrated'
import {
  formatReviewInterval,
  previewReviewIntervals,
  reviewActionForKey,
  type ReviewRating
} from '@/lib/srs'
import { savedWordKey } from '@/lib/word-bank'
import { useWordBankStore } from '@/lib/word-bank-store'

const RATINGS: Array<{
  rating: ReviewRating
  label: string
  key: string
  className: string
}> = [
  { rating: 'again', label: '忘记', key: '1', className: 'border-red-500/30 text-red-200 hover:bg-red-500/15' },
  { rating: 'hard', label: '困难', key: '2', className: 'border-orange-500/30 text-orange-200 hover:bg-orange-500/15' },
  { rating: 'good', label: '良好', key: '3', className: 'border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/15' },
  { rating: 'easy', label: '简单', key: '4', className: 'border-sky-500/30 text-sky-200 hover:bg-sky-500/15' }
]

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)
}

export default function ReviewSession() {
  const hydrated = useHydrated()
  const words = useWordBankStore(state => state.words)
  const reviewCards = useWordBankStore(state => state.reviewCards)
  const startReviewSession = useWordBankStore(state => state.startReviewSession)
  const rateReview = useWordBankStore(state => state.rateReview)
  const startedRef = useRef(false)
  const [queueKeys, setQueueKeys] = useState<string[] | null>(null)
  const [initialTotal, setInitialTotal] = useState(0)
  const [answerVisible, setAnswerVisible] = useState(false)
  const [previewAt, setPreviewAt] = useState<Date | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!hydrated || startedRef.current) return
    startedRef.current = true
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      try {
        const keys = startReviewSession(new Date())
        setQueueKeys(keys)
        setInitialTotal(keys.length)
      } catch (error) {
        const message = error instanceof Error ? error.message : '无法读取复习进度'
        setLoadError(message)
        toast.error(message)
      }
    })
    return () => {
      cancelled = true
      startedRef.current = false
    }
  }, [hydrated, startReviewSession])

  const wordsByKey = useMemo(() => new Map(
    words.map(word => [savedWordKey(word.word, word.reading), word])
  ), [words])
  const currentKey = queueKeys?.[0] ?? null
  const currentWord = currentKey ? wordsByKey.get(currentKey) : undefined
  const currentCard = currentKey ? reviewCards[currentKey] : undefined
  const remainingNew = queueKeys?.filter(key => reviewCards[key]?.reps === 0).length ?? 0
  const remainingTotal = queueKeys?.length ?? 0
  const remainingDue = remainingTotal - remainingNew
  const completed = initialTotal - remainingTotal

  const previews = useMemo(() => {
    if (!answerVisible || !currentCard || !previewAt) return null
    try {
      return previewReviewIntervals(currentCard, previewAt)
    } catch {
      return null
    }
  }, [answerVisible, currentCard, previewAt])

  const revealAnswer = useCallback(() => {
    if (!currentCard) return
    setPreviewAt(new Date())
    setAnswerVisible(true)
  }, [currentCard])

  const submitRating = useCallback((rating: ReviewRating) => {
    if (!answerVisible || !currentKey) return
    try {
      rateReview(currentKey, rating, new Date())
      setQueueKeys(keys => keys?.slice(1) ?? [])
      setAnswerVisible(false)
      setPreviewAt(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存复习结果失败')
    }
  }, [answerVisible, currentKey, rateReview])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      const action = reviewActionForKey(event.key, answerVisible)
      if (!action) return
      event.preventDefault()
      if (action === 'reveal') revealAnswer()
      else submitRating(action)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [answerVisible, revealAnswer, submitRating])

  if (!hydrated || queueKeys === null) {
    return (
      <div className="flex min-h-[420px] items-center justify-center text-sm text-gray-400">
        正在准备今日复习...
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <h1 className="text-xl font-semibold text-white">无法载入复习进度</h1>
        <p className="mt-2 break-words text-sm text-red-300">{loadError}</p>
        <Link href="/words" className="mt-6 inline-flex items-center gap-2 text-sm text-amber-300 hover:text-amber-200">
          <BookOpen size={16} /> 返回生词本
        </Link>
      </div>
    )
  }

  if (!currentKey || !currentWord || !currentCard) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
        <h1 className="mt-4 text-2xl font-bold text-white">今日复习完成</h1>
        <p className="mt-2 text-sm text-gray-400">已完成 {completed} 个词，新的到期卡会在下次进入时出现。</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 px-4 text-sm text-gray-200 hover:bg-white/10">
            <ArrowLeft size={16} /> 返回阅读
          </Link>
          <Link href="/words" className="inline-flex h-10 items-center gap-2 rounded-md border border-amber-500/30 px-4 text-sm text-amber-200 hover:bg-amber-500/10">
            <BookOpen size={16} /> 生词本
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col py-6 sm:py-10">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-xs text-gray-500">今日进度</p>
          <p className="mt-1 text-sm font-medium text-gray-200">{completed} / {initialTotal}</p>
        </div>
        <div className="flex items-center gap-4 text-right text-xs text-gray-400">
          <span>到期 <strong className="ml-1 text-white">{remainingDue}</strong></span>
          <span>新词 <strong className="ml-1 text-white">{remainingNew}</strong></span>
        </div>
      </header>

      <section className="flex flex-1 flex-col justify-center py-8 sm:py-12" aria-live="polite">
        <div className="min-h-[300px] border-y border-white/10 bg-black/15 px-5 py-8 sm:min-h-[340px] sm:px-10 sm:py-10">
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs uppercase text-gray-500">{currentCard.reps === 0 ? '新词' : '复习'}</span>
            {answerVisible ? <JLPTBadge classification={currentWord.jlpt} language="zh" /> : null}
          </div>
          <div className="flex min-h-[210px] flex-col items-center justify-center text-center">
            <h1 lang="ja" className="font-japanese text-4xl font-bold leading-tight text-white break-words sm:text-5xl">
              {currentWord.word}
            </h1>
            {currentWord.sourceSentence ? (
              <p lang="ja" className="mt-5 max-w-2xl font-japanese text-sm leading-relaxed text-gray-300 break-words sm:text-base">
                {currentWord.sourceSentence}
              </p>
            ) : null}
            {answerVisible ? (
              <div className="mt-7 w-full border-t border-white/10 pt-6">
                <p lang="ja" className="font-japanese text-lg text-amber-200">{currentWord.reading}</p>
                <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-white break-words">{currentWord.meaning}</p>
                <p className="mt-2 text-xs text-gray-500">{currentWord.partOfSpeech}</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="min-h-[132px]">
        {!answerVisible ? (
          <button
            type="button"
            onClick={revealAnswer}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-amber-400 font-medium text-gray-950 transition-colors hover:bg-amber-300"
          >
            <Eye size={18} /> 显示答案
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {RATINGS.map(option => (
              <button
                key={option.rating}
                type="button"
                onClick={() => submitRating(option.rating)}
                className={`flex h-16 flex-col items-center justify-center rounded-md border bg-black/20 text-sm transition-colors ${option.className}`}
              >
                <span className="font-medium">{option.label}</span>
                <span className="mt-1 text-xs opacity-70">
                  {previews && previewAt ? formatReviewInterval(previewAt, previews[option.rating]) : '...'}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
          <Link href="/words" className="inline-flex items-center gap-1 hover:text-gray-300">
            <BookOpen size={13} /> 生词本
          </Link>
          <span className="inline-flex items-center gap-1"><RotateCcw size={12} /> FSRS</span>
        </div>
      </div>
    </div>
  )
}
