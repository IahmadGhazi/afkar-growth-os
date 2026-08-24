import { useSyncExternalStore } from 'react'

export type LiveStatus = 'connecting' | 'live' | 'polling' | 'error'

export interface LiveState {
  status: LiveStatus
  lastSyncAt: number | null
  lastPushAt: number | null
  lastError: string | null
}

let state: LiveState = {
  status: 'connecting',
  lastSyncAt: null,
  lastPushAt: null,
  lastError: null,
}

const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

export function liveSubscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function liveGetSnapshot(): LiveState {
  return state
}

function patch(p: Partial<LiveState>) {
  let changed = false
  const cur = state as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(p)) {
    if (cur[k] !== v) { changed = true; break }
  }
  if (!changed) return
  state = { ...state, ...p }
  emit()
}

/** Realtime channel joined — pushes arrive instantly. */
export function markRealtimeUp() { patch({ status: 'live', lastError: null }) }
/** Realtime unavailable — falling back to interval polling. */
export function markRealtimeDown(reason?: string) {
  patch({ status: 'error', lastError: reason ?? 'Realtime channel unavailable — using periodic polling' })
}
/** A server push arrived (broadcast or postgres_changes). */
export function markPush() { patch({ lastPushAt: Date.now(), lastError: null }) }
/** A full refresh succeeded. */
export function markSyncOk() { patch({ lastSyncAt: Date.now() }) }
/** A refresh failed — surface it. */
export function markSyncFail(err: unknown) {
  patch({ status: 'error', lastError: err instanceof Error ? err.message : String(err).slice(0, 120) })
}

export function useLive(): LiveState {
  return useSyncExternalStore(liveSubscribe, liveGetSnapshot, liveGetSnapshot)
}

export function relTime(t: number | null): string {
  if (!t) return '—'
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (s < 3) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
