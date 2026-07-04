'use client'

import { motion } from 'framer-motion'
import { BookOpen, Languages, Loader2, Quote, Sparkles } from 'lucide-react'
import type { AnalysisResult } from '@/lib/types'

interface MokuroAnalysisPanelProps {
  analysisResult: AnalysisResult | null
  isAnalyzing: boolean
  selectedText: string | null
}

const normalizeDifficulty = (difficulty: string): string => difficulty.toLowerCase()

const isBeginnerWord = (difficulty: string): boolean => {
  const normalized = normalizeDifficulty(difficulty)
  return normalized === 'beginner' || /^n[45]$/.test(normalized)
}

const DIFFICULTY_BADGE_CLASSES: Record<string, string> = {
  beginner: 'bg-green-500/15 text-green-300 border-green-500/25',
  n5: 'bg-green-500/15 text-green-300 border-green-500/25',
  n4: 'bg-green-500/15 text-green-300 border-green-500/25',
  intermediate: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
  n3: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
  n2: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
  advanced: 'bg-red-500/15 text-red-300 border-red-500/25',
  n1: 'bg-red-500/15 text-red-300 border-red-500/25'
}

const FALLBACK_DIFFICULTY_CLASS = 'bg-gray-500/15 text-gray-300 border-gray-500/25'

export default function MokuroAnalysisPanel({
  analysisResult,
  isAnalyzing,
  selectedText
}: MokuroAnalysisPanelProps) {
  const selectedTextHeader = selectedText ? (
    <div className="rounded-2xl border border-white/10 bg-gray-950/40 p-3">
      <p className="text-xs text-gray-500">Selected text</p>
      <p className="font-japanese text-sm font-medium text-white">{selectedText}</p>
    </div>
  ) : null

  if (!selectedText) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <Quote className="mx-auto mb-3 h-8 w-8 text-gray-500" />
        <h3 className="font-semibold text-white">No text selected</h3>
        <p className="mt-1 text-sm text-gray-400">
          Click a highlighted OCR block to see translation, vocabulary, and grammar analysis.
        </p>
      </div>
    )
  }

  if (isAnalyzing) {
    return (
      <div className="space-y-4">
        {selectedTextHeader}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center"
        >
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-purple-300" />
          <h3 className="font-semibold text-white">Analyzing...</h3>
          <p className="mt-1 text-sm text-gray-400">
            Extracting vocabulary and grammar patterns from the selected text.
          </p>
        </motion.div>
      </div>
    )
  }

  if (!analysisResult) {
    return (
      <div className="space-y-4">
        {selectedTextHeader}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-gray-500" />
          <h3 className="font-semibold text-white">Ready to analyze</h3>
          <p className="mt-1 text-sm text-gray-400">
            Analysis results will appear here once the selected text has been processed.
          </p>
        </div>
      </div>
    )
  }

  const vocabulary = analysisResult.sentences
    .flatMap(sentence => sentence.words)
    .filter(word => !isBeginnerWord(word.difficulty))

  const grammar = analysisResult.sentences
    .flatMap(sentence => sentence.grammar)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {selectedTextHeader}

      {analysisResult.translation && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Languages size={16} className="text-cyan-300" />
            <h3 className="font-semibold text-white">Translation</h3>
          </div>
          <p className="text-sm leading-relaxed text-gray-100">
            {analysisResult.translation}
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen size={16} className="text-amber-300" />
          <h3 className="font-semibold text-white">Vocabulary</h3>
          <span className="ml-auto text-xs text-gray-500">
            {vocabulary.length} item{vocabulary.length === 1 ? '' : 's'}
          </span>
        </div>
        {vocabulary.length > 0 ? (
          <ul className="space-y-2">
            {vocabulary.map((word, index) => (
              <li
                key={`${word.word}-${index}`}
                className="rounded-lg border border-white/10 bg-gray-950/40 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-japanese font-semibold text-white">
                      {word.word}
                    </p>
                    <p className="text-xs text-gray-400">{word.reading}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${DIFFICULTY_BADGE_CLASSES[normalizeDifficulty(word.difficulty)] ?? FALLBACK_DIFFICULTY_CLASS}`}>
                    {word.difficulty}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-100">{word.meaning}</p>
                <p className="mt-0.5 text-xs text-gray-500">{word.partOfSpeech}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-white/10 bg-gray-950/40 p-3 text-sm text-gray-400">
            No intermediate or advanced vocabulary in this selection.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-purple-300" />
          <h3 className="font-semibold text-white">Grammar</h3>
          <span className="ml-auto text-xs text-gray-500">
            {grammar.length} pattern{grammar.length === 1 ? '' : 's'}
          </span>
        </div>
        {grammar.length > 0 ? (
          <ul className="space-y-2">
            {grammar.map((pattern, index) => (
              <li
                key={`${pattern.pattern}-${index}`}
                className="rounded-lg border border-white/10 bg-gray-950/40 p-3"
              >
                <p className="font-japanese font-semibold text-white">
                  {pattern.pattern}
                </p>
                <p className="mt-1 text-sm text-gray-100">{pattern.explanation}</p>
                <p className="mt-1 text-xs italic text-gray-500">
                  Example: <span className="font-japanese text-gray-400">{pattern.example}</span>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-white/10 bg-gray-950/40 p-3 text-sm text-gray-400">
            No grammar patterns identified in this selection.
          </p>
        )}
      </section>
    </motion.div>
  )
}
