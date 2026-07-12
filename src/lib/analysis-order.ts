import type { SentenceAnalysis, WordAnalysis } from './types'

export const getVocabularyInTextOrder = (
  sentences: Pick<SentenceAnalysis, 'words'>[]
): WordAnalysis[] => sentences.flatMap(sentence => sentence.words)
