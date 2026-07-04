import type { GrammarPattern, WordAnalysis } from './types'

const BASIC_VOCABULARY_DIFFICULTIES = new Set(['n5', 'beginner'])

const BASIC_GRAMMAR_PATTERNS = [
  'です',
  'ます',
  'でした',
  'ません',
  'じゃない',
  'ではない',
  'あります',
  'います',
  '助詞 は',
  '助詞 が',
  '助詞 を',
  '助詞 に',
  '助詞 で',
  '助詞 の',
  '助詞 と',
  '助詞 も',
  '助詞 へ',
  'particle は',
  'particle が',
  'particle を',
  'particle に',
  'particle で',
  'particle の',
  'topic particle',
  'object particle',
  'subject particle'
]

const normalize = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[～〜]/g, '')
    .replace(/\s+/g, ' ')
}

export const isN5OrBasicVocabulary = (word: Pick<WordAnalysis, 'difficulty'>): boolean => {
  return BASIC_VOCABULARY_DIFFICULTIES.has(normalize(word.difficulty))
}

export const filterLearningVocabulary = (words: WordAnalysis[]): WordAnalysis[] => {
  return words.filter(word => !isN5OrBasicVocabulary(word))
}

export const isN5OrBasicGrammar = (grammar: GrammarPattern): boolean => {
  const pattern = normalize(grammar.pattern)
  const explanation = normalize(grammar.explanation)
  const combined = `${pattern} ${explanation}`

  if (/\bn5\b/.test(combined) || /\bjlpt n5\b/.test(combined) || combined.includes('basic ')) {
    return true
  }

  return BASIC_GRAMMAR_PATTERNS.some(basicPattern => {
    const normalizedBasicPattern = normalize(basicPattern)
    return pattern === normalizedBasicPattern || combined.includes(normalizedBasicPattern)
  })
}

export const filterLearningGrammar = (grammar: GrammarPattern[]): GrammarPattern[] => {
  return grammar.filter(pattern => !isN5OrBasicGrammar(pattern))
}
