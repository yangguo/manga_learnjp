import { getJLPTDictionary } from './jlpt-dictionary'
import { getJLPTGrammarDictionary } from './jlpt-grammar-dictionary'
import { calibrateAnalysisResult, calibrateReadingModeResult } from './jlpt-calibration'
import type {
  AIProvider,
  AnalysisLanguage,
  CalibratedAnalysisResult,
  CalibratedReadingModeResult,
  ReadingModeResult
} from './types'
import { CLIENT_ANALYSIS_FETCH_TIMEOUT_MS, fetchWithTimeout } from './fetch-timeout'

interface AnalyzeImageForReadingOptions {
  provider?: AIProvider
  language?: AnalysisLanguage
}

interface AnalyzeImageOptions {
  provider?: AIProvider
  language?: AnalysisLanguage
  signal?: AbortSignal
}

interface AnalyzeTextOptions {
  provider?: AIProvider
  language?: AnalysisLanguage
  signal?: AbortSignal
}

export async function analyzeText(
  text: string,
  options: AnalyzeTextOptions = {}
): Promise<CalibratedAnalysisResult> {
  const { provider = 'openai', language = 'zh', signal } = options

  // Retry lives on the server (route.ts), where the real upstream error is
  // visible and the provider fallback also runs. Retrying here stacked the two
  // layers (up to 9-18 upstream calls per block). The signal lets a batch
  // Cancel abort this in-flight request via fetchWithTimeout's abort forwarding.
  const response = await fetchWithTimeout('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      provider,
      analysisLanguage: language
    }),
    signal,
  }, { timeoutMs: CLIENT_ANALYSIS_FETCH_TIMEOUT_MS })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    const message = errorData.error || `HTTP ${response.status}: ${response.statusText}`
    const error = new Error(message)
    throw Object.assign(error, { status: response.status })
  }

  const result = await response.json()
  const [dictionary, grammarDictionary] = await Promise.all([getJLPTDictionary(), getJLPTGrammarDictionary()])
  return calibrateAnalysisResult(result, dictionary, grammarDictionary)
}

export async function analyzeImage(
  imageBase64: string,
  options: AnalyzeImageOptions = {}
): Promise<CalibratedAnalysisResult> {
  const { provider = 'openai', language = 'zh', signal } = options
  const response = await fetchWithTimeout('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64,
      provider,
      mangaMode: false,
      analysisLanguage: language
    }),
    signal
  }, { timeoutMs: CLIENT_ANALYSIS_FETCH_TIMEOUT_MS })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    const error = new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
    throw Object.assign(error, { status: response.status })
  }

  const result = await response.json()
  const [dictionary, grammarDictionary] = await Promise.all([getJLPTDictionary(), getJLPTGrammarDictionary()])
  return calibrateAnalysisResult(result, dictionary, grammarDictionary)
}

export async function analyzeImageForReading(
  imageBase64: string,
  options: AnalyzeImageForReadingOptions = {}
): Promise<CalibratedReadingModeResult> {
  const { provider = 'openai', language = 'zh' } = options

  const response = await fetchWithTimeout('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBase64,
      provider,
      readingMode: true,
      analysisLanguage: language
    }),
  }, { timeoutMs: CLIENT_ANALYSIS_FETCH_TIMEOUT_MS })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
  }

  const result = await response.json() as ReadingModeResult
  const [dictionary, grammarDictionary] = await Promise.all([getJLPTDictionary(), getJLPTGrammarDictionary()])
  return calibrateReadingModeResult(result, dictionary, grammarDictionary)
}
