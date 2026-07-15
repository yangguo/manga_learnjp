import { describe, expect, it } from 'vitest'
import type { SentenceAnalysis } from './types'
import { splitTextIntoSentences, MAX_BATCH_CHARS, getTextBatchConcurrency } from './text-batching'
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

  it('starts a new batch at the sentence cap even when under the char budget', () => {
    // 6 short sentences total 12 chars, well under MAX_BATCH_CHARS (800), so
    // only the 3-sentence cap forces the split into 3 + 3.
    const sentences = ['あ。', 'い。', 'う。', 'え。', 'お。', 'か。']
    expect(createTextBatches(sentences)).toEqual([
      ['あ。', 'い。', 'う。'],
      ['え。', 'お。', 'か。']
    ])
  })

  it('splits a long run of short sentences into capped concurrent batches', () => {
    // The regression case: 13 short sentences used to collapse into a single
    // batch whose full analysis took >120s to generate on slow endpoints. The
    // 3-sentence cap breaks it into 3 + 3 + 3 + 3 + 1 (5 batches) so batches
    // run concurrently (concurrency 3 = 2 waves) and each stays small enough
    // to finish under the fetch timeout.
    const sentences = Array.from({ length: 13 }, (_, i) => `s${i}。`)
    const batches = createTextBatches(sentences)
    expect(batches).toHaveLength(5)
    expect(batches[0]).toHaveLength(3)
    expect(batches[1]).toHaveLength(3)
    expect(batches[2]).toHaveLength(3)
    expect(batches[3]).toHaveLength(3)
    expect(batches[4]).toHaveLength(1)
    expect(batches.flat()).toEqual(sentences)
  })

  it('still splits on the char budget when it trips before the sentence cap', () => {
    // A tight char budget (5) trips before the 3-sentence cap, so batching is
    // char-driven and each batch stays within budget.
    const sentences = ['あ。', 'い。', 'う。', 'え。', 'お。', 'か。']
    const batches = createTextBatches(sentences, 5)
    expect(batches.flat()).toEqual(sentences)
    for (const batch of batches) {
      expect(batch.join('').length).toBeLessThanOrEqual(5)
    }
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
    const batch = okBatch([{ sentence: 'テスト。', translation: '', words: [], grammar: [], context: '' }], '翻訳')
    const result = combineBatchResults([batch])
    expect(result.summary).toBe('single summary')
    expect(result.sentences).toHaveLength(1)
  })

  it('merges sentences translations and extractedText across batches', () => {
    const b1 = okBatch([{ sentence: 'あ。', translation: '', words: [], grammar: [], context: '' }], 'A')
    const b2 = okBatch([{ sentence: 'い。', translation: '', words: [], grammar: [], context: '' }], 'B')
    const result = combineBatchResults([b1, b2])
    expect(result.sentences.map(s => s.sentence)).toEqual(['あ。', 'い。'])
    expect(result.translation).toBe('A B')
    expect(result.extractedText).toBe('あ。い。')
  })

  it('marks the summary as multi-batch combined instead of faking an overall summary', () => {
    const b1 = okBatch([{ sentence: 'あ。', translation: '', words: [], grammar: [], context: '' }], 'A')
    const b2 = okBatch([{ sentence: 'い。', translation: '', words: [], grammar: [], context: '' }], 'B')
    const result = combineBatchResults([b1, b2])
    expect(result.summary).toContain('2')
    expect(result.summary).not.toBe('single summary')
  })

  it('inserts a placeholder sentence for a failed batch so content does not silently vanish', () => {
    const ok = okBatch([{ sentence: 'あ。', translation: '', words: [], grammar: [], context: '' }], 'A')
    const failed: BatchResult = { sentences: [], translation: '', extractedText: '', summary: '', status: 'failed', error: 'timeout' }
    const result = combineBatchResults([ok, failed])
    expect(result.sentences).toHaveLength(2)
    expect(result.sentences[1].sentence).toContain('失败')
    expect(result.sentences[1].grammar).toEqual([])
    expect(result.sentences[1].words).toEqual([])
  })

  it('throws when every batch failed, surfacing the first real error', () => {
    const failed: BatchResult = { sentences: [], translation: '', extractedText: '', summary: '', status: 'failed', error: 'OpenAI API error: 401' }
    // The generic prefix is preserved for callers matching on it...
    expect(() => combineBatchResults([failed])).toThrow('All batches failed to process')
    // ...but the real cause must be visible too, not just the generic prefix.
    expect(() => combineBatchResults([failed])).toThrow('OpenAI API error: 401')
  })
})

describe('getTextBatchConcurrency', () => {
  it('uses the batch count up to the cap', () => {
    expect(getTextBatchConcurrency(1)).toBe(1)
    expect(getTextBatchConcurrency(3)).toBe(3)
  })

  it('caps concurrency to avoid overwhelming the provider', () => {
    expect(getTextBatchConcurrency(4)).toBe(3)
    expect(getTextBatchConcurrency(30)).toBe(3)
  })

  it('returns zero when there are no batches', () => {
    expect(getTextBatchConcurrency(0)).toBe(0)
  })

  it('treats non-finite or negative input as zero', () => {
    expect(getTextBatchConcurrency(Number.NaN)).toBe(0)
    expect(getTextBatchConcurrency(-3)).toBe(0)
  })
})
