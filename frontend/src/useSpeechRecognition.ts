import { useEffect, useRef, useState } from 'react'

interface SpeechRecognitionEventLike extends Event {
  results: {
    length: number
    [index: number]: {
      0: { transcript: string }
      isFinal: boolean
    }
  }
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export function useSpeechRecognition(onTranscript: (text: string) => void) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)
  const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition

  useEffect(() => {
    if (!Recognition) return

    const recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      let transcript = ''
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript
      }
      onTranscript(transcript.trim())
    }
    recognition.onerror = (event) => {
      setSpeechError(`Speech input stopped: ${event.error}`)
      setIsListening(false)
    }
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition

    return () => recognition.stop()
  }, [Recognition, onTranscript])

  function toggleListening() {
    setSpeechError(null)
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    } else {
      recognitionRef.current?.start()
      setIsListening(true)
    }
  }

  return {
    isListening,
    speechError,
    speechSupported: Boolean(Recognition),
    toggleListening,
  }
}
