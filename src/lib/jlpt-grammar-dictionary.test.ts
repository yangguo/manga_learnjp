import { afterEach, describe, expect, it } from 'vitest'
import { GRAMMAR_JLPT_DATASET_VERSION } from './jlpt-levels'
import {
  loadJLPTGrammarDictionary,
  resetJLPTGrammarDictionaryForTests
} from './jlpt-grammar-dictionary'

const sha256 = async (text: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

const responseSet = async (dataOverride: Record<string, unknown> = {}) => {
  const dataText = `${JSON.stringify({
    schemaVersion: 1,
    datasetVersion: GRAMMAR_JLPT_DATASET_VERSION,
    entries: {
      '〜ことにする': 'N3',
      '〜こととなる': 'N3',
      '〜わけではない': 'N2'
    },
    ...dataOverride
  })}\n`
  const manifestText = JSON.stringify({
    schemaVersion: 1,
    datasetVersion: GRAMMAR_JLPT_DATASET_VERSION,
    checksums: { dataSha256: await sha256(dataText) }
  })
  return { dataText, manifestText }
}

afterEach(() => resetJLPTGrammarDictionaryForTests())

describe('loadJLPTGrammarDictionary', () => {
  it('classifies exact, normalized aliases, and missing patterns without substring matching', async () => {
    const fixtures = await responseSet()
    const fetchMock = async (input: RequestInfo | URL) => new Response(
      String(input).includes('manifest') ? fixtures.manifestText : fixtures.dataText
    )
    const result = await loadJLPTGrammarDictionary(fetchMock)

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw result.error
    expect(result.dictionary.classify('〜ことにする')).toMatchObject({ level: 'N3', match: 'exact' })
    expect(result.dictionary.classify(' 「～ こととなる 」 ')).toMatchObject({ level: 'N3', match: 'normalized' })
    expect(result.dictionary.classify('〜ことにするわけではない').level).toBeNull()
    expect(result.dictionary.classify('〜未知').match).toBe('none')
  })

  it('fails closed when the data checksum or level schema is invalid', async () => {
    const checksumFixtures = await responseSet()
    const checksumFetch = async (input: RequestInfo | URL) => new Response(
      String(input).includes('manifest')
        ? checksumFixtures.manifestText.replace(/[a-f0-9]{64}/, '0'.repeat(64))
        : checksumFixtures.dataText
    )
    await expect(loadJLPTGrammarDictionary(checksumFetch)).resolves.toMatchObject({ status: 'error' })

    const levelFixtures = await responseSet({ entries: { '〜ことにする': 'N0' } })
    const levelFetch = async (input: RequestInfo | URL) => new Response(
      String(input).includes('manifest') ? levelFixtures.manifestText : levelFixtures.dataText
    )
    await expect(loadJLPTGrammarDictionary(levelFetch)).resolves.toMatchObject({ status: 'error' })
  })
})
