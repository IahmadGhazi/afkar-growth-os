import { useEffect, useMemo, useState } from 'react'
import { TicketPercent, Trash2, RefreshCw, Sparkles, Clock, Users, ShoppingCart, Pencil, Power, Plus, Brain } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from '../../lib/toast'
import { useApp } from '../../lib/store'

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

interface Preset { id: string; label: string; percent: number; hours: number; why: string }

const DEFAULT_PRESETS: Preset[] = [
  { id: 'recovery', label: '🛒 Cart recovery', percent: 15, hours: 48, why: 'Hesitation, not rejection — a meaningful gift converts fence-sitters' },
  { id: 'winback', label: '😴 Win-back', percent: 20, hours: 168, why: 'Dormant customers need a stronger jolt to break inertia' },
  { id: 'vip', label: '👑 VIP exclusive', percent: 10, hours: 72, why: 'Champions want status, not charity — small + exclusive' },
  { id: 'first', label: '🌱 First order', percent: 10, hours: 336, why: 'Lowers the risk barrier for strangers' },
  { id: 'flash', label: '⚡ Flash sale', percent: 25, hours: 24, why: 'High depth + tiny window = urgency spike' },
]

/** Doctrine hints — the bot whispers while you type */
function doctrine(percent: number): string {
  if (percent < 8) return 'Status play — signals exclusivity, barely touches margin. Best for loyal/VIP.'
  if (percent <= 12) return 'Conversion sweet spot — enough to tip a decision without training customers to wait for sales.'
  if (percent <= 18) return 'Rescue territory — for warm carts and one-time buyers who need a real reason.'
  if (percent <= 25) return 'Jolt dose — dormant/win-back and flash windows only. Never routine.'
  return '⚠️ Margin burner — above 25% needs a strategic reason (clearance, win-back war). Use sparingly.'
}

export function CouponsManager() {
  const { state, actions } = useApp()
  const [coupons, setCoupons] = useState<SallaCoupon[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Playbook: fully editable, persisted in client settings (survives devices)
  const client = state.clients.find((c) => c.id === state.currentClientId) ?? state.clients[0] ?? null
  const playbook: Preset[] = useMemo(() => {
    const saved = (client?.settings as { coupon_playbook?: Preset[] } | null)?.coupon_playbook
    return Array.isArray(saved) && saved.length ? saved : DEFAULT_PRESETS
  }, [client])
  const [presetId, setPresetId] = useState<string>(DEFAULT_PRESETS[0].id)
  const [customPercent, setCustomPercent] = useState<number | null>(null)
  const [editPreset, setEditPreset] = useState<Preset | null>(null)

  const preset = playbook.find((p) => p.id === presetId) ?? playbook[0] ?? DEFAULT_PRESETS[0]
  const percent = customPercent ?? preset.percent
  const hours = preset.hours

  const savePlaybook = async (next: Preset[]) => {
    if (!client) { toast.error('No client context'); return }
    const settings = { ...(client.settings as Record<string, unknown> ?? {}), coupon_playbook: next }
    actions.updateClient(client.id, { settings } as never)
    toast.success('Playbook saved — it follows you across devices')
  }

  // ── Edit modal state
  const [editing, setEditing] = useState<SallaCoupon | null>(null)
  const [editPercent, setEditPercent] = useState(10)
  const [editExpiry, setEditExpiry] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

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

  const authedFetch = async (path: string, init?: RequestInit) => {
    const { data } = await supabase!.auth.getSession()
    return fetch(path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token}`, ...(init?.headers ?? {}) } })
  }

  const create = async () => {
    setCreating(true)
    try {
      const res = await authedFetch('/api/salla/coupons/create', {
        method: 'POST',
        body: JSON.stringify({ percentOff: percent, validHours: hours }),
      })
      const body = await res.json()
      if (res.ok && body.ok) {
        toast.success(`Coupon ${body.code} live — ${percent}% for ${hours}h`)
        await load()
      } else {
        const raw = String(body.detail ?? body.error ?? res.status)
        toast.error(raw.includes('marketing.read_write') ? 'Token lacks marketing scope — reconnect Salla' : raw.slice(0, 130))
      }
    } finally { setCreating(false) }
  }

  const saveEdit = async () => {
    if (!editing) return
    setSavingEdit(true)
    try {
      const res = await authedFetch('/api/salla/coupons/update', {
        method: 'POST',
        body: JSON.stringify({ id: editing.id, percentOff: editPercent, expiresAt: editExpiry || undefined }),
      })
      const body = await res.json()
      if (res.ok && body.ok) { toast.success(`${editing.code} updated`); setEditing(null); await load() }
      else toast.error(`Update failed: ${String(body.detail ?? body.error ?? res.status).slice(0, 120)}`)
    } finally { setSavingEdit(false) }
  }

  const toggleStatus = async (c: SallaCoupon) => {
    const next = c.status === 'active' ? 'inactive' : 'active'
    const res = await authedFetch('/api/salla/coupons/update', {
      method: 'POST', body: JSON.stringify({ id: c.id, status: next }),
    })
    const body = await res.json().catch(() => ({}) as Record<string, unknown>)
    if (res.ok && body.ok) { toast.success(`${c.code} ${next === 'active' ? 'activated' : 'paused'}`); await load() }
    else toast.error(`Status change rejected: ${String(body.detail ?? body.error ?? res.status).slice(0, 110)}`)
  }

  const remove = async (c: SallaCoupon) => {
    if (!window.confirm(`Delete coupon ${c.code} from your Salla store?`)) return
    try {
      const res = await authedFetch(`/api/salla/coupons?id=${c.id}`, { method: 'DELETE' })
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
          <div className="text-sm text-[var(--text-muted)]">Full control: mint, edit numbers, pause, resume, delete — with a brain that advises.</div>
        </div>
        <button onClick={() => void load()} className="btn btn-outline !text-xs !px-3 !py-2 inline-flex items-center gap-1.5">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ── PLAYBOOK (fully editable) */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <Sparkles size={12} /> Your playbook
          </div>
          <button onClick={() => setEditPreset({ id: `p_${Date.now()}`, label: 'New play', percent: 10, hours: 48, why: '' })}
            className="btn btn-outline !text-[11px] !px-2.5 !py-1 inline-flex items-center gap-1">
            <Plus size={11} /> Add play
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {playbook.map((p) => (
            <span key={p.id}
              className={`chip !px-3 !py-1.5 text-xs inline-flex items-center gap-1.5 cursor-pointer group ${(presetId === p.id && customPercent == null) ? 'font-bold' : ''}`}
              style={(presetId === p.id && customPercent == null) ? { borderColor: '#d29a0c88', color: '#d29a0c', background: 'rgba(240,196,46,.12)' } : undefined}
              onClick={() => { setPresetId(p.id); setCustomPercent(null) }}
              title={p.why}>
              {p.label} · {p.percent}%
              <button onClick={(e) => { e.stopPropagation(); setEditPreset(p) }} className="opacity-40 hover:opacity-100" title="Edit play"><Pencil size={10} /></button>
              {playbook.length > 1 && (
                <button onClick={(e) => { e.stopPropagation(); void savePlaybook(playbook.filter((x) => x.id !== p.id)) }} className="opacity-40 hover:opacity-100" style={{ color: '#ef4444' }} title="Delete play"><Trash2 size={10} /></button>
              )}
            </span>
          ))}
        </div>
        <div className="text-[11px] text-[var(--text-muted)] italic">{preset.why || '—'}</div>

        <div className="flex flex-wrap items-center gap-4 pt-1">
          <div className="flex items-center gap-2">
            <Brain size={14} style={{ color: '#8b5cf6' }} />
            <span className="text-xs text-[var(--text-muted)]">Doctrine:</span>
            <span className="text-xs text-[var(--text-primary)]">{doctrine(percent)}</span>
          </div>
        </div>

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

      {/* ── LIST */}
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
                <button onClick={() => { setEditing(c); setEditPercent(c.type === 'percentage' ? (c.amount ?? 10) : 10); setEditExpiry(c.expiryDate ? c.expiryDate.slice(0, 10) : '') }}
                  title="Edit numbers / expiry" className="btn !px-2.5 !py-1.5 shrink-0"><Pencil size={13} /></button>
                <button onClick={() => void toggleStatus(c)} disabled={expired}
                  title={c.status === 'active' ? 'Pause (deactivate)' : 'Activate'}
                  className="btn !px-2.5 !py-1.5 shrink-0" style={{ color: c.status === 'active' ? '#f59e0b' : '#10b981' }}>
                  <Power size={13} />
                </button>
                <button onClick={() => void remove(c)} title="Delete from Salla store"
                  className="btn !px-2.5 !py-1.5 shrink-0" style={{ color: '#ef4444' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── EDIT MODAL */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setEditing(null)} />
          <div className="relative glass-card p-6 w-full max-w-sm space-y-4 animate-[pulseIn_.3s_var(--ease-spring)_both]">
            <div className="text-sm font-bold text-[var(--text-primary)]">Edit <span className="font-mono">{editing.code}</span></div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide">Discount %</label>
                <input type="number" min={1} max={90} value={editPercent}
                  onChange={(e) => setEditPercent(Math.min(90, Math.max(1, Number(e.target.value) || 1)))}
                  className="field !py-2 tabular-nums" />
                <div className="text-[10px] text-[var(--text-muted)] mt-1">{doctrine(editPercent)}</div>
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide">Expiry date</label>
                <input type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} className="field !py-2" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="btn btn-outline !text-xs">Cancel</button>
              <button onClick={() => void saveEdit()} disabled={savingEdit} className="btn btn-primary !text-xs">
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PLAYBOOK EDIT MODAL */}
      {editPreset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setEditPreset(null)} />
          <div className="relative glass-card p-6 w-full max-w-sm space-y-3 animate-[pulseIn_.3s_var(--ease-spring)_both]">
            <div className="text-sm font-bold text-[var(--text-primary)]">{playbook.some((p) => p.id === editPreset.id) ? 'Edit play' : 'New play'}</div>
            <input value={editPreset.label} onChange={(e) => setEditPreset({ ...editPreset, label: e.target.value })}
              placeholder="Name (e.g. 🎉 Eid special)" className="field !py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[var(--text-muted)] uppercase">Percent</label>
                <input type="number" min={1} max={90} value={editPreset.percent}
                  onChange={(e) => setEditPreset({ ...editPreset, percent: Math.min(90, Math.max(1, Number(e.target.value) || 1)) })}
                  className="field !py-2 tabular-nums" />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-muted)] uppercase">Hours valid</label>
                <input type="number" min={1} max={2160} value={editPreset.hours}
                  onChange={(e) => setEditPreset({ ...editPreset, hours: Math.min(2160, Math.max(1, Number(e.target.value) || 1)) })}
                  className="field !py-2 tabular-nums" />
              </div>
            </div>
            <textarea value={editPreset.why} onChange={(e) => setEditPreset({ ...editPreset, why: e.target.value })}
              placeholder="Why this dose? (shown as reminder)" className="field !py-2 text-xs" rows={2} />
            <div className="text-[10px] text-[var(--text-muted)]">{doctrine(editPreset.percent)}</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditPreset(null)} className="btn btn-outline !text-xs">Cancel</button>
              <button onClick={() => {
                const exists = playbook.some((p) => p.id === editPreset.id)
                const next = exists ? playbook.map((p) => p.id === editPreset.id ? editPreset : p) : [...playbook, editPreset]
                void savePlaybook(next)
                setPresetId(editPreset.id); setCustomPercent(null)
                setEditPreset(null)
              }} className="btn btn-primary !text-xs">Save play</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
