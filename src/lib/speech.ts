// Pure helpers for picking a SpeechSynthesisVoice by language. Lives in lib/
// (not in the hook) so it can be unit-tested without a DOM, matching the
// mokuro-keyboard-nav / useMokuroKeyboardNav split.

export interface SpeechVoiceLike {
  lang: string
  voiceURI?: string
  name?: string
  localService?: boolean
  default?: boolean
}

export interface SpeechVoiceOption<T extends SpeechVoiceLike> extends SpeechVoiceLike {
  id: string
  label: string
  voice: T
  voiceURI: string
}

const isJapaneseVoice = (voice: SpeechVoiceLike): boolean => {
  return voice.lang.toLowerCase().split('-')[0] === 'ja'
}

const NON_FALLBACK_FAILURES = new Set([
  'canceled',
  'interrupted',
  'audio-busy',
  'audio-hardware',
  'synthesis-unavailable',
  'text-too-long',
  'invalid-argument',
  'not-allowed'
])

// Pick the best voice for a BCP-47 language tag (e.g. 'ja-JP'). Prefers an
// exact, case-insensitive match, then any voice sharing the same primary
// subtag ('ja'). Returns null when no voice covers the language — callers
// should prompt the user to install one rather than fall back to an unrelated
// voice that would mispronounce the text.
export const selectVoice = <T extends SpeechVoiceLike>(
  voices: T[],
  lang: string
): T | null => {
  if (voices.length === 0) return null

  const target = lang.toLowerCase()
  const exact = voices.find(voice => voice.lang.toLowerCase() === target)
  if (exact) return exact

  const primary = target.split('-')[0]
  return voices.find(voice => voice.lang.toLowerCase().split('-')[0] === primary) ?? null
}

// True when at least one installed voice can speak the given language.
export const hasVoiceForLang = <T extends SpeechVoiceLike>(
  voices: T[],
  lang: string
): boolean => selectVoice(voices, lang) !== null

export const getJapaneseVoices = <T extends SpeechVoiceLike>(voices: T[]): T[] => {
  return voices.filter(isJapaneseVoice)
}

export const getCandidateVoiceOptions = <T extends SpeechVoiceLike>(
  voices: T[],
  unavailableVoiceIds: Set<string>
): SpeechVoiceOption<T>[] => {
  const japaneseVoices = getJapaneseVoices(voices).filter(
    (voice): voice is T & { voiceURI: string } => Boolean(voice.voiceURI?.trim())
  )
  const labelTotals = new Map<string, number>()
  japaneseVoices.forEach(voice => {
    const label = voice.name?.trim() || voice.voiceURI
    labelTotals.set(label, (labelTotals.get(label) ?? 0) + 1)
  })

  const fingerprintOccurrences = new Map<string, number>()
  const labelOccurrences = new Map<string, number>()
  return japaneseVoices.map(voice => {
    const voiceURI = voice.voiceURI
    const label = voice.name?.trim() || voiceURI
    const fingerprint = JSON.stringify([
      voiceURI,
      voice.name ?? '',
      voice.lang,
      voice.localService ?? null,
      voice.default ?? null
    ])
    const fingerprintOccurrence = fingerprintOccurrences.get(fingerprint) ?? 0
    const labelOccurrence = labelOccurrences.get(label) ?? 0
    fingerprintOccurrences.set(fingerprint, fingerprintOccurrence + 1)
    labelOccurrences.set(label, labelOccurrence + 1)

    return {
      id: `${fingerprint}#${fingerprintOccurrence}`,
      label: (labelTotals.get(label) ?? 0) > 1 ? `${label} (${labelOccurrence + 1})` : label,
      voice,
      voiceURI,
      lang: voice.lang
    }
  }).filter(option => !unavailableVoiceIds.has(option.id))
}

export const orderSpeechCandidates = <T extends SpeechVoiceLike>(
  voices: T[],
  preferredVoiceId: string | null,
  verifiedVoiceIds: Set<string>,
  lang: string
): T[] => {
  const ordered: T[] = []
  const seen = new Set<string>()
  const getVoiceId = (voice: T): string | undefined => {
    if ('id' in voice && typeof voice.id === 'string') return voice.id
    return voice.voiceURI
  }
  const add = (voice: T | null) => {
    if (!voice) return
    const voiceId = getVoiceId(voice)
    if (!voiceId || seen.has(voiceId)) return
    seen.add(voiceId)
    ordered.push(voice)
  }

  add(preferredVoiceId
    ? voices.find(voice => getVoiceId(voice) === preferredVoiceId) ?? null
    : null)

  const verified = voices.filter(voice => {
    const voiceId = getVoiceId(voice)
    return voiceId !== undefined && verifiedVoiceIds.has(voiceId)
  })
  add(selectVoice(verified, lang))
  verified.forEach(add)
  voices.forEach(add)
  return ordered
}

export const isSpeechCancellation = (reason: string | undefined): boolean => {
  return reason === 'canceled' || reason === 'interrupted'
}

export const shouldProcessSpeechError = (attemptSettled: boolean): boolean => {
  return !attemptSettled
}

export const getSpeechErrorPolicy = (
  attemptSettled: boolean,
  volume: number
): { process: boolean; stopSpeaking: boolean } => {
  const process = shouldProcessSpeechError(attemptSettled)
  return {
    process,
    stopSpeaking: process && volume > 0
  }
}

export const shouldRemoveVoice = (reason: string | undefined): boolean => {
  return reason === 'voice-unavailable' || reason === 'language-unavailable'
}

export const shouldTrySpeechFallback = (reason: string | undefined): boolean => {
  if (!reason) return false
  return !NON_FALLBACK_FAILURES.has(reason)
}
