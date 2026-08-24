import { useEffect, useState } from 'react'
import { RefreshCw, Check, X, AlertTriangle, Cloud } from 'lucide-react'
import { supabase } from '../../lib/supabase'

/** Live platform integrations panel: asks the server which platforms have
    credentials (never secrets), and offers a Sync-now relay to the puller.
    Honest states: Connected / Missing <named env vars> / Not configured. */

interface PlatformStatus {
  configured: boolean
  account: string | null
  missing: string[]
}

const LABELS: Record<string, string> = {
  google_ads: 'Google Ads',
  tiktok_ads: 'TikTok Ads',
  snap_ads: 'Snapchat Ads',
  salla: 'Salla Store',
}

export function IntegrationsPanel() {
  const [platforms, setPlatforms] = useState<Record<string, PlatformStatus> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [sallaSyncMsg, setSallaSyncMsg] = useState<string | null>(null)

  const load = async () => {
    if (!supabase) { setError('Supabase not configured.'); return }
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) { setError('Sign in required.'); return }
    try {
      const res = await fetch('/api/integrations/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) setError(json.error ?? `Status ${res.status}`)
      else setPlatforms(json.platforms)
    } catch (e) {
      setError(String((e as Error).message))
    }
  }

  useEffect(() => { void load() }, [])

  const syncNow = async () => {
    if (!supabase) return
    setSyncing(true)
    setSyncMsg(null)
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    try {
      const res = await fetch('/api/integrations/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      setSyncMsg(res.ok ? 'Sync complete — KPIs refreshed.' : (json.error ?? `Sync failed (${res.status})`))
      if (res.ok) void load()
    } catch (e) {
      setSyncMsg(String((e as Error).message))
    }
    setSyncing(false)
  }

  const syncSalla = async () => {
    if (!supabase) return
    setSyncing(true)
    setSallaSyncMsg(null)
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    try {
      const res = await fetch('/api/salla/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (res.ok && json.results) {
        const r = json.results as Record<string, string>
        setSallaSyncMsg(`Sync complete: ${Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(' · ')}`)
        void load()
      } else {
        setSallaSyncMsg(json.message ?? json.error ?? `Sync failed (${res.status})`)
      }
    } catch (e) {
      setSallaSyncMsg(String((e as Error).message))
    }
    setSyncing(false)
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <Cloud size={15} className="text-[var(--brand)]" />
          Live puller: yesterday's spend & sales per platform, every 3 hours.
        </div>
        <div className="flex gap-2 shrink-0">
          {/* Salla data sync */}
          <button onClick={syncSalla} disabled={syncing} className="btn btn-outline !text-xs !px-3 !py-1.5">
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            Sync Salla Data
          </button>
          {/* Ads sync */}
          <button onClick={syncNow} disabled={syncing} className="btn btn-primary !text-xs !px-3 !py-1.5">
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            Sync Ads
          </button>
        </div>
      </div>

      {sallaSyncMsg && (
        <div className={`text-xs px-3 py-2 rounded-lg ${sallaSyncMsg.includes('error') ? 'bg-[var(--critical-soft)] text-[var(--critical)]' : 'bg-[var(--positive-soft)] text-[var(--positive)]'}`}>
          {sallaSyncMsg}
        </div>
      )}

      {syncMsg && (
        <div className={`text-xs px-3 py-2 rounded-lg ${syncMsg.includes('complete') ? 'bg-[var(--positive-soft)] text-[var(--positive)]' : 'bg-[var(--warning-soft)] text-[var(--warning)]'}`}>
          {syncMsg}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 text-xs text-[var(--critical)] bg-[var(--critical-soft)] rounded-lg px-3 py-2">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {platforms == null ? (
        <div className="text-sm text-[var(--text-muted)]">Checking platform credentials…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(platforms).map(([id, st]) => (
            <div key={id} className="rounded-xl border border-[var(--border)] p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-semibold text-[var(--text-primary)]">{LABELS[id] ?? id}</span>
                {st.configured ? (
                  <span className="badge bg-[var(--positive-soft)] text-[var(--positive)]"><Check size={11} /> Ready</span>
                ) : (
                  <span className="badge bg-[var(--warning-soft)] text-[var(--warning)]"><X size={11} /> Needs setup</span>
                )}
              </div>
              {st.configured ? (
                st.account && <div className="text-xs text-[var(--text-muted)]">Account: {st.account}</div>
              ) : (
                <div className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Missing server secrets:
                  <code className="block mt-1 text-[10px] font-mono text-[var(--text-secondary)]">{st.missing.join(', ')}</code>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
        Set each platform's secrets with <code className="font-mono">npx wrangler pages secret put &lt;NAME&gt;</code>, then deploy once.
        Secrets live on the server only — the browser never sees them.
      </p>
    </div>
  )
}
