import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import { useCallback, useEffect, useState } from 'react'

import { commitSchedule, fetchEvents, generateSchedule, getErrorMessage } from './api'
import type { CalendarEvent, ScheduleProposal } from './types'
import { useLocalSpeechInput } from './useLocalSpeechInput'

const examplePrompt = 'I have a 3-page research essay due September 20 about urban ecology.'

export default function App() {
  const [prompt, setPrompt] = useState('')
  const [proposal, setProposal] = useState<ScheduleProposal | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const handleTranscript = useCallback((transcript: string) => setPrompt(transcript), [])
  const { isListening, isTranscribing, speechError, speechSupported, toggleListening } =
    useLocalSpeechInput(handleTranscript)

  const refreshEvents = useCallback(async () => {
    try {
      setEvents(await fetchEvents())
    } catch {
      // Initial empty state remains usable while the backend starts.
    }
  }, [])

  useEffect(() => {
    void refreshEvents()
  }, [refreshEvents])

  async function handleGenerate() {
    if (prompt.trim().length < 3) return
    setIsGenerating(true)
    setError(null)
    setNotice(null)
    setProposal(null)
    try {
      setProposal(await generateSchedule(prompt.trim()))
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleCommit() {
    if (!proposal) return
    setIsCommitting(true)
    setError(null)
    try {
      await commitSchedule(proposal, prompt.trim())
      await refreshEvents()
      setProposal(null)
      setPrompt('')
      setNotice('Schedule saved locally and added to your calendar.')
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setIsCommitting(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="masthead">
        <a className="brand" href="#top" aria-label="LIAS home">
          <span className="brand-mark">L</span>
          <span>LIAS</span>
        </a>
        <p>Private by design · Powered locally</p>
        <a className="export-link" href="/api/schedule/export" download>
          Export calendar
        </a>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Local intelligent academic scheduler</p>
            <h1>Turn a deadline into a plan you can actually follow.</h1>
            <p className="hero-description">
              Describe the work in your own words. LIAS uses a model on your machine to
              map the deadline, stage the work, and place each milestone on your calendar.
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
                title={speechSupported ? 'Record and transcribe locally' : 'Speech input is unavailable'}
              >
                <span aria-hidden="true">{isListening ? '■' : isTranscribing ? '…' : '●'}</span>
                {isListening
                  ? 'Stop & transcribe'
                  : isTranscribing
                    ? 'Transcribing locally…'
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
            {notice && <p className="message success">{notice}</p>}
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
                {isCommitting ? 'Saving…' : 'Add to calendar'}
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
            <div className="legend" aria-label="Calendar legend">
              <span><i className="milestone-dot" /> Milestone</span>
              <span><i className="deadline-dot" /> Deadline</span>
            </div>
          </div>
          <FullCalendar
            plugins={[dayGridPlugin]}
            initialView="dayGridMonth"
            events={events}
            height="auto"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
            dayMaxEvents={3}
            eventDisplay="block"
          />
        </section>
      </main>

      <footer>
        <p>Nothing leaves this machine.</p>
        <p>LIAS · local model · local database · your schedule</p>
      </footer>
    </div>
  )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}
