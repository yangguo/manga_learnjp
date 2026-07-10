'use client'

import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Search } from 'lucide-react'
import MokuroAnalysisPanel from '@/components/MokuroAnalysisPanel'
import type { AIProvider, AnalysisLanguage, AnalysisResult, ReadingModeResult, SentenceLocation } from '@/lib/types'

interface ReadingModeViewerProps {
  result: ReadingModeResult
  language: AnalysisLanguage
}

const UI_TEXT = {
  zh: {
    title: '单页图片分析',
    subtitle: '点击图片上的文字框，右侧会显示翻译、重点词汇和语法。',
    sentences: '识别语句',
    noSentences: '没有识别到可点击语句，建议重新分析或换用更清晰的图片。',
    imageAlt: '用于分析的漫画页',
    block: '语句',
    chars: '字符',
    locationUnavailable: '没有坐标',
    analyzed: '已分析'
  },
  en: {
    title: 'Single Page Image Analysis',
    subtitle: 'Click a text box on the image to see translation, key vocabulary, and grammar.',
    sentences: 'Detected Sentences',
    noSentences: 'No clickable sentences were detected. Try reanalyzing or use a clearer image.',
    imageAlt: 'Manga page for analysis',
    block: 'Sentence',
    chars: 'chars',
    locationUnavailable: 'No location',
    analyzed: 'Analyzed'
  }
} satisfies Record<AnalysisLanguage, Record<string, string>>

const normalizeProvider = (provider?: string): AIProvider => {
  return provider === 'openai-format' ? 'openai-format' : 'openai'
}

const createSentenceAnalysisResult = (
  sentence: SentenceLocation,
  provider: AIProvider,
  jlptCalibration: ReadingModeResult['jlptCalibration']
): AnalysisResult => ({
  extractedText: sentence.sentence,
  sentences: [
    {
      sentence: sentence.sentence,
      translation: sentence.translation,
      words: sentence.words || [],
      grammar: sentence.grammar || [],
      context: sentence.context || ''
    }
  ],
  translation: sentence.translation,
  summary: sentence.context || '',
  provider,
  jlptCalibration
})

export default function ReadingModeViewer({ result, language }: ReadingModeViewerProps) {
  const t = UI_TEXT[language]
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [imageSize, setImageSize] = useState({
    width: 0,
    height: 0,
    naturalWidth: 0,
    naturalHeight: 0
  })
  const imageRef = useRef<HTMLImageElement>(null)
  const provider = normalizeProvider(result.provider)

  useEffect(() => {
    const updateImageSize = () => {
      if (!imageRef.current) return
      setImageSize({
        width: imageRef.current.clientWidth,
        height: imageRef.current.clientHeight,
        naturalWidth: imageRef.current.naturalWidth || imageRef.current.clientWidth,
        naturalHeight: imageRef.current.naturalHeight || imageRef.current.clientHeight
      })
    }

    const img = imageRef.current
    if (img?.complete) {
      updateImageSize()
    }

    window.addEventListener('resize', updateImageSize)
    return () => window.removeEventListener('resize', updateImageSize)
  }, [result.imageData])

  const effectiveSelectedIndex = result.sentences.length === 0
    ? null
    : Math.min(selectedIndex, result.sentences.length - 1)
  const selectedSentence = effectiveSelectedIndex == null ? null : result.sentences[effectiveSelectedIndex] ?? null
  const selectedAnalysis = useMemo(() => {
    return selectedSentence ? createSentenceAnalysisResult(selectedSentence, provider, result.jlptCalibration) : null
  }, [provider, result.jlptCalibration, selectedSentence])

  const convertToPixels = (
    value: number | undefined | null,
    renderedDimension: number,
    naturalDimension: number
  ) => {
    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
      return null
    }

    if (renderedDimension === 0) return null
    const safeNatural = naturalDimension || renderedDimension

    if (value >= 0 && value <= 1) {
      return value * renderedDimension
    }

    if (value > 1 && value <= 100) {
      return (value / 100) * renderedDimension
    }

    const clampedValue = Math.min(Math.max(value, 0), safeNatural)
    const ratio = clampedValue / safeNatural
    return ratio * renderedDimension
  }

  const getSentenceBoxStyle = (sentence: SentenceLocation): CSSProperties | null => {
    const { boundingBox } = sentence
    if (!boundingBox || imageSize.width === 0 || imageSize.height === 0) return null

    const left = convertToPixels(boundingBox.x, imageSize.width, imageSize.naturalWidth)
    const top = convertToPixels(boundingBox.y, imageSize.height, imageSize.naturalHeight)
    const rawWidth = convertToPixels(boundingBox.width, imageSize.width, imageSize.naturalWidth)
    const rawHeight = convertToPixels(boundingBox.height, imageSize.height, imageSize.naturalHeight)

    if (left === null || top === null || rawWidth === null || rawHeight === null) return null

    const maxWidth = Math.max(imageSize.width - left, 0)
    const maxHeight = Math.max(imageSize.height - top, 0)
    const width = Math.min(rawWidth, maxWidth)
    const height = Math.min(rawHeight, maxHeight)

    if (width <= 0 || height <= 0) return null

    return {
      left,
      top,
      width,
      height
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <section className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-3 md:p-4">
        <div className="mb-3">
          <h2 className="text-xl font-semibold text-white">{t.title}</h2>
          <p className="text-sm text-gray-400">{t.subtitle}</p>
        </div>

        <div className="overflow-auto rounded-xl bg-gray-950/70 p-2">
          <div className="relative mx-auto overflow-hidden rounded-lg bg-black">
            <img
              ref={imageRef}
              src={result.imageData}
              alt={t.imageAlt}
              className="block h-auto w-full select-none"
              onLoad={() => {
                if (!imageRef.current) return
                setImageSize({
                  width: imageRef.current.clientWidth,
                  height: imageRef.current.clientHeight,
                  naturalWidth: imageRef.current.naturalWidth || imageRef.current.clientWidth,
                  naturalHeight: imageRef.current.naturalHeight || imageRef.current.clientHeight
                })
              }}
            />
            <div className="absolute inset-0">
              {result.sentences.map((sentence, index) => {
                const boxStyle = getSentenceBoxStyle(sentence)
                if (!boxStyle) return null
                const selected = effectiveSelectedIndex === index

                return (
                  <button
                    key={`${sentence.sentence}-${index}`}
                    type="button"
                    aria-label={`${t.block} ${index + 1}: ${sentence.sentence}`}
                    title={sentence.sentence}
                    onClick={() => setSelectedIndex(index)}
                    style={boxStyle}
                    className={`absolute rounded-sm border transition-colors ${
                      selected
                        ? 'border-amber-300 bg-amber-300/25 shadow-[0_0_0_2px_rgba(251,191,36,0.35)]'
                        : 'border-cyan-300/70 bg-cyan-300/5 hover:bg-cyan-300/20'
                    }`}
                  >
                    <span className="sr-only">{sentence.sentence}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <aside className="min-w-0 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Search size={16} className="text-cyan-300" />
            <h3 className="font-semibold text-white">{t.sentences}</h3>
            <span className="ml-auto rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-400">
              {result.sentences.length}
            </span>
          </div>
          <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
            {result.sentences.length > 0 ? result.sentences.map((sentence, index) => {
              const selected = effectiveSelectedIndex === index
              const hasLocation = Boolean(sentence.boundingBox)

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
                    <span className="inline-flex items-center gap-1">
                      {selected && <CheckCircle2 size={12} className="text-emerald-300" />}
                      {hasLocation ? t.analyzed : t.locationUnavailable}
                    </span>
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
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <MokuroAnalysisPanel
            analysisResult={selectedAnalysis}
            isAnalyzing={false}
            selectedText={selectedSentence?.sentence ?? null}
            language={language}
          />
        </div>
      </aside>
    </div>
  )
}
