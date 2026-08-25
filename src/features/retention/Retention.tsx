import { useMemo } from 'react'
import { HeartPulse, TrendingUp, Users, Trophy } from 'lucide-react'
import { useApp } from '../../lib/store'
import { LiveBadge } from '../../components/shared/LiveBadge'
import { computeCustomerIntel, SEGMENTS, type SegmentId } from '../../lib/rfm'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function Retention() {
  const { state } = useApp()
  const orders = state.sallaOrders ?? []
  const customers = state.sallaCustomers ?? []
  const intel = useMemo(() => computeCustomerIntel(customers, orders), [customers, orders])

  // ── Cohort grid: first-order month → % who ordered again in M1..M3
  const cohort = useMemo(() => {
    const byCustomer = new Map<string, Date[]>()
    for (const o of orders) {
      if (!o.customer_id || !o.date_created) continue
      const d = new Date(o.date_created)
      if (isNaN(d.getTime())) continue
      const list = byCustomer.get(o.customer_id)
      if (list) list.push(d)
      else byCustomer.set(o.customer_id, [d])
    }
    const cohorts = new Map<string, Set<string>>() // month -> customerIds
    for (const [cid, dates] of byCustomer) {
      dates.sort((a, b) => a.getTime() - b.getTime())
      const first = monthKey(dates[0])
      if (!cohorts.has(first)) cohorts.set(first, new Set())
      cohorts.get(first)!.add(cid)
    }
    const now = new Date()
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(monthKey(d))
    }
    return months.map((m) => {
      const members = [...(cohorts.get(m) ?? [])]
      if (members.length === 0) return { month: m, size: 0, repeat: [null, null, null] as (number | null)[] }
      const repeat = [1, 2, 3].map((offset) => {
        const windowStart = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) + offset, 1).getTime()
        const windowEnd = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) + offset + 1, 1).getTime()
        const buyers = members.filter((cid) =>
          (byCustomer.get(cid) ?? []).some((d) => d.getTime() >= windowStart && d.getTime() < windowEnd),
        ).length
        return Math.round((buyers / members.length) * 100)
      })
      return { month: m, size: members.length, repeat: repeat as (number | null)[] }
    })
  }, [orders])

  // ── LTV bands
  const ltvBands = useMemo(() => {
    const bands = [
      { label: 'Never paid', min: 0, max: 0, color: '#94a3b8', count: 0 },
      { label: '< 200 SAR', min: 0.01, max: 200, color: '#64748b', count: 0 },
      { label: '200–500 SAR', min: 200.01, max: 500, color: '#8b5cf6', count: 0 },
      { label: '500–1K SAR', min: 500.01, max: 1000, color: '#3b82f6', count: 0 },
      { label: '1K–5K SAR', min: 1000.01, max: 5000, color: '#10b981', count: 0 },
      { label: '5K+ SAR 👑', min: 5000.01, max: Infinity, color: '#d29a0c', count: 0 },
    ]
    for (const i of intel) {
      const band = bands.find((b) => i.lifetimeValue >= b.min && i.lifetimeValue <= b.max)
      if (band) band.count++
    }
    return bands
  }, [intel])

  // ── Segment distribution
  const segmentCounts = useMemo(() => {
    const m = new Map<SegmentId, number>()
    for (const i of intel) m.set(i.segment, (m.get(i.segment) ?? 0) + 1)
    return m
  }, [intel])

  const atRisk = (segmentCounts.get('at_risk') ?? 0) + (segmentCounts.get('dormant') ?? 0)
  const champions = segmentCounts.get('champion') ?? 0
  const maxBand = Math.max(...ltvBands.map((b) => b.count), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-[var(--text-muted)]">Who comes back, who walks away — computed live from your orders</div>
        </div>
      </div>

      <LiveBadge />

      {/* Headline stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger">
        {[
          { icon: HeartPulse, label: 'At Risk + Dormant', value: String(atRisk), color: '#f59e0b' },
          { icon: Trophy, label: 'Champions', value: String(champions), color: '#d29a0c' },
          { icon: Users, label: 'Total customers', value: String(intel.length), color: '#3b82f6' },
          { icon: TrendingUp, label: 'Avg LTV', value: `${Math.round(intel.reduce((s, i) => s + i.lifetimeValue, 0) / Math.max(1, intel.length)).toLocaleString()} SAR`, color: '#10b981' },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4 flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${s.color}18` }}>
              <s.icon size={16} style={{ color: s.color }} />
            </span>
            <div>
              <div className="text-xl font-bold text-[var(--text-primary)] tabular-nums">{s.value}</div>
              <div className="text-[11px] text-[var(--text-muted)]">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Cohort retention grid */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Monthly Cohort Repeat Rate</h3>
        <div className="glass-card p-5 overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: 480 }}>
            <thead>
              <tr className="text-[var(--text-muted)]">
                <th className="text-left pb-2 pr-3 font-medium">First order</th>
                <th className="pb-2 px-2 font-medium">Customers</th>
                <th className="pb-2 px-2 font-medium">M+1</th>
                <th className="pb-2 px-2 font-medium">M+2</th>
                <th className="pb-2 px-2 font-medium">M+3</th>
              </tr>
            </thead>
            <tbody>
              {cohort.map((row) => (
                <tr key={row.month} className="border-t border-[var(--hairline)]">
                  <td className="py-2.5 pr-3 font-semibold text-[var(--text-primary)] whitespace-nowrap">
                    {MONTH_NAMES[Number(row.month.slice(5, 7)) - 1]} {row.month.slice(0, 4)}
                  </td>
                  <td className="px-2 text-center tabular-nums text-[var(--text-muted)]">{row.size}</td>
                  {row.repeat.map((r, idx) => {
                    const future = row.size === 0 || r == null
                    const hue = r == null ? 0 : r
                    return (
                      <td key={idx} className="px-1 py-1">
                        <div className="rounded-md py-1.5 text-center tabular-nums font-semibold"
                          style={future
                            ? { background: 'var(--track)', color: 'var(--text-muted)' }
                            : { background: `color-mix(in srgb, #10b981 ${Math.max(8, hue)}%, transparent)`, color: hue > 55 ? '#065f46' : 'var(--text-primary)' }}>
                          {future ? '—' : `${r}%`}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[11px] text-[var(--text-muted)] mt-3">
            Each cell shows the % of that month's first-time buyers who ordered again N months later. Greener = stickier.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LTV bands */}
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Lifetime Value Bands</h3>
          <div className="glass-card p-5 space-y-2.5">
            {ltvBands.map((b) => (
              <div key={b.label} className="flex items-center gap-3">
                <span className="w-24 text-xs text-[var(--text-muted)] shrink-0" dir="ltr">{b.label}</span>
                <div className="flex-1 h-5 rounded-md overflow-hidden bg-[var(--track)]">
                  <div className="h-full rounded-md transition-all duration-700"
                    style={{ width: `${Math.max(b.count ? 4 : 0, (b.count / maxBand) * 100)}%`, background: b.color, opacity: 0.85 }} />
                </div>
                <span className="w-8 text-right text-xs font-bold tabular-nums text-[var(--text-primary)]">{b.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Segment mix */}
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">RFM Segment Mix</h3>
          <div className="glass-card p-5 space-y-2">
            {(Object.keys(SEGMENTS) as SegmentId[]).map((id) => {
              const seg = SEGMENTS[id]
              const n = segmentCounts.get(id) ?? 0
              const pct = intel.length ? Math.round((n / intel.length) * 100) : 0
              return (
                <div key={id} className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: seg.color }} />
                  <span className="text-xs w-20 shrink-0" style={{ color: seg.color }}>{seg.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-[var(--track)] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: seg.color }} />
                  </div>
                  <span className="text-xs tabular-nums text-[var(--text-muted)] w-12 text-right">{n} · {pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
