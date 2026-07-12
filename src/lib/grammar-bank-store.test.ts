import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { migrateGrammarBankState, useGrammarBankStore } from './grammar-bank-store'
import { savedGrammarKey, toSavedGrammar } from './grammar-bank'
import type { GrammarPattern } from './types'

const grammar: GrammarPattern = {
  pattern: '〜に違いない',
  explanation: 'must be',
  example: '彼は来るに違いない。'
}

const entry = toSavedGrammar(grammar, '彼は来るに違いない。', 'en', '2026-07-12T00:00:00.000Z')
const key = savedGrammarKey(grammar.pattern)

describe('grammar bank store', () => {
  beforeEach(() => {
    useGrammarBankStore.setState({ grammars: [] })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('drops malformed persisted grammar while preserving valid entries', () => {
    expect(migrateGrammarBankState({
      grammars: [
        entry,
        { ...entry, pattern: '～に違いない', explanation: 'replacement' },
        { ...entry, pattern: '  ', savedAt: 'not-a-date' },
        { ...entry, pattern: '〜はずだ', language: 'fr' }
      ]
    })).toEqual({ grammars: [entry] })
  })

  it('persists grammar independently from the word bank state', async () => {
    await useGrammarBankStore.getState().addGrammar(entry)

    expect(useGrammarBankStore.getState().isSaved(grammar.pattern)).toBe(true)
    expect(useGrammarBankStore.getState().grammars).toEqual([entry])
  })

  it('removes and clears only grammar entries', async () => {
    useGrammarBankStore.setState({ grammars: [entry] })

    await useGrammarBankStore.getState().removeGrammar(grammar.pattern)
    expect(useGrammarBankStore.getState().grammars).toEqual([])

    await useGrammarBankStore.getState().addGrammar(entry)
    await useGrammarBankStore.getState().clearAll()
    expect(useGrammarBankStore.getState().grammars).toEqual([])
  })

  it('keeps memory unchanged when local storage rejects a write', async () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => { throw new Error('quota exceeded') }
      }
    })

    await expect(useGrammarBankStore.getState().addGrammar(entry)).rejects.toThrow('quota exceeded')
    expect(useGrammarBankStore.getState().grammars).toEqual([])
    expect(useGrammarBankStore.getState().grammars.find(item => savedGrammarKey(item.pattern) === key)).toBeUndefined()
  })

  it('recovers from malformed storage JSON on the next successful write', async () => {
    const setItem = vi.fn()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => '{',
        setItem
      }
    })

    await useGrammarBankStore.getState().addGrammar(entry)

    expect(useGrammarBankStore.getState().grammars).toEqual([entry])
    expect(setItem).toHaveBeenCalledWith('grammar-bank-storage', expect.stringContaining('〜に違いない'))
  })
})
