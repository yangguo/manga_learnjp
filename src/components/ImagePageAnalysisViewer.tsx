'use client'

import { FileImage } from 'lucide-react'
import MokuroAnalysisPanel from '@/components/MokuroAnalysisPanel'
import type { AnalysisLanguage, AnalysisResult } from '@/lib/types'

interface ImagePageAnalysisViewerProps {
  analysisResult: AnalysisResult
  imageData: string | null
  language: AnalysisLanguage
}

const UI_TEXT = {
  zh: {
    title: '单页图片分析',
    subtitle: '整页 OCR 和学习重点会显示在右侧。',
    imageAlt: '用于分析的漫画页',
    imageUnavailable: '没有可显示的图片',
    pageText: '整页文本'
  },
  en: {
    title: 'Single Page Image Analysis',
    subtitle: 'Full-page OCR and learning points appear on the right.',
    imageAlt: 'Manga page for analysis',
    imageUnavailable: 'No image available',
    pageText: 'Full-page text'
  }
} satisfies Record<AnalysisLanguage, Record<string, string>>

const formatImageSrc = (data: string | null): string | null => {
  if (!data) return null
  return data.startsWith('data:') ? data : `data:image/jpeg;base64,${data}`
}

export default function ImagePageAnalysisViewer({
  analysisResult,
  imageData,
  language
}: ImagePageAnalysisViewerProps) {
  const t = UI_TEXT[language]
  const imageSrc = formatImageSrc(imageData)
  const selectedText = analysisResult.extractedText || analysisResult.sentences.map(sentence => sentence.sentence).join('\n')

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <section className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-3 md:p-4">
        <div className="mb-3">
          <h2 className="text-xl font-semibold text-white">{t.title}</h2>
          <p className="text-sm text-gray-400">{t.subtitle}</p>
        </div>

        <div className="overflow-auto rounded-xl bg-gray-950/70 p-2">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={t.imageAlt}
              className="mx-auto block h-auto max-h-[78vh] max-w-full select-none rounded-lg"
            />
          ) : (
            <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed border-white/15 bg-gray-950/60 p-8 text-center">
              <div>
                <FileImage className="mx-auto mb-3 h-10 w-10 text-gray-500" />
                <h4 className="font-semibold text-white">{t.imageUnavailable}</h4>
              </div>
            </div>
          )}
        </div>
      </section>

      <aside className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4">
        <MokuroAnalysisPanel
          analysisResult={analysisResult}
          isAnalyzing={false}
          selectedText={selectedText || t.pageText}
          language={language}
        />
      </aside>
    </div>
  )
}
