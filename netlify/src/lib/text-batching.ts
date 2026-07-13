import type { AnalysisResult, SentenceAnalysis } from './types'

export const MAX_BATCH_CHARS = 800

export interface BatchResult {
  sentences: SentenceAnalysis[]
  translation: string
  extractedText: string
  summary: string
  status: 'ok' | 'failed'
  error?: string
}

const SENTENCE_ENDINGS = /[。！？…～♪♫]/

export const splitTextIntoSentences = (text: string): string[] => {
  if (!text || text.trim().length === 0) {
    return []
  }

  const sentences: string[] = []
  let currentSentence = ''

  for (const char of text) {
    currentSentence += char
    if (SENTENCE_ENDINGS.test(char)) {
      sentences.push(currentSentence.trim())
      currentSentence = ''
    }
  }

  if (currentSentence.trim().length > 0) {
    sentences.push(currentSentence.trim())
  }

  return sentences.filter(s => s.trim().length > 0)
}

export const createTextBatches = (
  sentences: string[],
  maxBatchChars: number = MAX_BATCH_CHARS
): string[][] => {
  if (sentences.length === 0) return []

  const batches: string[][] = []
  let current: string[] = []
  let currentLen = 0

  for (const sentence of sentences) {
    // An over-budget sentence gets its own batch so we never split a sentence.
    if (sentence.length > maxBatchChars) {
      if (current.length > 0) {
        batches.push(current)
        current = []
        currentLen = 0
      }
      batches.push([sentence])
      continue
    }

    if (currentLen + sentence.length > maxBatchChars && current.length > 0) {
      batches.push(current)
      current = []
      currentLen = 0
    }

    current.push(sentence)
    currentLen += sentence.length
  }

  if (current.length > 0) {
    batches.push(current)
  }

  return batches
}

const PLACEHOLDER_WORDS: SentenceAnalysis['words'] = []
const PLACEHOLDER_GRAMMAR: SentenceAnalysis['grammar'] = []

const failedPlaceholderSentence = (batchIndex: number, error: string): SentenceAnalysis => ({
  sentence: `[第${batchIndex + 1}段分析失败: ${error}]`,
  translation: '',
  words: PLACEHOLDER_WORDS,
  grammar: PLACEHOLDER_GRAMMAR,
  context: ''
})

export const combineBatchResults = (batches: BatchResult[]): Omit<AnalysisResult, 'provider'> => {
  if (batches.length === 0) {
    throw new Error('No batch results to combine')
  }

  if (batches.every(b => b.status === 'failed')) {
    // Surface the first real failure cause instead of a generic message, so the
    // caller (and ultimately the user) sees e.g. "OpenAI API error: 401" rather
    // than an unhelpful "All batches failed to process".
    const firstError = batches.find(b => b.error)?.error ?? 'unknown error'
    throw new Error(`All batches failed to process: ${firstError}`)
  }

  if (batches.length === 1 && batches[0].status === 'ok') {
    const b = batches[0]
    return {
      extractedText: b.extractedText,
      sentences: b.sentences,
      translation: b.translation,
      summary: b.summary
    }
  }

  const allSentences: SentenceAnalysis[] = []
  const translations: string[] = []
  const extractedTexts: string[] = []
  let okCount = 0

  batches.forEach((batch, index) => {
    if (batch.status === 'ok') {
      okCount++
      allSentences.push(...batch.sentences)
      if (batch.translation) translations.push(batch.translation)
      if (batch.extractedText) extractedTexts.push(batch.extractedText)
    } else {
      allSentences.push(failedPlaceholderSentence(index, batch.error ?? 'unknown'))
    }
  })

  return {
    extractedText: extractedTexts.join(''),
    sentences: allSentences,
    translation: translations.join(' '),
    summary: `已合并 ${batches.length} 段分析结果(成功 ${okCount} 段,共 ${allSentences.length} 句)。整体总结见各段翻译与语法标注。`
  }
}
