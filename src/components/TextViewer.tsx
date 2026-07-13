'use client'

import { FileText } from 'lucide-react'
import MokuroAnalysisPanel from '@/components/MokuroAnalysisPanel'
import { type AnalysisLanguage, type AnalysisResult } from '@/lib/types'

const UI_TEXT = {
  zh: {
    title: '文本分析结果',
    subtitle: '词汇、语法与翻译显示在右侧。'
  },
  en: {
    title: 'Text Analysis',
    subtitle: 'Vocabulary, grammar, and translation appear on the right.'
  }
} satisfies Record<AnalysisLanguage, { title: string; subtitle: string }>

interface TextViewerProps {
  analysisResult: AnalysisResult
  language: AnalysisLanguage
}

export default function TextViewer({ analysisResult, language }: TextViewerProps) {
  const t = UI_TEXT[language]
  return (
    <div className="w-full max-w-7xl mx-auto bg-white/5 backdrop-blur-md rounded-2xl border border-gray-600 p-6 space-y-4">
      <div className="flex items-center gap-2 text-white">
        <FileText className="w-5 h-5 text-purple-400" />
        <div>
          <h2 className="text-lg font-semibold">{t.title}</h2>
          <p className="text-sm text-gray-400">{t.subtitle}</p>
        </div>
      </div>
      <MokuroAnalysisPanel
        analysisResult={analysisResult}
        isAnalyzing={false}
        selectedText={null}
        language={language}
        hideSelectedText
      />
    </div>
  )
}
