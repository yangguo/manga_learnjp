import { describe, expect, it } from 'vitest'
import {
  filterLearningGrammar,
  isN5OrBasicGrammar
} from './analysis-filters'
import type { GrammarPattern } from './types'

describe('analysis filters', () => {
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
