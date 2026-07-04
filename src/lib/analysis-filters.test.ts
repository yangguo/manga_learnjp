import { describe, expect, it } from 'vitest'
import {
  filterLearningGrammar,
  filterLearningVocabulary,
  isN5OrBasicGrammar,
  isN5OrBasicVocabulary
} from './analysis-filters'
import type { GrammarPattern, WordAnalysis } from './types'

describe('analysis filters', () => {
  it('hides N5 and beginner vocabulary while keeping N4+ items', () => {
    const words = [
      { word: '私', reading: 'わたし', meaning: 'I', partOfSpeech: '代名词', difficulty: 'N5' },
      { word: '猫', reading: 'ねこ', meaning: 'cat', partOfSpeech: '名词', difficulty: 'beginner' },
      { word: '火種', reading: 'ひだね', meaning: '火种', partOfSpeech: '名词', difficulty: 'N3' },
      { word: '綴る', reading: 'つづる', meaning: '书写', partOfSpeech: '动词', difficulty: 'intermediate' }
    ] as WordAnalysis[]

    expect(words.map(isN5OrBasicVocabulary)).toEqual([true, true, false, false])
    expect(filterLearningVocabulary(words).map(word => word.word)).toEqual(['火種', '綴る'])
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
