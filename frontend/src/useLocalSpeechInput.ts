import { useEffect, useRef, useState } from 'react'

import { getErrorMessage, transcribeAudio } from './api'

export function useLocalSpeechInput(onTranscript: (text: string) => void) {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [isListening, setIsListening] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)
  const speechSupported =
    typeof navigator.mediaDevices?.getUserMedia === 'function' && 'MediaRecorder' in window

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  function releaseMicrophone() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  async function finishRecording(recorder: MediaRecorder) {
    releaseMicrophone()
    setIsListening(false)

    const recording = new Blob(chunksRef.current, {
      type: recorder.mimeType || 'audio/webm',
    })
    if (!recording.size) {
      setSpeechError('The recording was empty. Please try again.')
      return
    }

    setIsTranscribing(true)
    try {
      onTranscript(await transcribeAudio(recording))
    } catch (error) {
      setSpeechError(getErrorMessage(error))
    } finally {
      setIsTranscribing(false)
    }
  }

  async function toggleListening() {
    setSpeechError(null)

    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const preferredType = ['audio/webm;codecs=opus', 'audio/mp4'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      )
      const recorder = new MediaRecorder(
        stream,
        preferredType ? { mimeType: preferredType } : undefined,
      )
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        releaseMicrophone()
        setIsListening(false)
        setSpeechError('The browser could not record audio from this microphone.')
      }
      recorder.onstop = () => void finishRecording(recorder)
      recorder.start()
      setIsListening(true)
    } catch (error) {
      releaseMicrophone()
      const name = error instanceof DOMException ? error.name : ''
      if (name === 'NotAllowedError') {
        setSpeechError('Microphone access is blocked. Allow it for localhost in your browser settings.')
      } else if (name === 'NotFoundError') {
        setSpeechError('No microphone was found on this device.')
      } else {
        setSpeechError('The browser could not start the microphone.')
      }
    }
  }

  return {
    isListening,
    isTranscribing,
    speechError,
    speechSupported,
    toggleListening,
  }
}
