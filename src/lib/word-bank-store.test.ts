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
