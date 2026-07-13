import { describe, expect, it } from 'vitest'
import type { SentenceAnalysis } from './types'
import { splitTextIntoSentences, MAX_BATCH_CHARS } from './text-batching'
import { createTextBatches } from './text-batching'
import type { BatchResult } from './text-batching'
import { combineBatchResults } from './text-batching'

describe('splitTextIntoSentences', () => {
  it('returns empty for empty or whitespace-only text', () => {
    expect(splitTextIntoSentences('')).toEqual([])
    expect(splitTextIntoSentences('   ')).toEqual([])
  })

  it('splits on Japanese sentence endings and keeps the ending character', () => {
    expect(splitTextIntoSentences('こんにちは。さようなら！')).toEqual(['こんにちは。', 'さようなら！'])
  })

  it('treats ellipsis tilde and music notes as endings', () => {
    expect(splitTextIntoSentences('あ…い～')).toEqual(['あ…', 'い～'])
  })

  it('keeps trailing text without an ending as one sentence', () => {
    expect(splitTextIntoSentences('こんにちは')).toEqual(['こんにちは'])
  })
})

describe('createTextBatches', () => {
  it('returns empty for no sentences', () => {
    expect(createTextBatches([])).toEqual([])
  })

  it('groups sentences under the char budget into one batch without splitting a sentence', () => {
    const sentences = ['短い。', '短い。', '短い。']
    expect(createTextBatches(sentences)).toEqual([['短い。', '短い。', '短い。']])
  })

  it('starts a new batch when adding the next sentence would exceed the budget', () => {
    const long = 'あ'.repeat(MAX_BATCH_CHARS - 5) + '。'
    const next = 'い'.repeat(MAX_BATCH_CHARS - 5) + '。'
    expect(createTextBatches([long, next])).toEqual([[long], [next]])
  })

  it('gives an over-budget single sentence its own batch instead of splitting it', () => {
    const huge = 'あ'.repeat(MAX_BATCH_CHARS + 50) + '。'
    expect(createTextBatches([huge])).toEqual([[huge]])
  })

  it('preserves sentence order across batches', () => {
    const sentences = ['あ。', 'い。', 'う。', 'え。', 'お。']
    const batches = createTextBatches(sentences, 10)
    expect(batches.flat()).toEqual(sentences)
  })
})

const okBatch = (sentences: SentenceAnalysis[], translation: string): BatchResult => ({
  sentences,
  translation,
  extractedText: sentences.map(s => s.sentence).join(''),
  summary: 'single summary',
  status: 'ok'
})

describe('combineBatchResults', () => {
  it('throws when given no batches', () => {
    expect(() => combineBatchResults([])).toThrow('No batch results to combine')
  })

  it('returns the single batch directly when only one batch is provided', () => {
    const batch = okBatch([{ sentence: 'テスト。', translation: '', vocabulary: [], grammar: [], context: '' } as unknown as SentenceAnalysis], '翻訳')
    const result = combineBatchResults([batch])
    expect(result.summary).toBe('single summary')
    expect(result.sentences).toHaveLength(1)
  })

  it('merges sentences translations and extractedText across batches', () => {
    const b1 = okBatch([{ sentence: 'あ。', translation: '', vocabulary: [], grammar: [], context: '' } as unknown as SentenceAnalysis], 'A')
    const b2 = okBatch([{ sentence: 'い。', translation: '', vocabulary: [], grammar: [], context: '' } as unknown as SentenceAnalysis], 'B')
    const result = combineBatchResults([b1, b2])
    expect(result.sentences.map(s => s.sentence)).toEqual(['あ。', 'い。'])
    expect(result.translation).toBe('A B')
    expect(result.extractedText).toBe('あ。い。')
  })

  it('marks the summary as multi-batch combined instead of faking an overall summary', () => {
    const b1 = okBatch([{ sentence: 'あ。', translation: '', vocabulary: [], grammar: [], context: '' } as unknown as SentenceAnalysis], 'A')
    const b2 = okBatch([{ sentence: 'い。', translation: '', vocabulary: [], grammar: [], context: '' } as unknown as SentenceAnalysis], 'B')
    const result = combineBatchResults([b1, b2])
    expect(result.summary).toContain('2')
    expect(result.summary).not.toBe('single summary')
  })

  it('inserts a placeholder sentence for a failed batch so content does not silently vanish', () => {
    const ok = okBatch([{ sentence: 'あ。', translation: '', vocabulary: [], grammar: [], context: '' } as unknown as SentenceAnalysis], 'A')
    const failed: BatchResult = { sentences: [], translation: '', extractedText: '', summary: '', status: 'failed', error: 'timeout' }
    const result = combineBatchResults([ok, failed])
    expect(result.sentences).toHaveLength(2)
    expect(result.sentences[1].sentence).toContain('失败')
    expect(result.sentences[1].grammar).toEqual([])
    expect(result.sentences[1].vocabulary).toEqual([])
  })

  it('throws when every batch failed', () => {
    const failed: BatchResult = { sentences: [], translation: '', extractedText: '', summary: '', status: 'failed', error: 'x' }
    expect(() => combineBatchResults([failed])).toThrow('All batches failed to process')
  })
})
