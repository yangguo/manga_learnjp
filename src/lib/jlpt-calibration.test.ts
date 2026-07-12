import { describe, expect, it } from 'vitest'
import { calibrateAnalysisRecord, calibrateAnalysisResult } from './jlpt-calibration'
import type { JLPTDictionaryLoadResult } from './jlpt-dictionary'
import type { JLPTGrammarDictionaryLoadResult } from './jlpt-grammar-dictionary'
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
    grammar: [{ pattern: '〜ことにする', explanation: 'decide to do', example: '毎日勉強することにする。' }],
    context: ''
  }],
  translation: 'cat and unknown word',
  summary: '',
  provider: 'openai'
}

const grammarReady: JLPTGrammarDictionaryLoadResult = {
  status: 'ready',
  dictionary: {
    datasetVersion: 'grammar-test-v1',
    classify: pattern => ({
      level: pattern === '〜ことにする' ? 'N3' : null,
      source: 'tanos-jlpt-grammar',
      datasetVersion: 'grammar-test-v1',
      match: pattern === '〜ことにする' ? 'exact' : 'none'
    })
  }
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
    const result = calibrateAnalysisResult(raw, ready, grammarReady)
    expect(result.sentences[0].words[0].jlpt.level).toBe('N5')
    expect(result.sentences[0].words[1].jlpt.level).toBeNull()
    expect(result.jlptCalibration).toMatchObject({ status: 'ready', persistable: true })
    expect(result.sentences[0].grammar[0]).toMatchObject({
      explanation: 'decide to do',
      jlpt: { level: 'N3', source: 'tanos-jlpt-grammar' }
    })
    expect(result.grammarCalibration).toMatchObject({ status: 'ready', persistable: true })
  })

  it('keeps existing reliable data but marks failure output non-persistable', () => {
    const once = calibrateAnalysisResult(raw, ready, grammarReady)
    const failed = calibrateAnalysisResult(once, {
      status: 'error',
      datasetVersion: 'test-v1',
      error: new Error('offline')
    }, {
      status: 'error',
      datasetVersion: 'grammar-test-v1',
      error: new Error('offline')
    })
    expect(failed.sentences[0].words[0].jlpt.level).toBe('N5')
    expect(failed.jlptCalibration).toMatchObject({ status: 'error', persistable: false })
    expect(failed.sentences[0].grammar[0].jlpt?.level).toBe('N3')
    expect(failed.grammarCalibration).toMatchObject({ status: 'error', persistable: false })
  })

  it('calibrates every result in a Mokuro cache record', () => {
    const record = calibrateAnalysisRecord({ a: raw, b: raw }, ready, grammarReady)
    expect(Object.values(record).every(result => result.sentences[0].words[0].jlpt?.level === 'N5')).toBe(true)
    expect(Object.values(record).every(result => result.sentences[0].grammar[0].jlpt?.level === 'N3')).toBe(true)
  })
})
