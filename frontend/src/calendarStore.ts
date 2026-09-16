import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'

import { db } from './firebase'
import type { CalendarEvent, ScheduleProposal } from './types'

interface StoredEvent {
  assignmentId: string
  description?: string
  kind: 'deadline' | 'milestone'
  source: 'ai' | 'manual'
  start: string
  status: 'PENDING' | 'COMPLETED'
  title: string
}

function toCalendarEvent(id: string, data: StoredEvent): CalendarEvent {
  const isDeadline = data.kind === 'deadline'
  return {
    id,
    title: data.title,
    start: data.start,
    allDay: true,
    backgroundColor: isDeadline ? '#ef4444' : '#eab308',
    borderColor: isDeadline ? '#dc2626' : '#ca8a04',
    extendedProps: {
      kind: data.kind,
      assignmentId: data.assignmentId,
      description: data.description,
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  proposal.events.forEach((milestone) => {
    const eventRef = doc(collection(db, 'users', uid, 'events'))
    batch.set(eventRef, {
      assignmentId: assignmentRef.id,
      description: milestone.description,
      kind: 'milestone',
      source: 'ai',
      start: milestone.date,
      status: 'PENDING',
      title: milestone.title,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })

  await batch.commit()
}
