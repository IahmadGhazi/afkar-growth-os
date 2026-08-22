import { useState } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import { updatePassword } from '../../lib/auth'

/** Shown after the user arrives from a password-reset email link. */
export function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    setError(null)
    const { error: err } = await updatePassword(password)
    if (err) setError(err)
    setBusy(false)
  }

  return (
    <div className="min-h-[100dvh] grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm my-auto">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="AFKAR" className="h-14 w-auto mx-auto rounded-xl drop-shadow-[0_8px_24px_rgba(0,0,0,0.25)]" />
          <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Set a new password</div>
        </div>
        <div className="glass-card p-6 space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className="field"
            autoFocus
            autoComplete="new-password"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm new password"
            className="field"
            autoComplete="new-password"
          />
          {error && (
            <div className="rounded-lg bg-[var(--critical-soft)] text-[var(--critical)] text-xs px-3 py-2">{error}</div>
          )}
          <button type="submit" disabled={busy || !password || !confirm} className="btn btn-primary w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            Update password
          </button>
        </div>
      </form>
    </div>
  )
}
