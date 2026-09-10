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

export interface CalendarEvent {
  id: string
  title: string
  start: string
  allDay: boolean
  backgroundColor: string
  borderColor: string
  extendedProps: {
    kind: 'deadline' | 'milestone'
    assignmentId: string
    assignmentTitle?: string
    description?: string
    status?: 'PENDING' | 'COMPLETED'
  }
}
