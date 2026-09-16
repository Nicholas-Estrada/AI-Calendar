import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import { useCallback, useEffect, useState, type FormEvent } from 'react'

import {
  generateSchedule,
  getCalendarSubscriptionUrl,
  getErrorMessage,
  resetCalendarSubscriptionUrl,
} from './api'
import { useAuth } from './AuthContext'
import {
  saveManualEventToFirestore,
  saveScheduleToFirestore,
  subscribeToCalendarEvents,
} from './calendarStore'
import { downloadIcal } from './icalExport'
import {
  saveManualEventLocally,
  saveScheduleLocally,
  subscribeToLocalCalendarEvents,
} from './localCalendarStore'
import type {
  CalendarEvent,
  ManualCalendarEventInput,
  ScheduleProposal,
} from './types'
import { useLocalSpeechInput } from './useLocalSpeechInput'

const examplePrompt = 'I have a 3-page research essay due September 20 about urban ecology.'

export default function App() {
  const { isGuest, signOutUser, user } = useAuth()
  const [prompt, setPrompt] = useState('')
  const [proposal, setProposal] = useState<ScheduleProposal | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [manualEvent, setManualEvent] = useState<ManualCalendarEventInput>(
    createEmptyManualEvent,
  )
  const [showManualForm, setShowManualForm] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [isPreparingSubscription, setIsPreparingSubscription] = useState(false)
  const [showCalendarOptions, setShowCalendarOptions] = useState(false)
  const [subscriptionUrl, setSubscriptionUrl] = useState<string | null>(null)
  const [isSavingManualEvent, setIsSavingManualEvent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [calendarNotice, setCalendarNotice] = useState<string | null>(null)

  const handleTranscript = useCallback((transcript: string) => setPrompt(transcript), [])
  const { isListening, isTranscribing, speechError, speechSupported, toggleListening } =
    useLocalSpeechInput(handleTranscript)

  useEffect(() => {
    if (!user) return
    if (isGuest) return subscribeToLocalCalendarEvents(setEvents)
    return subscribeToCalendarEvents(user.uid, setEvents, setCalendarError)
  }, [isGuest, user])

  async function handleGenerate() {
    if (prompt.trim().length < 3) return
    setIsGenerating(true)
    setError(null)
    setProposal(null)
    try {
      setProposal(await generateSchedule(prompt.trim()))
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleAddToCalendar() {
    setShowCalendarOptions(true)
    setCalendarError(null)
    if (isGuest || subscriptionUrl) return
    setIsPreparingSubscription(true)
    try {
      setSubscriptionUrl(await getCalendarSubscriptionUrl())
    } catch (caught) {
      setCalendarError(getErrorMessage(caught))
    } finally {
      setIsPreparingSubscription(false)
    }
  }

  async function handleCopySubscription() {
    if (!subscriptionUrl) return
    try {
      await navigator.clipboard.writeText(subscriptionUrl)
      setCalendarNotice('Subscription link copied. Keep it private; anyone with the link can view your events.')
    } catch {
      setCalendarError('Could not copy the link. Select and copy it below.')
    }
  }

  async function handleResetSubscription() {
    setIsPreparingSubscription(true)
    setCalendarError(null)
    setCalendarNotice(null)
    try {
      setSubscriptionUrl(await resetCalendarSubscriptionUrl())
      setCalendarNotice('Private link reset. Previous subscriptions will stop updating; add the new link to your calendar app.')
    } catch (caught) {
      setCalendarError(getErrorMessage(caught))
    } finally {
      setIsPreparingSubscription(false)
    }
  }

  async function handleCommit() {
    if (!proposal || !user) return
    setIsCommitting(true)
    setCalendarError(null)
    setCalendarNotice(null)
    try {
      if (isGuest) saveScheduleLocally(proposal)
      else await saveScheduleToFirestore(user.uid, proposal, prompt.trim())
      setProposal(null)
      setPrompt('')
      setCalendarNotice(isGuest ? 'Schedule saved in this browser.' : 'Schedule saved to your account.')
    } catch (caught) {
      setCalendarError(caught instanceof Error ? caught.message : 'Could not save this plan.')
    } finally {
      setIsCommitting(false)
    }
  }

  async function handleManualEventSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    const validationError = validateManualEvent(manualEvent)
    if (validationError) {
      setCalendarError(validationError)
      return
    }

    setIsSavingManualEvent(true)
    setCalendarError(null)
    setCalendarNotice(null)
    try {
      if (isGuest) saveManualEventLocally(manualEvent)
      else await saveManualEventToFirestore(user.uid, manualEvent)
      setManualEvent(createEmptyManualEvent())
      setShowManualForm(false)
      setCalendarNotice(isGuest ? 'Event saved in this browser.' : 'Event saved to your account.')
    } catch (caught) {
      setCalendarError(caught instanceof Error ? caught.message : 'Could not save this event.')
    } finally {
      setIsSavingManualEvent(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="masthead">
        <a className="brand" href="#top" aria-label="AI Calendar home">
          <span className="brand-mark">AI</span>
          <span>AI Calendar</span>
        </a>
        <p>Plan clearly · Calendar your way</p>
        <div className="account-menu">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="account-initial" aria-hidden="true">
              {(isGuest ? 'G' : user?.displayName ?? user?.email ?? 'S').charAt(0).toUpperCase()}
            </span>
          )}
          <span>{isGuest ? 'Guest' : user?.displayName?.split(' ')[0] ?? 'Student'}</span>
          <button type="button" onClick={() => void signOutUser()}>{isGuest ? 'Leave guest mode' : 'Sign out'}</button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Your intelligent academic scheduler</p>
            <h1>Turn a deadline into a plan you can actually follow.</h1>
            <p className="hero-description">
              Describe the work in your own words. AI Calendar maps the deadline, stages
              the work, and saves every approved milestone to your calendar.
            </p>
          </div>

          <div className="composer-card">
            <label htmlFor="assignment-prompt">What is coming up?</label>
            <textarea
              id="assignment-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={examplePrompt}
              rows={5}
            />
            <div className="composer-actions">
              <button
                className={`speech-button ${isListening ? 'is-listening' : ''}`}
                type="button"
                onClick={() => void toggleListening()}
                disabled={!speechSupported || isTranscribing}
                title={speechSupported ? 'Record and transcribe' : 'Speech input is unavailable'}
              >
                <span aria-hidden="true">{isListening ? '■' : isTranscribing ? '…' : '●'}</span>
                {isListening
                  ? 'Stop & transcribe'
                  : isTranscribing
                    ? 'Transcribing…'
                    : 'Speak it'}
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => void handleGenerate()}
                disabled={isGenerating || prompt.trim().length < 3}
              >
                {isGenerating ? 'Building plan…' : 'Build my plan'}
              </button>
            </div>
            {(error ?? speechError) && <p className="message error">{error ?? speechError}</p>}
          </div>
        </section>

        {proposal && (
          <section className="proposal-panel" aria-labelledby="proposal-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Review before saving</p>
                <h2 id="proposal-heading">{proposal.assignment_title}</h2>
              </div>
              <div className="deadline-chip">
                <span>Final due date</span>
                <strong>{formatDate(proposal.final_due_date)}</strong>
              </div>
            </div>

            <ol className="milestone-list">
              {proposal.events.map((milestone, index) => (
                <li key={`${milestone.date}-${milestone.title}`}>
                  <span className="milestone-number">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <div className="milestone-title-row">
                      <h3>{milestone.title}</h3>
                      <time dateTime={milestone.date}>{formatDate(milestone.date)}</time>
                    </div>
                    <p>{milestone.description}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="proposal-actions">
              <button className="text-button" type="button" onClick={() => setProposal(null)}>
                Revise prompt
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => void handleCommit()}
                disabled={isCommitting}
              >
                {isCommitting ? 'Saving…' : 'Save plan'}
              </button>
            </div>
          </section>
        )}

        <section className="calendar-panel" aria-labelledby="calendar-heading">
          <div className="section-heading calendar-heading">
            <div>
              <p className="eyebrow">Your runway</p>
              <h2 id="calendar-heading">Academic calendar</h2>
            </div>
            <div className="calendar-control-area">
              <button
                className="google-calendar-button"
                type="button"
                onClick={() => void handleAddToCalendar()}
                disabled={isPreparingSubscription}
              >
                {isPreparingSubscription ? 'Preparing link…' : 'Add to Calendar'}
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setShowManualForm((current) => !current)
                  setCalendarError(null)
                  setCalendarNotice(null)
                }}
              >
                {showManualForm ? 'Close form' : 'Add event'}
              </button>
            </div>
          </div>

          {calendarError && <p className="message error calendar-feedback">{calendarError}</p>}
          {calendarNotice && (
            <p className="message success calendar-feedback">{calendarNotice}</p>
          )}

          {showCalendarOptions && (
            <div className="calendar-options" aria-label="Add to another calendar">
              <div className="calendar-options-heading">
                <div>
                  <p className="eyebrow">Add to Calendar</p>
                  <h3>{isGuest ? 'Export your guest calendar' : 'Subscribe to your calendar'}</h3>
                </div>
                <button className="text-button" type="button" onClick={() => setShowCalendarOptions(false)}>Close</button>
              </div>
              {isGuest ? (
                <>
                  <p>Download your events, then import the file into a new calendar in Apple Calendar, Google Calendar, or another app. The imported calendar can be toggled on or off. Export again after you make changes here.</p>
                  <button className="primary-button" type="button" onClick={() => downloadIcal(events)} disabled={!events.length}>
                    Download .ics file
                  </button>
                </>
              ) : (
                <>
                  <p>Subscribe once to a separate, read-only AI Calendar. New events saved here will appear when your calendar app refreshes. Keep this private link to yourself.</p>
                  {subscriptionUrl && (
                    <>
                      <div className="calendar-link-row">
                        <input aria-label="Private calendar subscription link" readOnly value={subscriptionUrl} onFocus={(event) => event.target.select()} />
                        <button className="google-calendar-button" type="button" onClick={() => void handleCopySubscription()}>Copy link</button>
                      </div>
                      <div className="calendar-option-actions">
                        <a className="primary-button" href={subscriptionUrl.replace(/^https?:/, 'webcal:')}>Open in Apple Calendar</a>
                        <a className="google-calendar-button" href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl" target="_blank" rel="noopener noreferrer">Open Google Calendar settings</a>
                      </div>
                      <p className="calendar-help">In Google Calendar, choose <strong>Other calendars → From URL</strong> and paste the link. Apple Calendar can open the subscription link directly.</p>
                      <button className="text-button calendar-reset-button" type="button" disabled={isPreparingSubscription} onClick={() => void handleResetSubscription()}>
                        Reset private link (stops old subscriptions)
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {showManualForm && (
            <form className="manual-event-form" onSubmit={(event) => void handleManualEventSubmit(event)}>
              <div className="manual-form-heading">
                <div>
                  <p className="eyebrow">Create it yourself</p>
                  <h3>New calendar event</h3>
                </div>
                <p>{isGuest ? 'Saved in this browser.' : 'Saved to your private account calendar.'}</p>
              </div>

              <div className="manual-form-grid">
                <label className="field-wide">
                  <span>Event title</span>
                  <input
                    type="text"
                    value={manualEvent.title}
                    onChange={(event) =>
                      setManualEvent((current) => ({ ...current, title: event.target.value }))
                    }
                    maxLength={200}
                    required
                  />
                </label>

                <label>
                  <span>Type</span>
                  <select
                    value={manualEvent.kind}
                    onChange={(event) =>
                      setManualEvent((current) => ({
                        ...current,
                        kind: event.target.value as ManualCalendarEventInput['kind'],
                      }))
                    }
                  >
                    <option value="event">Event</option>
                    <option value="deadline">Deadline</option>
                  </select>
                </label>

                <label>
                  <span>Date</span>
                  <input
                    type="date"
                    value={manualEvent.date}
                    onChange={(event) =>
                      setManualEvent((current) => ({ ...current, date: event.target.value }))
                    }
                    required
                  />
                </label>

                <label className="all-day-field">
                  <input
                    type="checkbox"
                    checked={manualEvent.allDay}
                    onChange={(event) =>
                      setManualEvent((current) => ({
                        ...current,
                        allDay: event.target.checked,
                      }))
                    }
                  />
                  <span>All-day event</span>
                </label>

                {!manualEvent.allDay && (
                  <>
                    <label>
                      <span>Starts</span>
                      <input
                        type="time"
                        value={manualEvent.startTime}
                        onChange={(event) =>
                          setManualEvent((current) => ({
                            ...current,
                            startTime: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                    <label>
                      <span>Ends</span>
                      <input
                        type="time"
                        value={manualEvent.endTime}
                        onChange={(event) =>
                          setManualEvent((current) => ({
                            ...current,
                            endTime: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                  </>
                )}

                <label className="field-wide">
                  <span>Notes <em>optional</em></span>
                  <textarea
                    value={manualEvent.description}
                    onChange={(event) =>
                      setManualEvent((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    maxLength={1000}
                    rows={3}
                  />
                </label>
              </div>

              <div className="manual-form-actions">
                <button
                  className="primary-button"
                  type="submit"
                  disabled={isSavingManualEvent}
                >
                  {isSavingManualEvent ? 'Saving event…' : 'Save event'}
                </button>
              </div>
            </form>
          )}

          <div className="calendar-meta">
            <div className="legend" aria-label="Calendar legend">
              <span><i className="event-dot" /> Event</span>
              <span><i className="milestone-dot" /> Milestone</span>
              <span><i className="deadline-dot" /> Deadline</span>
            </div>
            <span>{isGuest ? 'Guest events are stored in this browser.' : 'Your subscription shows these events in other calendar apps.'}</span>
          </div>

          <div className="calendar-scroll">
            <FullCalendar
              plugins={[dayGridPlugin]}
              initialView="dayGridMonth"
              events={events}
              height="auto"
              headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
              dayMaxEvents={3}
              eventDisplay="block"
              eventClick={(event) => {
                const googleEventUrl = event.event.extendedProps.googleEventUrl as
                  | string
                  | undefined
                if (googleEventUrl) {
                  window.open(googleEventUrl, '_blank', 'noopener,noreferrer')
                }
              }}
            />
          </div>
        </section>
      </main>

      <footer>
        <p>{isGuest ? 'Guest plans stay in this browser.' : 'Your plans stay private to your account.'}</p>
        <p>AI Calendar · plan clearly · study calmly</p>
      </footer>
    </div>
  )
}

function createEmptyManualEvent(): ManualCalendarEventInput {
  const today = new Date()
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset())
  return {
    allDay: true,
    date: today.toISOString().slice(0, 10),
    description: '',
    endTime: '10:00',
    kind: 'event',
    startTime: '09:00',
    title: '',
  }
}

function validateManualEvent(event: ManualCalendarEventInput): string | null {
  if (!event.title.trim()) return 'Give this event a title.'
  if (!event.date) return 'Choose a date for this event.'
  if (!event.allDay && (!event.startTime || !event.endTime)) {
    return 'Choose a start and end time.'
  }
  if (!event.allDay && event.endTime <= event.startTime) {
    return 'The end time must be later than the start time.'
  }
  return null
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}
