import { describe, expect, it } from 'vitest'
import { getLearningGrammarInTextOrder, getVocabularyInTextOrder } from './analysis-order'
import type { SentenceAnalysis } from './types'

const sentence = (words: SentenceAnalysis['words']): Pick<SentenceAnalysis, 'words'> => ({ words })
const word = (value: string) => ({
  word: value,
  reading: value,
  meaning: value,
  partOfSpeech: 'test'
})

const grammarSentence = (grammar: SentenceAnalysis['grammar']): Pick<SentenceAnalysis, 'grammar'> => ({ grammar })
const grammar = (pattern: string) => ({
  pattern,
  explanation: pattern,
  example: pattern
})

describe('getVocabularyInTextOrder', () => {
  it('keeps sentence order and word order regardless of JLPT level', () => {
    const input = [
      sentence([{
        ...word('first'),
        jlpt: {
          level: 'N1',
          source: 'open-anki-jlpt-decks',
          datasetVersion: 'test',
          match: 'exact'
        }
      }]),
      sentence([
        {
          ...word('second'),
          jlpt: {
            level: 'N5',
            source: 'open-anki-jlpt-decks',
            datasetVersion: 'test',
            match: 'exact'
          }
        },
        word('third')
      ])
    ]

    expect(getVocabularyInTextOrder(input).map(item => item.word)).toEqual([
      'first',
      'second',
      'third'
    ])
  })

  it('returns a new array without mutating sentence word arrays', () => {
    const input = [sentence([word('one'), word('two')])]
    const snapshot = structuredClone(input)

    const result = getVocabularyInTextOrder(input)

    expect(result).not.toBe(input[0].words)
    expect(input).toEqual(snapshot)
  })
})

describe('getLearningGrammarInTextOrder', () => {
  it('keeps source order while filtering blank grammar patterns', () => {
    const input = [
      grammarSentence([grammar('first'), grammar('   ')]),
      grammarSentence([grammar('second'), grammar('third')])
    ]

    expect(getLearningGrammarInTextOrder(input).map(item => item.pattern)).toEqual([
      'first',
      'second',
      'third'
    ])
  })
})
