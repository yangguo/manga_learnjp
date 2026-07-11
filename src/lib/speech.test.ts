import { describe, expect, it } from 'vitest'
import {
  getCandidateVoices,
  getJapaneseVoices,
  getVerifiedVoices,
  hasVoiceForLang,
  isSpeechFailure,
  orderSpeechCandidates,
  selectFallbackVoice,
  selectVoice
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

  it('keeps only verified voices that have not failed', () => {
    expect(getVerifiedVoices(
      [english, ayumi, haruka],
      new Set(['ja-ayumi', 'ja-haruka']),
      new Set(['ja-haruka'])
    )).toEqual([ayumi])
  })

  it('does not treat deliberate cancellation as a voice failure', () => {
    expect(isSpeechFailure('canceled')).toBe(false)
    expect(isSpeechFailure('interrupted')).toBe(false)
  })

  it('treats synthesis errors and start timeout as a voice failure', () => {
    expect(isSpeechFailure('voice-unavailable')).toBe(true)
    expect(isSpeechFailure('synthesis-unavailable')).toBe(true)
    expect(isSpeechFailure('timeout')).toBe(true)
  })

  it('keeps the chosen verified voice or falls back to a matching Japanese voice', () => {
    expect(selectFallbackVoice([ayumi, haruka], 'ja-haruka', 'ja-JP')).toBe(haruka)
    expect(selectFallbackVoice([ayumi, haruka], 'missing', 'ja-JP')).toBe(ayumi)
  })
})

describe('lazy voice candidates', () => {
  const ayumi = namedVoice('ja-ayumi', 'ja-JP')
  const haruka = namedVoice('ja-haruka', 'ja-JP')
  const kyoko = namedVoice('ja-kyoko', 'ja')
  const english = namedVoice('en-ava', 'en-US')

  it('shows Japanese candidates without requiring prior verification', () => {
    expect(getCandidateVoices(
      [english, ayumi, haruka],
      new Set(['ja-haruka'])
    )).toEqual([ayumi])
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
