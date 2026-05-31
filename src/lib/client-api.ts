import { AIProvider, ReadingModeResult } from './types'

interface AnalyzeImageForReadingOptions {
  provider?: AIProvider
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