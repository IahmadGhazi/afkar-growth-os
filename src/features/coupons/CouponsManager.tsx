import { useEffect, useMemo, useState } from 'react'
import { TicketPercent, Trash2, RefreshCw, Sparkles, Clock, Users, ShoppingCart } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from '../../lib/toast'

interface SallaCoupon {
  id: number
  code: string
  type: string
  amount: number | null
  status: string
  isGroup: boolean
  expiryDate: string | null
  startDate: string | null
  freeShipping: boolean
  usage: { times: number | null; customers: number | null; sales: number | null }
}

/**
 * Coupon generation logic — every preset maps a BUSINESS SITUATION to a
 * proven discount size, because discount depth is psychology:
 *  - Recovery (15%): cart abandonment = hesitation, not rejection. A gift
 *    sized "meaningful but not desperate" converts fence-sitters.
 *  - Win-back (20%): dormant customers need a stronger jolt to break inertia.
 *  - VIP (10%): champions don't need money off — a small exclusive token
 *    signals status without training them to wait for sales.
 *  - First order (10%): lowers the risk barrier for strangers.
 *  - Flash (25%): short-window events; high depth + tiny window = spike.
 */
const PRESETS: { id: string; label: string; percent: number; hours: number; why: string }[] = [
  { id: 'recovery', label: '🛒 Cart recovery', percent: 15, hours: 48, why: 'Hesitation, not rejection — a meaningful gift converts fence-sitters' },
  { id: 'winback', label: '😴 Win-back', percent: 20, hours: 168, why: 'Dormant customers need a stronger jolt to break inertia' },
  { id: 'vip', label: '👑 VIP exclusive', percent: 10, hours: 72, why: 'Champions want status, not charity — small + exclusive' },
  { id: 'first', label: '🌱 First order', percent: 10, hours: 336, why: 'Lowers the risk barrier for strangers' },
  { id: 'flash', label: '⚡ Flash sale', percent: 25, hours: 24, why: 'High depth + tiny window = urgency spike' },
]

export function CouponsManager() {
  const [coupons, setCoupons] = useState<SallaCoupon[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [preset, setPreset] = useState(PRESETS[0])
  const [customPercent, setCustomPercent] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const percent = customPercent ?? preset.percent
  const hours = preset.hours

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await supabase!.auth.getSession()
      const token = data.session?.access_token
      if (!token) { setError('Sign in required'); return }
      const res = await fetch('/api/salla/coupons', { headers: { Authorization: `Bearer ${token}` } })
      const body = await res.json()
      if (res.ok && body.ok) setCoupons(body.coupons)
      else setError(String(body.detail ?? body.error ?? res.status))
    } catch (e) {
      setError(String((e as Error).message).slice(0, 120))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const create = async () => {
    setCreating(true)
    try {
      const { data } = await supabase!.auth.getSession()
      const token = data.session?.access_token
      const res = await fetch('/api/salla/coupons/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ percentOff: percent, validHours: hours }),
      })
      const body = await res.json()
      if (res.ok && body.ok) {
        toast.success(`Coupon ${body.code} live — ${percent}% for ${hours}h`)
        await load()
      } else {
        const raw = String(body.detail ?? body.error ?? res.status)
        toast.error(raw.includes('marketing.read_write')
          ? 'Token lacks marketing scope — reconnect Salla'
          : raw.slice(0, 130))
      }
    } finally {
      setCreating(false)
    }
  }

  const remove = async (c: SallaCoupon) => {
    if (!window.confirm(`Delete coupon ${c.code} from your Salla store?`)) return
    try {
      const { data } = await supabase!.auth.getSession()
      const token = data.session?.access_token
      const res = await fetch(`/api/salla/coupons?id=${c.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const body = await res.json().catch(() => ({}) as Record<string, unknown>)
      if (res.ok && body.ok) { toast.success(`${c.code} deleted`); await load() }
      else toast.error(`Delete failed: ${String(body.error ?? res.status).slice(0, 100)}`)
    } catch (e) { toast.error(String((e as Error).message).slice(0, 100)) }
  }

  const sorted = useMemo(() => {
    if (!coupons) return []
    return coupons.slice().sort((a, b) => (b.usage.times ?? -1) - (a.usage.times ?? -1))
  }, [coupons])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <TicketPercent size={17} style={{ color: '#d29a0c' }} /> Coupons
          </h2>
          <div className="text-sm text-[var(--text-muted)]">Real discount codes in your Salla store — minted, tracked, cleaned up here.</div>
        </div>
        <button onClick={() => void load()} className="btn btn-outline !text-xs !px-3 !py-2 inline-flex items-center gap-1.5">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Forge */}
      <div className="glass-card p-5 space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
          <Sparkles size={12} /> Mint a new coupon
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.id} onClick={() => { setPreset(p); setCustomPercent(null) }}
              className={`chip !px-3 !py-1.5 text-xs ${(preset.id === p.id && customPercent == null) ? 'font-bold' : ''}`}
              style={(preset.id === p.id && customPercent == null) ? { borderColor: '#d29a0c88', color: '#d29a0c', background: 'rgba(240,196,46,.12)' } : undefined}>
              {p.label} · {p.percent}%
            </button>
          ))}
        </div>
        <div className="text-[11px] text-[var(--text-muted)] italic">{preset.why}</div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">Discount</span>
            <input type="number" min={1} max={90} value={customPercent ?? preset.percent}
              onChange={(e) => setCustomPercent(Math.min(90, Math.max(1, Number(e.target.value) || 1)))}
              className="field !w-20 !py-1.5 !text-sm tabular-nums" />
            <span className="text-xs text-[var(--text-muted)]">%</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-muted)]">Expires in {hours >= 24 ? `${Math.round(hours / 24)} day${hours >= 48 ? 's' : ''}` : `${hours}h`}</span>
          </div>
          <button onClick={() => void create()} disabled={creating}
            className="btn btn-primary !text-xs !px-4 !py-2 inline-flex items-center gap-1.5 ml-auto">
            <TicketPercent size={13} /> {creating ? 'Minting…' : `Mint ${percent}% coupon`}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,.25)' }}>
          {error}
        </div>
      )}

      {/* List */}
      {coupons === null && !error ? (
        <div className="glass-card p-8 text-center text-sm text-[var(--text-muted)]">Loading your coupons…</div>
      ) : sorted.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <div className="text-sm font-semibold text-[var(--text-primary)]">No coupons yet</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Mint your first one above — it appears in your Salla store instantly.</div>
        </div>
      ) : (
        <div className="glass-card divide-y divide-[var(--hairline)] overflow-hidden">
          {sorted.map((c) => {
            const expired = c.expiryDate ? new Date(c.expiryDate.replace(' ', 'T')).getTime() < Date.now() : false
            const dead = c.status !== 'active' || expired
            return (
              <div key={c.id} className="px-4 sm:px-5 py-3 flex items-center gap-3 sm:gap-4">
                <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 font-mono text-[10px] font-bold"
                  style={{ background: dead ? 'var(--track)' : 'rgba(240,196,46,.14)', color: dead ? 'var(--text-muted)' : '#d29a0c' }}>
                  {c.type === 'percentage' ? `${c.amount ?? '?'}%` : 'FIX'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[var(--text-primary)] font-mono">{c.code}</span>
                    {c.isGroup && <span className="badge bg-[var(--track)] text-[var(--text-muted)] text-[9px]">group</span>}
                    <span className="badge text-[9px]" style={
                      dead ? { background: 'var(--track)', color: 'var(--text-muted)' }
                        : { background: 'rgba(16,185,129,.12)', color: '#10b981' }
                    }>{expired ? 'expired' : c.status}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--text-muted)] mt-0.5">
                    {c.expiryDate && <span>exp {c.expiryDate.slice(0, 10)}</span>}
                    {c.usage.times != null && (
                      <span className="flex items-center gap-1"><Users size={10} /> {c.usage.times} uses · {c.usage.customers ?? 0} customers</span>
                    )}
                    {c.usage.sales != null && c.usage.sales > 0 && (
                      <span className="flex items-center gap-1 font-semibold text-[var(--positive)]"><ShoppingCart size={10} /> {Math.round(c.usage.sales).toLocaleString()} SAR earned</span>
                    )}
                  </div>
                </div>
                <button onClick={() => void remove(c)} title="Delete from Salla store"
                  className="btn !px-2.5 !py-1.5 shrink-0" style={{ color: '#ef4444' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
