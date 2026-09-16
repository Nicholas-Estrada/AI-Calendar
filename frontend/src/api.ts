import axios from 'axios'

import { auth } from './firebase'
import type { ScheduleProposal } from './types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 10_000,
})

api.interceptors.request.use(async (config) => {
  const token = await auth.currentUser?.getIdToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export async function generateSchedule(text: string): Promise<ScheduleProposal> {
  const response = await api.post<ScheduleProposal>(
    '/schedule/generate',
    { text },
    { timeout: 130_000 },
  )
  return response.data
}

export async function transcribeAudio(audio: Blob): Promise<string> {
  const extension = audio.type.includes('mp4') ? 'm4a' : 'webm'
  const form = new FormData()
  form.append('audio', audio, `recording.${extension}`)
  const response = await api.post<{ text: string }>('/transcribe', form, {
    timeout: 180_000,
  })
  return response.data.text
}

export async function getCalendarSubscriptionUrl(): Promise<string> {
  const response = await api.post<{ url: string }>('/calendar/subscription')
  return response.data.url
}

export async function resetCalendarSubscriptionUrl(): Promise<string> {
  const response = await api.post<{ url: string }>('/calendar/subscription/reset')
  return response.data.url
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (!error.response) return 'The local API is not responding. Start the FastAPI server.'
    if (error.response.status >= 500) {
      return 'The local API had an error. Check the FastAPI terminal and try again.'
    }
  }
  return 'Something went wrong. Please try again.'
}
