import { describe, expect, it } from 'vitest'
import { serializeWordsForAnki } from './anki-export'
import type { SavedWord } from './types'

const makeWord = (overrides: Partial<SavedWord> = {}): SavedWord => ({
  word: '橋',
  reading: 'はし',
  meaning: 'bridge',
  partOfSpeech: 'noun',
  jlpt: {
    level: 'N4',
    source: 'open-anki-jlpt-decks',
    datasetVersion: 'test',
    match: 'exact'
  },
  sourceSentence: 'あの橋を渡る。',
  savedAt: '2026-07-12T00:00:00.000Z',
  ...overrides
})

const HEADERS = [
  '#separator:Tab',
  '#html:false',
  '#tags column:8',
  '#columns:Word\tReading\tMeaning\tPartOfSpeech\tJLPT\tSourceSentence\tSavedAt\tTags'
]

describe('serializeWordsForAnki', () => {
  it('writes Anki headers and eight stable columns', () => {
    const output = serializeWordsForAnki([makeWord()])
    const lines = output.trimEnd().split('\n')

    expect(lines.slice(0, 4)).toEqual(HEADERS)
    expect(lines[4].split('\t')).toEqual([
      '橋',
      'はし',
      'bridge',
      'noun',
      'N4',
      'あの橋を渡る。',
      '2026-07-12T00:00:00.000Z',
      'manga_learnjp jlpt::N4'
    ])
    expect(output.endsWith('\n')).toBe(true)
  })

  it('uses an unclassified tag when no canonical level exists', () => {
    const output = serializeWordsForAnki([makeWord({ jlpt: undefined })])
    const fields = output.trimEnd().split('\n')[4].split('\t')

    expect(fields[4]).toBe('')
    expect(fields[7]).toBe('manga_learnjp jlpt::unclassified')
  })

  it('preserves Unicode and normalizes tabs and line breaks inside fields', () => {
    const output = serializeWordsForAnki([makeWord({
      meaning: '桥\t梁\r\nbridge',
      sourceSentence: 'あの橋を\n渡る。'
    })])
    const fields = output.trimEnd().split('\n')[4].split('\t')

    expect(fields[2]).toBe('桥 梁 bridge')
    expect(fields[5]).toBe('あの橋を 渡る。')
    expect(fields).toHaveLength(8)
  })

  it('emits only headers for an empty word bank', () => {
    expect(serializeWordsForAnki([])).toBe(`${HEADERS.join('\n')}\n`)
  })

  it('is deterministic and does not mutate input words', () => {
    const words = [makeWord(), makeWord({ word: '猫', reading: 'ねこ' })]
    const snapshot = structuredClone(words)

    expect(serializeWordsForAnki(words)).toBe(serializeWordsForAnki(words))
    expect(words).toEqual(snapshot)
  })
})
