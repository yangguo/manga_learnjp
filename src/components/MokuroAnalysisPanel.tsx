'use client'

import { motion } from 'framer-motion'
import { BookOpen, Loader2, Quote, Sparkles, Star } from 'lucide-react'
import { filterLearningGrammar, filterLearningVocabulary } from '@/lib/analysis-filters'
import { useWordBankStore } from '@/lib/word-bank-store'
import JLPTBadge from '@/components/JLPTBadge'
import type { AnalysisLanguage, AnalysisResult, WordAnalysis } from '@/lib/types'

interface MokuroAnalysisPanelProps {
  analysisResult: AnalysisResult | null
  isAnalyzing: boolean
  selectedText: string | null
  language: AnalysisLanguage
  hideSelectedText?: boolean
}

const UI_TEXT = {
  zh: {
    selectedText: '选中文本',
    noTextSelected: '未选择文本',
    noTextSelectedBody: '点击页面上的文字框查看翻译、词汇和语法解析。',
    analyzing: '分析中...',
    analyzingBody: '正在提取所选文本的词汇和语法结构。',
    ready: '等待分析',
    readyBody: '选中文本的分析结果会显示在这里。',
    translation: '翻译',
    vocabulary: '词汇',
    item: '项',
    noVocabulary: '没有需要重点学习的 N4+ 词汇。',
    grammar: '语法',
    pattern: '个语法点',
    noGrammar: '没有需要重点学习的 N4+ 语法点。',
    example: '例句',
    jlptUnavailable: 'JLPT 词表暂不可用，当前定级不会写入缓存。'
  },
  en: {
    selectedText: 'Selected text',
    noTextSelected: 'No text selected',
    noTextSelectedBody: 'Click a text box to see translation, vocabulary, and grammar analysis.',
    analyzing: 'Analyzing...',
    analyzingBody: 'Extracting vocabulary and grammar patterns from the selected text.',
    ready: 'Ready to analyze',
    readyBody: 'Analysis results will appear here once the selected text has been processed.',
    translation: 'Translation',
    vocabulary: 'Vocabulary',
    item: 'item',
    noVocabulary: 'No N4+ vocabulary needs special focus in this selection.',
    grammar: 'Grammar',
    pattern: 'pattern',
    noGrammar: 'No N4+ grammar patterns need special focus in this selection.',
    example: 'Example',
    jlptUnavailable: 'JLPT data is unavailable. Current classifications will not be saved.'
  }
} satisfies Record<AnalysisLanguage, Record<string, string>>

export default function MokuroAnalysisPanel({
  analysisResult,
  isAnalyzing,
  selectedText,
  language,
  hideSelectedText = false
}: MokuroAnalysisPanelProps) {
  const t = UI_TEXT[language]
  const selectedTextHeader = !hideSelectedText && selectedText ? (
    <div className="rounded-2xl border border-white/10 bg-gray-950/40 p-3">
      <p className="text-xs text-gray-500">{t.selectedText}</p>
      <p className="font-japanese text-sm font-medium text-white">{selectedText}</p>
    </div>
  ) : null

  if (!selectedText) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <Quote className="mx-auto mb-3 h-8 w-8 text-gray-500" />
        <h3 className="font-semibold text-white">{t.noTextSelected}</h3>
        <p className="mt-1 text-sm text-gray-400">
          {t.noTextSelectedBody}
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
          <h3 className="font-semibold text-white">{t.analyzing}</h3>
          <p className="mt-1 text-sm text-gray-400">
            {t.analyzingBody}
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
          <h3 className="font-semibold text-white">{t.ready}</h3>
          <p className="mt-1 text-sm text-gray-400">
            {t.readyBody}
          </p>
        </div>
      </div>
    )
  }

  const vocabulary = analysisResult.sentences
    .flatMap(sentence => sentence.words)
  const learningVocabulary = filterLearningVocabulary(vocabulary)

  const grammar = analysisResult.sentences
    .flatMap(sentence => sentence.grammar)
  const learningGrammar = filterLearningGrammar(grammar)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {(!hideSelectedText && selectedText) || analysisResult.translation ? (
        <section className="rounded-2xl border border-white/10 bg-gray-950/40 p-3">
          {!hideSelectedText && selectedText && (
            <>
              <p className="mb-1 text-xs text-gray-500">{t.selectedText}</p>
              <p className="font-japanese text-base font-medium leading-relaxed text-white">{selectedText}</p>
            </>
          )}
          {analysisResult.translation && (
            <div className={!hideSelectedText && selectedText ? 'mt-2 border-t border-white/10 pt-2' : ''}>
              <p className="mb-1 text-xs text-gray-500">{t.translation}</p>
              <p className="text-sm leading-relaxed text-gray-100">
                {analysisResult.translation}
              </p>
            </div>
          )}
        </section>
      ) : null}

      {analysisResult.jlptCalibration?.status === 'error' && (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {t.jlptUnavailable}
        </p>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen size={16} className="text-amber-300" />
          <h3 className="font-semibold text-white">{t.vocabulary}</h3>
          <span className="ml-auto text-xs text-gray-500">
            {learningVocabulary.length} {t.item}{language === 'en' && learningVocabulary.length !== 1 ? 's' : ''}
          </span>
        </div>
        {learningVocabulary.length > 0 ? (
          <ul className="space-y-2">
            {learningVocabulary.map((word, index) => (
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
                  <div className="flex items-center gap-1">
                    <JLPTBadge classification={word.jlpt} language={language} />
                    <WordSaveButton word={word} sourceSentence={selectedText} />
                  </div>
                </div>
                <p className="mt-1 text-sm text-gray-100">{word.meaning}</p>
                <p className="mt-0.5 text-xs text-gray-500">{word.partOfSpeech}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-white/10 bg-gray-950/40 p-3 text-sm text-gray-400">
            {t.noVocabulary}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-purple-300" />
          <h3 className="font-semibold text-white">{t.grammar}</h3>
          <span className="ml-auto text-xs text-gray-500">
            {learningGrammar.length} {t.pattern}{language === 'en' && learningGrammar.length !== 1 ? 's' : ''}
          </span>
        </div>
        {learningGrammar.length > 0 ? (
          <ul className="space-y-2">
            {learningGrammar.map((pattern, index) => (
              <li
                key={`${pattern.pattern}-${index}`}
                className="rounded-lg border border-white/10 bg-gray-950/40 p-3"
              >
                <p className="font-japanese font-semibold text-white">
                  {pattern.pattern}
                </p>
                <p className="mt-1 text-sm text-gray-100">{pattern.explanation}</p>
                <p className="mt-1 text-xs italic text-gray-500">
                  {t.example}: <span className="font-japanese text-gray-400">{pattern.example}</span>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-white/10 bg-gray-950/40 p-3 text-sm text-gray-400">
            {t.noGrammar}
          </p>
        )}
      </section>
    </motion.div>
  )
}

interface WordSaveButtonProps {
  word: WordAnalysis
  sourceSentence: string | null
}

function WordSaveButton({ word, sourceSentence }: WordSaveButtonProps) {
  const saved = useWordBankStore(state => state.isSaved(word.word, word.reading))
  const toggleWord = useWordBankStore(state => state.toggleWord)

  return (
    <button
      type="button"
      onClick={() => toggleWord(word, sourceSentence)}
      aria-label={saved ? 'Remove from word bank' : 'Save to word bank'}
      aria-pressed={saved}
      className={`shrink-0 rounded-full p-1 transition-colors hover:bg-white/10 ${
        saved ? 'text-amber-300' : 'text-gray-500'
      }`}
    >
      <Star size={16} className={saved ? 'fill-current' : ''} />
    </button>
  )
}
