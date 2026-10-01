export interface MilestoneProposal {
  title: string
  date: string
  description: string
}

export interface ScheduleProposal {
  assignment_title: string
  final_due_date: string
  events: MilestoneProposal[]
}

export type CalendarEventKind = 'deadline' | 'milestone' | 'event'

export interface ManualCalendarEventInput {
  allDay: boolean
  date: string
  description: string
  endTime: string
  kind: 'deadline' | 'event'
  startTime: string
  title: string
}

export interface GoogleCalendarEventReference {
  id: string
  htmlLink?: string
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end?: string
  allDay: boolean
  backgroundColor: string
  borderColor: string
  extendedProps: {
    kind: CalendarEventKind
    assignmentId: string
    assignmentTitle?: string
    description?: string
    googleEventId?: string
    googleEventUrl?: string
    status?: 'PENDING' | 'COMPLETED'
  }
}
