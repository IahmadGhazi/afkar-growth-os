import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initStore } from './lib/store'
import { initTheme } from './lib/theme'
import { ErrorBoundary } from './components/shared/ErrorBoundary'

initTheme()
initStore()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
