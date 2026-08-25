import { useState } from 'react'
import { Target, TrendingUp, Pencil, Check } from 'lucide-react'
import { useApp } from '../../lib/store'
import { currentClient } from '../../lib/selectors'

/**
 * GoalGauge — monthly revenue target vs live run-rate.
 * Target persists per client (settings.monthly_target). Edit inline.
 */
export function GoalGauge() {
  const { state, actions } = useApp()
  const client = currentClient(state)
  const target = Number((client?.settings as { monthly_target?: number } | null)?.monthly_target ?? 0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const orders = (state.sallaOrders ?? []).filter(
    (o) => !['canceled', 'cancelled', 'refunded', 'deleted', 'restocked'].includes(o.status),
  )

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const mtd = orders
    .filter((o) => new Date(o.date_created ?? o.synced_at).getTime() >= monthStart)
    .reduce((s, o) => s + o.total_amount, 0)

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayNow = now.getDate()
  const daysLeft = Math.max(1, daysInMonth - dayNow)
  const paceExpected = target > 0 ? (target / daysInMonth) * dayNow : 0
  const pct = target > 0 ? Math.min(100, Math.round((mtd / target) * 100)) : 0
  const onPace = mtd >= paceExpected
  const neededPerDay = target > 0 ? Math.max(0, (target - mtd) / daysLeft) : 0
  const projectedEnd = target > 0 ? (mtd / dayNow) * daysInMonth : 0

  const save = () => {
    const v = Number(draft)
    if (!client || !Number.isFinite(v) || v <= 0) { setEditing(false); return }
    const settings = { ...(client.settings as Record<string, unknown> ?? {}), monthly_target: v }
    actions.updateClient(client.id, { settings } as never)
    setEditing(false)
  }

  // Arc geometry (semi-circle)
  const R = 80
  const CIRC = Math.PI * R // half circumference
  const dash = target > 0 ? CIRC * (pct / 100) : 0

  return (
    <section>
      <div className="glass-card p-6">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-8">
          {/* Gauge */}
          <div className="relative w-44 h-24 shrink-0">
            <svg viewBox="0 0 200 110" className="w-full h-full">
              <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--track)" strokeWidth="14" strokeLinecap="round" />
              {target > 0 && (
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--brand)" strokeWidth="14" strokeLinecap="round"
                  strokeDasharray={`${dash} ${CIRC}`} />
              )}
              <text x="100" y="86" textAnchor="middle" fill="var(--text-primary)" style={{ fontSize: 27, fontWeight: 800 }}>
                {target > 0 ? `${pct}%` : '—'}
              </text>
              <text x="100" y="104" textAnchor="middle" fill="var(--text-muted)" style={{ fontSize: 10 }}>
                of monthly target
              </text>
            </svg>
          </div>

          {/* Numbers */}
          <div className="space-y-2 min-w-[220px]">
            <div className="flex items-center gap-2 text-sm">
              <Target size={14} style={{ color: 'var(--brand)' }} />
              <span className="text-[var(--text-muted)]">Monthly target</span>
              {editing ? (
                <span className="inline-flex items-center gap-1.5">
                  <input type="number" min={1} autoFocus value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
                    className="field !w-28 !py-1 !text-sm tabular-nums" />
                  <button onClick={save} aria-label="Save target" className="p-1 rounded hover:bg-[var(--hover)] text-[var(--positive)]">
                    <Check size={14} />
                  </button>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <b className="text-[var(--text-primary)] tabular-nums">{target > 0 ? `${target.toLocaleString()} SAR` : 'not set'}</b>
                  <button onClick={() => { setDraft(target > 0 ? String(target) : ''); setEditing(true) }}
                    aria-label="Edit monthly target"
                    className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover)] transition-colors">
                    <Pencil size={12} />
                  </button>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp size={14} className="text-[var(--positive)]" />
              <span className="text-[var(--text-muted)]">Month-to-date</span>
              <b className="text-[var(--text-primary)] tabular-nums">{Math.round(mtd).toLocaleString()} SAR</b>
            </div>
            {target > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="w-[14px]" />
                <span className="text-[var(--text-muted)]">Needed / day</span>
                <b className="text-[var(--text-primary)] tabular-nums">{Math.round(neededPerDay).toLocaleString()} SAR</b>
                <span className="text-xs text-[var(--text-muted)]">· {daysLeft}d left</span>
              </div>
            )}
          </div>

          {/* Verdict */}
          {target > 0 && (
            <div className="lg:ml-auto">
              <div className="text-xs px-3 py-2 rounded-lg inline-flex items-center gap-1.5 font-medium"
                style={onPace
                  ? { background: 'rgba(16,185,129,.1)', color: 'var(--positive)' }
                  : { background: 'rgba(245,158,11,.12)', color: '#f59e0b' }}>
                {onPace
                  ? `On pace — projected ${Math.round(projectedEnd).toLocaleString()} SAR`
                  : `Behind pace by ${Math.round(paceExpected - mtd).toLocaleString()} SAR — ${Math.round(neededPerDay).toLocaleString()}/day closes it`}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
