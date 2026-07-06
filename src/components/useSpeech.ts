'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { selectVoice } from '@/lib/speech'

interface UseSpeechOptions {
  lang?: string
  rate?: number
  voiceURI?: string | null
}

interface UseSpeechReturn {
  supported: boolean
  ready: boolean
  speaking: boolean
  voices: SpeechSynthesisVoice[]
  speak: (text: string) => boolean
  cancel: () => void
}

// Thin React wrapper around the Web Speech API (speechSynthesis). Voices load
// asynchronously (the voiceschanged event), so `ready` flips true once the
// browser has populated the voice list. speak() returns false when no voice
// covers the requested language (or the chosen voiceURI is unavailable), so
// the caller can prompt the user to install one instead of mispronouncing the
// text. Any in-flight utterance is cancelled before the next starts, so
// selecting a new block never queues audio behind the old one. Pass voiceURI
// to pin a specific voice; leave it null to auto-select by lang.
export const useSpeech = ({
  lang = 'ja-JP',
  rate = 0.9,
  voiceURI = null
}: UseSpeechOptions = {}): UseSpeechReturn => {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [speaking, setSpeaking] = useState(false)
  const langRef = useRef(lang)
  const rateRef = useRef(rate)
  const voiceURIRef = useRef(voiceURI)

  useEffect(() => {
    langRef.current = lang
    rateRef.current = rate
    voiceURIRef.current = voiceURI
  }, [lang, rate, voiceURI])

  useEffect(() => {
    if (!supported) return
    const synth = window.speechSynthesis
    const load = () => {
      const next = synth.getVoices()
      if (next.length > 0) setVoices(next)
    }
    load()
    synth.addEventListener('voiceschanged', load)
    return () => synth.removeEventListener('voiceschanged', load)
  }, [supported])

  // Stop any in-flight speech when the reader unmounts so audio does not
  // outlive the component that started it.
  useEffect(() => {
    if (!supported) return
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [supported])

  const speak = useCallback((text: string): boolean => {
    if (!supported || !text.trim()) return false
    const synth = window.speechSynthesis
    const uri = voiceURIRef.current
    const voice = uri
      ? voices.find(candidate => candidate.voiceURI === uri) ?? null
      : selectVoice(voices, langRef.current)
    if (!voice) return false

    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = voice.lang
    utterance.voice = voice
    utterance.rate = rateRef.current
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    synth.speak(utterance)
    return true
  }, [supported, voices])

  const cancel = useCallback((): void => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  return {
    supported,
    ready: voices.length > 0,
    speaking,
    voices,
    speak,
    cancel
  }
}
