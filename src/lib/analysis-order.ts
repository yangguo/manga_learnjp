import { filterLearningGrammar } from './analysis-filters'
import type { GrammarPattern, SentenceAnalysis, WordAnalysis } from './types'

export const getVocabularyInTextOrder = (
  sentences: Pick<SentenceAnalysis, 'words'>[]
): WordAnalysis[] => sentences.flatMap(sentence => sentence.words)

export const getLearningGrammarInTextOrder = (
  sentences: Pick<SentenceAnalysis, 'grammar'>[]
): GrammarPattern[] => filterLearningGrammar(sentences.flatMap(sentence => sentence.grammar))
