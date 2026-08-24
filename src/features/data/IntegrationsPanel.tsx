import { useEffect, useState } from 'react'
import { RefreshCw, Check, X, AlertTriangle, Cloud, Zap, Link2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

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
  const [syncing, setSyncing] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [autoSync, setAutoSync] = useState(() => {
    try { return localStorage.getItem('afkar-auto-sync') !== 'false' } catch { return true }
  })

  const toggleAutoSync = () => {
    const next = !autoSync
    setAutoSync(next)
    try { localStorage.setItem('afkar-auto-sync', String(next)) } catch {}
  }

  const load = async () => {
    if (!supabase) { setError('Supabase not configured.'); return }
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) { setError('Sign in required.'); return }
    try {
      const res = await fetch('/api/integrations/status', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!res.ok) setError(json.error ?? `Status ${res.status}`)
      else setPlatforms(json.platforms)
    } catch (e) { setError(String((e as Error).message)) }
  }

  useEffect(() => { void load() }, [])

  const getToken = async () => {
    if (!supabase) return null
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }

  const syncPlatform = async (platform: string) => {
    setSyncing(platform)
    setMessages((m) => ({ ...m, [platform]: '' }))
    const token = await getToken()
    if (!token) { setMessages((m) => ({ ...m, [platform]: 'Sign in required.' })); setSyncing(null); return }

    try {
      const path = platform === 'salla' ? '/api/salla/sync' : '/api/integrations/sync'
      const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (res.ok) {
        const results = json.results as Record<string, string> | undefined
        setMessages((m) => ({
          ...m,
          [platform]: results
            ? Object.entries(results).map(([k, v]) => `${k}: ${v}`).join(' · ')
            : 'Sync complete.',
        }))
        void load()
      } else {
        setMessages((m) => ({ ...m, [platform]: json.message ?? json.error ?? `Failed (${res.status})` }))
      }
    } catch (e) {
      setMessages((m) => ({ ...m, [platform]: String((e as Error).message) }))
    }
    setSyncing(null)
  }

  const connectSalla = async () => {
    const token = await getToken()
    if (!token) return
    const res = await fetch('/api/salla/connect', { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 501) {
      setMessages((m) => ({ ...m, salla: 'SALLA_CLIENT_ID not set. Add it as a Cloudflare Pages secret.' }))
      return
    }
    if (res.redirected) window.location.href = res.url
  }

  const isSallaConnected = platforms?.salla?.configured ?? false

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 text-xs text-[var(--critical)] bg-[var(--critical-soft)] rounded-lg px-3 py-2">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Auto-sync toggle */}
      <div className="flex items-center justify-between glass-inset rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <Zap size={15} className="text-[var(--brand)]" />
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">Auto Sync</div>
            <div className="text-xs text-[var(--text-muted)]">Pull data automatically every 3 hours</div>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={autoSync}
          onClick={toggleAutoSync}
          className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${autoSync ? 'bg-[var(--positive)]' : 'bg-[var(--track)]'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${autoSync ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
      </div>

      {platforms == null ? (
        <div className="text-sm text-[var(--text-muted)] py-4 text-center">Checking platform credentials…</div>
      ) : (
        <div className="space-y-3">
          {Object.entries(platforms).map(([id, st]) => {
            const isSalla = id === 'salla'
            const msg = messages[id]
            const isSyncing = syncing === id

            return (
              <div key={id} className="glass-inset rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Cloud size={16} className="text-[var(--brand)]" />
                    <div>
                      <div className="font-semibold text-sm text-[var(--text-primary)]">{LABELS[id] ?? id}</div>
                      {st.account && <div className="text-xs text-[var(--text-muted)]">{st.account}</div>}
                    </div>
                  </div>
                  {st.configured ? (
                    <span className="badge bg-[var(--positive-soft)] text-[var(--positive)]"><Check size={11} /> Ready</span>
                  ) : (
                    <span className="badge bg-[var(--warning-soft)] text-[var(--warning)]"><X size={11} /> Needs setup</span>
                  )}
                </div>

                {!st.configured && st.missing.length > 0 && (
                  <div className="text-xs text-[var(--text-muted)]">
                    Missing: <code className="font-mono text-[10px] text-[var(--text-secondary)]">{st.missing.join(', ')}</code>
                  </div>
                )}

                {msg && (
                  <div className={`text-xs px-3 py-2 rounded-lg ${msg.includes('error') || msg.includes('Fail') || msg.includes('not_configured') || msg.includes('no_salla') ? 'bg-[var(--critical-soft)] text-[var(--critical)]' : 'bg-[var(--positive-soft)] text-[var(--positive)]'}`}>
                    {msg}
                  </div>
                )}

                {/* Per-platform actions */}
                {isSalla ? (
                  <div className="flex items-center gap-2">
                    {isSallaConnected ? (
                      <button onClick={() => syncPlatform('salla')} disabled={isSyncing} className="btn btn-primary !text-xs !px-3 !py-1.5 flex-1">
                        <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                        {isSyncing ? 'Syncing…' : 'Sync Now'}
                      </button>
                    ) : (
                      <button onClick={connectSalla} className="btn btn-primary !text-xs !px-3 !py-1.5 flex-1">
                        <Link2 size={12} /> Connect Salla
                      </button>
                    )}
                  </div>
                ) : st.configured ? (
                  <button onClick={() => syncPlatform(id)} disabled={isSyncing} className="btn btn-outline !text-xs !px-3 !py-1.5 w-full">
                    <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                    Sync Now
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
        Missing secrets? Set them with <code className="font-mono">npx wrangler pages secret put &lt;NAME&gt;</code> then redeploy.
      </p>
    </div>
  )
}
