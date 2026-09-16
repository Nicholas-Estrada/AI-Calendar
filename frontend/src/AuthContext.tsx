import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { auth, db } from './firebase'

interface AuthContextValue {
  authError: string | null
  isLoading: boolean
  signInWithGoogle: () => Promise<void>
  signOutUser: () => Promise<void>
  user: User | null
}

const AuthContext = createContext<AuthContextValue | null>(null)
const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

async function saveUserProfile(user: User) {
  await setDoc(
    doc(db, 'users', user.uid),
    {
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      lastLoginAt: serverTimestamp(),
    },
    { merge: true },
  )
}

function friendlyAuthError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('popup-closed-by-user')) return 'Sign-in was cancelled.'
    if (error.message.includes('popup-blocked')) return 'Your browser blocked the sign-in window.'
    if (error.message.includes('unauthorized-domain')) {
      return 'This domain is not authorized in Firebase Authentication yet.'
    }
    if (error.message.includes('operation-not-allowed')) {
      return 'Google sign-in is not enabled for this Firebase project yet.'
    }
  }
  return 'We could not sign you in. Please try again.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(
    () =>
      onAuthStateChanged(auth, (nextUser) => {
        setUser(nextUser)
        setIsLoading(false)
      }),
    [],
  )

  useEffect(() => {
    void getRedirectResult(auth)
      .then((result) => {
        if (result) return saveUserProfile(result.user)
      })
      .catch((error: unknown) => setAuthError(friendlyAuthError(error)))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      authError,
      isLoading,
      user,
      signInWithGoogle: async () => {
        setAuthError(null)
        try {
          const useRedirect = window.matchMedia('(max-width: 640px)').matches
          if (useRedirect) {
            await signInWithRedirect(auth, googleProvider)
            return
          }
          const result = await signInWithPopup(auth, googleProvider)
          await saveUserProfile(result.user)
        } catch (error) {
          setAuthError(friendlyAuthError(error))
        }
      },
      signOutUser: async () => {
        setAuthError(null)
        await signOut(auth)
      },
    }),
    [authError, isLoading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
