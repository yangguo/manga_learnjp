import { describe, expect, it } from 'vitest'
import {
  filterLearningGrammar,
  filterLearningVocabulary,
  isN5OrBasicGrammar,
  isN5OrBasicVocabulary
} from './analysis-filters'
import type { GrammarPattern, WordAnalysis } from './types'

describe('analysis filters', () => {
  it('uses canonical JLPT data and ignores contradictory provider difficulty', () => {
    const words = [
      {
        word: '私', reading: 'わたし', meaning: 'I', partOfSpeech: 'pronoun', difficulty: 'N1',
        jlpt: { level: 'N5', source: 'open-anki-jlpt-decks', datasetVersion: 'v1', match: 'exact' }
      },
      {
        word: '未知語', reading: 'みちご', meaning: 'unknown', partOfSpeech: 'noun', difficulty: 'N5',
        jlpt: { level: null, source: 'open-anki-jlpt-decks', datasetVersion: 'v1', match: 'none' }
      }
    ] as WordAnalysis[]

    expect(words.map(isN5OrBasicVocabulary)).toEqual([true, false])
    expect(filterLearningVocabulary(words).map(word => word.word)).toEqual(['未知語'])
  })

  it('hides obvious N5 grammar and keeps higher-value patterns', () => {
    const grammar = [
      { pattern: 'です', explanation: 'JLPT N5 polite copula', example: '学生です' },
      { pattern: '助词 は', explanation: 'basic topic particle', example: '私は学生です' },
      { pattern: '〜として', explanation: 'as; in the capacity of', example: '証拠として使う' },
      { pattern: '〜に違いない', explanation: 'must be', example: '本物に違いない' }
    ] as GrammarPattern[]

    expect(grammar.map(isN5OrBasicGrammar)).toEqual([true, true, false, false])
    expect(filterLearningGrammar(grammar).map(pattern => pattern.pattern)).toEqual(['〜として', '〜に違いない'])
  })
})
