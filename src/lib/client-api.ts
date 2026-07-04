import type { AIProvider, AnalysisLanguage, AnalysisResult, ReadingModeResult } from './types'

interface AnalyzeImageForReadingOptions {
  provider?: AIProvider
}

interface AnalyzeTextOptions {
  provider?: AIProvider
  language?: AnalysisLanguage
  excludeN5?: boolean
}

export async function analyzeText(
  text: string,
  options: AnalyzeTextOptions = {}
): Promise<AnalysisResult> {
  const { provider = 'openai', language = 'zh', excludeN5 = true } = options

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      provider,
      analysisLanguage: language,
      excludeN5
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
  }

  const result = await response.json()
  return result as AnalysisResult
}

export async function analyzeImageForReading(
  imageBase64: string,
  options: AnalyzeImageForReadingOptions = {}
): Promise<ReadingModeResult> {
  const { provider = 'openai' } = options

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBase64,
      provider,
      readingMode: true
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
  }

  const result = await response.json()
  return result as ReadingModeResult
}
