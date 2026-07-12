import {
  GRAMMAR_JLPT_DATASET_VERSION,
  createUnclassifiedGrammarJLPTClassification,
  createUnclassifiedJLPTClassification
} from './jlpt-levels'
import type { JLPTDictionaryLoadResult } from './jlpt-dictionary'
import type { JLPTGrammarDictionaryLoadResult } from './jlpt-grammar-dictionary'
import type {
  AnalysisResult,
  CalibratedAnalysisResult,
  CalibratedMangaAnalysisResult,
  CalibratedReadingModeResult,
  CalibratedWordAnalysis,
  CalibratedGrammarPattern,
  GrammarCalibrationMeta,
  GrammarPattern,
  JLPTCalibrationMeta,
  MangaAnalysisResult,
  ReadingModeResult,
  SentenceAnalysis,
  SentenceLocation,
  WordAnalysis
} from './types'

const metaFor = (loadResult: JLPTDictionaryLoadResult): JLPTCalibrationMeta =>
  loadResult.status === 'ready'
    ? { status: 'ready', datasetVersion: loadResult.dictionary.datasetVersion, persistable: true }
    : { status: 'error', datasetVersion: loadResult.datasetVersion, persistable: false }

const grammarMetaFor = (loadResult: JLPTGrammarDictionaryLoadResult): GrammarCalibrationMeta =>
  loadResult.status === 'ready'
    ? { status: 'ready', datasetVersion: loadResult.dictionary.datasetVersion, persistable: true }
    : { status: 'error', datasetVersion: loadResult.datasetVersion, persistable: false }

const calibrateWord = (
  word: WordAnalysis,
  loadResult: JLPTDictionaryLoadResult
): CalibratedWordAnalysis => {
  if (loadResult.status === 'ready') {
    return { ...word, jlpt: loadResult.dictionary.classify(word.word, word.reading) }
  }
  const existing = word.jlpt?.datasetVersion === loadResult.datasetVersion
    ? word.jlpt
    : createUnclassifiedJLPTClassification()
  return { ...word, jlpt: existing }
}

const calibrateGrammar = (
  grammar: GrammarPattern,
  loadResult: JLPTGrammarDictionaryLoadResult
): CalibratedGrammarPattern => {
  if (loadResult.status === 'ready') {
    return { ...grammar, jlpt: loadResult.dictionary.classify(grammar.pattern) }
  }
  const existing = grammar.jlpt?.datasetVersion === loadResult.datasetVersion
    ? grammar.jlpt
    : createUnclassifiedGrammarJLPTClassification()
  return { ...grammar, jlpt: existing }
}

const calibrateSentence = (
  sentence: SentenceAnalysis,
  loadResult: JLPTDictionaryLoadResult,
  grammarLoadResult: JLPTGrammarDictionaryLoadResult
) => ({
  ...sentence,
  words: sentence.words.map(word => calibrateWord(word, loadResult)),
  grammar: sentence.grammar.map(grammar => calibrateGrammar(grammar, grammarLoadResult))
})

const calibrateLocation = (
  sentence: SentenceLocation,
  loadResult: JLPTDictionaryLoadResult,
  grammarLoadResult: JLPTGrammarDictionaryLoadResult
) => ({
  ...sentence,
  words: sentence.words.map(word => calibrateWord(word, loadResult)),
  grammar: sentence.grammar.map(grammar => calibrateGrammar(grammar, grammarLoadResult))
})

const unavailableGrammarData: JLPTGrammarDictionaryLoadResult = {
  status: 'error',
  datasetVersion: GRAMMAR_JLPT_DATASET_VERSION,
  error: new Error('JLPT grammar data has not been loaded')
}

export function calibrateAnalysisResult(
  result: AnalysisResult,
  loadResult: JLPTDictionaryLoadResult,
  grammarLoadResult: JLPTGrammarDictionaryLoadResult = unavailableGrammarData
): CalibratedAnalysisResult {
  return {
    ...result,
    sentences: result.sentences.map(sentence => calibrateSentence(sentence, loadResult, grammarLoadResult)),
    jlptCalibration: metaFor(loadResult),
    grammarCalibration: grammarMetaFor(grammarLoadResult)
  }
}

export function calibrateReadingModeResult(
  result: ReadingModeResult,
  loadResult: JLPTDictionaryLoadResult,
  grammarLoadResult: JLPTGrammarDictionaryLoadResult = unavailableGrammarData
): CalibratedReadingModeResult {
  return {
    ...result,
    sentences: result.sentences.map(sentence => calibrateLocation(sentence, loadResult, grammarLoadResult)),
    jlptCalibration: metaFor(loadResult),
    grammarCalibration: grammarMetaFor(grammarLoadResult)
  }
}

export function calibrateMangaAnalysisResult(
  result: MangaAnalysisResult,
  loadResult: JLPTDictionaryLoadResult,
  grammarLoadResult: JLPTGrammarDictionaryLoadResult = unavailableGrammarData
): CalibratedMangaAnalysisResult {
  return {
    ...result,
    panels: result.panels.map(panel => ({
      ...panel,
      sentences: panel.sentences.map(sentence => calibrateSentence(sentence, loadResult, grammarLoadResult))
    })),
    jlptCalibration: metaFor(loadResult),
    grammarCalibration: grammarMetaFor(grammarLoadResult)
  }
}

export function calibrateAnalysisRecord(
  record: Record<string, AnalysisResult>,
  loadResult: JLPTDictionaryLoadResult,
  grammarLoadResult: JLPTGrammarDictionaryLoadResult = unavailableGrammarData
): Record<string, CalibratedAnalysisResult> {
  return Object.fromEntries(Object.entries(record).map(([key, result]) => [
    key,
    calibrateAnalysisResult(result, loadResult, grammarLoadResult)
  ]))
}

export const isPersistableAnalysis = (result: AnalysisResult): boolean =>
  result.jlptCalibration?.status === 'ready'
  && result.jlptCalibration.persistable === true
  && result.grammarCalibration?.status === 'ready'
  && result.grammarCalibration.persistable === true
