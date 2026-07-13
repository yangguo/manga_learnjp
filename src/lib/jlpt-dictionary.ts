import {
  JLPT_DATASET_SOURCE,
  JLPT_DATASET_VERSION,
  type JLPTClassification,
  type JLPTLevel,
  createJLPTWordKey,
  createUnclassifiedJLPTClassification,
  isJLPTLevel,
  normalizeJLPTReading,
  normalizeJLPTText,
  pickEarliestJLPTLevel
} from './jlpt-levels'

export interface JLPTDictionary {
  datasetVersion: string
  classify: (word: string, reading: string) => JLPTClassification
}

export type JLPTDictionaryLoadResult =
  | { status: 'ready'; dictionary: JLPTDictionary }
  | { status: 'error'; error: Error; datasetVersion: string }

interface DataFile {
  schemaVersion: 1
  datasetVersion: string
  entries: Record<string, JLPTLevel>
}

let singleton: Promise<JLPTDictionaryLoadResult> | null = null

const digest = async (text: string): Promise<string> => {
  const bytes = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

const createDictionary = (data: DataFile): JLPTDictionary => {
  const normalized = new Map<string, JLPTLevel[]>()
  for (const [key, level] of Object.entries(data.entries)) {
    const [word, reading] = JSON.parse(key) as [string, string]
    const normalizedKey = createJLPTWordKey(normalizeJLPTText(word), normalizeJLPTReading(reading))
    normalized.set(normalizedKey, [...(normalized.get(normalizedKey) ?? []), level])
  }

  return {
    datasetVersion: data.datasetVersion,
    classify: (word, reading) => {
      const exact = data.entries[createJLPTWordKey(word, reading)]
      if (exact) {
        return {
          level: exact,
          source: JLPT_DATASET_SOURCE,
          datasetVersion: data.datasetVersion,
          match: 'exact'
        }
      }
      const levels = normalized.get(createJLPTWordKey(
        normalizeJLPTText(word),
        normalizeJLPTReading(reading)
      ))
      if (levels?.length) {
        return {
          level: pickEarliestJLPTLevel(levels),
          source: JLPT_DATASET_SOURCE,
          datasetVersion: data.datasetVersion,
          match: 'normalized'
        }
      }
      return createUnclassifiedJLPTClassification()
    }
  }
}

export async function loadJLPTDictionary(
  fetchImpl: typeof fetch = fetch
): Promise<JLPTDictionaryLoadResult> {
  try {
    const [manifestResponse, dataResponse] = await Promise.all([
      fetchImpl('/data/jlpt-vocabulary.v1.manifest.json'),
      fetchImpl('/data/jlpt-vocabulary.v1.json')
    ])
    if (!manifestResponse.ok || !dataResponse.ok) {
      throw new Error('JLPT data files are unavailable')
    }
    const manifest = await manifestResponse.json() as {
      schemaVersion?: unknown
      datasetVersion?: unknown
      checksums?: { dataSha256?: unknown }
    }
    // Normalize CRLF -> LF before digesting: the manifest stores the LF hash, but
    // a Windows checkout (core.autocrlf) serves CRLF. Lone CR is left untouched so
    // the digest matches the generated LF content exactly.
    const dataText = (await dataResponse.text()).replace(/\r\n/g, '\n')
    const data = JSON.parse(dataText) as Partial<DataFile>
    if (manifest.schemaVersion !== 1) {
      throw new Error('JLPT manifest schema is invalid')
    }
    if (manifest.datasetVersion !== JLPT_DATASET_VERSION || data.datasetVersion !== JLPT_DATASET_VERSION) {
      throw new Error('JLPT dataset version mismatch')
    }
    if (data.schemaVersion !== 1 || !data.entries || typeof data.entries !== 'object') {
      throw new Error('JLPT data schema is invalid')
    }
    if (!Object.values(data.entries).every(isJLPTLevel)) {
      throw new Error('JLPT data contains an invalid level')
    }
    if (manifest.checksums?.dataSha256 !== await digest(dataText)) {
      throw new Error('JLPT data checksum mismatch')
    }
    return { status: 'ready', dictionary: createDictionary(data as DataFile) }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error : new Error('Failed to load JLPT data'),
      datasetVersion: JLPT_DATASET_VERSION
    }
  }
}

export const getJLPTDictionary = (): Promise<JLPTDictionaryLoadResult> => {
  singleton ??= loadJLPTDictionary()
  return singleton
}

export const resetJLPTDictionaryForTests = (): void => {
  singleton = null
}
