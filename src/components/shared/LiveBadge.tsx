import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { useLive, relTime, type LiveStatus } from '../../lib/live'

const META: Record<LiveStatus, { dot: string; text: string; label: string }> = {
  live: { dot: '#10b981', text: '#10b981', label: 'Live — push connected' },
  polling: { dot: '#f59e0b', text: '#f59e0b', label: 'Polling' },
  connecting: { dot: '#94a3b8', text: 'var(--text-muted)', label: 'Connecting…' },
  error: { dot: '#ef4444', text: '#ef4444', label: 'Error' },
}

/** Slim connection bar shown at the top of live data pages. */
export function LiveBadge() {
  const live = useLive()
  const m = META[live.status]
  const lastEvent = Math.max(live.lastSyncAt ?? 0, live.lastPushAt ?? 0)
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[var(--hairline)] bg-[var(--card)] px-3 py-2 text-[11px]"
      role="status"
      aria-live="polite"
      title={live.lastError ?? undefined}
    >
      <span className="flex items-center gap-1.5 font-semibold" style={{ color: m.text }}>
        {live.status === 'error'
          ? <AlertTriangle size={12} />
          : live.status === 'live'
            ? <Wifi size={12} />
            : live.status === 'polling'
              ? <RefreshCw size={12} />
              : <WifiOff size={12} />}
        <span className={`w-1.5 h-1.5 rounded-full ${live.status === 'live' ? 'animate-pulse' : ''}`} style={{ background: m.dot }} />
        {m.label}
      </span>
      <span className="text-[var(--text-muted)]">
        last update {relTime(lastEvent)}
        {live.lastPushAt ? ' · pushed' : ''}
      </span>
      {live.lastError && (
        <span className="truncate max-w-full" style={{ color: '#ef4444' }}>{live.lastError}</span>
      )}
    </div>
  )
}
