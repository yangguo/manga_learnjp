import { describe, expect, it } from 'vitest'
import { buildJLPTGrammarArtifacts, extractGrammarPatterns } from './update-jlpt-grammar'

const bodies = {
  N5: 'JLPT N5 Grammar List\n～です\n～ます\nJLPT Resources – http://www.tanos.co.uk/jlpt/\nPAGE 1',
  N4: 'JLPT N4 Grammar List\n～ながら\n～です',
  N3: 'JLPT N3 Grammar List\n～ことにする / ～こととなる',
  N2: 'JLPT N2 Grammar List\n～ものの',
  N1: 'JLPT N1 Grammar List\n～めく'
} as const

describe('Tanos grammar generator', () => {
  it('extracts only grammar patterns and drops document chrome', () => {
    expect(extractGrammarPatterns(bodies.N5)).toEqual(['～です', '～ます'])
  })

  it('normalizes aliases, resolves cross-level conflicts, and records checksums', async () => {
    const result = await buildJLPTGrammarArtifacts(
      bodies,
      'Everything on this site is licenced under Creative Commons "BY".',
      '2026-07-12T00:00:00.000Z'
    )
    const data = JSON.parse(result.dataText)
    const manifest = JSON.parse(result.manifestText)

    expect(data.entries['〜です']).toBe('N5')
    expect(data.entries['〜ことにする']).toBe('N3')
    expect(data.entries['〜こととなる']).toBe('N3')
    expect(manifest.stats.conflictingPatterns).toBe(1)
    expect(manifest.stats.aliases).toBe(1)
    expect(manifest.checksums.dataSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(result.dataText).not.toContain('Creative Commons')
  })

  it('rejects a missing level body or a changed document with no patterns', async () => {
    await expect(buildJLPTGrammarArtifacts(
      { ...bodies, N2: '' },
      'Creative Commons "BY"',
      '2026-07-12T00:00:00.000Z'
    )).rejects.toThrow(/N2.*empty/i)
  })

  it('normalizes the checked-in license snapshot without changing its source checksum', async () => {
    const licenseText = 'Creative Commons "BY".  \r\nLine with whitespace\t \r\n'
    const result = await buildJLPTGrammarArtifacts(
      bodies,
      licenseText,
      '2026-07-12T00:00:00.000Z'
    )
    const manifest = JSON.parse(result.manifestText)

    expect(result.licenseText).toBe('Creative Commons "BY".\nLine with whitespace\n')
    expect(manifest.checksums.licenseSha256).toMatch(/^[a-f0-9]{64}$/)
  })
})
