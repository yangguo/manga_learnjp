import { describe, expect, it } from 'vitest'
import {
  JLPT_DATASET_VERSION,
  createJLPTWordKey,
  createUnclassifiedJLPTClassification,
  normalizeJLPTReading,
  normalizeJLPTText,
  pickEarliestJLPTLevel
} from './jlpt-levels'

describe('JLPT normalization', () => {
  it('normalizes width and whitespace without dropping word form information', () => {
    expect(normalizeJLPTText('  Ａ  Ｂ  ')).toBe('A B')
    expect(normalizeJLPTText('取り扱う')).toBe('取り扱う')
  })

  it('normalizes katakana readings to hiragana', () => {
    expect(normalizeJLPTReading(' ジーンズ ')).toBe('じーんず')
  })

  it('keeps word and reading structurally separated in keys', () => {
    expect(createJLPTWordKey('ab', 'c')).not.toBe(createJLPTWordKey('a', 'bc'))
  })
})

describe('JLPT levels', () => {
  it('selects the earliest-learning level from conflicts', () => {
    expect(pickEarliestJLPTLevel(['N2', 'N5', 'N3'])).toBe('N5')
  })

  it('creates a stable unclassified value', () => {
    expect(createUnclassifiedJLPTClassification()).toEqual({
      level: null,
      source: 'open-anki-jlpt-decks',
      datasetVersion: JLPT_DATASET_VERSION,
      match: 'none'
    })
  })
})
