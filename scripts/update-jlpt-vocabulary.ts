import { createHash } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'csv-parse/sync'
import {
  JLPT_DATASET_COMMIT,
  JLPT_DATASET_SOURCE,
  JLPT_DATASET_VERSION,
  JLPT_LEVELS,
  type JLPTLevel,
  createJLPTWordKey,
  normalizeJLPTReading,
  normalizeJLPTText,
  pickEarliestJLPTLevel
} from '../src/lib/jlpt-levels'

const MAX_DATA_BYTES = 350 * 1024
const SOURCE_REPOSITORY = 'https://github.com/jamsinclair/open-anki-jlpt-decks'
const RAW_BASE = `https://raw.githubusercontent.com/jamsinclair/open-anki-jlpt-decks/${JLPT_DATASET_COMMIT}`
const KANA_ONLY = /^[\p{Script=Hiragana}\p{Script=Katakana}\p{M}\sー]+$/u

type SourceMap = Record<JLPTLevel, string>

interface SourceRow {
  expression?: string
  reading?: string
}

const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex')

export async function buildJLPTVocabularyArtifacts(
  sources: SourceMap,
  licenseText: string,
  generatedAt: string
) {
  const levelsByExactKey = new Map<string, JLPTLevel[]>()
  const levelsByNormalizedKey = new Map<string, JLPTLevel[]>()
  let rowCount = 0
  let repairedReadings = 0

  for (const level of JLPT_LEVELS) {
    const rows = parse(sources[level], {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      relax_column_count: false
    }) as SourceRow[]

    for (const [index, row] of rows.entries()) {
      const expression = row.expression?.trim() ?? ''
      let reading = row.reading?.trim() ?? ''
      if (!expression) throw new Error(`${level} row ${index + 2}: empty expression`)
      if (!reading && KANA_ONLY.test(expression)) {
        reading = expression
        repairedReadings += 1
      }
      if (!reading) throw new Error(`${level} row ${index + 2}: empty reading`)
      rowCount += 1
      const key = createJLPTWordKey(expression, reading)
      levelsByExactKey.set(key, [...(levelsByExactKey.get(key) ?? []), level])
      const normalizedKey = createJLPTWordKey(
        normalizeJLPTText(expression),
        normalizeJLPTReading(reading)
      )
      levelsByNormalizedKey.set(normalizedKey, [
        ...(levelsByNormalizedKey.get(normalizedKey) ?? []),
        level
      ])
    }
  }

  const entries = Object.fromEntries([...levelsByExactKey.entries()]
    .map(([key, levels]) => [key, pickEarliestJLPTLevel(levels)] as const)
    .sort(([left], [right]) => left.localeCompare(right, 'ja')))

  const dataText = `${JSON.stringify({
    schemaVersion: 1,
    datasetVersion: JLPT_DATASET_VERSION,
    entries
  })}\n`
  if (Buffer.byteLength(dataText) > MAX_DATA_BYTES) {
    throw new Error(`JLPT data exceeds ${MAX_DATA_BYTES} bytes`)
  }

  const conflictingKeys = [...levelsByExactKey.values()]
    .filter(levels => new Set(levels).size > 1).length
  const normalizedConflictingKeys = [...levelsByNormalizedKey.values()]
    .filter(levels => new Set(levels).size > 1).length

  const manifestText = `${JSON.stringify({
    schemaVersion: 1,
    datasetVersion: JLPT_DATASET_VERSION,
    generatedAt,
    source: {
      name: JLPT_DATASET_SOURCE,
      repository: SOURCE_REPOSITORY,
      commit: JLPT_DATASET_COMMIT,
      commitDate: '2025-08-11',
      license: 'MIT'
    },
    stats: {
      rows: rowCount,
      uniqueEntries: Object.keys(entries).length,
      duplicateRows: rowCount - Object.keys(entries).length,
      conflictingKeys,
      repairedReadings,
      normalizedEntries: levelsByNormalizedKey.size,
      normalizedConflictingKeys
    },
    checksums: {
      dataSha256: sha256(dataText),
      licenseSha256: sha256(licenseText)
    }
  }, null, 2)}\n`

  return { dataText, manifestText, licenseText }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`)
  return response.text()
}

async function main() {
  const sources = Object.fromEntries(await Promise.all(JLPT_LEVELS.map(async level => [
    level,
    await fetchText(`${RAW_BASE}/src/${level.toLowerCase()}.csv`)
  ]))) as SourceMap
  const licenseText = await fetchText(`${RAW_BASE}/LICENSE`)
  const artifacts = await buildJLPTVocabularyArtifacts(
    sources,
    licenseText,
    process.env.JLPT_GENERATED_AT ?? new Date().toISOString()
  )

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const tempDir = path.join(root, '.tmp-jlpt-data')
  await rm(tempDir, { recursive: true, force: true })
  await mkdir(path.join(tempDir, 'data'), { recursive: true })
  await mkdir(path.join(tempDir, 'licenses'), { recursive: true })
  await writeFile(path.join(tempDir, 'data/jlpt-vocabulary.v1.json'), artifacts.dataText)
  await writeFile(path.join(tempDir, 'data/jlpt-vocabulary.v1.manifest.json'), artifacts.manifestText)
  await writeFile(path.join(tempDir, 'licenses/open-anki-jlpt-decks-MIT.txt'), artifacts.licenseText)
  await mkdir(path.join(root, 'public/data'), { recursive: true })
  await mkdir(path.join(root, 'public/licenses'), { recursive: true })
  await rename(path.join(tempDir, 'data/jlpt-vocabulary.v1.json'), path.join(root, 'public/data/jlpt-vocabulary.v1.json'))
  await rename(path.join(tempDir, 'data/jlpt-vocabulary.v1.manifest.json'), path.join(root, 'public/data/jlpt-vocabulary.v1.manifest.json'))
  await rename(path.join(tempDir, 'licenses/open-anki-jlpt-decks-MIT.txt'), path.join(root, 'public/licenses/open-anki-jlpt-decks-MIT.txt'))
  await rm(tempDir, { recursive: true, force: true })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}
