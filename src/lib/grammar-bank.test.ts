import { describe, expect, it } from 'vitest'
import {
  addGrammar,
  isSavedGrammar,
  normalizeGrammarPattern,
  reclassifySavedGrammar,
  removeGrammar,
  savedGrammarKey,
  toSavedGrammar,
  toggleGrammar
} from './grammar-bank'
import type { JLPTGrammarDictionaryLoadResult } from './jlpt-grammar-dictionary'
import type { GrammarPattern, SavedGrammar } from './types'

const grammar: GrammarPattern = {
  pattern: ' ～ わけではない ',
  explanation: 'not necessarily',
  example: '高いからといって、良いわけではない。'
}

const saved = (): SavedGrammar => toSavedGrammar(
  grammar,
  '高いからといって、良いわけではない。',
  'zh',
  '2026-07-12T00:00:00.000Z'
)

describe('grammar bank helpers', () => {
  it('normalizes NFKC, waves, whitespace, and outer punctuation into a stable key', () => {
    expect(normalizeGrammarPattern(' 「〜 わけではない」 ')).toBe('〜わけではない')
    expect(savedGrammarKey('～わけではない')).toBe(savedGrammarKey('~ わけではない'))
  })

  it('keeps the first saved explanation and source when a pattern is encountered again', () => {
    const first = saved()
    const repeated = {
      ...first,
      explanation: 'replacement',
      sourceSentence: '別の原句',
      savedAt: '2026-07-13T00:00:00.000Z'
    }

    expect(addGrammar([first], repeated)).toEqual([first])
  })

  it('adds, removes, toggles, and checks grammar without mutating inputs', () => {
    const first = saved()
    const entries: SavedGrammar[] = []
    const snapshot = structuredClone(entries)

    expect(addGrammar(entries, first)).toEqual([first])
    expect(isSavedGrammar([first], grammar.pattern)).toBe(true)
    expect(removeGrammar([first], '〜わけではない')).toEqual([])
    expect(toggleGrammar([first], first)).toEqual([])
    expect(toggleGrammar([], first)).toEqual([first])
    expect(entries).toEqual(snapshot)
  })

  it('reclassifies saved grammar without overwriting learner-facing fields or mutating input', () => {
    const entry = saved()
    const snapshot = structuredClone(entry)
    const ready: JLPTGrammarDictionaryLoadResult = {
      status: 'ready',
      dictionary: {
        datasetVersion: 'grammar-test-v1',
        classify: () => ({
          level: 'N2',
          source: 'tanos-jlpt-grammar',
          datasetVersion: 'grammar-test-v1',
          match: 'exact'
        })
      }
    }

    expect(reclassifySavedGrammar([entry], ready)).toEqual([{
      ...entry,
      jlpt: { level: 'N2', source: 'tanos-jlpt-grammar', datasetVersion: 'grammar-test-v1', match: 'exact' }
    }])
    expect(reclassifySavedGrammar([{ ...entry, jlpt: { level: 'N3', source: 'tanos-jlpt-grammar', datasetVersion: 'grammar-test-v1', match: 'exact' } }], {
      status: 'error',
      datasetVersion: 'grammar-test-v1',
      error: new Error('offline')
    })[0].jlpt?.level).toBe('N3')
    expect(entry).toEqual(snapshot)
  })
})
