'use client'

import { BookOpen, Brain, Download, Star, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useWordBankStore } from '@/lib/word-bank-store'
import { useGrammarBankStore } from '@/lib/grammar-bank-store'
import { useHydrated } from '@/hooks/useHydrated'
import { useWordBankJLPTCalibration } from '@/hooks/useWordBankJLPTCalibration'
import { useGrammarBankJLPTCalibration } from '@/hooks/useGrammarBankJLPTCalibration'
import {
  createAnkiExportFilename,
  downloadTextFile,
  serializeWordsForAnki
} from '@/lib/anki-export'
import { resolveReviewEntry } from '@/lib/review-entry'
import JLPTBadge from '@/components/JLPTBadge'
import type { AnalysisLanguage, SavedGrammar, SavedWord } from '@/lib/types'

interface WordBankProps {
  showBackHome?: boolean
  onStartReview?: () => void
}

const UI_TEXT = {
  zh: {
    title: '收藏',
    count: '个词',
    grammarCount: '个语法点',
    vocabularyTab: '词汇',
    grammarTab: '语法',
    empty: '还没有收藏任何词',
    emptyBody: '阅读时点词汇卡上的星标,把不认识的词收进来吧。',
    emptyGrammar: '还没有收藏任何语法',
    emptyGrammarBody: '阅读时点语法卡上的星标,把想复习的构式收进来吧。',
    backHome: '返回首页',
    exportAnki: '导出 Anki',
    exportSuccess: '已导出',
    exportError: '导出失败，请重试。',
    updateError: '生词本更新失败，请重试。',
    startReview: '开始复习',
    clearAll: '清空全部',
    clearGrammar: '清空语法',
    clearConfirm: '确定要清空全部收藏的词吗?此操作不可撤销。',
    clearGrammarConfirm: '确定要清空全部收藏的语法吗?此操作不可撤销。',
    noSentence: '(无原句)',
    example: '例句',
    sourceSentence: '原句',
    language: '说明语言',
    justNow: '刚刚',
    minutesAgo: '分钟前',
    hoursAgo: '小时前',
    daysAgo: '天前'
  },
  en: {
    title: 'Collection',
    count: 'words',
    grammarCount: 'grammar patterns',
    vocabularyTab: 'Vocabulary',
    grammarTab: 'Grammar',
    empty: 'No saved words yet',
    emptyBody: 'Tap the star on a vocabulary card while reading to save words you don\'t know.',
    emptyGrammar: 'No saved grammar yet',
    emptyGrammarBody: 'Tap the star on a grammar card while reading to keep patterns to revisit.',
    backHome: 'Back to home',
    exportAnki: 'Export Anki',
    exportSuccess: 'Exported',
    exportError: 'Export failed. Please try again.',
    updateError: 'Could not update the word bank. Please try again.',
    startReview: 'Start review',
    clearAll: 'Clear all',
    clearGrammar: 'Clear grammar',
    clearConfirm: 'Clear all saved words? This cannot be undone.',
    clearGrammarConfirm: 'Clear all saved grammar? This cannot be undone.',
    noSentence: '(no source sentence)',
    example: 'Example',
    sourceSentence: 'Source sentence',
    language: 'Explanation language',
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

function GrammarCard({ grammar }: { grammar: SavedGrammar }) {
  const removeGrammar = useGrammarBankStore(state => state.removeGrammar)
  const handleRemove = () => {
    void removeGrammar(grammar.pattern).catch(() => toast.error(t.updateError))
  }
  const languageLabel = grammar.language === 'zh' ? '中文' : 'English'

  return (
    <li className="rounded-lg border border-white/10 bg-gray-950/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <p lang="ja" className="font-japanese font-semibold text-white break-words">{grammar.pattern}</p>
        <div className="flex shrink-0 items-center gap-1">
          <JLPTBadge classification={grammar.jlpt} language="zh" />
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove grammar from collection"
            title="Remove grammar from collection"
            className="rounded-full p-1 text-gray-500 transition-colors hover:bg-white/10 hover:text-red-300"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-gray-100 break-words">{grammar.explanation}</p>
      {grammar.example ? (
        <p lang="ja" className="mt-2 border-t border-white/10 pt-2 font-japanese text-xs leading-relaxed text-gray-300 break-words">
          <span className="mr-1 font-sans text-gray-500">{t.example}</span>{grammar.example}
        </p>
      ) : null}
      {grammar.sourceSentence ? (
        <p lang="ja" className="mt-2 text-xs leading-relaxed text-gray-400 break-words">
          <span className="mr-1 font-sans text-gray-500">{t.sourceSentence}</span>{grammar.sourceSentence}
        </p>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-600">
        <span>{t.language}: {languageLabel}</span>
        <span>{relativeTime(grammar.savedAt)}</span>
      </div>
    </li>
  )
}

export default function WordBank({ showBackHome = false, onStartReview }: WordBankProps) {
  useWordBankJLPTCalibration()
  useGrammarBankJLPTCalibration()
  const words = useWordBankStore(state => state.words)
  const clearAll = useWordBankStore(state => state.clearAll)
  const grammars = useGrammarBankStore(state => state.grammars)
  const clearGrammar = useGrammarBankStore(state => state.clearAll)
  const hydrated = useHydrated()
  const [activeTab, setActiveTab] = useState<'words' | 'grammar'>('words')
  const reviewEntry = resolveReviewEntry(onStartReview)
  const activeCount = activeTab === 'words' ? words.length : grammars.length
  const hasActiveEntries = activeTab === 'words' ? words.length > 0 : grammars.length > 0

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

  const handleClearGrammar = () => {
    if (window.confirm(t.clearGrammarConfirm)) {
      void clearGrammar().catch(() => toast.error(t.updateError))
    }
  }

  return (
    <div className="px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <BookOpen size={20} className="text-amber-300" />
        <h1 className="text-xl font-bold text-white">{t.title}</h1>
        <span className="text-sm text-gray-400">
          {activeCount} {activeTab === 'words' ? t.count : t.grammarCount}
        </span>
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          {activeTab === 'words' ? (
            <>
              {reviewEntry.mode === 'inline' ? (
                <button
                  type="button"
                  onClick={reviewEntry.onStart}
                  disabled={!hydrated || words.length === 0}
                  className="flex h-8 items-center gap-1.5 rounded-md border border-emerald-500/30 px-3 text-sm text-emerald-200 transition-colors hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Brain size={15} />
                  <span>{t.startReview}</span>
                </button>
              ) : (
                <Link
                  href={reviewEntry.href}
                  aria-disabled={!hydrated || words.length === 0}
                  className={`flex h-8 items-center gap-1.5 rounded-md border border-emerald-500/30 px-3 text-sm text-emerald-200 transition-colors hover:bg-emerald-500/10 ${
                    !hydrated || words.length === 0 ? 'pointer-events-none opacity-40' : ''
                  }`}
                >
                  <Brain size={15} />
                  <span>{t.startReview}</span>
                </Link>
              )}
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
                <button type="button" onClick={handleClear} className="h-8 rounded-md border border-white/10 px-3 text-sm text-gray-300 transition-colors hover:bg-white/10">
                  {t.clearAll}
                </button>
              ) : null}
            </>
          ) : hydrated && grammars.length > 0 ? (
            <button type="button" onClick={handleClearGrammar} className="h-8 rounded-md border border-white/10 px-3 text-sm text-gray-300 transition-colors hover:bg-white/10">
              {t.clearGrammar}
            </button>
          ) : null}
        </div>
      </div>

      <div role="tablist" aria-label="Collection type" className="mb-4 flex border-b border-white/10">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'words'}
          onClick={() => setActiveTab('words')}
          className={`h-9 border-b-2 px-3 text-sm transition-colors ${activeTab === 'words' ? 'border-amber-300 text-amber-200' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
        >
          {t.vocabularyTab} <span className="ml-1 text-xs">{words.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'grammar'}
          onClick={() => setActiveTab('grammar')}
          className={`h-9 border-b-2 px-3 text-sm transition-colors ${activeTab === 'grammar' ? 'border-purple-300 text-purple-200' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
        >
          {t.grammarTab} <span className="ml-1 text-xs">{grammars.length}</span>
        </button>
      </div>

      {hydrated && hasActiveEntries ? (
        activeTab === 'words' ? (
          <ul className="space-y-2">
            {words.map(word => (
              <WordCard key={`${word.word}-${word.reading}`} word={word} />
            ))}
          </ul>
        ) : (
          <ul className="space-y-2">
            {grammars.map(grammar => (
              <GrammarCard key={grammar.pattern} grammar={grammar} />
            ))}
          </ul>
        )
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <Star className="mx-auto mb-3 h-8 w-8 text-gray-500" />
          <h2 className="font-semibold text-white">{activeTab === 'words' ? t.empty : t.emptyGrammar}</h2>
          <p className="mt-1 text-sm text-gray-400">{activeTab === 'words' ? t.emptyBody : t.emptyGrammarBody}</p>
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
