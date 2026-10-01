import type {
  GoogleCalendarEventReference,
  ManualCalendarEventInput,
  ScheduleProposal,
} from './types'

const GOOGLE_CALENDAR_EVENTS_URL =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events'

interface GoogleCalendarEventDraft {
  allDay: boolean
  date: string
  description?: string
  endTime?: string
  startTime?: string
  title: string
}

interface GoogleCalendarApiError {
  error?: {
    message?: string
  }
}

export class GoogleCalendarRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'GoogleCalendarRequestError'
  }
}

export async function createManualGoogleCalendarEvent(
  accessToken: string,
  event: ManualCalendarEventInput,
): Promise<GoogleCalendarEventReference> {
  return createGoogleCalendarEvent(accessToken, {
    allDay: event.allDay,
    date: event.date,
    description: event.description.trim() || undefined,
    endTime: event.endTime,
    startTime: event.startTime,
    title: event.title.trim(),
  })
}

export async function createScheduleGoogleCalendarEvents(
  accessToken: string,
  proposal: ScheduleProposal,
): Promise<GoogleCalendarEventReference[]> {
  const drafts: GoogleCalendarEventDraft[] = [
    {
      allDay: true,
      date: proposal.final_due_date,
      description: 'Final due date created by AI Calendar.',
      title: `Due: ${proposal.assignment_title}`,
    },
    ...proposal.events.map((event) => ({
      allDay: true,
      date: event.date,
      description: event.description,
      title: event.title,
    })),
  ]

  const created: GoogleCalendarEventReference[] = []
  try {
    for (const draft of drafts) {
      created.push(await createGoogleCalendarEvent(accessToken, draft))
    }
    return created
  } catch (error) {
    await deleteGoogleCalendarEvents(accessToken, created)
    throw error
  }
}

export async function deleteGoogleCalendarEvents(
  accessToken: string,
  events: GoogleCalendarEventReference[],
): Promise<void> {
  await Promise.allSettled(
    events.map((event) =>
      fetch(`${GOOGLE_CALENDAR_EVENTS_URL}/${encodeURIComponent(event.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ),
  )
}

export function getGoogleCalendarErrorMessage(error: unknown): string {
  if (error instanceof GoogleCalendarRequestError) {
    if (error.status === 401) {
      return 'Your Google Calendar connection expired. Reconnect it and try again.'
    }
    if (error.status === 403) {
      return 'Google Calendar access was denied. Enable the Calendar API and approve event access.'
    }
    return error.message
  }
  if (error instanceof Error && error.message) return error.message
  return 'Google Calendar could not save this event. Please try again.'
}

async function createGoogleCalendarEvent(
  accessToken: string,
  draft: GoogleCalendarEventDraft,
): Promise<GoogleCalendarEventReference> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const resource = draft.allDay
    ? {
        summary: draft.title,
        description: draft.description,
        start: { date: draft.date },
        end: { date: addDays(draft.date, 1) },
      }
    : {
        summary: draft.title,
        description: draft.description,
        start: {
          dateTime: toIsoDateTime(draft.date, draft.startTime),
          timeZone,
        },
        end: {
          dateTime: toIsoDateTime(draft.date, draft.endTime),
          timeZone,
        },
      }

  const response = await fetch(GOOGLE_CALENDAR_EVENTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(resource),
  })

  if (!response.ok) {
    let message = 'Google Calendar could not save this event.'
    try {
      const payload = (await response.json()) as GoogleCalendarApiError
      if (payload.error?.message) message = payload.error.message
    } catch {
      // Google occasionally returns an empty response for authorization errors.
    }
    throw new GoogleCalendarRequestError(message, response.status)
  }

  const event = (await response.json()) as { id?: string; htmlLink?: string }
  if (!event.id) {
    throw new GoogleCalendarRequestError(
      'Google Calendar returned an event without an ID.',
      response.status,
    )
  }
  return { id: event.id, htmlLink: event.htmlLink }
}

function toIsoDateTime(date: string, time?: string): string {
  if (!time) throw new Error('Choose a start and end time for this event.')
  return new Date(`${date}T${time}:00`).toISOString()
}

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + amount)
  return value.toISOString().slice(0, 10)
}
