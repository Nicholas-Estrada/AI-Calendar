import React from 'react'
import ReactDOM from 'react-dom/client'

import { AuthProvider } from './AuthContext'
import { Root } from './Root'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </React.StrictMode>,
)
