import { useEffect, useState } from 'react'
import { RefreshCw, Check, ChevronDown, ShieldCheck, Lock, AlertTriangle, Zap } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  PLATFORM_SETUP, PLATFORM_META, SECURITY_NOTES,
  DIFFICULTY_LABEL, type PlatformId,
} from '../../data/platforms'
import { cn } from '../../lib/utils'

interface PlatformStatus {
  configured: boolean
  account: string | null
  missing: string[]
}

export function IntegrationsPanel() {
  const [status, setStatus] = useState<Record<string, PlatformStatus> | null>(null)
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncMessages, setSyncMessages] = useState<Record<string, string>>({})

  const load = async () => {
    if (!supabase) { setError('Supabase not configured.'); return }
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) { setError('Sign in required.'); return }
    try {
      const res = await fetch('/api/integrations/status', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!res.ok) setError(json.error ?? `Status ${res.status}`)
      else { setStatus(json.platforms); setChecked(true) }
    } catch (e) { setError(String((e as Error).message)) }
  }

  useEffect(() => { void load() }, [])

  const syncPlatform = async (platform: string) => {
    setSyncing(platform)
    setSyncMessages((m) => ({ ...m, [platform]: '' }))
    const token = (await supabase?.auth.getSession())?.data.session?.access_token
    if (!token) { setSyncMessages((m) => ({ ...m, [platform]: 'Sign in required.' })); setSyncing(null); return }

    const path = platform === 'salla' ? '/api/salla/sync' : '/api/integrations/sync'
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (res.ok) {
        const results = json.results as Record<string, string> | undefined
        setSyncMessages((m) => ({
          ...m,
          [platform]: results
            ? Object.entries(results).map(([k, v]) => `${k}: ${v}`).join(' · ')
            : 'Sync complete.',
        }))
        void load()
      } else {
        setSyncMessages((m) => ({ ...m, [platform]: json.message ?? json.error ?? `Failed (${res.status})` }))
      }
    } catch (e) {
      setSyncMessages((m) => ({ ...m, [platform]: String((e as Error).message) }))
    }
    setSyncing(null)
  }

  const connectSalla = async () => {
    const token = (await supabase?.auth.getSession())?.data.session?.access_token
    if (!token) { setSyncMessages((m) => ({ ...m, salla: 'Sign in required.' })); return }
    try {
      const res = await fetch('/api/salla/connect', { headers: { Authorization: `Bearer ${token}` } })
      if (res.redirected) { window.location.href = res.url; return }
      const json = await res.json().catch(() => ({}))
      setSyncMessages((m) => ({ ...m, salla: json.error ?? json.message ?? `Connect failed (${res.status})` }))
    } catch (e) {
      setSyncMessages((m) => ({ ...m, salla: String((e as Error).message) }))
    }
  }

  const syncAll = async () => {
    setSyncing('all')
    const token = (await supabase?.auth.getSession())?.data.session?.access_token
    if (!token) { setSyncing(null); return }
    try {
      await fetch('/api/salla/sync', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` } })
      await fetch('/api/integrations/sync', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` } })
      void load()
    } catch { /* ignore */ }
    setSyncing(null)
  }

  const liveCount = status ? Object.values(status).filter((s) => s.configured).length : 0

  return (
    <div className="space-y-6">
      {/* Sync all button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-[var(--brand)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {checked ? `${liveCount} of 5 platforms connected` : 'Checking platforms…'}
          </span>
        </div>
        <button onClick={syncAll} disabled={syncing === 'all'} className="btn btn-primary !text-xs !px-4 !py-2">
          <RefreshCw size={14} className={cn(syncing === 'all' && 'animate-spin')} />
          {syncing === 'all' ? 'Syncing all…' : 'Sync All'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-[var(--critical)] bg-[var(--critical-soft)] rounded-lg px-3 py-2">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Platform cards — THE HERO. Each card is self-contained with everything. */}
      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(PLATFORM_SETUP) as PlatformId[]).map((pid) => (
          <PlatformCard
            key={pid}
            pid={pid}
            server={status?.[pid]}
            syncing={syncing === pid}
            message={syncMessages[pid]}
            onSync={() => syncPlatform(pid === 'salla' ? 'salla' : pid)}
            onConnect={connectSalla}
          />
        ))}
      </div>

      {/* Security notes */}
      <div className="glass-card rounded-2xl p-6">
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-[var(--positive-soft)] p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--positive-soft)] text-[var(--positive)]">
            <Lock size={18} />
          </span>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Every token is read-only. The puller can look at performance; it cannot move money, change budgets, or post.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {SECURITY_NOTES.map((n) => (
            <div key={n.title} className="rounded-xl border border-[var(--border)] p-4">
              <ShieldCheck size={17} className="text-[var(--brand)]" />
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{n.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{n.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PlatformCard({
  pid, server, syncing, message, onSync, onConnect,
}: {
  pid: PlatformId
  server?: PlatformStatus
  syncing: boolean
  message?: string
  onSync: () => void
  onConnect: () => void
}) {
  const setup = PLATFORM_SETUP[pid]
  const meta = PLATFORM_META[pid]
  const [showSteps, setShowSteps] = useState(false)
  const live = Boolean(server?.configured)

  return (
    <div className={cn('glass-card rounded-2xl p-5 space-y-3', live && 'ring-1 ring-[var(--positive)]/20')}>
      {/* Header: logo + name + status badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-xl text-base font-bold shrink-0"
            style={{ background: meta.bg, color: pid === 'snap' ? '#111' : '#fff' }}
          >
            {meta.name[0]}
          </span>
          <div>
            <p className="text-base font-semibold text-[var(--text-primary)]">{meta.name}</p>
            <p className="text-xs text-[var(--text-muted)]">{meta.sub}</p>
          </div>
        </div>
        {live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--positive-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--positive)] ring-1 ring-[var(--positive)]/20 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--positive)] breathing-dot" /> Connected
          </span>
        ) : (
          <span className="rounded-full bg-[var(--track)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)] shrink-0">Not connected</span>
        )}
      </div>

      {/* Scopes chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {meta.scopes.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
            <Check size={9} /> {s}
          </span>
        ))}
        <span className="ml-auto rounded bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
          {DIFFICULTY_LABEL[setup.difficulty]}
        </span>
      </div>

      {/* Status message */}
      {message && (
        <div className={cn(
          'text-xs px-3 py-2 rounded-lg',
          message.includes('error') || message.includes('not_configured') || message.includes('no_salla') || message.includes('Fail')
            ? 'bg-[var(--critical-soft)] text-[var(--critical)]'
            : 'bg-[var(--positive-soft)] text-[var(--positive)]'
        )}>
          {message}
        </div>
      )}

      {/* Missing secrets */}
      {server && !server.configured && server.missing.length > 0 && pid !== 'salla' && (
        <div className="text-xs text-[var(--warning)]">
          Missing: <code className="font-mono text-[10px]">{server.missing.join(', ')}</code>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        {pid === 'salla' ? (
          live ? (
            <button onClick={onSync} disabled={syncing} className="btn btn-primary !text-xs !px-4 !py-2 flex-1">
              <RefreshCw size={13} className={cn(syncing && 'animate-spin')} />
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
          ) : (
            <button onClick={onConnect} className="btn btn-primary !text-xs !px-4 !py-2 flex-1">
              <Zap size={13} /> Connect Salla
            </button>
          )
        ) : live ? (
          <button onClick={onSync} disabled={syncing} className="btn btn-primary !text-xs !px-4 !py-2 flex-1">
            <RefreshCw size={13} className={cn(syncing && 'animate-spin')} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        ) : (
          <button onClick={() => setShowSteps((v) => !v)} className="btn btn-outline !text-xs !px-4 !py-2 flex-1">
            Setup required
          </button>
        )}
        <button
          onClick={() => setShowSteps((v) => !v)}
          aria-expanded={showSteps}
          className="icon-btn w-8 h-8 shrink-0"
          aria-label="Toggle setup steps"
        >
          <ChevronDown size={14} className={cn('transition-transform', showSteps && 'rotate-180')} />
        </button>
      </div>

      {/* Expandable setup steps */}
      {showSteps && (
        <div className="mt-1 space-y-3 border-t border-[var(--hairline)] pt-3">
          <p className="rounded-lg bg-[var(--surface)] px-3 py-2 text-[11px] leading-relaxed text-[var(--text-muted)]">{setup.gate}</p>
          <ol className="space-y-2.5">
            {setup.steps.map((s, n) => (
              <li key={s.title} className="flex gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--track)] text-[10px] font-bold text-[var(--text-secondary)]">{n + 1}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{s.title}</p>
                  <p className="text-xs leading-relaxed text-[var(--text-muted)]">{s.detail}</p>
                  {s.env && <code className="mt-1 inline-block rounded bg-[var(--track)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">{s.env}</code>}
                </div>
              </li>
            ))}
          </ol>
          {server && !server.configured && server.missing.length > 0 && pid !== 'salla' && (
            <p className="text-[11px] text-[var(--critical)]">Still missing: {server.missing.join(', ')}.</p>
          )}
          <a href={setup.docs} target="_blank" rel="noreferrer" className="inline-block text-xs font-semibold text-[var(--brand)] hover:underline">
            Platform documentation →
          </a>
        </div>
      )}
    </div>
  )
}
