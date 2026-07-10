'use client'

import { BookOpen, Star, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useWordBankStore } from '@/lib/word-bank-store'
import { useHydrated } from '@/hooks/useHydrated'
import { useWordBankJLPTCalibration } from '@/hooks/useWordBankJLPTCalibration'
import JLPTBadge from '@/components/JLPTBadge'
import type { AnalysisLanguage, SavedWord } from '@/lib/types'

const UI_TEXT = {
  zh: {
    title: '生词本',
    count: '个词',
    empty: '还没有收藏任何词',
    emptyBody: '阅读时点词汇卡上的星标,把不认识的词收进来吧。',
    backHome: '返回首页',
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
    clearAll: 'Clear all',
    clearConfirm: 'Clear all saved words? This cannot be undone.',
    noSentence: '(no source sentence)',
    justNow: 'just now',
    minutesAgo: 'min ago',
    hoursAgo: 'h ago',
    daysAgo: 'd ago'
  }
} satisfies Record<AnalysisLanguage, Record<string, string>>

// 本页默认中文文案(与 Image Analyzer 默认中文一致);language 固定 zh,不引入语言切换。
const language: AnalysisLanguage = 'zh'
const t = UI_TEXT[language]

const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const now = Date.now()
  const diffMs = now - then
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return t.justNow
  if (min < 60) return `${min} ${t.minutesAgo}`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} ${t.hoursAgo}`
  const day = Math.floor(hr / 24)
  return `${day} ${t.daysAgo}`
}

function WordCard({ word }: { word: SavedWord }) {
  const removeWord = useWordBankStore(state => state.removeWord)
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
            onClick={() => removeWord(word.word, word.reading)}
            aria-label="Remove from word bank"
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

export default function WordBankPage() {
  useWordBankJLPTCalibration()
  const words = useWordBankStore(state => state.words)
  const clearAll = useWordBankStore(state => state.clearAll)
  const hydrated = useHydrated()

  const handleClear = () => {
    if (window.confirm(t.clearConfirm)) {
      clearAll()
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <BookOpen size={20} className="text-amber-300" />
        <h1 className="text-xl font-bold text-white">{t.title}</h1>
        <span className="text-sm text-gray-400">{words.length} {t.count}</span>
        {hydrated && words.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-auto rounded-lg border border-white/10 px-3 py-1 text-sm text-gray-300 transition-colors hover:bg-white/10"
          >
            {t.clearAll}
          </button>
        )}
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
          <Link
            href="/"
            className="mt-4 inline-block rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-200 transition-colors hover:bg-white/10"
          >
            {t.backHome}
          </Link>
        </div>
      )}
    </div>
  )
}
