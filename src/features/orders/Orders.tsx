import { useMemo, useState } from 'react'
import { Search, ShoppingBag } from 'lucide-react'
import { useApp } from '../../lib/store'
import { EmptyState } from '../../components/shared/ui'
import type { SallaOrder } from '../../types/database'

const STATUS_TONES: Record<string, string> = {
  completed: 'var(--positive)',
  delivered: 'var(--positive)',
  shipped: 'var(--brand)',
  payment_completed: 'var(--warning)',
  cancelled: 'var(--critical)',
  refunded: 'var(--critical)',
}

const statusLabel = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export function Orders() {
  const { state } = useApp()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const orders = state.sallaOrders ?? []

  const statuses = useMemo(() => [...new Set(orders.map((o) => o.status))], [orders])

  const filtered = useMemo(() => {
    let list = orders
    if (statusFilter !== 'all') list = list.filter((o) => o.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((o) =>
        String(o.salla_id).includes(q) ||
        (o.payment_method ?? '').toLowerCase().includes(q),
      )
    }
    return list.sort((a, b) => (b.date_created ?? '').localeCompare(a.date_created ?? ''))
  }, [orders, statusFilter, search])

  const totalRevenue = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'refunded').reduce((s, o) => s + o.total_amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Orders</h2>
          <div className="text-sm text-[var(--text-muted)]">{orders.length} orders · {totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} SAR revenue</div>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatusFilter('all')} className={`chip ${statusFilter === 'all' ? '!border-[var(--brand)] !text-[var(--brand)] font-semibold' : ''}`}>
          All <span className="ml-0.5 opacity-70">{orders.length}</span>
        </button>
        {statuses.map((s) => {
          const count = orders.filter((o) => o.status === s).length
          return (
            <button key={s} onClick={() => setStatusFilter(s)} className={`chip ${statusFilter === s ? '!border-[var(--brand)] !text-[var(--brand)] font-semibold' : ''}`}>
              {statusLabel(s)} <span className="ml-0.5 opacity-70">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by order ID or payment method…" className="field !pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No orders found" hint="Sync from Salla to load your order history." />
      ) : (
        <div className="glass-card divide-y divide-[var(--hairline)] overflow-hidden">
          {filtered.map((o: SallaOrder) => (
            <div key={o.id} className="px-4 sm:px-5 py-3.5 hover:bg-[var(--hover)] transition-colors">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">#{o.salla_id}</span>
                    <span className="badge shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${STATUS_TONES[o.status] ?? 'var(--text-muted)'} 12%, transparent)`, color: STATUS_TONES[o.status] ?? 'var(--text-muted)' }}>
                      {statusLabel(o.status)}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">
                    {o.items_count} items · {o.payment_method ?? 'unknown'} · {o.selling_channel ?? 'online'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{o.total_amount.toLocaleString()} SAR</div>
                  <div className="text-xs text-[var(--text-muted)]">{o.date_created ? new Date(o.date_created).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</div>
                </div>
              </div>
              {/* Items preview */}
              {o.items && o.items.length > 0 && (
                <div className="mt-1.5 text-xs text-[var(--text-muted)] pl-0.5">
                  {o.items.slice(0, 3).map((item, i) => (
                    <span key={i}>{i > 0 && ' · '}{item.name} ×{item.qty}</span>
                  ))}
                  {o.items.length > 3 && ` +${o.items.length - 3} more`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
