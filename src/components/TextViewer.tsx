'use client'

import { useState } from 'react'
import { CheckCircle2, FileText, Search } from 'lucide-react'
import MokuroAnalysisPanel from '@/components/MokuroAnalysisPanel'
import { type AnalysisLanguage, type AnalysisResult, type SentenceAnalysis } from '@/lib/types'

const UI_TEXT = {
  zh: {
    title: '文本分析结果',
    subtitle: '点击左侧句子，右侧显示其翻译、词汇与语法。',
    sentences: '句子列表',
    noSentences: '没有识别到句子，建议检查输入文本后重新分析。',
    block: '句子',
    chars: '字符'
  },
  en: {
    title: 'Text Analysis',
    subtitle: 'Click a sentence on the left to see its translation, vocabulary, and grammar on the right.',
    sentences: 'Sentences',
    noSentences: 'No sentences detected. Check your input and try analyzing again.',
    block: 'Sentence',
    chars: 'chars'
  }
} satisfies Record<AnalysisLanguage, Record<string, string>>

interface TextViewerProps {
  analysisResult: AnalysisResult
  language: AnalysisLanguage
}

// Wrap a single SentenceAnalysis as an AnalysisResult so MokuroAnalysisPanel
// (which expects an AnalysisResult and would otherwise flatten every sentence
// via getVocabularyInTextOrder) renders only this one sentence's words/grammar.
const createSentenceAnalysisResult = (
  sentence: SentenceAnalysis,
  analysisResult: AnalysisResult
): AnalysisResult => ({
  extractedText: sentence.sentence,
  sentences: [sentence],
  translation: sentence.translation,
  summary: sentence.context || '',
  provider: analysisResult.provider,
  jlptCalibration: analysisResult.jlptCalibration,
  grammarCalibration: analysisResult.grammarCalibration
})

export default function TextViewer({ analysisResult, language }: TextViewerProps) {
  const t = UI_TEXT[language]
  const [selectedIndex, setSelectedIndex] = useState(0)

  const effectiveSelectedIndex = analysisResult.sentences.length === 0
    ? null
    : Math.min(selectedIndex, analysisResult.sentences.length - 1)
  const selectedSentence = effectiveSelectedIndex == null ? null : analysisResult.sentences[effectiveSelectedIndex] ?? null
  const selectedAnalysis = selectedSentence ? createSentenceAnalysisResult(selectedSentence, analysisResult) : null

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-2 text-white">
        <FileText className="w-5 h-5 text-purple-400" />
        <div>
          <h2 className="text-lg font-semibold">{t.title}</h2>
          <p className="text-sm text-gray-400">{t.subtitle}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Search size={16} className="text-cyan-300" />
            <h3 className="font-semibold text-white">{t.sentences}</h3>
            <span className="ml-auto rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-400">
              {analysisResult.sentences.length}
            </span>
          </div>
          <div className="max-h-[60vh] space-y-2 overflow-auto pr-1">
            {analysisResult.sentences.length > 0 ? analysisResult.sentences.map((sentence, index) => {
              const selected = effectiveSelectedIndex === index
              return (
                <button
                  key={`sentence-list-${index}`}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selected
                      ? 'border-amber-300/70 bg-amber-400/20'
                      : 'border-white/10 bg-gray-950/40 hover:bg-white/10'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                    <span>{t.block} {index + 1}</span>
                    {selected && <CheckCircle2 size={12} className="text-emerald-300" />}
                  </div>
                  <p className="line-clamp-3 font-japanese text-sm leading-relaxed text-gray-100">
                    {sentence.sentence}
                  </p>
                  {sentence.translation && (
                    <p className="mt-1 line-clamp-2 text-xs text-gray-400">
                      {sentence.translation}
                    </p>
                  )}
                </button>
              )
            }) : (
              <p className="rounded-lg border border-white/10 bg-gray-950/40 p-3 text-sm text-gray-400">
                {t.noSentences}
              </p>
            )}
          </div>
        </section>

        <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <MokuroAnalysisPanel
              analysisResult={selectedAnalysis}
              isAnalyzing={false}
              selectedText={selectedSentence?.sentence ?? null}
              language={language}
              hideSelectedText
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
