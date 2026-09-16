import { lazy, Suspense } from 'react'

import { useAuth } from './AuthContext'
import { LoginPage } from './LoginPage'

const App = lazy(() => import('./App'))

function LoadingCalendar() {
  return (
    <main className="auth-loading" aria-live="polite">
      <span className="brand-mark">AI</span>
      <p>Opening your calendar…</p>
    </main>
  )
}

export function Root() {
  const { isLoading, user } = useAuth()

  if (isLoading) {
    return <LoadingCalendar />
  }

  return user ? (
    <Suspense fallback={<LoadingCalendar />}>
      <App />
    </Suspense>
  ) : (
    <LoginPage />
  )
}
