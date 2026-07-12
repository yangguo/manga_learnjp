import { describe, expect, it } from 'vitest'
import { filterLearningGrammar } from './analysis-filters'
import type { GrammarPattern } from './types'

describe('analysis filters', () => {
  it('keeps basic grammar and filters only missing patterns', () => {
    const grammar = [
      { pattern: 'です', explanation: 'JLPT N5 polite copula', example: '学生です' },
      { pattern: '助词 は', explanation: 'basic topic particle', example: '私は学生です' },
      { pattern: '〜として', explanation: 'as; in the capacity of', example: '証拠として使う' },
      { pattern: '〜に違いない', explanation: 'must be', example: '本物に違いない' },
      { pattern: '   ', explanation: 'invalid', example: '' }
    ] as GrammarPattern[]

    expect(filterLearningGrammar(grammar).map(pattern => pattern.pattern)).toEqual([
      'です',
      '助词 は',
      '〜として',
      '〜に違いない'
    ])
  })
})
