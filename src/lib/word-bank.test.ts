import { describe, expect, it } from 'vitest'
import {
  addWord,
  isSaved,
  removeWord,
  savedWordKey,
  toSavedWord,
  toggleWord
} from './word-bank'
import type { SavedWord, WordAnalysis } from './types'

const baseWord: WordAnalysis = {
  word: '橋',
  reading: 'はし',
  meaning: '桥',
  partOfSpeech: '名词',
  difficulty: 'N3'
}

const makeSaved = (overrides: Partial<SavedWord> = {}): SavedWord => ({
  word: baseWord.word,
  reading: baseWord.reading,
  meaning: baseWord.meaning,
  partOfSpeech: baseWord.partOfSpeech,
  difficulty: baseWord.difficulty,
  sourceSentence: 'あの橋を渡る',
  savedAt: '2026-07-10T00:00:00.000Z',
  ...overrides
})

describe('savedWordKey', () => {
  it('same word + reading -> same key', () => {
    expect(savedWordKey('橋', 'はし')).toBe(savedWordKey('橋', 'はし'))
  })

  it('same word, different reading -> different key (handles homographs)', () => {
    expect(savedWordKey('橋', 'はし')).not.toBe(savedWordKey('橋', 'はしbogus'))
  })

  it('does not collide on concatenation edge cases', () => {
    // 'ab'+'c' vs 'a'+'bc' must NOT share a key
    expect(savedWordKey('ab', 'c')).not.toBe(savedWordKey('a', 'bc'))
  })
})

describe('toSavedWord', () => {
  it('carries WordAnalysis fields and sourceSentence, injects savedAt', () => {
    const saved = toSavedWord(baseWord, 'あの橋を渡る', '2026-07-10T00:00:00.000Z')
    expect(saved).toEqual(makeSaved())
  })

  it('allows null sourceSentence', () => {
    const saved = toSavedWord(baseWord, null, '2026-07-10T00:00:00.000Z')
    expect(saved.sourceSentence).toBeNull()
  })
})

describe('addWord', () => {
  it('prepends a new word', () => {
    const result = addWord([], makeSaved())
    expect(result).toHaveLength(1)
    expect(result[0].word).toBe('橋')
  })

  it('does not duplicate when key already exists', () => {
    const existing = makeSaved()
    const result = addWord([existing], makeSaved({ savedAt: '2026-07-11T00:00:00.000Z' }))
    expect(result).toHaveLength(1)
    expect(result[0].savedAt).toBe('2026-07-10T00:00:00.000Z') // original kept
  })

  it('keeps newer entries toward the front (prepend)', () => {
    const first = makeSaved({ word: '先', reading: 'せん', savedAt: '2026-07-09T00:00:00.000Z' })
    const second = makeSaved({ word: '後', reading: 'ご', savedAt: '2026-07-10T00:00:00.000Z' })
    expect(addWord([first], second)[0].word).toBe('後')
  })
})

describe('removeWord', () => {
  it('removes by word + reading', () => {
    const list = [makeSaved()]
    expect(removeWord(list, '橋', 'はし')).toEqual([])
  })

  it('is a no-op when key absent', () => {
    const list = [makeSaved()]
    expect(removeWord(list, '箸', 'はし')).toEqual(list)
  })
})

describe('toggleWord', () => {
  it('adds when absent', () => {
    const result = toggleWord([], makeSaved())
    expect(result).toHaveLength(1)
  })

  it('removes when present', () => {
    const list = [makeSaved()]
    expect(toggleWord(list, makeSaved())).toEqual([])
  })
})

describe('isSaved', () => {
  it('returns true when present', () => {
    expect(isSaved([makeSaved()], '橋', 'はし')).toBe(true)
  })

  it('returns false when absent', () => {
    expect(isSaved([makeSaved()], '箸', 'はし')).toBe(false)
  })
})
