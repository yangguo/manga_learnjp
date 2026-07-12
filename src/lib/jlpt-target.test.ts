import { describe, expect, it } from 'vitest'
import {
  classifyJLPTLevelForTarget,
  formatJLPTLevelRange,
  groupGrammarByTarget,
  getJLPTLevelsForBand,
  groupVocabularyByTarget
} from './jlpt-target'
import type { JLPTClassification, JLPTLevel } from './jlpt-levels'
import type { GrammarPattern } from './types'

const classification = (level: JLPTLevel | null): JLPTClassification => ({
  level,
  source: 'open-anki-jlpt-decks',
  datasetVersion: 'test',
  match: level ? 'exact' : 'none'
})

const item = (id: string, level?: JLPTLevel | null) => ({
  id,
  ...(level === undefined ? {} : { jlpt: classification(level) })
})

describe('classifyJLPTLevelForTarget', () => {
  it('classifies levels around an N4 target', () => {
    expect(classifyJLPTLevelForTarget('N5', 'N4')).toBe('foundation')
    expect(classifyJLPTLevelForTarget('N4', 'N4')).toBe('focus')
    expect(classifyJLPTLevelForTarget('N3', 'N4')).toBe('stretch')
    expect(classifyJLPTLevelForTarget('N2', 'N4')).toBe('stretch')
    expect(classifyJLPTLevelForTarget('N1', 'N4')).toBe('stretch')
    expect(classifyJLPTLevelForTarget(null, 'N4')).toBe('unclassified')
  })
})

describe('getJLPTLevelsForBand', () => {
  it('handles the N5 and N1 boundary targets', () => {
    expect(getJLPTLevelsForBand('N5', 'foundation')).toEqual([])
    expect(getJLPTLevelsForBand('N5', 'stretch')).toEqual(['N4', 'N3', 'N2', 'N1'])
    expect(getJLPTLevelsForBand('N1', 'foundation')).toEqual(['N5', 'N4', 'N3', 'N2'])
    expect(getJLPTLevelsForBand('N1', 'stretch')).toEqual([])
  })

  it('returns only the target for the focus band and no levels for unclassified', () => {
    expect(getJLPTLevelsForBand('N3', 'focus')).toEqual(['N3'])
    expect(getJLPTLevelsForBand('N3', 'unclassified')).toEqual([])
  })
})

describe('formatJLPTLevelRange', () => {
  it('formats empty, single, and multi-level ranges compactly', () => {
    expect(formatJLPTLevelRange([])).toBe('')
    expect(formatJLPTLevelRange(['N4'])).toBe('N4')
    expect(formatJLPTLevelRange(['N3', 'N2', 'N1'])).toBe('N3–N1')
  })
})

describe('groupVocabularyByTarget', () => {
  it('groups every item without changing order or mutating input', () => {
    const words = [
      item('stretch-one', 'N3'),
      item('foundation', 'N5'),
      item('focus', 'N4'),
      item('stretch-two', 'N2'),
      item('unclassified', null),
      item('missing')
    ]
    const snapshot = [...words]

    const grouped = groupVocabularyByTarget(words, 'N4')

    expect(grouped.foundation.map(word => word.id)).toEqual(['foundation'])
    expect(grouped.focus.map(word => word.id)).toEqual(['focus'])
    expect(grouped.stretch.map(word => word.id)).toEqual(['stretch-one', 'stretch-two'])
    expect(grouped.unclassified.map(word => word.id)).toEqual(['unclassified', 'missing'])
    expect(words).toEqual(snapshot)
  })
})

describe('groupGrammarByTarget', () => {
  it('groups N4 grammar into foundation, focus, stretch, and unclassified without mutation', () => {
    const grammar = [
      { pattern: '〜ようだ', jlpt: { level: 'N3', source: 'tanos-jlpt-grammar', datasetVersion: 'test', match: 'exact' } },
      { pattern: '〜ます', jlpt: { level: 'N5', source: 'tanos-jlpt-grammar', datasetVersion: 'test', match: 'exact' } },
      { pattern: '〜ながら', jlpt: { level: 'N4', source: 'tanos-jlpt-grammar', datasetVersion: 'test', match: 'exact' } },
      { pattern: '〜にもかかわらず', jlpt: { level: 'N2', source: 'tanos-jlpt-grammar', datasetVersion: 'test', match: 'exact' } },
      { pattern: '〜不明', jlpt: { level: null, source: 'tanos-jlpt-grammar', datasetVersion: 'test', match: 'none' } },
      { pattern: '〜未校准' }
    ] satisfies Pick<GrammarPattern, 'pattern' | 'jlpt'>[]
    const snapshot = structuredClone(grammar)

    const grouped = groupGrammarByTarget(grammar, 'N4')

    expect(grouped.foundation.map(item => item.pattern)).toEqual(['〜ます'])
    expect(grouped.focus.map(item => item.pattern)).toEqual(['〜ながら'])
    expect(grouped.stretch.map(item => item.pattern)).toEqual(['〜ようだ', '〜にもかかわらず'])
    expect(grouped.unclassified.map(item => item.pattern)).toEqual(['〜不明', '〜未校准'])
    expect(grammar).toEqual(snapshot)
  })
})
