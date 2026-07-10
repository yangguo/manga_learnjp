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
