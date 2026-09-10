import axios from 'axios'

import type { CalendarEvent, ScheduleProposal } from './types'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
})

export async function generateSchedule(text: string): Promise<ScheduleProposal> {
  const response = await api.post<ScheduleProposal>('/schedule/generate', { text })
  return response.data
}

export async function commitSchedule(
  proposal: ScheduleProposal,
  rawPrompt: string,
): Promise<void> {
  await api.post('/schedule/commit', { ...proposal, raw_prompt: rawPrompt })
}

export async function fetchEvents(): Promise<CalendarEvent[]> {
  const response = await api.get<CalendarEvent[]>('/events')
  return response.data
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (!error.response) return 'The local API is not responding. Start the FastAPI server.'
  }
  return 'Something went wrong while building the schedule.'
}
