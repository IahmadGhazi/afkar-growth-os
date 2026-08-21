import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** The app never shows a white screen: a render crash lands here with an
    honest message and one recovery action. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Render crash:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-card max-w-md w-full p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--critical-soft)] flex items-center justify-center mb-4">
            <span className="text-xl">⚠️</span>
          </div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Something broke</h1>
          <p className="text-sm text-[var(--text-muted)] mt-2 leading-relaxed">
            The screen hit an unexpected error. Your data is safe in Supabase — reloading brings it back.
          </p>
          <pre className="mt-4 text-[11px] text-left text-[var(--critical)] bg-[var(--surface)] rounded-lg p-3 overflow-auto max-h-28">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary mt-5 w-full"
          >
            Reload the app
          </button>
        </div>
      </div>
    )
  }
}
