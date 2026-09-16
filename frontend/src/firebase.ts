import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY

if (!apiKey) {
  throw new Error(
    'VITE_FIREBASE_API_KEY is missing. Add it to the repository .env file before starting the app.',
  )
}

const firebaseConfig = {
  apiKey,
  authDomain: 'lias-abff9.firebaseapp.com',
  projectId: 'lias-abff9',
  storageBucket: 'lias-abff9.firebasestorage.app',
  messagingSenderId: '444256575616',
  appId: '1:444256575616:web:e25b05de96ef1ed57c0665',
  measurementId: 'G-6P4FFJ6KGK',
}

export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)
