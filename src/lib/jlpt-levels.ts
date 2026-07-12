export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
export type JLPTLevel = (typeof JLPT_LEVELS)[number]

export const JLPT_DATASET_SOURCE = 'open-anki-jlpt-decks' as const
export const JLPT_DATASET_COMMIT = '1ad66734417aca9dbcca6b2d5ee440cb13ab3ba0'
export const JLPT_DATASET_VERSION = `${JLPT_DATASET_SOURCE}@${JLPT_DATASET_COMMIT}`

export const GRAMMAR_JLPT_DATASET_SOURCE = 'tanos-jlpt-grammar' as const
export const GRAMMAR_JLPT_DATASET_VERSION = `${GRAMMAR_JLPT_DATASET_SOURCE}@2026-07-12`

export interface JLPTClassification {
  level: JLPTLevel | null
  source: typeof JLPT_DATASET_SOURCE
  datasetVersion: string
  match: 'exact' | 'normalized' | 'none'
}

export interface GrammarJLPTClassification {
  level: JLPTLevel | null
  source: typeof GRAMMAR_JLPT_DATASET_SOURCE
  datasetVersion: string
  match: 'exact' | 'normalized' | 'none'
}

export const isJLPTLevel = (value: unknown): value is JLPTLevel =>
  typeof value === 'string' && JLPT_LEVELS.includes(value as JLPTLevel)

export const normalizeJLPTText = (value: string): string =>
  value.normalize('NFKC').trim().replace(/\s+/g, ' ')

export const normalizeJLPTReading = (value: string): string =>
  Array.from(normalizeJLPTText(value), char => {
    const code = char.codePointAt(0) ?? 0
    return code >= 0x30a1 && code <= 0x30f6
      ? String.fromCodePoint(code - 0x60)
      : char
  }).join('')

export const normalizeGrammarJLPTPattern = (value: string): string => {
  let normalized = value.normalize('NFKC').trim()
  normalized = normalized.replace(/^[「『（(【［]+|[」』）)】］]+$/g, '')
  return normalized.replace(/[〜～~]/g, '〜').replace(/\s+/g, '')
}

export const createJLPTWordKey = (word: string, reading: string): string =>
  JSON.stringify([word, reading])

export const pickEarliestJLPTLevel = (levels: JLPTLevel[]): JLPTLevel => {
  if (levels.length === 0) throw new Error('At least one JLPT level is required')
  return levels.reduce((earliest, level) =>
    JLPT_LEVELS.indexOf(level) < JLPT_LEVELS.indexOf(earliest) ? level : earliest
  )
}

export const createUnclassifiedJLPTClassification = (): JLPTClassification => ({
  level: null,
  source: JLPT_DATASET_SOURCE,
  datasetVersion: JLPT_DATASET_VERSION,
  match: 'none'
})

export const createUnclassifiedGrammarJLPTClassification = (): GrammarJLPTClassification => ({
  level: null,
  source: GRAMMAR_JLPT_DATASET_SOURCE,
  datasetVersion: GRAMMAR_JLPT_DATASET_VERSION,
  match: 'none'
})
