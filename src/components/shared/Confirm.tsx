import { useSyncExternalStore } from 'react'
import { AlertTriangle } from 'lucide-react'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface ConfirmState extends ConfirmOptions {
  resolve: (v: boolean) => void
}

let state: ConfirmState | null = null
const listeners = new Set<() => void>()

function emit() { for (const fn of listeners) fn() }

/** Promise-based app-styled confirm — replaces browser yes/no everywhere. */
export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    state = { ...opts, resolve }
    emit()
  })
}

export function useAppConfirm(): ConfirmState | null {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
    () => state,
    () => state,
  )
}

export function AppConfirm() {
  const s = useAppConfirm()
  if (!s) return null
  const close = (v: boolean) => { s.resolve(v); state = null; emit() }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-[fadeIn_.15s_ease]" onClick={() => close(false)} />
      <div className="relative glass-card p-6 w-full max-w-sm space-y-4 animate-[pulseIn_.25s_var(--ease-spring)_both]">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: s.danger ? 'rgba(239,68,68,.12)' : 'rgba(240,196,46,.14)' }}>
            <AlertTriangle size={17} style={{ color: s.danger ? '#ef4444' : '#d29a0c' }} />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[var(--text-primary)]">{s.title}</div>
            {s.message && <div className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed whitespace-pre-line">{s.message}</div>}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => close(false)} className="btn btn-outline !text-xs !px-4 !py-2">{s.cancelLabel ?? 'Cancel'}</button>
          <button onClick={() => close(true)}
            className="btn !text-xs !px-4 !py-2"
            style={s.danger ? { background: '#ef4444', color: '#fff' } : undefined}
            autoFocus>
            {s.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
