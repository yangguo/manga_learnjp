'use client'

import { BookOpen, Brain, Download, Star, Trash2 } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useWordBankStore } from '@/lib/word-bank-store'
import { useHydrated } from '@/hooks/useHydrated'
import { useWordBankJLPTCalibration } from '@/hooks/useWordBankJLPTCalibration'
import {
  createAnkiExportFilename,
  downloadTextFile,
  serializeWordsForAnki
} from '@/lib/anki-export'
import JLPTBadge from '@/components/JLPTBadge'
import type { AnalysisLanguage, SavedWord } from '@/lib/types'

interface WordBankProps {
  showBackHome?: boolean
}

const UI_TEXT = {
  zh: {
    title: '生词本',
    count: '个词',
    empty: '还没有收藏任何词',
    emptyBody: '阅读时点词汇卡上的星标,把不认识的词收进来吧。',
    backHome: '返回首页',
    exportAnki: '导出 Anki',
    exportSuccess: '已导出',
    exportError: '导出失败，请重试。',
    updateError: '生词本更新失败，请重试。',
    startReview: '开始复习',
    clearAll: '清空全部',
    clearConfirm: '确定要清空全部收藏的词吗?此操作不可撤销。',
    noSentence: '(无原句)',
    justNow: '刚刚',
    minutesAgo: '分钟前',
    hoursAgo: '小时前',
    daysAgo: '天前'
  },
  en: {
    title: 'Word Bank',
    count: 'words',
    empty: 'No saved words yet',
    emptyBody: 'Tap the star on a vocabulary card while reading to save words you don\'t know.',
    backHome: 'Back to home',
    exportAnki: 'Export Anki',
    exportSuccess: 'Exported',
    exportError: 'Export failed. Please try again.',
    updateError: 'Could not update the word bank. Please try again.',
    startReview: 'Start review',
    clearAll: 'Clear all',
    clearConfirm: 'Clear all saved words? This cannot be undone.',
    noSentence: '(no source sentence)',
    justNow: 'just now',
    minutesAgo: 'min ago',
    hoursAgo: 'h ago',
    daysAgo: 'd ago'
  }
} satisfies Record<AnalysisLanguage, Record<string, string>>

const language: AnalysisLanguage = 'zh'
const t = UI_TEXT[language]

const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const min = Math.floor((Date.now() - then) / 60000)
  if (min < 1) return t.justNow
  if (min < 60) return `${min} ${t.minutesAgo}`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} ${t.hoursAgo}`
  return `${Math.floor(hr / 24)} ${t.daysAgo}`
}

function WordCard({ word }: { word: SavedWord }) {
  const removeWord = useWordBankStore(state => state.removeWord)
  const handleRemove = () => {
    void removeWord(word.word, word.reading).catch(() => toast.error(t.updateError))
  }
  return (
    <li className="rounded-lg border border-white/10 bg-gray-950/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-japanese font-semibold text-white">{word.word}</p>
          <p className="text-xs text-gray-400">{word.reading}</p>
        </div>
        <div className="flex items-center gap-1">
          <JLPTBadge classification={word.jlpt} language="zh" />
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove from word bank"
            title="Remove from word bank"
            className="shrink-0 rounded-full p-1 text-gray-500 transition-colors hover:bg-white/10 hover:text-red-300"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-100">{word.meaning}</p>
      <p className="mt-0.5 text-xs text-gray-500">{word.partOfSpeech}</p>
      {word.sourceSentence ? (
        <p
          lang="ja"
          className="mt-2 border-t border-white/10 pt-2 font-japanese text-xs leading-relaxed text-gray-300 whitespace-pre-wrap break-words select-text"
        >
          {word.sourceSentence}
        </p>
      ) : (
        <p className="mt-2 border-t border-white/10 pt-2 text-xs text-gray-600">{t.noSentence}</p>
      )}
      <p className="mt-1 text-xs text-gray-600">{relativeTime(word.savedAt)}</p>
    </li>
  )
}

export default function WordBank({ showBackHome = false }: WordBankProps) {
  useWordBankJLPTCalibration()
  const words = useWordBankStore(state => state.words)
  const clearAll = useWordBankStore(state => state.clearAll)
  const hydrated = useHydrated()

  const handleClear = () => {
    if (window.confirm(t.clearConfirm)) {
      void clearAll().catch(() => toast.error(t.updateError))
    }
  }

  const handleExport = () => {
    try {
      downloadTextFile(
        serializeWordsForAnki(words),
        createAnkiExportFilename(new Date())
      )
      toast.success(`${t.exportSuccess} ${words.length} ${t.count}`)
    } catch {
      toast.error(t.exportError)
    }
  }

  return (
    <div className="px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <BookOpen size={20} className="text-amber-300" />
        <h1 className="text-xl font-bold text-white">{t.title}</h1>
        <span className="text-sm text-gray-400">{words.length} {t.count}</span>
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <Link
            href="/review"
            aria-disabled={!hydrated || words.length === 0}
            className={`flex h-8 items-center gap-1.5 rounded-md border border-emerald-500/30 px-3 text-sm text-emerald-200 transition-colors hover:bg-emerald-500/10 ${
              !hydrated || words.length === 0 ? 'pointer-events-none opacity-40' : ''
            }`}
          >
            <Brain size={15} />
            <span>{t.startReview}</span>
          </Link>
          <button
            type="button"
            onClick={handleExport}
            disabled={!hydrated || words.length === 0}
            className="flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-3 text-sm text-gray-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={15} />
            <span>{t.exportAnki}</span>
          </button>
          {hydrated && words.length > 0 ? (
            <button
              type="button"
              onClick={handleClear}
              className="h-8 rounded-md border border-white/10 px-3 text-sm text-gray-300 transition-colors hover:bg-white/10"
            >
              {t.clearAll}
            </button>
          ) : null}
        </div>
      </div>

      {hydrated && words.length > 0 ? (
        <ul className="space-y-2">
          {words.map(word => (
            <WordCard key={`${word.word}-${word.reading}`} word={word} />
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <Star className="mx-auto mb-3 h-8 w-8 text-gray-500" />
          <h2 className="font-semibold text-white">{t.empty}</h2>
          <p className="mt-1 text-sm text-gray-400">{t.emptyBody}</p>
          {showBackHome ? (
            <Link
              href="/"
              className="mt-4 inline-block rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-200 transition-colors hover:bg-white/10"
            >
              {t.backHome}
            </Link>
          ) : null}
        </div>
      )}
    </div>
  )
}
