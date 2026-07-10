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

  it('fails closed on manifest schema mismatch', async () => {
    const fixtures = await responseSet()
    const fetchMock = async (input: RequestInfo | URL) => new Response(
      String(input).includes('manifest')
        ? fixtures.manifestText.replace('"schemaVersion":1', '"schemaVersion":2')
        : fixtures.dataText
    )
    await expect(loadJLPTDictionary(fetchMock)).resolves.toMatchObject({ status: 'error' })
  })
})
