import { createUnclassifiedJLPTClassification } from './jlpt-levels'
import type { JLPTDictionaryLoadResult } from './jlpt-dictionary'
import type {
  AnalysisResult,
  CalibratedAnalysisResult,
  CalibratedMangaAnalysisResult,
  CalibratedReadingModeResult,
  CalibratedWordAnalysis,
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

const calibrateSentence = (sentence: SentenceAnalysis, loadResult: JLPTDictionaryLoadResult) => ({
  ...sentence,
  words: sentence.words.map(word => calibrateWord(word, loadResult))
})

const calibrateLocation = (sentence: SentenceLocation, loadResult: JLPTDictionaryLoadResult) => ({
  ...sentence,
  words: sentence.words.map(word => calibrateWord(word, loadResult))
})

export function calibrateAnalysisResult(
  result: AnalysisResult,
  loadResult: JLPTDictionaryLoadResult
): CalibratedAnalysisResult {
  return {
    ...result,
    sentences: result.sentences.map(sentence => calibrateSentence(sentence, loadResult)),
    jlptCalibration: metaFor(loadResult)
  }
}

export function calibrateReadingModeResult(
  result: ReadingModeResult,
  loadResult: JLPTDictionaryLoadResult
): CalibratedReadingModeResult {
  return {
    ...result,
    sentences: result.sentences.map(sentence => calibrateLocation(sentence, loadResult)),
    jlptCalibration: metaFor(loadResult)
  }
}

export function calibrateMangaAnalysisResult(
  result: MangaAnalysisResult,
  loadResult: JLPTDictionaryLoadResult
): CalibratedMangaAnalysisResult {
  return {
    ...result,
    panels: result.panels.map(panel => ({
      ...panel,
      sentences: panel.sentences.map(sentence => calibrateSentence(sentence, loadResult))
    })),
    jlptCalibration: metaFor(loadResult)
  }
}

export function calibrateAnalysisRecord(
  record: Record<string, AnalysisResult>,
  loadResult: JLPTDictionaryLoadResult
): Record<string, CalibratedAnalysisResult> {
  return Object.fromEntries(Object.entries(record).map(([key, result]) => [
    key,
    calibrateAnalysisResult(result, loadResult)
  ]))
}

export const isPersistableAnalysis = (result: AnalysisResult): boolean =>
  result.jlptCalibration?.status === 'ready' && result.jlptCalibration.persistable === true
