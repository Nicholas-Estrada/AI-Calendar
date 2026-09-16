import { toCalendarEvent, type StoredEvent } from './calendarStore'
import type { CalendarEvent, ManualCalendarEventInput, ScheduleProposal } from './types'

const storageKey = 'ai-calendar-guest-events-v1'
const changedEvent = 'ai-calendar-guest-events-changed'

interface LocalEvent extends StoredEvent {
  id: string
}

function readEvents(): LocalEvent[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((event): event is LocalEvent =>
      event !== null && typeof event === 'object'
      && typeof event.id === 'string' && typeof event.title === 'string'
      && typeof event.start === 'string' && typeof event.kind === 'string',
    )
  } catch {
    return []
  }
}

function writeEvents(next: LocalEvent[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(next))
    window.dispatchEvent(new Event(changedEvent))
  } catch {
    throw new Error('This browser could not save your guest calendar. Check available storage and try again.')
  }
}

export function subscribeToLocalCalendarEvents(onEvents: (events: CalendarEvent[]) => void): () => void {
  const update = () => onEvents(readEvents().map(({ id, ...data }) => toCalendarEvent(id, data)))
  update()
  window.addEventListener(changedEvent, update)
  window.addEventListener('storage', update)
  return () => {
    window.removeEventListener(changedEvent, update)
    window.removeEventListener('storage', update)
  }
}

export function saveScheduleLocally(proposal: ScheduleProposal, rawPrompt: string): void {
  const assignmentId = crypto.randomUUID()
  const events: LocalEvent[] = [
    {
      id: crypto.randomUUID(),
      allDay: true,
      assignmentId,
      kind: 'deadline',
      source: 'ai',
      start: proposal.final_due_date,
      description: `Submit ${proposal.assignment_title}. ${rawPrompt.trim()}`.slice(0, 1000),
      status: 'PENDING',
      title: `Due: ${proposal.assignment_title}`,
    },
    ...proposal.events.map((milestone) => ({
      id: crypto.randomUUID(),
      allDay: true,
      assignmentId,
      description: milestone.description,
      kind: 'milestone' as const,
      source: 'ai' as const,
      start: milestone.date,
      status: 'PENDING' as const,
      title: milestone.title,
    })),
  ]
  writeEvents([...readEvents(), ...events])
}

export function saveManualEventLocally(event: ManualCalendarEventInput): void {
  const start = event.allDay ? event.date : `${event.date}T${event.startTime}:00`
  const end = event.allDay ? undefined : `${event.date}T${event.endTime}:00`
  writeEvents([...readEvents(), {
    id: crypto.randomUUID(),
    allDay: event.allDay,
    assignmentId: 'manual',
    description: event.description.trim(),
    ...(end ? { end } : {}),
    kind: event.kind,
    source: 'manual',
    start,
    status: 'PENDING',
    title: event.title.trim(),
  }])
}
