'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getCandidateVoiceOptions,
  getSpeechErrorPolicy,
  orderSpeechCandidates,
  shouldRemoveVoice,
  shouldTrySpeechFallback
} from '@/lib/speech'
import type { SpeechVoiceOption } from '@/lib/speech'

const SPEECH_START_TIMEOUT_MS = 5000
const VOICE_VALIDATION_TEXT = 'あ'

interface UseSpeechOptions {
  lang?: string
  rate?: number
  voiceId?: string | null
}

export interface SpeechAttemptResult {
  started: boolean
  reason?: string
}

interface UseSpeechReturn {
  supported: boolean
  ready: boolean
  speaking: boolean
  voices: SpeechSynthesisVoice[]
  candidateVoices: SpeechVoiceOption<SpeechSynthesisVoice>[]
  validatingVoiceId: string | null
  validateVoice: (voiceId: string) => Promise<SpeechAttemptResult>
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
  voiceId = null
}: UseSpeechOptions = {}): UseSpeechReturn => {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [candidateVoices, setCandidateVoices] = useState<SpeechVoiceOption<SpeechSynthesisVoice>[]>([])
  const [speaking, setSpeaking] = useState(false)
  const [validatingVoiceId, setValidatingVoiceId] = useState<string | null>(null)
  const langRef = useRef(lang)
  const rateRef = useRef(rate)
  const voiceIdRef = useRef(voiceId)
  const validatingVoiceIdRef = useRef<string | null>(null)
  const verifiedVoiceIdsRef = useRef(new Set<string>())
  const unavailableVoiceIdsRef = useRef(new Set<string>())
  const activeAttemptRef = useRef<ActiveSpeechAttempt | null>(null)

  useEffect(() => {
    langRef.current = lang
    rateRef.current = rate
    voiceIdRef.current = voiceId
  }, [lang, rate, voiceId])

  const refreshCandidateVoices = useCallback((nextVoices: SpeechSynthesisVoice[]) => {
    setCandidateVoices(getCandidateVoiceOptions(nextVoices, unavailableVoiceIdsRef.current))
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

  const markVoiceUnavailable = useCallback((voiceIdToRemove: string, nextVoices = voices) => {
    unavailableVoiceIdsRef.current.add(voiceIdToRemove)
    verifiedVoiceIdsRef.current.delete(voiceIdToRemove)
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
      try {
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
          const errorPolicy = getSpeechErrorPolicy(settled, volume)
          if (!errorPolicy.process) return
          if (errorPolicy.stopSpeaking) setSpeaking(false)
          const reason = event.error
          onFailure?.(reason)
          if (!started) finish({ started: false, reason })
        }
        synth.speak(utterance)
      } catch {
        finish({ started: false, reason: 'synthesis-failed' })
      }
    })
  }, [finishActiveAttempt])

  const validateVoice = useCallback(async (voiceIdToValidate: string): Promise<SpeechAttemptResult> => {
    if (!supported) return { started: false, reason: 'unsupported' }
    if (validatingVoiceIdRef.current) {
      return { started: false, reason: 'validation-in-progress' }
    }
    const option = getCandidateVoiceOptions(voices, unavailableVoiceIdsRef.current)
      .find(candidate => candidate.id === voiceIdToValidate)
    if (!option) return { started: false, reason: 'voice-unavailable' }

    validatingVoiceIdRef.current = voiceIdToValidate
    setValidatingVoiceId(voiceIdToValidate)
    try {
      const result = await speakWithVoice(option.voice, VOICE_VALIDATION_TEXT, 0, reason => {
        if (shouldRemoveVoice(reason)) markVoiceUnavailable(option.id)
      })
      if (result.started) verifiedVoiceIdsRef.current.add(option.id)
      return result
    } finally {
      if (validatingVoiceIdRef.current === voiceIdToValidate) {
        validatingVoiceIdRef.current = null
        setValidatingVoiceId(null)
      }
    }
  }, [markVoiceUnavailable, speakWithVoice, supported, voices])

  const speak = useCallback(async (text: string): Promise<SpeechAttemptResult> => {
    if (!supported) return { started: false, reason: 'unsupported' }
    if (!text.trim()) return { started: false, reason: 'empty-text' }

    const candidates = getCandidateVoiceOptions(voices, unavailableVoiceIdsRef.current)
    const ordered = orderSpeechCandidates(
      candidates,
      voiceIdRef.current,
      verifiedVoiceIdsRef.current,
      langRef.current
    )
    if (ordered.length === 0) return { started: false, reason: 'no-voice' }
    let lastResult: SpeechAttemptResult = { started: false }

    for (const candidate of ordered) {
      const result = await speakWithVoice(candidate.voice, text, 1, reason => {
        if (shouldRemoveVoice(reason)) markVoiceUnavailable(candidate.id)
      })
      if (result.started) {
        verifiedVoiceIdsRef.current.add(candidate.id)
        return result
      }
      if (!shouldTrySpeechFallback(result.reason)) return result
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
    validatingVoiceId,
    validateVoice,
    speak,
    cancel
  }
}
