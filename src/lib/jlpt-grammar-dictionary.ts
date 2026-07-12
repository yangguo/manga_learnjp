import {
  GRAMMAR_JLPT_DATASET_SOURCE,
  GRAMMAR_JLPT_DATASET_VERSION,
  type GrammarJLPTClassification,
  type JLPTLevel,
  createUnclassifiedGrammarJLPTClassification,
  isJLPTLevel,
  normalizeGrammarJLPTPattern
} from './jlpt-levels'

export interface JLPTGrammarDictionary {
  datasetVersion: string
  classify: (pattern: string) => GrammarJLPTClassification
}

export type JLPTGrammarDictionaryLoadResult =
  | { status: 'ready'; dictionary: JLPTGrammarDictionary }
  | { status: 'error'; error: Error; datasetVersion: string }

interface DataFile {
  schemaVersion: 1
  datasetVersion: string
  entries: Record<string, JLPTLevel>
}

let singleton: Promise<JLPTGrammarDictionaryLoadResult> | null = null

const digest = async (text: string): Promise<string> => {
  const bytes = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

const createDictionary = (data: DataFile): JLPTGrammarDictionary => {
  const normalized = new Map<string, JLPTLevel>()
  for (const [pattern, level] of Object.entries(data.entries)) {
    normalized.set(normalizeGrammarJLPTPattern(pattern), level)
  }

  return {
    datasetVersion: data.datasetVersion,
    classify: pattern => {
      const exact = data.entries[pattern]
      if (exact) {
        return {
          level: exact,
          source: GRAMMAR_JLPT_DATASET_SOURCE,
          datasetVersion: data.datasetVersion,
          match: 'exact'
        }
      }
      const normalizedLevel = normalized.get(normalizeGrammarJLPTPattern(pattern))
      if (normalizedLevel) {
        return {
          level: normalizedLevel,
          source: GRAMMAR_JLPT_DATASET_SOURCE,
          datasetVersion: data.datasetVersion,
          match: 'normalized'
        }
      }
      return createUnclassifiedGrammarJLPTClassification()
    }
  }
}

export async function loadJLPTGrammarDictionary(
  fetchImpl: typeof fetch = fetch
): Promise<JLPTGrammarDictionaryLoadResult> {
  try {
    const [manifestResponse, dataResponse] = await Promise.all([
      fetchImpl('/data/jlpt-grammar.v1.manifest.json'),
      fetchImpl('/data/jlpt-grammar.v1.json')
    ])
    if (!manifestResponse.ok || !dataResponse.ok) {
      throw new Error('JLPT grammar data files are unavailable')
    }
    const manifest = await manifestResponse.json() as {
      schemaVersion?: unknown
      datasetVersion?: unknown
      checksums?: { dataSha256?: unknown }
    }
    const dataText = await dataResponse.text()
    const data = JSON.parse(dataText) as Partial<DataFile>
    if (manifest.schemaVersion !== 1) {
      throw new Error('JLPT grammar manifest schema is invalid')
    }
    if (manifest.datasetVersion !== GRAMMAR_JLPT_DATASET_VERSION || data.datasetVersion !== GRAMMAR_JLPT_DATASET_VERSION) {
      throw new Error('JLPT grammar dataset version mismatch')
    }
    if (data.schemaVersion !== 1 || !data.entries || typeof data.entries !== 'object') {
      throw new Error('JLPT grammar data schema is invalid')
    }
    if (!Object.values(data.entries).every(isJLPTLevel)) {
      throw new Error('JLPT grammar data contains an invalid level')
    }
    if (manifest.checksums?.dataSha256 !== await digest(dataText)) {
      throw new Error('JLPT grammar data checksum mismatch')
    }
    return { status: 'ready', dictionary: createDictionary(data as DataFile) }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error : new Error('Failed to load JLPT grammar data'),
      datasetVersion: GRAMMAR_JLPT_DATASET_VERSION
    }
  }
}

export const getJLPTGrammarDictionary = (): Promise<JLPTGrammarDictionaryLoadResult> => {
  singleton ??= loadJLPTGrammarDictionary()
  return singleton
}

export const resetJLPTGrammarDictionaryForTests = (): void => {
  singleton = null
}
