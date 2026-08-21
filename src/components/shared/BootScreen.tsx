import { useApp } from '../../lib/store'

/** Shown while the store bootstraps from Supabase: never flash an empty
    "no data" state that would lie about the workspace. */
export function BootScreen() {
  const { state } = useApp()
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <img
          src="/logo.png"
          alt="AFKAR"
          className="h-12 w-auto mx-auto rounded-xl animate-pulse"
        />
        <div className="text-sm font-semibold text-[var(--text-secondary)] mt-4">
          {state.organization?.name ?? 'AFKAR Growth OS'}
        </div>
        <div className="text-xs text-[var(--text-muted)]">Loading your workspace…</div>
        <div className="mt-6 space-y-2.5" aria-hidden>
          {[80, 100, 64].map((w, i) => (
            <div
              key={i}
              className="h-11 rounded-xl bg-[var(--skeleton)] animate-pulse mx-auto"
              style={{ width: `${w}%`, animationDelay: `${i * 140}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
