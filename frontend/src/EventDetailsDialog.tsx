import { useEffect, useRef } from 'react'

import type { CalendarEvent } from './types'

interface EventDetailsDialogProps {
  event: CalendarEvent
  onClose: () => void
}

const kindLabels: Record<CalendarEvent['extendedProps']['kind'], string> = {
  deadline: 'Deadline',
  event: 'Event',
  milestone: 'Milestone',
}

export default function EventDetailsDialog({ event, onClose }: EventDetailsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  const description = event.extendedProps.description?.trim()
  const instruction = description || (
    event.extendedProps.kind === 'deadline'
      ? 'Finish and submit your work by this deadline.'
      : event.extendedProps.kind === 'milestone'
        ? 'Review this milestone in your plan and complete it by the scheduled date.'
        : 'No instructions were added to this event.'
  )

  return (
    <dialog
      ref={dialogRef}
      className="event-details-dialog"
      aria-labelledby="event-details-title"
      aria-describedby="event-details-instructions"
      onCancel={(cancel) => {
        cancel.preventDefault()
        onClose()
      }}
      onClick={(click) => {
        if (click.target === click.currentTarget) onClose()
      }}
    >
      <div className="event-details-content">
        <div className="event-details-heading">
          <span className={`event-details-kind kind-${event.extendedProps.kind}`}>
            {kindLabels[event.extendedProps.kind]}
          </span>
          <button
            className="event-details-close"
            type="button"
            aria-label="Close event details"
            onClick={onClose}
            autoFocus
          >
            ×
          </button>
        </div>
        <h2 id="event-details-title">{event.title}</h2>
        <p className="event-details-date">
          <time dateTime={event.start}>{formatEventDate(event)}</time>
        </p>
        <div className="event-details-instructions" id="event-details-instructions">
          <h3>What to do</h3>
          <p>{instruction}</p>
        </div>
        {event.extendedProps.googleEventUrl && (
          <a
            className="event-details-external"
            href={event.extendedProps.googleEventUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in Google Calendar ↗
          </a>
        )}
      </div>
    </dialog>
  )
}

function formatEventDate(event: CalendarEvent): string {
  const date = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${event.start.slice(0, 10)}T00:00:00Z`))

  if (event.allDay) return `${date} · All day`

  const formatTime = (value: string) => new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
  return `${date} · ${formatTime(event.start)}${event.end ? `–${formatTime(event.end)}` : ''}`
}
