import { useState } from 'react'
import { LogIn, Loader2, UserPlus, ShieldCheck } from 'lucide-react'
import { signIn, signUp } from '../../lib/auth'

export function Login() {
  const [mode, setMode] = useState<'signin' | 'setup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    if (mode === 'signin') {
      const { error: err } = await signIn(email.trim(), password)
      if (err) setError(err)
    } else {
      const { error: err, needsConfirmation } = await signUp(email.trim(), password)
      if (err) setError(err)
      else if (needsConfirmation)
        setNotice('Account created but needs email confirmation. Ask the admin to disable "Confirm email" in Authentication settings, then sign in.')
    }
    setBusy(false)
  }

  return (
    <div className="min-h-[100dvh] grid place-items-center p-6">
      <div className="w-full max-w-sm my-auto">
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
              autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-[var(--critical-soft)] text-[var(--critical)] text-xs px-3 py-2 leading-relaxed">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-lg bg-[var(--warning-soft)] text-[var(--warning)] text-xs px-3 py-2 leading-relaxed">
              {notice}
            </div>
          )}

          <button type="submit" disabled={!email.trim() || !password || busy} className="btn btn-primary w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : mode === 'setup' ? <UserPlus size={16} /> : <LogIn size={16} />}
            {busy ? 'Working…' : mode === 'setup' ? 'Create owner account' : 'Sign in'}
          </button>

          <p className="text-[11px] text-[var(--text-muted)] text-center leading-relaxed">
            Team accounts only. Your email must match your team profile.
          </p>
        </form>

        {/* First-time setup — the owner's super-admin bootstrap */}
        <button
          onClick={() => {
            setMode(mode === 'setup' ? 'signin' : 'setup')
            setError(null)
            setNotice(null)
          }}
          className="mt-4 mx-auto flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--brand)] transition-colors"
        >
          <ShieldCheck size={13} />
          {mode === 'setup' ? 'Back to sign in' : 'First-time setup — create the owner account'}
        </button>
      </div>
    </div>
  )
}
