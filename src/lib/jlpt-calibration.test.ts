import { describe, expect, it } from 'vitest'
import { calibrateAnalysisRecord, calibrateAnalysisResult } from './jlpt-calibration'
import type { JLPTDictionaryLoadResult } from './jlpt-dictionary'
import type { AnalysisResult } from './types'

const raw: AnalysisResult = {
  extractedText: '猫と未知語',
  sentences: [{
    sentence: '猫と未知語',
    translation: 'cat and unknown word',
    words: [
      { word: '猫', reading: 'ねこ', meaning: 'cat', partOfSpeech: 'noun', difficulty: 'N1' },
      { word: '未知語', reading: 'みちご', meaning: 'unknown', partOfSpeech: 'noun', difficulty: 'N1' }
    ],
    grammar: [],
    context: ''
  }],
  translation: 'cat and unknown word',
  summary: '',
  provider: 'openai'
}

const ready: JLPTDictionaryLoadResult = {
  status: 'ready',
  dictionary: {
    datasetVersion: 'test-v1',
    classify: word => ({
      level: word === '猫' ? 'N5' : null,
      source: 'open-anki-jlpt-decks',
      datasetVersion: 'test-v1',
      match: word === '猫' ? 'exact' : 'none'
    })
  }
}

describe('JLPT result calibration', () => {
  it('overrides provider difficulty and preserves unknown words', () => {
    const result = calibrateAnalysisResult(raw, ready)
    expect(result.sentences[0].words[0].jlpt.level).toBe('N5')
    expect(result.sentences[0].words[1].jlpt.level).toBeNull()
    expect(result.jlptCalibration).toMatchObject({ status: 'ready', persistable: true })
  })

  it('keeps existing reliable data but marks failure output non-persistable', () => {
    const once = calibrateAnalysisResult(raw, ready)
    const failed = calibrateAnalysisResult(once, {
      status: 'error',
      datasetVersion: 'test-v1',
      error: new Error('offline')
    })
    expect(failed.sentences[0].words[0].jlpt.level).toBe('N5')
    expect(failed.jlptCalibration).toMatchObject({ status: 'error', persistable: false })
  })

  it('calibrates every result in a Mokuro cache record', () => {
    const record = calibrateAnalysisRecord({ a: raw, b: raw }, ready)
    expect(Object.values(record).every(result => result.sentences[0].words[0].jlpt?.level === 'N5')).toBe(true)
  })
})
