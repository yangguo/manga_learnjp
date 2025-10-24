import { AIProvider, OpenAIFormatSettings, ModelSettings, APIKeySettings, ReadingModeResult } from './types'

interface AnalyzeImageForReadingOptions {
  provider?: AIProvider
  openaiFormatSettings?: OpenAIFormatSettings
  modelSettings?: ModelSettings
  apiKeySettings?: APIKeySettings
}

export async function analyzeImageForReading(
  imageBase64: string,
  options: AnalyzeImageForReadingOptions = {}
): Promise<ReadingModeResult> {
  const { provider = 'openai', openaiFormatSettings, modelSettings, apiKeySettings } = options

  const response = await fetch('/.netlify/functions/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBase64,
      provider,
      openaiFormatSettings,
      modelSettings,
      apiKeySettings,
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