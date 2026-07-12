'use client'

import { motion } from 'framer-motion'
import { BookOpen, ChevronDown, Loader2, Quote, Sparkles, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { filterLearningGrammar } from '@/lib/analysis-filters'
import { isPersistableAnalysis } from '@/lib/jlpt-calibration'
import { formatJLPTLevelRange, getJLPTLevelsForBand, groupVocabularyByTarget } from '@/lib/jlpt-target'
import { useJLPTTargetStore } from '@/lib/jlpt-target-store'
import { useWordBankStore } from '@/lib/word-bank-store'
import { useGrammarBankStore } from '@/lib/grammar-bank-store'
import { toSavedGrammar } from '@/lib/grammar-bank'
import JLPTBadge from '@/components/JLPTBadge'
import JLPTTargetSelector from '@/components/JLPTTargetSelector'
import type { AnalysisLanguage, AnalysisResult, GrammarPattern, WordAnalysis } from '@/lib/types'

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
    focus: '重点',
    stretch: '超纲',
    unclassified: '未定级',
    foundation: '基础',
    noFocus: '当前文本没有目标等级词汇。',
    noStretch: '当前文本没有超纲词汇。',
    noUnclassified: '当前文本没有未定级词汇。',
    noFoundation: '当前文本没有基础词汇。',
    grammar: '语法',
    pattern: '个语法点',
    noGrammar: '没有需要特别学习的语法点。',
    example: '例句',
    jlptUnavailable: 'JLPT 词表暂不可用，当前定级不会写入缓存。',
    grammarSaveError: '保存语法失败，请重试。'
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
    focus: 'Focus',
    stretch: 'Stretch',
    unclassified: 'Unclassified',
    foundation: 'Foundation',
    noFocus: 'No target-level vocabulary in this selection.',
    noStretch: 'No stretch vocabulary in this selection.',
    noUnclassified: 'No unclassified vocabulary in this selection.',
    noFoundation: 'No foundation vocabulary in this selection.',
    grammar: 'Grammar',
    pattern: 'pattern',
    noGrammar: 'No grammar patterns need special focus in this selection.',
    example: 'Example',
    jlptUnavailable: 'JLPT data is unavailable. Current classifications will not be saved.',
    grammarSaveError: 'Could not save grammar. Please try again.'
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
  const targetLevel = useJLPTTargetStore(state => state.targetLevel)
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
  const vocabularyGroups = groupVocabularyByTarget(vocabulary, targetLevel)
  const persistJLPT = isPersistableAnalysis(analysisResult)

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
            {vocabulary.length} {t.item}{language === 'en' && vocabulary.length !== 1 ? 's' : ''}
          </span>
        </div>
        <JLPTTargetSelector language={language} />
        <VocabularyGroup
          label={t.focus}
          levelLabel={formatJLPTLevelRange(getJLPTLevelsForBand(targetLevel, 'focus'))}
          emptyText={t.noFocus}
          words={vocabularyGroups.focus}
          toneClass="text-amber-300"
          language={language}
          sourceSentence={selectedText}
          persistJLPT={persistJLPT}
        />
        <VocabularyGroup
          label={t.stretch}
          levelLabel={formatJLPTLevelRange(getJLPTLevelsForBand(targetLevel, 'stretch'))}
          emptyText={t.noStretch}
          words={vocabularyGroups.stretch}
          toneClass="text-rose-300"
          language={language}
          sourceSentence={selectedText}
          persistJLPT={persistJLPT}
        />
        <VocabularyGroup
          label={t.unclassified}
          levelLabel=""
          emptyText={t.noUnclassified}
          words={vocabularyGroups.unclassified}
          toneClass="text-gray-300"
          language={language}
          sourceSentence={selectedText}
          persistJLPT={persistJLPT}
        />
        <VocabularyGroup
          label={t.foundation}
          levelLabel={formatJLPTLevelRange(getJLPTLevelsForBand(targetLevel, 'foundation'))}
          emptyText={t.noFoundation}
          words={vocabularyGroups.foundation}
          toneClass="text-emerald-300"
          language={language}
          sourceSentence={selectedText}
          persistJLPT={persistJLPT}
          collapsible
        />
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
              <GrammarCard
                key={`${pattern.pattern}-${index}`}
                pattern={pattern}
                language={language}
                sourceSentence={selectedText}
                exampleLabel={t.example}
                saveError={t.grammarSaveError}
              />
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

function GrammarCard({
  pattern,
  language,
  sourceSentence,
  exampleLabel,
  saveError
}: {
  pattern: GrammarPattern
  language: AnalysisLanguage
  sourceSentence: string
  exampleLabel: string
  saveError: string
}) {
  const saved = useGrammarBankStore(state => state.isSaved(pattern.pattern))
  const toggleGrammar = useGrammarBankStore(state => state.toggleGrammar)
  const handleToggle = () => {
    void toggleGrammar(toSavedGrammar(pattern, sourceSentence, language, new Date().toISOString()))
      .catch(() => toast.error(saveError))
  }

  return (
    <li className="rounded-lg border border-white/10 bg-gray-950/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="font-japanese font-semibold text-white">{pattern.pattern}</p>
        <button
          type="button"
          onClick={handleToggle}
          aria-label={saved ? 'Remove grammar from collection' : 'Save grammar to collection'}
          aria-pressed={saved}
          className={`shrink-0 rounded-full p-1 transition-colors hover:bg-white/10 ${
            saved ? 'text-amber-300' : 'text-gray-500'
          }`}
        >
          <Star size={16} className={saved ? 'fill-current' : ''} />
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-100">{pattern.explanation}</p>
      {pattern.example ? (
        <p className="mt-1 text-xs italic text-gray-500">
          {exampleLabel}: <span className="font-japanese text-gray-400">{pattern.example}</span>
        </p>
      ) : null}
    </li>
  )
}

interface VocabularyGroupProps {
  label: string
  levelLabel: string
  emptyText: string
  words: WordAnalysis[]
  toneClass: string
  language: AnalysisLanguage
  sourceSentence: string
  persistJLPT: boolean
  collapsible?: boolean
}

function VocabularyGroup({
  label,
  levelLabel,
  emptyText,
  words,
  toneClass,
  language,
  sourceSentence,
  persistJLPT,
  collapsible = false
}: VocabularyGroupProps) {
  const header = (
    <div className="flex min-h-7 items-center gap-2">
      <span className={`text-sm font-semibold ${toneClass}`}>{label}</span>
      {levelLabel ? <span className="text-xs text-gray-500">{levelLabel}</span> : null}
      <span className="ml-auto text-xs tabular-nums text-gray-500">{words.length}</span>
      {collapsible ? (
        <ChevronDown className="h-4 w-4 text-gray-500 transition-transform group-open:rotate-180" />
      ) : null}
    </div>
  )
  const content = words.length > 0 ? (
    <ul className="mt-2 space-y-2">
      {words.map((word, index) => (
        <VocabularyCard
          key={`${word.word}-${word.reading}-${index}`}
          word={word}
          language={language}
          sourceSentence={sourceSentence}
          persistJLPT={persistJLPT}
        />
      ))}
    </ul>
  ) : (
    <p className="mt-2 text-xs text-gray-500">{emptyText}</p>
  )

  if (collapsible) {
    return (
      <details className="group border-t border-white/10 py-3">
        <summary className="cursor-pointer list-none rounded-md px-1 transition-colors hover:bg-white/5">
          {header}
        </summary>
        <div className="px-1">{content}</div>
      </details>
    )
  }

  return (
    <div className="border-t border-white/10 py-3 first:border-t-0">
      {header}
      {content}
    </div>
  )
}

interface VocabularyCardProps {
  word: WordAnalysis
  language: AnalysisLanguage
  sourceSentence: string
  persistJLPT: boolean
}

function VocabularyCard({ word, language, sourceSentence, persistJLPT }: VocabularyCardProps) {
  return (
    <li className="rounded-lg border border-white/10 bg-gray-950/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-japanese font-semibold text-white">{word.word}</p>
          <p className="text-xs text-gray-400">{word.reading}</p>
        </div>
        <div className="flex items-center gap-1">
          <JLPTBadge classification={word.jlpt} language={language} />
          <WordSaveButton
            word={word}
            sourceSentence={sourceSentence}
            persistJLPT={persistJLPT}
          />
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-100">{word.meaning}</p>
      <p className="mt-0.5 text-xs text-gray-500">{word.partOfSpeech}</p>
    </li>
  )
}

interface WordSaveButtonProps {
  word: WordAnalysis
  sourceSentence: string | null
  persistJLPT: boolean
}

function WordSaveButton({ word, sourceSentence, persistJLPT }: WordSaveButtonProps) {
  const saved = useWordBankStore(state => state.isSaved(word.word, word.reading))
  const toggleWord = useWordBankStore(state => state.toggleWord)
  const handleToggle = () => {
    void toggleWord(word, sourceSentence, persistJLPT).catch(() => {
      toast.error('保存生词失败，请重试。')
    })
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
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
