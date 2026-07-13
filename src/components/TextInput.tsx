'use client'

import { useState } from 'react'
import { FileImage, FileJson, FileText, Languages, Loader2, type LucideIcon } from 'lucide-react'
import { analyzeText } from '@/lib/client-api'
import { ANALYSIS_MODE_OPTIONS, IMAGE_ANALYSIS_LANGUAGE_OPTIONS } from '@/lib/analysis-modes'
import { type AnalysisLanguage, type AnalysisMode, type AnalysisResult } from '@/lib/types'

const MAX_TEXT_BYTES = 100 * 1024 // 100KB

const MODE_VISUALS: Record<AnalysisMode, { icon: LucideIcon; accent: string }> = {
  image: { icon: FileImage, accent: 'from-blue-500 to-cyan-500' },
  mokuro: { icon: FileJson, accent: 'from-amber-500 to-orange-500' },
  text: { icon: FileText, accent: 'from-purple-500 to-pink-500' }
}

interface TextInputProps {
  onAnalysisComplete: (result: AnalysisResult) => void
  onError: (message: string) => void
  analysisLanguage: AnalysisLanguage
  onAnalysisLanguageChange: (language: AnalysisLanguage) => void
  analysisMode: AnalysisMode
  onModeChange: (mode: AnalysisMode) => void
}

export default function TextInput({
  onAnalysisComplete,
  onError,
  analysisLanguage,
  onAnalysisLanguageChange,
  analysisMode,
  onModeChange
}: TextInputProps) {
  const [text, setText] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleFile = (file: File) => {
    if (file.size > MAX_TEXT_BYTES) {
      onError('文件过大(超过 100KB),请截取后再试。')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      // Detect likely non-UTF-8 input by a high density of replacement chars.
      if (result.includes('�')) {
        onError('文件可能不是 UTF-8 编码(检测到乱码)。请用 UTF-8 重新保存后上传。')
        return
      }
      setText(result)
    }
    reader.onerror = () => onError('读取文件失败。')
    reader.readAsText(file, 'UTF-8')
  }

  const handleAnalyze = async () => {
    const trimmed = text.trim()
    if (!trimmed) {
      onError('请输入或上传日文文本。')
      return
    }
    setIsLoading(true)
    try {
      const result = await analyzeText(trimmed, { language: analysisLanguage })
      onAnalysisComplete(result)
    } catch (err) {
      onError(err instanceof Error ? err.message : '分析失败。')
    } finally {
      setIsLoading(false)
    }
  }

  const analyzeDisabled = isLoading || !text.trim()

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-gray-600 p-6">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-2 text-white">
            <FileText className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold">文本分析</h2>
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="粘贴日文文本,或上传 .txt 文件..."
            className="w-full h-64 p-3 rounded-lg bg-gray-900/60 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 font-japanese resize-y"
          />
          <div className="flex items-center gap-3">
            <label className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm cursor-pointer transition-colors">
              上传 .txt
              <input
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(file)
                }}
              />
            </label>
            <span className="text-xs text-gray-500">UTF-8,最大 100KB</span>
          </div>
        </div>

        <div className="w-full md:w-64 lg:w-72 flex flex-col gap-2.5">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-1.5">Select Mode</p>
            <div className="space-y-1.5">
              {ANALYSIS_MODE_OPTIONS.map((mode) => {
                const visual = MODE_VISUALS[mode.mode]
                const Icon = visual.icon
                const isActive = analysisMode === mode.mode
                return (
                  <button
                    key={mode.mode}
                    onClick={() => onModeChange(mode.mode)}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all w-full ${
                      isActive
                        ? 'border-white/60 bg-white/10 shadow-lg shadow-purple-500/20'
                        : 'border-white/10 bg-white/5 hover:border-white/30'
                    }`}
                  >
                    <div className={`rounded-lg bg-gradient-to-br ${visual.accent} p-2 text-white flex-shrink-0`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex flex-col leading-tight">
                      <p className="font-semibold text-white text-sm">{mode.label}</p>
                      <span className="text-[11px] uppercase tracking-wide text-gray-400">{mode.shortLabel}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-400">Explanation Language</p>
            <div className="inline-flex w-full items-center gap-1 rounded-lg border border-white/10 bg-gray-950/40 p-1">
              <Languages size={15} className="ml-1.5 text-cyan-300" />
              {IMAGE_ANALYSIS_LANGUAGE_OPTIONS.map(language => (
                <button
                  key={language}
                  type="button"
                  onClick={() => onAnalysisLanguageChange(language)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                    analysisLanguage === language
                      ? 'bg-white text-gray-950'
                      : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {language === 'zh' ? '中文' : 'English'}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={analyzeDisabled}
            className={`w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
              analyzeDisabled
                ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
            }`}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoading ? '分析中...' : '分析文本'}
          </button>
        </div>
      </div>
    </div>
  )
}
