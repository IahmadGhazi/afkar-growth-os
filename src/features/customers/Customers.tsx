import { useMemo, useState } from 'react'
import { Search, Users, Mail, Phone, MapPin, Crown } from 'lucide-react'
import { useApp } from '../../lib/store'
import { scopeSalla } from '../../lib/selectors'
import { EmptyState } from '../../components/shared/ui'
import { computeCustomerIntel, SEGMENTS, type CustomerIntel, type SegmentId } from '../../lib/rfm'
import { CustomerDrawer } from './CustomerDrawer'
import { LiveBadge } from '../../components/shared/LiveBadge'

export function Customers() {
  const { state } = useApp()
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState<SegmentId | null>(null)
  const [selected, setSelected] = useState<CustomerIntel | null>(null)
  const customers = useMemo(
    () => scopeSalla(state, state.sallaCustomers),
    [state.sallaCustomers, state.clients],
  )
  const orders = useMemo(
    () => scopeSalla(state, state.sallaOrders),
    [state.sallaOrders, state.clients],
  )

  const intel = useMemo(() => computeCustomerIntel(customers, orders), [customers, orders])

  const segmentCounts = useMemo(() => {
    const counts = new Map<SegmentId, number>()
    for (const i of intel) counts.set(i.segment, (counts.get(i.segment) ?? 0) + 1)
    return counts
  }, [intel])

  const filtered = useMemo(() => {
    let list = segment ? intel.filter((i) => i.segment === segment) : intel
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((i) => {
        const c = i.customer
        return `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          (c.mobile ?? '').includes(q) ||
          (c.city ?? '').toLowerCase().includes(q) ||
          i.favoriteProducts.some((p) => p.name.toLowerCase().includes(q))
      })
    }
    // champions & biggest spenders float to top
    return list.slice().sort((a, b) => b.lifetimeValue - a.lifetimeValue)
  }, [intel, search, segment])

  const totalValue = intel.reduce((s, i) => s + i.lifetimeValue, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Customers</h2>
          <div className="text-sm text-[var(--text-muted)]">
            {customers.length} customers · {totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} SAR lifetime value · auto-segmented by RFM
          </div>
        </div>
      </div>

      <LiveBadge />

      {/* Smart segments */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSegment(null)}
          className={`chip transition-all ${segment === null ? '!bg-[var(--gold-soft,#f0c42e22)] !border-[#d29a0c55] !text-[var(--text-primary)]' : ''}`}
        >
          All <span className="opacity-60">{intel.length}</span>
        </button>
        {(Object.keys(SEGMENTS) as SegmentId[]).map((id) => {
          const seg = SEGMENTS[id]
          const n = segmentCounts.get(id) ?? 0
          if (n === 0 && id !== 'new') return null
          return (
            <button
              key={id}
              title={seg.hint}
              onClick={() => setSegment(segment === id ? null : id)}
              className={`chip transition-all ${segment === id ? '!font-semibold' : ''}`}
              style={segment === id ? { borderColor: `${seg.color}66`, color: seg.color, background: `${seg.color}18` } : undefined}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: seg.color }} />
              {seg.label} <span className="opacity-60">{n}</span>
            </button>
          )
        })}
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone, city — even products they buy…" className="field !pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title={segment ? `No ${SEGMENTS[segment].label} right now` : 'No customers found'} hint={segment ? SEGMENTS[segment].hint : 'Sync from Salla to load your customer base.'} />
      ) : (
        <div className="glass-card divide-y divide-[var(--hairline)] overflow-hidden">
          {filtered.map((i) => {
            const c = i.customer
            const seg = SEGMENTS[i.segment]
            const isVip = i.rfm.m >= 4 && i.orderCount >= 2
            return (
              <button
                key={c.id}
                onClick={() => setSelected(i)}
                className="w-full text-left px-4 sm:px-5 py-3.5 flex items-center gap-3 sm:gap-4 hover:bg-[var(--hover)] transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f0c42e] to-[#d29a0c] flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-[#1a1405]">{(c.first_name?.charAt(0) ?? '?')}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{c.first_name} {c.last_name}</span>
                    {isVip && (
                      <span className="badge bg-[var(--warning-soft)] text-[var(--warning)] shrink-0 hidden lg:inline-flex">
                        <Crown size={11} /> VIP
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mt-0.5">
                    {c.email && <span className="flex items-center gap-1 truncate"><Mail size={11} />{c.email}</span>}
                    {c.mobile && <span className="hidden sm:flex items-center gap-1"><Phone size={11} />{c.mobile_code}{c.mobile}</span>}
                    {c.city && <span className="hidden md:flex items-center gap-1"><MapPin size={11} />{c.city}</span>}
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium shrink-0"
                  style={{ color: seg.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: seg.color }} />
                  {seg.label}
                </span>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{Math.round(i.lifetimeValue).toLocaleString()} SAR</div>
                  <div className="text-xs text-[var(--text-muted)]">{i.orderCount} orders{isVip ? '' : ` · ${Math.round(i.avgOrderValue).toLocaleString()} avg`}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <CustomerDrawer intel={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
