'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getCandidateVoices,
  isSpeechFailure,
  orderSpeechCandidates
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
  candidateVoices: SpeechSynthesisVoice[]
  validatingVoiceURI: string | null
  validateVoice: (voiceURI: string) => Promise<boolean>
  speak: (text: string) => Promise<SpeechAttemptResult>
  cancel: () => void
}

interface ActiveSpeechAttempt {
  finish: (result: SpeechAttemptResult) => void
}

// Voice registration only supplies candidates. A voice becomes trusted when a
// selected validation or real reading reaches onstart; failures are removed for
// the current session without making every candidate block first use.
export const useSpeech = ({
  lang = 'ja-JP',
  rate = 0.9,
  voiceURI = null
}: UseSpeechOptions = {}): UseSpeechReturn => {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [candidateVoices, setCandidateVoices] = useState<SpeechSynthesisVoice[]>([])
  const [speaking, setSpeaking] = useState(false)
  const [validatingVoiceURI, setValidatingVoiceURI] = useState<string | null>(null)
  const langRef = useRef(lang)
  const rateRef = useRef(rate)
  const voiceURIRef = useRef(voiceURI)
  const verifiedVoiceURIsRef = useRef(new Set<string>())
  const unavailableVoiceURIsRef = useRef(new Set<string>())
  const activeAttemptRef = useRef<ActiveSpeechAttempt | null>(null)

  useEffect(() => {
    langRef.current = lang
    rateRef.current = rate
    voiceURIRef.current = voiceURI
  }, [lang, rate, voiceURI])

  const refreshCandidateVoices = useCallback((nextVoices: SpeechSynthesisVoice[]) => {
    setCandidateVoices(getCandidateVoices(nextVoices, unavailableVoiceURIsRef.current))
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
      refreshCandidateVoices(nextVoices)
    }
    load()
    synth.addEventListener('voiceschanged', load)
    return () => synth.removeEventListener('voiceschanged', load)
  }, [refreshCandidateVoices, supported])

  const markVoiceUnavailable = useCallback((voiceURIToRemove: string, nextVoices = voices) => {
    unavailableVoiceURIsRef.current.add(voiceURIToRemove)
    verifiedVoiceURIsRef.current.delete(voiceURIToRemove)
    refreshCandidateVoices(nextVoices)
  }, [refreshCandidateVoices, voices])

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
        finish({ started: false, reason: 'timeout' })
        synth.cancel()
      }, SPEECH_START_TIMEOUT_MS)

      const finish = (result: SpeechAttemptResult) => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        if (activeAttemptRef.current?.finish === finish) activeAttemptRef.current = null
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

  const validateVoice = useCallback(async (voiceURIToValidate: string): Promise<boolean> => {
    if (!supported || validatingVoiceURI) return false
    const voice = getCandidateVoices(voices, unavailableVoiceURIsRef.current)
      .find(candidate => candidate.voiceURI === voiceURIToValidate)
    if (!voice) return false

    setValidatingVoiceURI(voiceURIToValidate)
    const result = await speakWithVoice(voice, VOICE_VALIDATION_TEXT, 0, reason => {
      markVoiceUnavailable(voice.voiceURI)
    })
    if (result.started) {
      verifiedVoiceURIsRef.current.add(voice.voiceURI)
    } else if (isSpeechFailure(result.reason)) {
      markVoiceUnavailable(voice.voiceURI)
    }
    setValidatingVoiceURI(null)
    return result.started
  }, [markVoiceUnavailable, speakWithVoice, supported, validatingVoiceURI, voices])

  const speak = useCallback(async (text: string): Promise<SpeechAttemptResult> => {
    if (!supported || !text.trim()) return { started: false }

    const candidates = getCandidateVoices(voices, unavailableVoiceURIsRef.current)
    const ordered = orderSpeechCandidates(
      candidates,
      voiceURIRef.current,
      verifiedVoiceURIsRef.current,
      langRef.current
    )
    let lastResult: SpeechAttemptResult = { started: false }

    for (const candidate of ordered) {
      const result = await speakWithVoice(candidate, text, 1, reason => {
        markVoiceUnavailable(candidate.voiceURI)
      })
      if (result.started) {
        verifiedVoiceURIsRef.current.add(candidate.voiceURI)
        return result
      }
      if (!isSpeechFailure(result.reason)) return result
      markVoiceUnavailable(candidate.voiceURI)
      lastResult = result
    }

    return lastResult
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
    candidateVoices,
    validatingVoiceURI,
    validateVoice,
    speak,
    cancel
  }
}
