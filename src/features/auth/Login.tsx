import { useState } from 'react'
import { LogIn, Loader2 } from 'lucide-react'
import { signIn } from '../../lib/auth'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password || busy) return
    setBusy(true)
    setError(null)
    const { error: err } = await signIn(email.trim(), password)
    if (err) setError(err)
    // On success onAuthStateChange flips the app in; nothing to do here.
    setBusy(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="AFKAR" className="h-14 w-auto mx-auto rounded-xl drop-shadow-[0_8px_24px_rgba(0,0,0,0.25)]" />
          <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Growth OS
          </div>
        </div>

        <form onSubmit={submit} className="glass-card p-6 space-y-3">
          <div>
            <label htmlFor="login-email" className="text-xs font-semibold text-[var(--text-secondary)]">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@afkar-growth.com"
              className="field mt-1"
              autoComplete="email"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="login-password" className="text-xs font-semibold text-[var(--text-secondary)]">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="field mt-1"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-[var(--critical-soft)] text-[var(--critical)] text-xs px-3 py-2 leading-relaxed">
              {error}
            </div>
          )}

          <button type="submit" disabled={!email.trim() || !password || busy} className="btn btn-primary w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-[11px] text-[var(--text-muted)] text-center pt-1 leading-relaxed">
            Team accounts only. Your email must match your team profile.
          </p>
        </form>
      </div>
    </div>
  )
}
