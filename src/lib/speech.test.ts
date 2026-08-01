import { describe, expect, it } from 'vitest'
import {
  getCandidateVoiceOptions,
  getSpeechErrorPolicy,
  getJapaneseVoices,
  hasVoiceForLang,
  isSpeechCancellation,
  orderSpeechCandidates,
  selectVoice,
  shouldProcessSpeechError,
  shouldRemoveVoice,
  shouldTrySpeechFallback
} from './speech'
import type { SpeechVoiceLike } from './speech'

const voice = (lang: string): SpeechVoiceLike => ({ lang })
const namedVoice = (voiceURI: string, lang: string): SpeechVoiceLike => ({ voiceURI, lang })

describe('selectVoice', () => {
  it('returns null for an empty voice list', () => {
    expect(selectVoice([], 'ja-JP')).toBeNull()
  })

  it('matches an exact lang tag case-insensitively', () => {
    const jaVoice = voice('ja-JP')
    expect(selectVoice([voice('en-US'), jaVoice], 'JA-jp')).toBe(jaVoice)
  })

  it('matches by primary subtag when no exact match exists', () => {
    const jaVoice = voice('ja-JP')
    expect(selectVoice([voice('en-US'), jaVoice], 'ja')).toBe(jaVoice)
  })

  it('matches a voice with only the primary subtag', () => {
    const jaVoice = voice('ja')
    expect(selectVoice([voice('en'), jaVoice], 'ja-JP')).toBe(jaVoice)
  })

  it('returns the first matching voice when several exist', () => {
    const ayumi = voice('ja-JP')
    const haruka = voice('ja-JP')
    expect(selectVoice([ayumi, haruka], 'ja-JP')).toBe(ayumi)
  })

  it('returns null when no voice covers the language', () => {
    expect(selectVoice([voice('en-US'), voice('zh-CN')], 'ja-JP')).toBeNull()
  })

  it('does not fall back to an unrelated default voice', () => {
    const defaultVoice = { lang: 'en-US', default: true }
    expect(selectVoice([defaultVoice], 'ja-JP')).toBeNull()
  })
})

describe('hasVoiceForLang', () => {
  it('is true when a matching voice exists', () => {
    expect(hasVoiceForLang([voice('en-US'), voice('ja-JP')], 'ja-JP')).toBe(true)
  })

  it('is false when no matching voice exists', () => {
    expect(hasVoiceForLang([voice('en-US'), voice('zh-CN')], 'ja-JP')).toBe(false)
  })

  it('is false for an empty voice list', () => {
    expect(hasVoiceForLang([], 'ja-JP')).toBe(false)
  })
})

describe('verified Japanese voices', () => {
  const ayumi = namedVoice('ja-ayumi', 'ja-JP')
  const haruka = namedVoice('ja-haruka', 'ja-JP')
  const english = namedVoice('en-ava', 'en-US')

  it('keeps only Japanese voice candidates', () => {
    expect(getJapaneseVoices([english, ayumi, haruka])).toEqual([ayumi, haruka])
  })

})

describe('speech failure policy', () => {
  it('ignores errors that arrive after a speech attempt has settled', () => {
    expect(shouldProcessSpeechError(false)).toBe(true)
    expect(shouldProcessSpeechError(true)).toBe(false)
  })

  it('does not update speaking state for an error from a settled attempt', () => {
    expect(getSpeechErrorPolicy(true, 1)).toEqual({
      process: false,
      stopSpeaking: false
    })
    expect(getSpeechErrorPolicy(false, 1)).toEqual({
      process: true,
      stopSpeaking: true
    })
    expect(getSpeechErrorPolicy(false, 0)).toEqual({
      process: true,
      stopSpeaking: false
    })
  })

  it('recognizes only deliberate cancellation reasons as cancellation', () => {
    expect(isSpeechCancellation('canceled')).toBe(true)
    expect(isSpeechCancellation('interrupted')).toBe(true)
    expect(isSpeechCancellation('network')).toBe(false)
  })

  it('removes only failures that prove the selected voice is unavailable', () => {
    expect(shouldRemoveVoice('voice-unavailable')).toBe(true)
    expect(shouldRemoveVoice('language-unavailable')).toBe(true)
    expect(shouldRemoveVoice('network')).toBe(false)
    expect(shouldRemoveVoice('audio-busy')).toBe(false)
    expect(shouldRemoveVoice('not-allowed')).toBe(false)
    expect(shouldRemoveVoice('timeout')).toBe(false)
  })

  it('falls back only when another voice could reasonably succeed', () => {
    expect(shouldTrySpeechFallback('voice-unavailable')).toBe(true)
    expect(shouldTrySpeechFallback('network')).toBe(true)
    expect(shouldTrySpeechFallback('synthesis-failed')).toBe(true)
    expect(shouldTrySpeechFallback('timeout')).toBe(true)
    expect(shouldTrySpeechFallback('audio-busy')).toBe(false)
    expect(shouldTrySpeechFallback('audio-hardware')).toBe(false)
    expect(shouldTrySpeechFallback('synthesis-unavailable')).toBe(false)
    expect(shouldTrySpeechFallback('not-allowed')).toBe(false)
    expect(shouldTrySpeechFallback('canceled')).toBe(false)
  })
})

describe('lazy voice candidates', () => {
  const ayumi = namedVoice('ja-ayumi', 'ja-JP')
  const haruka = namedVoice('ja-haruka', 'ja-JP')
  const kyoko = namedVoice('ja-kyoko', 'ja')
  const english = namedVoice('en-ava', 'en-US')

  it('excludes candidates with a blank voice URI', () => {
    expect(getCandidateVoiceOptions(
      [namedVoice('', 'ja-JP'), namedVoice('   ', 'ja-JP'), ayumi],
      new Set()
    ).map(option => option.voice)).toEqual([ayumi])
  })

  it('keeps voices with the same URI independently available', () => {
    const goodVoice = { voiceURI: 'shared-edge-uri', name: 'Working Natural', lang: 'ja-JP' }
    const badVoice = { voiceURI: 'shared-edge-uri', name: 'Broken Natural', lang: 'ja-JP' }
    const options = getCandidateVoiceOptions([goodVoice, badVoice], new Set())

    expect(options.map(option => option.voice)).toEqual([goodVoice, badVoice])
    expect(new Set(options.map(option => option.id)).size).toBe(2)
    expect(getCandidateVoiceOptions(
      [goodVoice, badVoice],
      new Set([options[1].id])
    ).map(option => option.voice)).toEqual([goodVoice])
  })

  it('labels otherwise identical voices separately', () => {
    const duplicateA = { voiceURI: 'same', name: 'Microsoft Natural', lang: 'ja-JP' }
    const duplicateB = { voiceURI: 'same', name: 'Microsoft Natural', lang: 'ja-JP' }
    const options = getCandidateVoiceOptions(
      [duplicateA, duplicateB, { voiceURI: '', name: 'Blank', lang: 'ja-JP' }],
      new Set()
    )

    expect(options.map(option => option.label)).toEqual([
      'Microsoft Natural (1)',
      'Microsoft Natural (2)'
    ])
    expect(new Set(options.map(option => option.id)).size).toBe(2)
  })

  it('orders same-URI options by their independent IDs', () => {
    const firstVoice = { voiceURI: 'shared', name: 'First', lang: 'ja-JP' }
    const secondVoice = { voiceURI: 'shared', name: 'Second', lang: 'ja-JP' }
    const options = getCandidateVoiceOptions([firstVoice, secondVoice], new Set())

    expect(orderSpeechCandidates(
      options,
      options[1].id,
      new Set([options[0].id]),
      'ja-JP'
    )).toEqual([options[1], options[0]])
  })

  it('orders a preferred voice before verified and remaining candidates', () => {
    expect(orderSpeechCandidates(
      [ayumi, haruka, kyoko],
      'ja-haruka',
      new Set(['ja-ayumi']),
      'ja-JP'
    )).toEqual([haruka, ayumi, kyoko])
  })

  it('prefers a verified matching voice when no explicit voice is selected', () => {
    expect(orderSpeechCandidates(
      [ayumi, haruka, kyoko],
      null,
      new Set(['ja-kyoko']),
      'ja-JP'
    )).toEqual([kyoko, ayumi, haruka])
  })
})
