import { useSyncExternalStore, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

type Listener = () => void

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<Listener>()
const timers = new Map<number, ReturnType<typeof setTimeout>>()

function emit() {
  listeners.forEach((l) => l())
}

function push(kind: ToastKind, message: string, ttl = 4200) {
  const toast: Toast = { id: nextId++, kind, message }
  toasts = [...toasts, toast].slice(-4)
  emit()
  timers.set(
    toast.id,
    setTimeout(() => dismiss(toast.id), ttl),
  )
}

export function dismiss(id: number) {
  const t = timers.get(id)
  if (t) clearTimeout(t)
  timers.delete(id)
  toasts = toasts.filter((x) => x.id !== id)
  emit()
}

export const toast = {
  success: (message: string) => push('success', message),
  error: (message: string) => push('error', message, 6500),
  info: (message: string) => push('info', message),
}

function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, () => toasts)
}

const styles: Record<ToastKind, { border: string; icon: ReactNode }> = {
  success: {
    border: 'var(--positive)',
    icon: <CheckCircle2 size={17} className="text-[var(--positive)] shrink-0" />,
  },
  error: {
    border: 'var(--critical)',
    icon: <AlertTriangle size={17} className="text-[var(--critical)] shrink-0" />,
  },
  info: {
    border: 'var(--brand)',
    icon: <Info size={17} className="text-[var(--brand)] shrink-0" />,
  },
}

export function Toaster() {
  const items = useToasts()
  if (items.length === 0) return null
  return (
    <div
      className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm print:hidden"
      role="status"
      aria-live="polite"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className="glass-strong rounded-xl px-4 py-3 flex items-start gap-2.5 scale-in"
          style={{ borderLeft: `3px solid ${styles[t.kind].border}` }}
        >
          {styles[t.kind].icon}
          <div className="text-sm leading-snug text-[var(--text-primary)] flex-1">{t.message}</div>
          <button
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
            className="icon-btn -mr-1 -mt-1 shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
