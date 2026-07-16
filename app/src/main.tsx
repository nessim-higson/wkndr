import './devRafPump'   // FIRST: dev-only hidden-tab rAF pump (see the module's comment)
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { openCurateDoor } from './curateDoor'
import './index.css'

// ?curate2026! on a wide screen leaves for the board — do it BEFORE render, or the app
// paints for a frame and then vanishes. On a phone this is a no-op and App opens Triage.
openCurateDoor()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
