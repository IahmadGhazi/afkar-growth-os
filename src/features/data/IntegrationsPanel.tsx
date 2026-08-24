import { useEffect, useState } from 'react'
import { RefreshCw, Check, ChevronDown, ShieldCheck, Lock, AlertTriangle } from 'lucide-react'
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
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)

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

  const syncNow = async () => {
    setSyncing(true); setSyncResult(null); setNotConfigured(false)
    const token = (await supabase?.auth.getSession())?.data.session?.access_token
    if (!token) { setSyncResult('Sign in required.'); setSyncing(false); return }
    try {
      const res = await fetch('/api/integrations/sync', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 501) { setNotConfigured(true); setSyncing(false); return }
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.ok) { setSyncResult(body?.error ?? `Sync failed (${res.status})`); setSyncing(false); return }
      const lines = (body.pulled ?? []).map((p: any) => `${p.platform}: ${p.status}`).join(' · ')
      setSyncResult(lines || 'Sync complete.')
      void load()
    } catch (e) { setSyncResult(String((e as Error).message)) }
    setSyncing(false)
  }

  const liveCount = status ? Object.values(status).filter((s) => s.configured).length : 0

  return (
    <div className="space-y-7">
      {/* Sync status strip */}
      <div className="glass-card rounded-2xl p-5">
        {error && (
          <div className="flex items-start gap-2 text-xs text-[var(--critical)] bg-[var(--critical-soft)] rounded-lg px-3 py-2 mb-3">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}
        <div className="text-sm font-semibold text-[var(--text-primary)] mb-1">
          {checked && liveCount === 0
            ? 'No platform tokens configured yet. Each card below has the exact steps.'
            : `The puller runs every 3 hours. ${liveCount} of 5 platforms have tokens.`}
        </div>
        <div className="mt-3 space-y-2">
          {(Object.keys(PLATFORM_SETUP) as PlatformId[]).map((pid) => {
            const meta = PLATFORM_META[pid]
            const st = status?.[pid]
            const dot = !st ? 'bg-[var(--track)]' : st.configured ? 'bg-[var(--positive)] breathing-dot' : 'bg-[var(--track)]'
            const label = !st ? 'Never synced' : st.configured ? `Token set${st.account ? ` · ${st.account}` : ''}` : 'No token yet'
            return (
              <div key={pid} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3.5 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', dot)} />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{meta.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">{label}</span>
                </div>
                {st?.missing && st.missing.length > 0 && (
                  <span className="text-[10px] text-[var(--critical)] truncate max-w-[200px]" title={st.missing.join(', ')}>
                    missing: {st.missing.join(', ')}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--hairline)] pt-4">
          <button
            onClick={syncNow}
            disabled={syncing}
            className="btn btn-primary !text-xs !px-4 !py-2"
          >
            <RefreshCw size={14} className={cn(syncing && 'animate-spin')} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
          <span className="text-[10px] text-[var(--text-muted)]">Runs automatically every 3 hours. The button asks the puller to run now.</span>
        </div>
        {syncResult && (
          <div className="mt-2 text-xs text-[var(--text-secondary)] bg-[var(--surface)] rounded-lg px-3 py-2">{syncResult}</div>
        )}
        {notConfigured && (
          <div className="mt-2 text-xs text-[var(--warning)]">The puller is not wired yet. Set ADS_PULLER_URL and ADS_PULLER_TOKEN as Pages secrets.</div>
        )}
      </div>

      {/* Platform setup cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(PLATFORM_SETUP) as PlatformId[]).map((pid) => (
          <PlatformCard key={pid} pid={pid} server={status?.[pid]} />
        ))}
      </div>

      {/* Security notes */}
      <div className="glass-card rounded-2xl p-6">
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-[var(--positive-soft)] p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--positive-soft)] text-[var(--positive)]">
            <Lock size={18} />
          </span>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Every token used here is read-only. The puller can look at performance; it cannot move money, change budgets, or post. Tokens live only in server secrets.
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

function PlatformCard({ pid, server }: { pid: PlatformId; server?: PlatformStatus }) {
  const setup = PLATFORM_SETUP[pid]
  const meta = PLATFORM_META[pid]
  const [showSteps, setShowSteps] = useState(false)
  const live = Boolean(server?.configured)

  return (
    <div className="glass-card rounded-2xl p-5">
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--positive-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--positive)] ring-1 ring-[var(--positive)]/20">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--positive)] breathing-dot" /> Token set
          </span>
        ) : (
          <span className="rounded-full bg-[var(--track)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)]">No token</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {meta.scopes.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
            <Check size={9} /> {s}
          </span>
        ))}
        <span className="ml-auto rounded bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
          {DIFFICULTY_LABEL[setup.difficulty]}
        </span>
      </div>

      <div className="mt-3 border-t border-[var(--hairline)] pt-3">
        <button
          onClick={() => setShowSteps((v) => !v)}
          aria-expanded={showSteps}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand)] hover:underline"
        >
          {showSteps ? 'Hide' : 'How to connect'} <ChevronDown size={13} className={cn('transition-transform', showSteps && 'rotate-180')} />
        </button>

        {showSteps && (
          <div className="mt-3 space-y-3">
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
            {server && !server.configured && server.missing.length > 0 && (
              <p className="text-[11px] text-[var(--critical)]">Still missing on the server: {server.missing.join(', ')}.</p>
            )}
            <a href={setup.docs} target="_blank" rel="noreferrer" className="inline-block text-xs font-semibold text-[var(--brand)] hover:underline">
              Platform documentation →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
