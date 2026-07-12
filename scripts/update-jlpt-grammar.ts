import { createHash } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import WordExtractor from 'word-extractor'
import { JLPT_LEVELS, pickEarliestJLPTLevel, type JLPTLevel } from '../src/lib/jlpt-levels'

const DATASET_VERSION = 'tanos-jlpt-grammar@2026-07-12'
const MAX_DATA_BYTES = 128 * 1024
const LICENSE_URL = 'https://www.tanos.co.uk/jlpt/sharing/'
const requiredLicenseText = 'Creative Commons "BY"'

type SourceBodies = Record<JLPTLevel, string>

interface SourceDocument {
  url: string
  sha256: string
}

const sourceUrlFor = (level: JLPTLevel): string =>
  `https://www.tanos.co.uk/jlpt/jlpt${level.slice(1)}/grammar/GrammarList.${level}.doc`

const sha256 = (value: string | Buffer): string =>
  createHash('sha256').update(value).digest('hex')

const normalizeLicenseSnapshot = (licenseText: string): string =>
  `${licenseText.replace(/\r\n?/g, '\n').split('\n').map(line => line.replace(/[\t ]+$/g, '')).join('\n').replace(/\n*$/, '')}\n`

const isDocumentChrome = (line: string): boolean =>
  /^JLPT N[1-5] Grammar List$/i.test(line)
  || /^This is not a cumulative list/i.test(line)
  || /^JLPT Resources/i.test(line)
  || /^PAGE\b/i.test(line)

const containsPatternScript = (line: string): boolean =>
  /[ぁ-んァ-ヶ一-龠々〆〤～〜]/.test(line)

export const normalizeGrammarPattern = (pattern: string): string => {
  let normalized = pattern.normalize('NFKC').trim()
  normalized = normalized.replace(/^[「『（(【［]+|[」』）)】］]+$/g, '')
  return normalized.replace(/[〜～~]/g, '〜').replace(/\s+/g, '')
}

export const extractGrammarPatterns = (body: string): string[] => body
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line.length > 0 && !isDocumentChrome(line) && containsPatternScript(line))

const aliasesFor = (pattern: string): string[] => {
  const aliases = pattern.split(/[\/／・]/).map(part => part.trim()).filter(Boolean)
  return aliases.length > 1 ? aliases : [pattern]
}

export async function buildJLPTGrammarArtifacts(
  bodies: SourceBodies,
  licenseText: string,
  generatedAt: string,
  documents: Record<JLPTLevel, SourceDocument> = Object.fromEntries(
    JLPT_LEVELS.map(level => [
      level,
      { url: sourceUrlFor(level), sha256: sha256(bodies[level]) }
    ])
  ) as Record<JLPTLevel, SourceDocument>
) {
  const licenseSnapshot = normalizeLicenseSnapshot(licenseText)
  const levelsByPattern = new Map<string, JLPTLevel[]>()
  let rawPatterns = 0
  let aliases = 0

  for (const level of JLPT_LEVELS) {
    const patterns = extractGrammarPatterns(bodies[level])
    if (patterns.length === 0) throw new Error(`${level} grammar body is empty or changed`)
    for (const pattern of patterns) {
      rawPatterns += 1
      const variants = aliasesFor(pattern)
      aliases += variants.length - 1
      for (const variant of variants) {
        const key = normalizeGrammarPattern(variant)
        if (!key) throw new Error(`${level} contains an empty grammar pattern`)
        levelsByPattern.set(key, [...(levelsByPattern.get(key) ?? []), level])
      }
    }
  }

  const entries = Object.fromEntries(Array.from(levelsByPattern.entries())
    .map(([pattern, levels]) => [pattern, pickEarliestJLPTLevel(levels)] as const)
    .sort(([left], [right]) => left.localeCompare(right, 'ja')))
  const dataText = `${JSON.stringify({ schemaVersion: 1, datasetVersion: DATASET_VERSION, entries })}\n`
  if (Buffer.byteLength(dataText) > MAX_DATA_BYTES) {
    throw new Error(`Grammar data exceeds ${MAX_DATA_BYTES} bytes`)
  }

  const conflictingPatterns = Array.from(levelsByPattern.values())
    .filter(levels => new Set(levels).size > 1).length
  const manifestText = `${JSON.stringify({
    schemaVersion: 1,
    datasetVersion: DATASET_VERSION,
    generatedAt,
    source: {
      name: 'tanos-jlpt-grammar',
      author: 'Jonathan Waller',
      license: 'CC BY (version unspecified by publisher)',
      licenseUrl: LICENSE_URL,
      documents
    },
    stats: {
      rawPatterns,
      uniquePatterns: Object.keys(entries).length,
      aliases,
      conflictingPatterns
    },
    checksums: {
      dataSha256: sha256(dataText),
      licenseSha256: sha256(licenseText)
    }
  }, null, 2)}\n`

  return { dataText, manifestText, licenseText: licenseSnapshot }
}

const fetchBuffer = async (url: string): Promise<Buffer> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

const fetchText = async (url: string): Promise<string> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`)
  return response.text()
}

async function main() {
  const extractor = new WordExtractor()
  const fetched = await Promise.all(JLPT_LEVELS.map(async level => {
    const url = sourceUrlFor(level)
    const buffer = await fetchBuffer(url)
    const document = await extractor.extract(buffer)
    return [level, { body: document.getBody(), url, sha256: sha256(buffer) }] as const
  }))
  const bodies = Object.fromEntries(fetched.map(([level, source]) => [level, source.body])) as SourceBodies
  const documents = Object.fromEntries(fetched.map(([level, source]) => [
    level,
    { url: source.url, sha256: source.sha256 }
  ])) as Record<JLPTLevel, SourceDocument>
  const licenseText = await fetchText(LICENSE_URL)
  if (!licenseText.includes(requiredLicenseText)) {
    throw new Error('Tanos sharing page no longer contains the required CC BY wording')
  }
  const artifacts = await buildJLPTGrammarArtifacts(
    bodies,
    licenseText,
    process.env.JLPT_GRAMMAR_GENERATED_AT ?? new Date().toISOString(),
    documents
  )
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const temporary = path.join(root, '.tmp-jlpt-grammar')
  await rm(temporary, { recursive: true, force: true })
  await mkdir(path.join(temporary, 'data'), { recursive: true })
  await mkdir(path.join(temporary, 'licenses'), { recursive: true })
  await writeFile(path.join(temporary, 'data/jlpt-grammar.v1.json'), artifacts.dataText)
  await writeFile(path.join(temporary, 'data/jlpt-grammar.v1.manifest.json'), artifacts.manifestText)
  await writeFile(path.join(temporary, 'licenses/tanos-sharing-CC-BY.txt'), artifacts.licenseText)
  await mkdir(path.join(root, 'public/data'), { recursive: true })
  await mkdir(path.join(root, 'public/licenses'), { recursive: true })
  await rename(path.join(temporary, 'data/jlpt-grammar.v1.json'), path.join(root, 'public/data/jlpt-grammar.v1.json'))
  await rename(path.join(temporary, 'data/jlpt-grammar.v1.manifest.json'), path.join(root, 'public/data/jlpt-grammar.v1.manifest.json'))
  await rename(path.join(temporary, 'licenses/tanos-sharing-CC-BY.txt'), path.join(root, 'public/licenses/tanos-sharing-CC-BY.txt'))
  await rm(temporary, { recursive: true, force: true })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}
