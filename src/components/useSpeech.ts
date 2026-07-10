'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getJapaneseVoices,
  getVerifiedVoices,
  isSpeechFailure,
  selectFallbackVoice
} from '@/lib/speech'

const SPEECH_START_TIMEOUT_MS = 5000
const VOICE_VALIDATION_TEXT = 'あ'

interface UseSpeechOptions {
  lang?: string
  rate?: number
  voiceURI?: string | null
}

interface SpeechAttemptResult {
  started: boolean
  reason?: string
}

interface UseSpeechReturn {
  supported: boolean
  ready: boolean
  speaking: boolean
  voices: SpeechSynthesisVoice[]
  verifiedVoices: SpeechSynthesisVoice[]
  isVerifying: boolean
  verifyVoices: () => Promise<void>
  speak: (text: string) => Promise<SpeechAttemptResult>
  cancel: () => void
}

interface ActiveSpeechAttempt {
  finish: (result: SpeechAttemptResult) => void
}

// Browser-provided voice registration is not evidence that an online or local
// voice can synthesize right now. This hook makes verification explicit and
// exposes only voices that started a real utterance during the current session.
export const useSpeech = ({
  lang = 'ja-JP',
  rate = 0.9,
  voiceURI = null
}: UseSpeechOptions = {}): UseSpeechReturn => {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [verifiedVoices, setVerifiedVoices] = useState<SpeechSynthesisVoice[]>([])
  const [speaking, setSpeaking] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const langRef = useRef(lang)
  const rateRef = useRef(rate)
  const voiceURIRef = useRef(voiceURI)
  const verifiedVoiceURIsRef = useRef(new Set<string>())
  const unavailableVoiceURIsRef = useRef(new Set<string>())
  const isVerifyingRef = useRef(false)
  const activeAttemptRef = useRef<ActiveSpeechAttempt | null>(null)

  useEffect(() => {
    langRef.current = lang
    rateRef.current = rate
    voiceURIRef.current = voiceURI
  }, [lang, rate, voiceURI])

  const refreshVerifiedVoices = useCallback((nextVoices: SpeechSynthesisVoice[]) => {
    setVerifiedVoices(getVerifiedVoices(
      nextVoices,
      verifiedVoiceURIsRef.current,
      unavailableVoiceURIsRef.current
    ))
  }, [])

  const finishActiveAttempt = useCallback((result: SpeechAttemptResult) => {
    activeAttemptRef.current?.finish(result)
  }, [])

  useEffect(() => {
    if (!supported) return
    const synth = window.speechSynthesis
    const load = () => {
      const nextVoices = synth.getVoices()
      setVoices(nextVoices)
      refreshVerifiedVoices(nextVoices)
    }
    load()
    synth.addEventListener('voiceschanged', load)
    return () => synth.removeEventListener('voiceschanged', load)
  }, [refreshVerifiedVoices, supported])

  const markVoiceUnavailable = useCallback((voiceURIToRemove: string, nextVoices = voices) => {
    unavailableVoiceURIsRef.current.add(voiceURIToRemove)
    verifiedVoiceURIsRef.current.delete(voiceURIToRemove)
    refreshVerifiedVoices(nextVoices)
  }, [refreshVerifiedVoices, voices])

  const speakWithVoice = useCallback((
    voice: SpeechSynthesisVoice,
    text: string,
    volume: number,
    onFailure?: (reason: string) => void
  ): Promise<SpeechAttemptResult> => {
    const synth = window.speechSynthesis
    finishActiveAttempt({ started: false, reason: 'canceled' })
    synth.cancel()

    return new Promise(resolve => {
      let settled = false
      let started = false
      const timeout = window.setTimeout(() => {
        synth.cancel()
        finish({ started: false, reason: 'timeout' })
      }, SPEECH_START_TIMEOUT_MS)

      const finish = (result: SpeechAttemptResult) => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        if (activeAttemptRef.current?.finish === finish) {
          activeAttemptRef.current = null
        }
        resolve(result)
      }

      activeAttemptRef.current = { finish }
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = voice.lang
      utterance.voice = voice
      utterance.rate = rateRef.current
      utterance.volume = volume
      utterance.onstart = () => {
        started = true
        if (volume > 0) setSpeaking(true)
        finish({ started: true })
      }
      utterance.onend = () => {
        if (volume > 0) setSpeaking(false)
        if (!started) finish({ started: false, reason: 'ended-before-start' })
      }
      utterance.onerror = event => {
        if (volume > 0) setSpeaking(false)
        const reason = event.error
        if (isSpeechFailure(reason)) onFailure?.(reason)
        if (!started) finish({ started: false, reason })
      }
      synth.speak(utterance)
    })
  }, [finishActiveAttempt])

  const verifyVoices = useCallback(async (): Promise<void> => {
    if (!supported || isVerifyingRef.current) return

    isVerifyingRef.current = true
    setIsVerifying(true)
    const candidates = getJapaneseVoices(voices)
      .filter(voice => !unavailableVoiceURIsRef.current.has(voice.voiceURI))

    for (const voice of candidates) {
      const result = await speakWithVoice(voice, VOICE_VALIDATION_TEXT, 0)
      if (result.started) {
        verifiedVoiceURIsRef.current.add(voice.voiceURI)
      } else if (isSpeechFailure(result.reason)) {
        unavailableVoiceURIsRef.current.add(voice.voiceURI)
        verifiedVoiceURIsRef.current.delete(voice.voiceURI)
      }
    }

    refreshVerifiedVoices(voices)
    isVerifyingRef.current = false
    setIsVerifying(false)
  }, [refreshVerifiedVoices, speakWithVoice, supported, voices])

  const speak = useCallback(async (text: string): Promise<SpeechAttemptResult> => {
    if (!supported || !text.trim()) return { started: false }

    const availableVoices = getVerifiedVoices(
      voices,
      verifiedVoiceURIsRef.current,
      unavailableVoiceURIsRef.current
    )
    const voice = selectFallbackVoice(availableVoices, voiceURIRef.current, langRef.current)
    if (!voice) return { started: false }

    const attempt = async (candidate: SpeechSynthesisVoice): Promise<SpeechAttemptResult> => {
      const result = await speakWithVoice(candidate, text, 1, reason => {
        markVoiceUnavailable(candidate.voiceURI)
      })
      if (result.started || !isSpeechFailure(result.reason)) return result

      markVoiceUnavailable(candidate.voiceURI)
      const fallback = selectFallbackVoice(
        getVerifiedVoices(voices, verifiedVoiceURIsRef.current, unavailableVoiceURIsRef.current),
        null,
        langRef.current
      )
      return fallback ? speakWithVoice(fallback, text, 1, reason => {
        markVoiceUnavailable(fallback.voiceURI)
      }) : result
    }

    return attempt(voice)
  }, [markVoiceUnavailable, speakWithVoice, supported, voices])

  const cancel = useCallback((): void => {
    if (!supported) return
    finishActiveAttempt({ started: false, reason: 'canceled' })
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [finishActiveAttempt, supported])

  useEffect(() => {
    if (!supported) return
    return () => cancel()
  }, [cancel, supported])

  return {
    supported,
    ready: voices.length > 0,
    speaking,
    voices,
    verifiedVoices,
    isVerifying,
    verifyVoices,
    speak,
    cancel
  }
}
