import { useAuth } from './AuthContext'

const calendarDays = Array.from({ length: 35 }, (_, index) => index - 2)

export function LoginPage() {
  const { authError, signInWithGoogle } = useAuth()

  return (
    <main className="login-page">
      <section className="login-story" aria-labelledby="login-heading">
        <a className="brand login-brand" href="/" aria-label="AI Calendar home">
          <span className="brand-mark">AI</span>
          <span>AI Calendar</span>
        </a>

        <div className="login-copy">
          <p className="eyebrow">Built for busy students</p>
          <h1 id="login-heading">Your semester, finally under control.</h1>
          <p>
            Turn assignments, exams, and half-remembered deadlines into a plan you can
            review and follow—wherever you study.
          </p>
        </div>

        <div className="login-calendar" aria-hidden="true">
          <div className="mini-calendar-header">
            <span>September</span>
            <span>2026</span>
          </div>
          <div className="mini-calendar-weekdays">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <span key={`${day}-${index}`}>{day}</span>
            ))}
          </div>
          <div className="mini-calendar-grid">
            {calendarDays.map((day, index) => (
              <span
                className={day === 15 ? 'is-today' : day === 20 ? 'has-deadline' : ''}
                key={index}
              >
                {day > 0 && day <= 30 ? day : ''}
              </span>
            ))}
          </div>
          <div className="mini-event">
            <span>Today</span>
            <strong>Outline biology lab</strong>
            <time>4:00 PM</time>
          </div>
        </div>
      </section>

      <section className="login-panel" aria-label="Sign in">
        <div className="login-card">
          <p className="eyebrow">Welcome</p>
          <h2>Sign in to your calendar</h2>
          <p className="login-supporting-copy">
            Your schedules sync privately across your phone and computer.
          </p>

          <button className="google-button" type="button" onClick={() => void signInWithGoogle()}>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.3h6a5.1 5.1 0 0 1-2.2 3.3v2.8h3.6c2.1-1.9 3.2-4.8 3.2-8.2Z" />
              <path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.6l-3.6-2.8c-1 .7-2.3 1-3.8 1a6.5 6.5 0 0 1-6.1-4.5H2.2V17A11.2 11.2 0 0 0 12 23Z" />
              <path fill="#FBBC05" d="M5.9 14.1a6.7 6.7 0 0 1 0-4.2V7H2.2a11.1 11.1 0 0 0 0 10l3.7-2.9Z" />
              <path fill="#EA4335" d="M12 5.4c1.8 0 3.3.6 4.6 1.8L20 3.8A11.3 11.3 0 0 0 2.2 7l3.7 2.9A6.5 6.5 0 0 1 12 5.4Z" />
            </svg>
            Continue with Google
          </button>

          {authError && <p className="message error" role="alert">{authError}</p>}

          <div className="login-reassurance">
            <span aria-hidden="true">✦</span>
            <p>AI suggestions stay drafts until you approve them.</p>
          </div>
        </div>
        <p className="login-fine-print">Plan clearly. Study calmly. Own your time.</p>
      </section>
    </main>
  )
}
