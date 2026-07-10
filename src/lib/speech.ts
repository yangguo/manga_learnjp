// Pure helpers for picking a SpeechSynthesisVoice by language. Lives in lib/
// (not in the hook) so it can be unit-tested without a DOM, matching the
// mokuro-keyboard-nav / useMokuroKeyboardNav split.

export interface SpeechVoiceLike {
  lang: string
  voiceURI?: string
}

const isJapaneseVoice = (voice: SpeechVoiceLike): boolean => {
  return voice.lang.toLowerCase().split('-')[0] === 'ja'
}

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

export const getVerifiedVoices = <T extends SpeechVoiceLike>(
  voices: T[],
  verifiedVoiceURIs: Set<string>,
  unavailableVoiceURIs: Set<string>
): T[] => {
  return getJapaneseVoices(voices).filter(voice => {
    return Boolean(voice.voiceURI) &&
      verifiedVoiceURIs.has(voice.voiceURI) &&
      !unavailableVoiceURIs.has(voice.voiceURI)
  })
}

export const isSpeechFailure = (reason: string | undefined): boolean => {
  return Boolean(reason) && reason !== 'canceled' && reason !== 'interrupted'
}

export const selectFallbackVoice = <T extends SpeechVoiceLike>(
  voices: T[],
  preferredVoiceURI: string | null,
  lang: string
): T | null => {
  const preferred = preferredVoiceURI
    ? voices.find(voice => voice.voiceURI === preferredVoiceURI) ?? null
    : null

  return preferred ?? selectVoice(voices, lang)
}
