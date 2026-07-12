import type { AnalysisLanguage, GrammarPattern, SavedGrammar } from './types'

const OUTER_PUNCTUATION = /^[「『（(【［]+|[」』）)】］]+$/g

export const normalizeGrammarPattern = (pattern: string): string => {
  let normalized = pattern.normalize('NFKC').trim()
  normalized = normalized.replace(OUTER_PUNCTUATION, '')
  return normalized.replace(/[〜～~]/g, '〜').replace(/\s+/g, '')
}

export const savedGrammarKey = (pattern: string): string => normalizeGrammarPattern(pattern)

export const toSavedGrammar = (
  grammar: GrammarPattern,
  sourceSentence: string | null,
  language: AnalysisLanguage,
  savedAt: string
): SavedGrammar => ({
  pattern: grammar.pattern,
  explanation: grammar.explanation,
  example: grammar.example,
  sourceSentence,
  language,
  savedAt
})

export const addGrammar = (grammars: SavedGrammar[], entry: SavedGrammar): SavedGrammar[] => {
  const key = savedGrammarKey(entry.pattern)
  return grammars.some(grammar => savedGrammarKey(grammar.pattern) === key)
    ? grammars
    : [entry, ...grammars]
}

export const removeGrammar = (grammars: SavedGrammar[], pattern: string): SavedGrammar[] => {
  const key = savedGrammarKey(pattern)
  return grammars.filter(grammar => savedGrammarKey(grammar.pattern) !== key)
}

export const toggleGrammar = (grammars: SavedGrammar[], entry: SavedGrammar): SavedGrammar[] => {
  return isSavedGrammar(grammars, entry.pattern)
    ? removeGrammar(grammars, entry.pattern)
    : addGrammar(grammars, entry)
}

export const isSavedGrammar = (grammars: SavedGrammar[], pattern: string): boolean => {
  const key = savedGrammarKey(pattern)
  return grammars.some(grammar => savedGrammarKey(grammar.pattern) === key)
}
