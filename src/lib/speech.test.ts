import { describe, expect, it } from 'vitest'
import { hasVoiceForLang, selectVoice } from './speech'
import type { SpeechVoiceLike } from './speech'

const voice = (lang: string): SpeechVoiceLike => ({ lang })

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
