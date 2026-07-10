# JLPT Vocabulary Level Calibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AI-generated vocabulary difficulty with a deterministic, versioned local JLPT reference dataset across new analysis results, Mokuro caches, the word bank, and all vocabulary badges.

**Architecture:** A pinned update script converts the upstream N1-N5 CSV files into a committed compact JSON index plus manifest and license. Browser code lazily loads and verifies that same-origin data, then a shared calibration layer enriches every result before it reaches UI or persistent storage; legacy cache and word-bank formats remain readable and are upgraded without another AI request.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Vitest 4, zustand 4 persist middleware, Node.js 20 update scripts, `tsx@4.23.0`, `csv-parse@7.0.1`, Web Crypto SHA-256, Tailwind CSS, lucide-react.

## Global Constraints

- Implement only M2A. Do not add the M2B target-level selector or basic/focus/stretch grouping in this plan.
- Preserve the confirmed M2B interface constraint: when M2B is designed separately, its new-user default is N4.
- Pin `jamsinclair/open-anki-jlpt-decks` to commit `1ad66734417aca9dbcca6b2d5ee440cb13ab3ba0`.
- Set `datasetVersion` exactly to `open-anki-jlpt-decks@1ad66734417aca9dbcca6b2d5ee440cb13ab3ba0`.
- Runtime and normal build commands must not call third-party dictionary APIs or download upstream data.
- The only authoritative vocabulary level is the local dataset. Never fall back to AI `difficulty`.
- Match exact `[word, reading]` first, then deterministic NFKC/whitespace/kana normalization; never match on reading alone.
- Resolve cross-level conflicts in earliest-learning order: `N5 -> N4 -> N3 -> N2 -> N1`.
- Repair an empty reading only when the expression consists entirely of hiragana, katakana, combining marks, whitespace, or `ー`; use `reading = expression` and count the repair. Reject every other empty reading.
- Keep unmatched vocabulary visible with `level: null` and `match: 'none'`.
- Publish `public/data/jlpt-vocabulary.v1.json`, `public/data/jlpt-vocabulary.v1.manifest.json`, and `public/licenses/open-anki-jlpt-decks-MIT.txt`.
- Fail generation when the compact data file exceeds `350 * 1024` bytes.
- Keep `difficulty` only as deprecated transport/legacy data; no filter, badge, store, export, or UI decision may read it.
- Do not persist transient classifications produced while the local data file is unavailable.
- Preserve old Mokuro analyses without another AI call and preserve word-bank count, key, source sentence, and `savedAt` during migration.
- Keep the root and `netlify/src/lib` AI-service behavior in sync when removing reading-mode N5 exclusion.
- Follow repository style: TypeScript, two spaces, single quotes, no semicolons, `@/` imports in app code, co-located Vitest tests.
- Required delivery checks: `npm test`, `npm run lint`, `npm run build`, scoped Netlify TypeScript output audit, `git diff --check`, and desktop/mobile browser verification.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/jlpt-levels.ts` | Dataset constants, types, keying, normalization, level conflict ordering | Create |
| `src/lib/jlpt-levels.test.ts` | Pure domain behavior | Create |
| `scripts/update-jlpt-vocabulary.ts` | Download pinned CSV/license, parse, validate, generate, hash, atomically publish | Create |
| `scripts/update-jlpt-vocabulary.test.ts` | Generator fixtures and failure cases | Create |
| `package.json` / `package-lock.json` | Add updater command and script-only dependencies | Modify |
| `public/data/jlpt-vocabulary.v1.json` | Generated compact exact-key index | Generate |
| `public/data/jlpt-vocabulary.v1.manifest.json` | Generated provenance, counts, checksums | Generate |
| `public/licenses/open-anki-jlpt-decks-MIT.txt` | Vendored upstream license | Generate |
| `src/lib/jlpt-dictionary.ts` | Same-origin loader, integrity verification, exact/normalized indexes | Create |
| `src/lib/jlpt-dictionary.test.ts` | Loader, checksum, schema, classification tests | Create |
| `src/lib/jlpt-calibration.ts` | Enrich analysis result shapes and records; preserve valid data on loader failure | Create |
| `src/lib/jlpt-calibration.test.ts` | Authority, unknown, traversal, failure tests | Create |
| `src/lib/types.ts` | Add JLPT metadata and v2 persistence contracts | Modify |
| `src/lib/client-api.ts` / `src/lib/client-api.test.ts` | Centralize all learner analysis calls and calibrate successful responses | Modify |
| `src/components/ImageUploader.tsx` | Replace direct fallback fetch with `client-api` | Modify |
| `src/lib/ai-service.ts` | Stop reading mode from pre-excluding N5 | Modify |
| `netlify/src/lib/ai-service.ts` | Mirror root AI-service change | Modify |
| `src/lib/jlpt-provider-parity.test.ts` | Prevent root/Netlify hardcoded N5 exclusion from returning | Create |
| `src/lib/mokuro.ts` / `src/lib/mokuro.test.ts` | Read v1/v2, always write v2 with dataset version | Modify |
| `src/components/MokuroReader.tsx` | Recalibrate imported caches and persist only verified results | Modify |
| `src/lib/word-bank.ts` / `src/lib/word-bank.test.ts` | Copy/reclassify `jlpt` without changing identity data | Modify |
| `src/lib/word-bank-store.ts` | Persist v2 and expose asynchronous reclassification | Modify |
| `src/lib/word-bank-store.test.ts` | v1 migration and loader-failure state preservation | Create |
| `src/hooks/useWordBankJLPTCalibration.ts` | Start reclassification on pages that consume the store | Create |
| `src/components/JLPTBadge.tsx` | Shared canonical level/unclassified badge | Create |
| `src/lib/analysis-filters.ts` / `src/lib/analysis-filters.test.ts` | Preserve pre-M2B N5 filtering using canonical levels | Modify |
| `src/components/MokuroAnalysisPanel.tsx` | Shared badge and non-blocking data warning | Modify |
| `src/components/ReadingModeViewer.tsx` | Propagate calibration metadata to selected-sentence panel | Modify |
| `src/components/TextAnalyzer.tsx` | Remove legacy difficulty presentation | Modify |
| `src/components/MangaAnalyzer.tsx` | Remove legacy difficulty presentation | Modify |
| `src/components/SimpleModePanelViewer.tsx` | Remove legacy difficulty presentation | Modify |
| `src/app/words/page.tsx` | Shared badge and word-bank calibration trigger | Modify |
| `src/components/Header.tsx` | Word-bank calibration trigger and Sources link | Modify |
| `src/app/sources/page.tsx` | Dataset provenance, license, disclaimer, statistics | Create |
| JLPT roadmap/spec docs | Mark M2A delivered after verification | Modify in final task |

Dependency order: Task 1 primitives -> Task 2 generated data -> Task 3 loader -> Task 4 calibration boundary -> Task 5 complete provider input -> Task 6 cache migration -> Task 7 word-bank migration -> Task 8 UI/sources -> Task 9 verification/docs.

---

### Task 1: Add JLPT Domain Primitives

**Files:**
- Create: `src/lib/jlpt-levels.ts`
- Create: `src/lib/jlpt-levels.test.ts`

**Interfaces:**
- Consumes: plain `string` values and candidate `JLPTLevel[]`.
- Produces: `JLPTLevel`, `JLPTClassification`, constants, `createJLPTWordKey`, `normalizeJLPTText`, `normalizeJLPTReading`, `pickEarliestJLPTLevel`, `createUnclassifiedJLPTClassification`.

- [ ] **Step 1: Write the failing primitive tests**

Create `src/lib/jlpt-levels.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  JLPT_DATASET_VERSION,
  createJLPTWordKey,
  createUnclassifiedJLPTClassification,
  normalizeJLPTReading,
  normalizeJLPTText,
  pickEarliestJLPTLevel
} from './jlpt-levels'

describe('JLPT normalization', () => {
  it('normalizes width and whitespace without dropping word form information', () => {
    expect(normalizeJLPTText('  Ａ  Ｂ  ')).toBe('A B')
    expect(normalizeJLPTText('取り扱う')).toBe('取り扱う')
  })

  it('normalizes katakana readings to hiragana', () => {
    expect(normalizeJLPTReading(' ジーンズ ')).toBe('じーんず')
  })

  it('keeps word and reading structurally separated in keys', () => {
    expect(createJLPTWordKey('ab', 'c')).not.toBe(createJLPTWordKey('a', 'bc'))
  })
})

describe('JLPT levels', () => {
  it('selects the earliest-learning level from conflicts', () => {
    expect(pickEarliestJLPTLevel(['N2', 'N5', 'N3'])).toBe('N5')
  })

  it('creates a stable unclassified value', () => {
    expect(createUnclassifiedJLPTClassification()).toEqual({
      level: null,
      source: 'open-anki-jlpt-decks',
      datasetVersion: JLPT_DATASET_VERSION,
      match: 'none'
    })
  })
})
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run: `npx vitest run src/lib/jlpt-levels.test.ts`

Expected: FAIL because `./jlpt-levels` does not exist.

- [ ] **Step 3: Implement the primitives**

Create `src/lib/jlpt-levels.ts`:

```ts
export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
export type JLPTLevel = (typeof JLPT_LEVELS)[number]

export const JLPT_DATASET_SOURCE = 'open-anki-jlpt-decks' as const
export const JLPT_DATASET_COMMIT = '1ad66734417aca9dbcca6b2d5ee440cb13ab3ba0'
export const JLPT_DATASET_VERSION = `${JLPT_DATASET_SOURCE}@${JLPT_DATASET_COMMIT}`

export interface JLPTClassification {
  level: JLPTLevel | null
  source: typeof JLPT_DATASET_SOURCE
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
```

- [ ] **Step 4: Run the primitive tests**

Run: `npx vitest run src/lib/jlpt-levels.test.ts`

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/lib/jlpt-levels.ts src/lib/jlpt-levels.test.ts
git commit -m "feat(jlpt): add level domain primitives"
```

---

### Task 2: Generate and Vendor the Pinned JLPT Dataset

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `scripts/update-jlpt-vocabulary.ts`
- Create: `scripts/update-jlpt-vocabulary.test.ts`
- Generate: `public/data/jlpt-vocabulary.v1.json`
- Generate: `public/data/jlpt-vocabulary.v1.manifest.json`
- Generate: `public/licenses/open-anki-jlpt-decks-MIT.txt`

**Interfaces:**
- Consumes: Task 1 constants/functions and pinned upstream CSV/license text.
- Produces: `buildJLPTVocabularyArtifacts(sources, licenseText, generatedAt)` and the three committed public artifacts used by Task 3.

- [ ] **Step 1: Install exact script dependencies and add the updater command**

Run: `npm install --save-dev csv-parse@7.0.1 tsx@4.23.0`

Add to `package.json` scripts:

```json
"update:jlpt-data": "tsx scripts/update-jlpt-vocabulary.ts"
```

Expected: `package.json` and `package-lock.json` contain `csv-parse@7.0.1` and `tsx@4.23.0`.

- [ ] **Step 2: Write generator failure/behavior tests**

Create `scripts/update-jlpt-vocabulary.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { JLPT_DATASET_VERSION } from '../src/lib/jlpt-levels'
import { buildJLPTVocabularyArtifacts } from './update-jlpt-vocabulary'

const csv = (rows: string[]) => [
  'expression,reading,meaning,tags,guid',
  ...rows
].join('\n')

const sources = {
  N5: csv(['猫,ねこ,cat,JLPT_N5,a', 'かな,,kana,JLPT_N5,b']),
  N4: csv(['猫,ねこ,cat,JLPT_N4,c']),
  N3: csv(['ジーンズ,ジーンズ,jeans,JLPT_N3,d']),
  N2: csv([]),
  N1: csv([])
}

describe('buildJLPTVocabularyArtifacts', () => {
  it('repairs kana-only readings, resolves conflicts, and emits stable data', async () => {
    const result = await buildJLPTVocabularyArtifacts(
      sources,
      'MIT License\n',
      '2026-07-10T00:00:00.000Z'
    )
    const data = JSON.parse(result.dataText)
    const manifest = JSON.parse(result.manifestText)

    expect(data.datasetVersion).toBe(JLPT_DATASET_VERSION)
    expect(data.entries[JSON.stringify(['猫', 'ねこ'])]).toBe('N5')
    expect(data.entries[JSON.stringify(['かな', 'かな'])]).toBe('N5')
    expect(manifest.stats.repairedReadings).toBe(1)
    expect(manifest.stats.conflictingKeys).toBe(1)
    expect(manifest.checksums.dataSha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('rejects a missing kanji reading instead of guessing', async () => {
    await expect(buildJLPTVocabularyArtifacts(
      { ...sources, N4: csv(['見る,,see,JLPT_N4,x']) },
      'MIT License\n',
      '2026-07-10T00:00:00.000Z'
    )).rejects.toThrow(/empty reading/i)
  })

  it('rejects malformed CSV rows', async () => {
    await expect(buildJLPTVocabularyArtifacts(
      { ...sources, N1: 'meaning,tags\nbad,row' },
      'MIT License\n',
      '2026-07-10T00:00:00.000Z'
    )).rejects.toThrow(/expression/i)
  })
})
```

- [ ] **Step 3: Run tests and verify the missing-export failure**

Run: `npx vitest run scripts/update-jlpt-vocabulary.test.ts`

Expected: FAIL because `buildJLPTVocabularyArtifacts` is not defined.

- [ ] **Step 4: Implement the generator**

Create `scripts/update-jlpt-vocabulary.ts` with these concrete exports and flow:

```ts
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
```

- [ ] **Step 5: Run generator tests**

Run: `npx vitest run scripts/update-jlpt-vocabulary.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 6: Generate pinned artifacts and verify audit baselines**

Run: `npm run update:jlpt-data`

Run: `node -e "const m=require('./public/data/jlpt-vocabulary.v1.manifest.json'); console.log(m.datasetVersion, m.stats)"`

Expected values:

```text
rows: 8131
uniqueEntries: 8034
duplicateRows: 97
conflictingKeys: 96
repairedReadings: 2
normalizedEntries: 8034
normalizedConflictingKeys: 96
```

Run: `wc -c public/data/jlpt-vocabulary.v1.json`

Expected: at most `358400` bytes.

- [ ] **Step 7: Commit Task 2**

```bash
git add package.json package-lock.json scripts/update-jlpt-vocabulary.ts scripts/update-jlpt-vocabulary.test.ts public/data public/licenses/open-anki-jlpt-decks-MIT.txt
git commit -m "feat(jlpt): vendor pinned vocabulary dataset"
```

---

### Task 3: Load, Verify, and Query the Local Dictionary

**Files:**
- Create: `src/lib/jlpt-dictionary.ts`
- Create: `src/lib/jlpt-dictionary.test.ts`

**Interfaces:**
- Consumes: Task 1 primitives and Task 2 JSON/manifest.
- Produces: `JLPTDictionary.classify(word, reading)`, `loadJLPTDictionary(fetchImpl?)`, `getJLPTDictionary()`, `resetJLPTDictionaryForTests()`.

- [ ] **Step 1: Write loader/classification tests**

Create `src/lib/jlpt-dictionary.test.ts` with fixtures that assert:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { JLPT_DATASET_VERSION, createJLPTWordKey } from './jlpt-levels'
import {
  loadJLPTDictionary,
  resetJLPTDictionaryForTests
} from './jlpt-dictionary'

const sha256 = async (text: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

const responseSet = async (dataOverride: Record<string, unknown> = {}) => {
  const dataText = `${JSON.stringify({
    schemaVersion: 1,
    datasetVersion: JLPT_DATASET_VERSION,
    entries: {
      [createJLPTWordKey('猫', 'ねこ')]: 'N5',
      [createJLPTWordKey('ジーンズ', 'ジーンズ')]: 'N3'
    },
    ...dataOverride
  })}\n`
  const manifestText = JSON.stringify({
    schemaVersion: 1,
    datasetVersion: JLPT_DATASET_VERSION,
    checksums: { dataSha256: await sha256(dataText) }
  })
  return { dataText, manifestText }
}

afterEach(() => resetJLPTDictionaryForTests())

describe('loadJLPTDictionary', () => {
  it('classifies exact, normalized, and missing keys', async () => {
    const fixtures = await responseSet()
    const fetchMock = async (input: RequestInfo | URL) => new Response(
      String(input).includes('manifest') ? fixtures.manifestText : fixtures.dataText
    )
    const result = await loadJLPTDictionary(fetchMock)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw result.error
    expect(result.dictionary.classify('猫', 'ねこ').match).toBe('exact')
    expect(result.dictionary.classify('ジーンズ', 'じーんず')).toMatchObject({ level: 'N3', match: 'normalized' })
    expect(result.dictionary.classify('未知語', 'みちご').level).toBeNull()
  })

  it('fails closed on checksum mismatch', async () => {
    const fixtures = await responseSet()
    const fetchMock = async (input: RequestInfo | URL) => new Response(
      String(input).includes('manifest')
        ? fixtures.manifestText.replace(/[a-f0-9]{64}/, '0'.repeat(64))
        : fixtures.dataText
    )
    await expect(loadJLPTDictionary(fetchMock)).resolves.toMatchObject({ status: 'error' })
  })

  it('fails closed on dataset version mismatch', async () => {
    const fixtures = await responseSet({ datasetVersion: 'wrong-version' })
    const fetchMock = async (input: RequestInfo | URL) => new Response(
      String(input).includes('manifest') ? fixtures.manifestText : fixtures.dataText
    )
    await expect(loadJLPTDictionary(fetchMock)).resolves.toMatchObject({ status: 'error' })
  })
})
```

- [ ] **Step 2: Run tests and verify the missing-module failure**

Run: `npx vitest run src/lib/jlpt-dictionary.test.ts`

Expected: FAIL because `./jlpt-dictionary` does not exist.

- [ ] **Step 3: Implement loader and dictionary construction**

Implement `src/lib/jlpt-dictionary.ts` with these exact public contracts:

```ts
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
      if (exact) return { level: exact, source: JLPT_DATASET_SOURCE, datasetVersion: data.datasetVersion, match: 'exact' }
      const levels = normalized.get(createJLPTWordKey(normalizeJLPTText(word), normalizeJLPTReading(reading)))
      if (levels?.length) return { level: pickEarliestJLPTLevel(levels), source: JLPT_DATASET_SOURCE, datasetVersion: data.datasetVersion, match: 'normalized' }
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
    if (!manifestResponse.ok || !dataResponse.ok) throw new Error('JLPT data files are unavailable')
    const manifest = await manifestResponse.json() as { datasetVersion?: unknown; checksums?: { dataSha256?: unknown } }
    const dataText = await dataResponse.text()
    const data = JSON.parse(dataText) as Partial<DataFile>
    if (manifest.datasetVersion !== JLPT_DATASET_VERSION || data.datasetVersion !== JLPT_DATASET_VERSION) {
      throw new Error('JLPT dataset version mismatch')
    }
    if (data.schemaVersion !== 1 || !data.entries || typeof data.entries !== 'object') {
      throw new Error('JLPT data schema is invalid')
    }
    if (!Object.values(data.entries).every(isJLPTLevel)) throw new Error('JLPT data contains an invalid level')
    if (manifest.checksums?.dataSha256 !== await digest(dataText)) throw new Error('JLPT data checksum mismatch')
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
```

- [ ] **Step 4: Run loader tests**

Run: `npx vitest run src/lib/jlpt-dictionary.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/lib/jlpt-dictionary.ts src/lib/jlpt-dictionary.test.ts
git commit -m "feat(jlpt): load verified local dictionary"
```

---

### Task 4: Calibrate Every Client Analysis Result

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/jlpt-calibration.ts`
- Create: `src/lib/jlpt-calibration.test.ts`
- Modify: `src/lib/client-api.ts`
- Modify: `src/lib/client-api.test.ts`
- Modify: `src/components/ImageUploader.tsx`
- Modify: `src/components/ReadingModeViewer.tsx`

**Interfaces:**
- Consumes: `JLPTDictionaryLoadResult` from Task 3 and raw result shapes.
- Produces: `JLPTCalibrationMeta`, calibrated words/results, `calibrateAnalysisResult`, `calibrateReadingModeResult`, `calibrateAnalysisRecord`, and new `analyzeImage` client API.

- [ ] **Step 1: Add backward-compatible serialized fields and canonical aliases**

In `src/lib/types.ts`, change `WordAnalysis.difficulty` to optional `string`, add optional `jlpt` for v1 deserialization, and add canonical aliases:

```ts
import type { JLPTClassification } from './jlpt-levels'

export interface WordAnalysis {
  word: string
  reading: string
  meaning: string
  partOfSpeech: string
  /** @deprecated Provider/legacy metadata; never use for JLPT behavior. */
  difficulty?: string
  jlpt?: JLPTClassification
}

export type CalibratedWordAnalysis = WordAnalysis & { jlpt: JLPTClassification }

export interface JLPTCalibrationMeta {
  status: 'ready' | 'error'
  datasetVersion: string
  persistable: boolean
}

export type CalibratedSentenceAnalysis = Omit<SentenceAnalysis, 'words'> & {
  words: CalibratedWordAnalysis[]
}

export type CalibratedAnalysisResult = Omit<AnalysisResult, 'sentences' | 'jlptCalibration'> & {
  sentences: CalibratedSentenceAnalysis[]
  jlptCalibration: JLPTCalibrationMeta
}

export type CalibratedSentenceLocation = Omit<SentenceLocation, 'words'> & {
  words: CalibratedWordAnalysis[]
}

export type CalibratedReadingModeResult = Omit<ReadingModeResult, 'sentences' | 'jlptCalibration'> & {
  sentences: CalibratedSentenceLocation[]
  jlptCalibration: JLPTCalibrationMeta
}

export type CalibratedMangaPanel = Omit<MangaPanel, 'sentences'> & {
  sentences: CalibratedSentenceAnalysis[]
}

export type CalibratedMangaAnalysisResult = Omit<MangaAnalysisResult, 'panels' | 'jlptCalibration'> & {
  panels: CalibratedMangaPanel[]
  jlptCalibration: JLPTCalibrationMeta
}
```

Add optional `jlptCalibration?: JLPTCalibrationMeta` to `AnalysisResult`, `ReadingModeResult`, and `MangaAnalysisResult` so v1 JSON remains parseable. Canonical values returned by the calibration functions always include it.

- [ ] **Step 2: Write calibration authority/traversal tests**

Create `src/lib/jlpt-calibration.test.ts` covering these complete cases:

```ts
import { describe, expect, it } from 'vitest'
import { calibrateAnalysisRecord, calibrateAnalysisResult } from './jlpt-calibration'
import type { JLPTDictionaryLoadResult } from './jlpt-dictionary'
import type { AnalysisResult } from './types'

const raw: AnalysisResult = {
  extractedText: '猫と未知語',
  sentences: [{
    sentence: '猫と未知語',
    translation: 'cat and unknown word',
    words: [
      { word: '猫', reading: 'ねこ', meaning: 'cat', partOfSpeech: 'noun', difficulty: 'N1' },
      { word: '未知語', reading: 'みちご', meaning: 'unknown', partOfSpeech: 'noun', difficulty: 'N1' }
    ],
    grammar: [],
    context: ''
  }],
  translation: 'cat and unknown word',
  summary: '',
  provider: 'openai'
}

const ready: JLPTDictionaryLoadResult = {
  status: 'ready',
  dictionary: {
    datasetVersion: 'test-v1',
    classify: word => ({
      level: word === '猫' ? 'N5' : null,
      source: 'open-anki-jlpt-decks',
      datasetVersion: 'test-v1',
      match: word === '猫' ? 'exact' : 'none'
    })
  }
}

describe('JLPT result calibration', () => {
  it('overrides provider difficulty and preserves unknown words', () => {
    const result = calibrateAnalysisResult(raw, ready)
    expect(result.sentences[0].words[0].jlpt.level).toBe('N5')
    expect(result.sentences[0].words[1].jlpt.level).toBeNull()
    expect(result.jlptCalibration).toMatchObject({ status: 'ready', persistable: true })
  })

  it('keeps existing reliable data but marks failure output non-persistable', () => {
    const once = calibrateAnalysisResult(raw, ready)
    const failed = calibrateAnalysisResult(once, {
      status: 'error',
      datasetVersion: 'test-v1',
      error: new Error('offline')
    })
    expect(failed.sentences[0].words[0].jlpt.level).toBe('N5')
    expect(failed.jlptCalibration).toMatchObject({ status: 'error', persistable: false })
  })

  it('calibrates every result in a Mokuro cache record', () => {
    const record = calibrateAnalysisRecord({ a: raw, b: raw }, ready)
    expect(Object.values(record).every(result => result.sentences[0].words[0].jlpt?.level === 'N5')).toBe(true)
  })
})
```

- [ ] **Step 3: Run calibration tests and verify failure**

Run: `npx vitest run src/lib/jlpt-calibration.test.ts`

Expected: FAIL because `./jlpt-calibration` does not exist.

- [ ] **Step 4: Implement result calibration**

Create `src/lib/jlpt-calibration.ts`. On `ready`, always reclassify from the dictionary. On `error`, preserve a word's existing `jlpt` only when it has the expected dataset version; otherwise attach `createUnclassifiedJLPTClassification()` for rendering:

```ts
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
    ? {
        status: 'ready',
        datasetVersion: loadResult.dictionary.datasetVersion,
        persistable: true
      }
    : {
        status: 'error',
        datasetVersion: loadResult.datasetVersion,
        persistable: false
      }

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

const calibrateSentence = (
  sentence: SentenceAnalysis,
  loadResult: JLPTDictionaryLoadResult
) => ({
  ...sentence,
  words: sentence.words.map(word => calibrateWord(word, loadResult))
})

const calibrateLocation = (
  sentence: SentenceLocation,
  loadResult: JLPTDictionaryLoadResult
) => ({
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
```

All functions return new sentence/word arrays and leave the caller's raw object unchanged. Change `analyzeText` and `analyzeImage` return types to `Promise<CalibratedAnalysisResult>` and `analyzeImageForReading` to `Promise<CalibratedReadingModeResult>`.

- [ ] **Step 5: Run calibration tests**

Run: `npx vitest run src/lib/jlpt-calibration.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 6: Centralize all learner API calls and calibrate responses**

In `src/lib/client-api.ts`:

- Remove `excludeN5` from `AnalyzeTextOptions` and request bodies.
- Add `AnalyzeImageOptions` with `provider`, `language`, and optional `signal`.
- Add `analyzeImage(imageBase64, options): Promise<CalibratedAnalysisResult>` using `{ imageBase64, provider, mangaMode: false, analysisLanguage }`.
- After every successful `response.json()`, await `getJLPTDictionary()` and call the matching calibration function before returning.
- Keep the existing server-owned retry and timeout behavior unchanged.

Update `src/lib/client-api.test.ts` to mock `getJLPTDictionary` as ready, assert `excludeN5` is absent, assert returned words contain `jlpt`, and add one `analyzeImage` body test.

In `src/components/ImageUploader.tsx`, import `analyzeImage` and replace lines 95-119's direct fetch with:

```ts
const result = await analyzeImage(imageForAPI, {
  provider: selectedProvider,
  language: analysisLanguage
})
setProgress(100)
setIsAnalyzing(false)
toast.success(analysisLanguage === 'zh' ? '已完成整页分析。' : 'Page analysis complete.')
onAnalysisComplete(result)
```

In `src/components/ReadingModeViewer.tsx`, pass `result.jlptCalibration` into `createSentenceAnalysisResult` and copy it to the generated `AnalysisResult` so failure warnings are not lost.

- [ ] **Step 7: Run focused client tests and typecheck through build**

Run: `npx vitest run src/lib/jlpt-calibration.test.ts src/lib/client-api.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: production build succeeds; fix every new missing `difficulty`/`jlptCalibration` type error before committing.

- [ ] **Step 8: Commit Task 4**

```bash
git add src/lib/types.ts src/lib/jlpt-calibration.ts src/lib/jlpt-calibration.test.ts src/lib/client-api.ts src/lib/client-api.test.ts src/components/ImageUploader.tsx src/components/ReadingModeViewer.tsx
git commit -m "feat(jlpt): calibrate client analysis results"
```

---

### Task 5: Stop Providers from Pre-Excluding N5 Vocabulary

**Files:**
- Modify: `src/lib/ai-service.ts`
- Modify: `netlify/src/lib/ai-service.ts`
- Create: `src/lib/jlpt-provider-parity.test.ts`

**Interfaces:**
- Consumes: existing provider prompts and `excludeN5` compatibility parameter.
- Produces: complete learner vocabulary input for client calibration; parity regression test.

- [ ] **Step 1: Write a failing parity regression test**

Create `src/lib/jlpt-provider-parity.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rootService = readFileSync('src/lib/ai-service.ts', 'utf8')
const netlifyService = readFileSync('netlify/src/lib/ai-service.ts', 'utf8')

describe('JLPT provider parity', () => {
  it('does not hardcode N5 exclusion in either reading-mode service', () => {
    expect(rootService).not.toContain('getLearningLevelInstruction(true)')
    expect(netlifyService).not.toContain('getLearningLevelInstruction(true)')
  })
})
```

- [ ] **Step 2: Run the test and verify it finds both current hardcodes**

Run: `npx vitest run src/lib/jlpt-provider-parity.test.ts`

Expected: FAIL because both service copies contain `getLearningLevelInstruction(true)`.

- [ ] **Step 3: Remove hardcoded exclusion in both service copies**

In both `src/lib/ai-service.ts` and `netlify/src/lib/ai-service.ts`, replace both reading-mode occurrences of:

```ts
${getLearningLevelInstruction(true)}
```

with:

```ts
${getLearningLevelInstruction(false)}
```

Replace reading-mode text that says `non-N5 words` / `non-N5 grammar patterns` with `important words` / `key grammar patterns`. Do not remove the request-level `excludeN5` parameter yet; it remains a compatibility path for callers outside the two supported product modes.

- [ ] **Step 4: Run parity and root tests**

Run: `npx vitest run src/lib/jlpt-provider-parity.test.ts src/lib/client-api.test.ts`

Expected: PASS.

- [ ] **Step 5: Audit scoped Netlify TypeScript output**

Run:

```bash
npx tsc --noEmit --skipLibCheck --target es2020 --module esnext --moduleResolution bundler --esModuleInterop --resolveJsonModule netlify/functions/analyze.ts netlify/src/lib/ai-service.ts
```

Current baseline expectation: the command exits non-zero only for the pre-existing `netlify/src/lib/improved-text-detection.ts(226,16): TS2367` comparison against removed provider `gemini`. Save output and confirm there are no additional errors introduced by this task. Do not run `npm --prefix netlify run build`.

- [ ] **Step 6: Commit Task 5**

```bash
git add src/lib/ai-service.ts netlify/src/lib/ai-service.ts src/lib/jlpt-provider-parity.test.ts
git commit -m "fix(jlpt): stop pre-filtering reading vocabulary"
```

---

### Task 6: Upgrade and Recalibrate Mokuro Caches

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/mokuro.ts`
- Modify: `src/lib/mokuro.test.ts`
- Modify: `src/components/MokuroReader.tsx`

**Interfaces:**
- Consumes: Task 4 `calibrateAnalysisRecord`, `isPersistableAnalysis`; Task 1 dataset version.
- Produces: v1/v2 parser compatibility, v2 serializers, imported-cache recalibration, persistence filtering.

- [ ] **Step 1: Add failing v1/v2 migration tests**

Extend `src/lib/mokuro.test.ts` with tests that:

```ts
it('reads v1 caches but always serializes v2 with the JLPT dataset version', () => {
  const v1 = JSON.stringify({
    version: 1,
    savedAt: '2026-07-10T00:00:00.000Z',
    source: {},
    analyses: {}
  })
  expect(parseMokuroAnalysisCacheContent(v1).version).toBe(1)
  const v2 = JSON.parse(serializeMokuroAnalysisCache({}))
  expect(v2.version).toBe(2)
  expect(v2.jlptDatasetVersion).toBe(JLPT_DATASET_VERSION)
})

it('writes only persistable calibrated analyses', () => {
  const ready = { ...result, jlptCalibration: { status: 'ready', datasetVersion: JLPT_DATASET_VERSION, persistable: true } }
  const error = { ...result, jlptCalibration: { status: 'error', datasetVersion: JLPT_DATASET_VERSION, persistable: false } }
  expect(Object.keys(getPersistableAnalysisRecord({ ready, error }))).toEqual(['ready'])
})
```

Add equivalent v1/v2 assertions for per-page cache files.

Update every existing serializer round-trip fixture in `src/lib/mokuro.test.ts` to include:

```ts
jlptCalibration: {
  status: 'ready',
  datasetVersion: JLPT_DATASET_VERSION,
  persistable: true
}
```

This keeps older parser-only fixtures free to omit metadata while ensuring serializer fixtures represent canonical persistable results.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npx vitest run src/lib/mokuro.test.ts`

Expected: FAIL because serializers still write v1 and `getPersistableAnalysisRecord` does not exist.

- [ ] **Step 3: Implement v2 cache contracts**

In `src/lib/types.ts`, change `MokuroAnalysisCacheFile` to:

```ts
export interface MokuroAnalysisCacheFile {
  version: 1 | 2
  jlptDatasetVersion?: string
  savedAt: string
  source: { title?: string; pageCount?: number }
  analyses: Record<string, AnalysisResult>
}
```

In `src/lib/mokuro.ts`:

- Accept `version === 1 || version === 2` in both cache parsers.
- Return parsed `version` and optional `jlptDatasetVersion`.
- Make both serializers write `version: 2` and `jlptDatasetVersion: JLPT_DATASET_VERSION`.
- Export:

```ts
export const getPersistableAnalysisRecord = (
  analyses: Record<string, AnalysisResult>
): Record<string, AnalysisResult> => Object.fromEntries(
  Object.entries(analyses).filter(([, result]) => isPersistableAnalysis(result))
)
```

Apply this filter inside both serializers as a defense in depth.

- [ ] **Step 4: Recalibrate imported caches in MokuroReader**

In `src/components/MokuroReader.tsx`:

- Track whether any loaded legacy/page/browser cache has `version === 1` or a mismatched `jlptDatasetVersion`.
- After merging all parsed cache files, call `const loadResult = await getJLPTDictionary()` and `loadedCache = calibrateAnalysisRecord(loadedCache, loadResult)` before assigning state.
- Keep calibrated results in memory even when `persistable` is false so reading still works.
- Continue writing through v2 serializers; their filter prevents transient results from reaching disk/localStorage.
- When migrating the legacy monolithic cache to page files, perform migration only if `loadResult.status === 'ready'`; otherwise retain the legacy file for a later retry.

- [ ] **Step 5: Run cache tests and build**

Run: `npx vitest run src/lib/mokuro.test.ts src/lib/jlpt-calibration.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: production build succeeds.

- [ ] **Step 6: Commit Task 6**

```bash
git add src/lib/types.ts src/lib/mokuro.ts src/lib/mokuro.test.ts src/components/MokuroReader.tsx
git commit -m "feat(jlpt): migrate Mokuro caches to calibrated v2"
```

---

### Task 7: Upgrade and Reclassify the Word Bank

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/word-bank.ts`
- Modify: `src/lib/word-bank.test.ts`
- Modify: `src/lib/word-bank-store.ts`
- Create: `src/lib/word-bank-store.test.ts`
- Create: `src/hooks/useWordBankJLPTCalibration.ts`

**Interfaces:**
- Consumes: Task 3 dictionary loader and Task 4 calibrated words.
- Produces: `reclassifySavedWords`, v2 store, `calibrateWords()` action, reusable initialization hook.

- [ ] **Step 1: Write failing migration/reclassification tests**

Extend `src/lib/word-bank.test.ts`:

```ts
it('copies canonical JLPT data into a newly saved word', () => {
  const saved = toSavedWord({
    ...baseWord,
    jlpt: { level: 'N3', source: 'open-anki-jlpt-decks', datasetVersion: 'v1', match: 'exact' }
  }, '橋を渡る', '2026-07-10T00:00:00.000Z')
  expect(saved.jlpt?.level).toBe('N3')
})

it('reclassifies without changing identity or learning context', () => {
  const before = makeSaved()
  const after = reclassifySavedWords([before], {
    datasetVersion: 'v2',
    classify: () => ({ level: 'N4', source: 'open-anki-jlpt-decks', datasetVersion: 'v2', match: 'exact' })
  })
  expect(after[0]).toMatchObject({
    word: before.word,
    reading: before.reading,
    sourceSentence: before.sourceSentence,
    savedAt: before.savedAt,
    jlpt: { level: 'N4', datasetVersion: 'v2' }
  })
})
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npx vitest run src/lib/word-bank.test.ts`

Expected: FAIL because `jlpt` is not copied and `reclassifySavedWords` does not exist.

- [ ] **Step 3: Add SavedWord compatibility and pure reclassification**

In `src/lib/types.ts`, change `SavedWord.difficulty` to optional and add `jlpt?: JLPTClassification` for persisted v1 compatibility.

In `src/lib/word-bank.ts`:

- Copy `word.jlpt` in `toSavedWord`.
- Remove `difficulty: word.difficulty` from `toSavedWord`; old persisted entries may retain it, but new entries do not copy it.
- Export:

```ts
export const reclassifySavedWords = (
  words: SavedWord[],
  dictionary: JLPTDictionary
): SavedWord[] => words.map(word => ({
  ...word,
  jlpt: dictionary.classify(word.word, word.reading)
}))
```

- [ ] **Step 4: Upgrade the persisted store to v2**

Create `src/lib/word-bank-store.test.ts` before the implementation:

```ts
import { describe, expect, it } from 'vitest'
import { migrateWordBankState } from './word-bank-store'

describe('migrateWordBankState', () => {
  it('preserves v1 word identity and learning context', () => {
    const word = {
      word: '橋',
      reading: 'はし',
      meaning: 'bridge',
      partOfSpeech: 'noun',
      difficulty: 'N3',
      sourceSentence: '橋を渡る',
      savedAt: '2026-07-10T00:00:00.000Z'
    }
    expect(migrateWordBankState({ words: [word] })).toEqual({
      words: [word],
      calibrationStatus: 'idle'
    })
  })
})
```

Run: `npx vitest run src/lib/word-bank-store.test.ts`

Expected: FAIL because `migrateWordBankState` is not exported.

In `src/lib/word-bank-store.ts`, add transient state:

```ts
calibrationStatus: 'idle' | 'loading' | 'ready' | 'error'
calibrateWords: () => Promise<void>
```

Add this pure migration helper:

```ts
export const migrateWordBankState = (persisted: unknown) => {
  const state = persisted as { words?: unknown }
  return {
    words: Array.isArray(state?.words) ? state.words as SavedWord[] : [],
    calibrationStatus: 'idle' as const
  }
}
```

Implement `calibrateWords` exactly with the current state at completion so words saved while the dictionary is loading are also classified:

```ts
calibrateWords: async () => {
  const status = get().calibrationStatus
  if (status === 'loading' || status === 'ready') return
  set({ calibrationStatus: 'loading' })
  const result = await getJLPTDictionary()
  if (result.status === 'error') {
    set({ calibrationStatus: 'error' })
    return
  }
  set(state => ({
    words: reclassifySavedWords(state.words, result.dictionary),
    calibrationStatus: 'ready'
  }))
}
```

Configure persist with:

```ts
version: 2,
migrate: persisted => {
  return migrateWordBankState(persisted)
},
partialize: state => ({ ...state, calibrationStatus: 'idle' as const })
```

Create `src/hooks/useWordBankJLPTCalibration.ts`:

```ts
'use client'

import { useEffect } from 'react'
import { useWordBankStore } from '@/lib/word-bank-store'

export const useWordBankJLPTCalibration = (): void => {
  const calibrateWords = useWordBankStore(state => state.calibrateWords)
  useEffect(() => {
    void calibrateWords()
  }, [calibrateWords])
}
```

- [ ] **Step 5: Run tests and build**

Run: `npx vitest run src/lib/word-bank.test.ts src/lib/word-bank-store.test.ts src/lib/jlpt-dictionary.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: production build succeeds.

- [ ] **Step 6: Commit Task 7**

```bash
git add src/lib/types.ts src/lib/word-bank.ts src/lib/word-bank.test.ts src/lib/word-bank-store.ts src/lib/word-bank-store.test.ts src/hooks/useWordBankJLPTCalibration.ts
git commit -m "feat(jlpt): migrate word bank classifications"
```

---

### Task 8: Replace Legacy Badges and Add the Sources Page

**Files:**
- Create: `src/components/JLPTBadge.tsx`
- Modify: `src/lib/analysis-filters.ts`
- Modify: `src/lib/analysis-filters.test.ts`
- Modify: `src/components/MokuroAnalysisPanel.tsx`
- Modify: `src/components/ReadingModeViewer.tsx`
- Modify: `src/components/TextAnalyzer.tsx`
- Modify: `src/components/MangaAnalyzer.tsx`
- Modify: `src/components/SimpleModePanelViewer.tsx`
- Modify: `src/app/words/page.tsx`
- Modify: `src/components/Header.tsx`
- Create: `src/app/sources/page.tsx`

**Interfaces:**
- Consumes: canonical/optional `word.jlpt`, result-level `jlptCalibration`, generated manifest, word-bank calibration hook.
- Produces: one badge component, canonical N5 filtering, visible failure warning, provenance route.

- [ ] **Step 1: Update filter tests to prove AI difficulty is ignored**

Replace vocabulary cases in `src/lib/analysis-filters.test.ts` with canonical values and add:

```ts
it('uses canonical JLPT data and ignores contradictory provider difficulty', () => {
  const words = [
    {
      word: '私', reading: 'わたし', meaning: 'I', partOfSpeech: 'pronoun', difficulty: 'N1',
      jlpt: { level: 'N5', source: 'open-anki-jlpt-decks', datasetVersion: 'v1', match: 'exact' }
    },
    {
      word: '未知語', reading: 'みちご', meaning: 'unknown', partOfSpeech: 'noun', difficulty: 'N5',
      jlpt: { level: null, source: 'open-anki-jlpt-decks', datasetVersion: 'v1', match: 'none' }
    }
  ]
  expect(filterLearningVocabulary(words).map(word => word.word)).toEqual(['未知語'])
})
```

- [ ] **Step 2: Run filter tests and verify failure**

Run: `npx vitest run src/lib/analysis-filters.test.ts`

Expected: FAIL because filtering still reads `difficulty`.

- [ ] **Step 3: Implement the shared badge and canonical filter**

Create `src/components/JLPTBadge.tsx`:

```tsx
import type { AnalysisLanguage } from '@/lib/types'
import type { JLPTClassification, JLPTLevel } from '@/lib/jlpt-levels'

const CLASSES: Record<JLPTLevel, string> = {
  N5: 'border-emerald-500/25 bg-emerald-500/15 text-emerald-300',
  N4: 'border-lime-500/25 bg-lime-500/15 text-lime-300',
  N3: 'border-amber-500/25 bg-amber-500/15 text-amber-300',
  N2: 'border-orange-500/25 bg-orange-500/15 text-orange-300',
  N1: 'border-red-500/25 bg-red-500/15 text-red-300'
}

export default function JLPTBadge({
  classification,
  language = 'zh'
}: {
  classification?: JLPTClassification
  language?: AnalysisLanguage
}) {
  const level = classification?.level ?? null
  const label = level ?? (language === 'zh' ? '未定级' : 'Unclassified')
  const title = classification
    ? `${classification.source} / ${classification.datasetVersion} / ${classification.match}`
    : (language === 'zh' ? '尚未校准' : 'Not calibrated')
  return (
    <span
      title={title}
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
        level ? CLASSES[level] : 'border-gray-500/25 bg-gray-500/15 text-gray-300'
      }`}
    >
      {label}
    </span>
  )
}
```

Change `isN5OrBasicVocabulary` in `src/lib/analysis-filters.ts` to:

```ts
export const isN5OrBasicVocabulary = (word: WordAnalysis): boolean =>
  word.jlpt?.level === 'N5'
```

Do not change the grammar heuristic in this task.

- [ ] **Step 4: Replace every learner-facing difficulty badge**

Use `<JLPTBadge classification={word.jlpt} language={...} />` in:

- `MokuroAnalysisPanel.tsx` using its `language` prop.
- `app/words/page.tsx` using fixed `zh` and call `useWordBankJLPTCalibration()` at page start.
- `TextAnalyzer.tsx`, `MangaAnalyzer.tsx`, and `SimpleModePanelViewer.tsx` using `en` where those legacy surfaces have English copy.

Delete local `normalizeDifficulty`, `DIFFICULTY_BADGE_CLASSES`, `getDifficultyColor`, and `getDifficultyIcon` helpers. In `MokuroAnalysisPanel`, add `jlptUnavailable` to both language dictionaries and render a compact amber warning above vocabulary when `analysisResult.jlptCalibration?.status === 'error'`.

In `ReadingModeViewer`, ensure selected sentence results retain the top-level calibration metadata added in Task 4.

- [ ] **Step 5: Add word-bank initialization and Sources navigation**

In `src/components/Header.tsx`:

- Call `useWordBankJLPTCalibration()`.
- Import `Info` from lucide-react.
- Add an icon link to `/sources` with `aria-label="JLPT data sources"` and `title="JLPT data sources"`.

Create `src/app/sources/page.tsx` as a server component. Import the generated manifest from `../../../public/data/jlpt-vocabulary.v1.manifest.json` and render:

- Back link to `/` with `ArrowLeft`.
- Dataset name, full version, fixed commit, commit date, generated time.
- Rows, unique entries, conflicts, and reading repairs.
- Upstream repository link.
- `/licenses/open-anki-jlpt-decks-MIT.txt` link.
- Official JLPT guidebook link.
- Explicit Chinese copy:「新版 JLPT 不发布官方逐词清单。本应用显示的 JLPT 等级来自固定版本的社区参考数据,可能存在遗漏、冲突或错误。」

Use unframed full-width sections with a constrained inner container; do not nest cards.

- [ ] **Step 6: Run focused tests and remove all UI difficulty consumers**

Run: `npx vitest run src/lib/analysis-filters.test.ts src/lib/word-bank.test.ts`

Expected: PASS.

Run:

```bash
rg -n "word\.difficulty|normalizeDifficulty|getDifficultyColor|getDifficultyIcon" src/components src/app src/lib/analysis-filters.ts src/lib/word-bank.ts
```

Expected: no matches.

Run: `npm run lint`

Expected: 0 errors; existing `<img>` warnings may remain, but this task adds no warning.

Run: `npm run build`

Expected: production build succeeds and route list includes `/sources`.

- [ ] **Step 7: Commit Task 8**

```bash
git add src/components/JLPTBadge.tsx src/lib/analysis-filters.ts src/lib/analysis-filters.test.ts src/components/MokuroAnalysisPanel.tsx src/components/ReadingModeViewer.tsx src/components/TextAnalyzer.tsx src/components/MangaAnalyzer.tsx src/components/SimpleModePanelViewer.tsx src/app/words/page.tsx src/components/Header.tsx src/app/sources/page.tsx
git commit -m "feat(jlpt): show calibrated levels and sources"
```

---

### Task 9: End-to-End Verification and Roadmap Closure

**Files:**
- Modify: `docs/superpowers/2026-07-10-jlpt-prep-assessment.md`
- Modify: `docs/superpowers/specs/2026-07-10-jlpt-level-calibration-design.md`
- Modify: `docs/superpowers/plans/2026-07-10-jlpt-level-calibration.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified M2A delivery state and explicit M2B handoff.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test`

Expected: all Vitest files pass, including generator, dictionary, calibration, client API, cache, word-bank, filters, and parity tests.

- [ ] **Step 2: Run static and production checks**

Run: `npm run lint`

Expected: 0 errors and no new warnings.

Run: `npm run build`

Expected: production build succeeds.

Run: `git diff --check`

Expected: no output.

Run the scoped Netlify command from Task 5 and confirm its only error remains the documented pre-existing TS2367 in `improved-text-detection.ts:226`; any additional error blocks completion.

- [ ] **Step 3: Verify generated provenance and runtime network behavior**

Run:

```bash
JLPT_GENERATED_AT=$(node -p "require('./public/data/jlpt-vocabulary.v1.manifest.json').generatedAt") npm run update:jlpt-data
git diff --exit-code -- public/data public/licenses
```

Expected: no diff; data JSON, manifest, and license are reproducible from the pinned source.

Start: `npm run dev`

Use the browser testing skill to verify desktop `1440x900` and mobile `390x844`:

1. `/sources` loads, displays version `open-anki-jlpt-decks@1ad6673...`, statistics, license, and disclaimer without overlap.
2. Image Analyzer reading-location and full-page fallback display canonical badges.
3. Mokuro Reader displays the same level for the same word.
4. A fixture/unmatched word displays「未定级」and remains saveable.
5. Blocking `/data/jlpt-vocabulary.v1.json` shows the non-blocking warning; translation and word saving still work.
6. Network requests include only same-origin `/data/...` dictionary files and no third-party dictionary API.

- [ ] **Step 4: Verify migration behavior manually**

Before loading the new build, seed:

- a `word-bank-storage` v1 localStorage object with two entries and fixed `savedAt` values;
- a Mokuro v1 cache containing one analyzed block without `jlpt`.

After loading:

- both word-bank entries remain, keys/source sentences/timestamps are unchanged, and storage version becomes 2 after successful calibration;
- the cache displays calibrated levels without an `/api/analyze` request and serializes as v2 on the next save;
- when the data file is blocked, existing reliable classifications remain and no transient null classification is persisted.

- [ ] **Step 5: Update delivery status docs**

After all checks pass:

- Set the M2A row in the roadmap to `已完成` and M2B to `下一步`.
- Set the design status to `已实现` and record the final merge/feature commit.
- Add a completion status at the top of this plan while retaining checkbox history.
- Record exact test count, lint warning count, build result, Netlify baseline error, and manual viewport checks.

- [ ] **Step 6: Commit Task 9**

```bash
git add docs/superpowers/2026-07-10-jlpt-prep-assessment.md docs/superpowers/specs/2026-07-10-jlpt-level-calibration-design.md docs/superpowers/plans/2026-07-10-jlpt-level-calibration.md
git commit -m "docs(jlpt): record calibrated level delivery"
```

---

## Plan Self-Review Checklist

- Spec coverage: Tasks 1-3 cover pinned data, provenance, deterministic matching, conflicts, repairs, integrity, and size; Tasks 4-5 cover canonical result flow and complete provider vocabulary; Tasks 6-7 cover cache/store migration; Task 8 covers badges, warning, and Sources; Task 9 covers delivery checks.
- Scope: M2B target settings and default N4 behavior remain interface constraints only; no M2B UI task appears here.
- Type consistency: `JLPTClassification`, `JLPTDictionaryLoadResult`, `JLPTCalibrationMeta`, `calibrateAnalysisRecord`, `isPersistableAnalysis`, and `reclassifySavedWords` have one definition and matching consumers.
- Persistence: only `jlptCalibration.status === 'ready' && persistable === true` results reach cache serializers; word-bank migration mutates only `jlpt` after a successful dictionary load.
- Placeholder scan: no unresolved marker, implicit error handling instruction, or unspecified test step remains.
