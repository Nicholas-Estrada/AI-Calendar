import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'

import { db } from './firebase'
import type {
  CalendarEvent,
  CalendarEventKind,
  GoogleCalendarEventReference,
  ManualCalendarEventInput,
  ScheduleProposal,
} from './types'

export interface StoredEvent {
  allDay?: boolean
  assignmentId: string
  description?: string
  end?: string
  googleEventId?: string
  googleEventUrl?: string
  kind: CalendarEventKind
  source: 'ai' | 'manual'
  start: string
  status: 'PENDING' | 'COMPLETED'
  title: string
}

export function toCalendarEvent(id: string, data: StoredEvent): CalendarEvent {
  const isDeadline = data.kind === 'deadline'
  const isManualEvent = data.kind === 'event'
  return {
    id,
    title: data.title,
    start: data.start,
    end: data.end,
    allDay: data.allDay ?? true,
    backgroundColor: isDeadline ? '#ef4444' : isManualEvent ? '#164e63' : '#eab308',
    borderColor: isDeadline ? '#dc2626' : isManualEvent ? '#0d3848' : '#ca8a04',
    extendedProps: {
      kind: data.kind,
      assignmentId: data.assignmentId,
      description: data.description,
      googleEventId: data.googleEventId,
      googleEventUrl: data.googleEventUrl,
      status: data.status,
    },
  }
}

export function subscribeToCalendarEvents(
  uid: string,
  onEvents: (events: CalendarEvent[]) => void,
  onError: (message: string) => void,
): Unsubscribe {
  const eventsQuery = query(collection(db, 'users', uid, 'events'), orderBy('start', 'asc'))
  return onSnapshot(
    eventsQuery,
    (snapshot) => {
      onEvents(
        snapshot.docs.map((eventDocument) =>
          toCalendarEvent(eventDocument.id, eventDocument.data() as StoredEvent),
        ),
      )
    },
    () => onError('Your calendar could not sync. Check the Firestore setup and try again.'),
  )
}

export async function saveScheduleToFirestore(
  uid: string,
  proposal: ScheduleProposal,
  rawPrompt: string,
  googleEvents: GoogleCalendarEventReference[] = [],
): Promise<void> {
  const batch = writeBatch(db)
  const assignmentRef = doc(collection(db, 'users', uid, 'assignments'))

  batch.set(assignmentRef, {
    title: proposal.assignment_title,
    finalDueDate: proposal.final_due_date,
    rawPrompt,
    source: 'ai',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  const deadlineRef = doc(collection(db, 'users', uid, 'events'))
  batch.set(deadlineRef, {
    assignmentId: assignmentRef.id,
    kind: 'deadline',
    source: 'ai',
    start: proposal.final_due_date,
    status: 'PENDING',
    title: `Due: ${proposal.assignment_title}`,
    ...googleEventFields(googleEvents[0]),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  proposal.events.forEach((milestone, index) => {
    const eventRef = doc(collection(db, 'users', uid, 'events'))
    batch.set(eventRef, {
      assignmentId: assignmentRef.id,
      description: milestone.description,
      kind: 'milestone',
      source: 'ai',
      start: milestone.date,
      status: 'PENDING',
      title: milestone.title,
      ...googleEventFields(googleEvents[index + 1]),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })

  await batch.commit()
}

export async function saveManualEventToFirestore(
  uid: string,
  event: ManualCalendarEventInput,
  googleEvent?: GoogleCalendarEventReference,
): Promise<void> {
  const eventRef = doc(collection(db, 'users', uid, 'events'))
  const start = event.allDay ? event.date : `${event.date}T${event.startTime}:00`
  const end = event.allDay ? undefined : `${event.date}T${event.endTime}:00`

  await setDoc(eventRef, {
    allDay: event.allDay,
    assignmentId: 'manual',
    description: event.description.trim(),
    ...(end ? { end } : {}),
    kind: event.kind,
    source: 'manual',
    start,
    status: 'PENDING',
    title: event.title.trim(),
    ...googleEventFields(googleEvent),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

function googleEventFields(event?: GoogleCalendarEventReference) {
  if (!event) return {}
  return {
    googleEventId: event.id,
    ...(event.htmlLink ? { googleEventUrl: event.htmlLink } : {}),
  }
}
