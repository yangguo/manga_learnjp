import type { GrammarPattern } from './types'

export const filterLearningGrammar = (grammar: GrammarPattern[]): GrammarPattern[] => {
  return grammar.filter(pattern => pattern.pattern.trim().length > 0)
}
