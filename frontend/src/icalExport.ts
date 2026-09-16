import type { CalendarEvent } from './types'

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
}

function fold(line: string): string {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let current = ''
  let bytes = 0
  for (const character of line) {
    const size = encoder.encode(character).length
    if (bytes + size > 75) {
      parts.push(current)
      current = ' '
      bytes = 1
    }
    current += character
    bytes += size
  }
  parts.push(current)
  return parts.join('\r\n')
}

function nextDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

function icalDate(value: string): string {
  return value.replace(/[-:]/g, '')
}

export function buildIcal(events: CalendarEvent[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AI Calendar//Academic Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:AI Calendar',
  ]
  for (const event of events) {
    const date = event.start.slice(0, 10)
    lines.push('BEGIN:VEVENT', `UID:${escapeText(event.id)}@ai-calendar.local`, `DTSTAMP:${now}`)
    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${icalDate(date)}`)
      lines.push(`DTEND;VALUE=DATE:${icalDate(nextDate(date))}`)
    } else {
      lines.push(`DTSTART:${icalDate(new Date(event.start).toISOString().slice(0, 19))}Z`)
      lines.push(`DTEND:${icalDate(new Date(event.end ?? event.start).toISOString().slice(0, 19))}Z`)
    }
    lines.push(`SUMMARY:${escapeText(event.title)}`)
    if (event.extendedProps.description) {
      lines.push(`DESCRIPTION:${escapeText(event.extendedProps.description)}`)
    }
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return `${lines.map(fold).join('\r\n')}\r\n`
}

export function downloadIcal(events: CalendarEvent[]): void {
  const blob = new Blob([buildIcal(events)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'ai-calendar.ics'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
