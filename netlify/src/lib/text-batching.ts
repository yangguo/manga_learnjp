import type { AnalysisResult, SentenceAnalysis } from './types'

export const MAX_BATCH_CHARS = 800

// Cap sentences per batch. The char budget alone is not enough: many short
// sentences can fit well under MAX_BATCH_CHARS yet require a large output
// (each sentence yields sentence+translation+words+grammar+context), and the
// output token count - not the input char count - drives generation time and
// timeouts. Without this cap, 13 short sentences land in a single batch whose
// full analysis takes >120s to generate on slower endpoints. 5 keeps each
// batch's output bounded so a single request finishes well under the timeout,
// and turns a long text into multiple concurrent batches (see
// getTextBatchConcurrency) instead of one heavyweight call.
export const MAX_BATCH_SENTENCES = 5

// Cap concurrent batch analyses so a long text (many batches) does not fire
// many simultaneous requests at the AI provider (rate limits, local Ollama
// overload, retry thundering-herd). 3 (vs 4 for Mokuro blocks) because text
// batches can be heavier per call. Mirrors getMokuroPageAnalysisConcurrency.
export const MAX_TEXT_BATCH_CONCURRENCY = 3

export const getTextBatchConcurrency = (batchCount: number): number => {
  const count = Math.max(0, Math.floor(Number.isFinite(batchCount) ? batchCount : 0))
  return Math.min(count, MAX_TEXT_BATCH_CONCURRENCY)
}

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
  maxBatchChars: number = MAX_BATCH_CHARS,
  maxBatchSentences: number = MAX_BATCH_SENTENCES
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

    // Start a new batch when adding this sentence would exceed the char budget
    // OR the sentence cap - whichever trips first. The sentence cap bounds
    // output token count (and thus generation time), which the char budget
    // alone cannot.
    const wouldExceedChars = currentLen + sentence.length > maxBatchChars && current.length > 0
    const wouldExceedSentences = current.length >= maxBatchSentences
    if (wouldExceedChars || wouldExceedSentences) {
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
