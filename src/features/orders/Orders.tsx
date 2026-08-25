import { useMemo, useState } from 'react'
import { Search, ShoppingBag, Clock, User, CreditCard, Layers, Truck, ShieldAlert } from 'lucide-react'
import { useApp } from '../../lib/store'
import { scopeSalla } from '../../lib/selectors'
import { EmptyState } from '../../components/shared/ui'
import { LiveBadge } from '../../components/shared/LiveBadge'
import { orderStatusMeta, exactDateTime, relativeFromIso, STATUS_ORDER } from '../../lib/orderStatus'
import { computeCustomerIntel, type CustomerIntel } from '../../lib/rfm'
import { CustomerDrawer } from '../customers/CustomerDrawer'
import { OrderDrawer } from './OrderDrawer'
import type { SallaOrder } from '../../types/database'

const itemQty = (it: { qty?: number; quantity?: number }) => it.qty ?? it.quantity ?? 1
const itemName = (it: { name?: string | null }) => (typeof it?.name === 'string' ? it.name : 'Item')

export function Orders() {
  const { state } = useApp()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerIntel | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<SallaOrder | null>(null)
  const cid = state.currentClientId
  void cid
  const orders = useMemo(() => scopeSalla(state, state.sallaOrders), [state.sallaOrders, state.clients])
  const customers = useMemo(() => scopeSalla(state, state.sallaCustomers), [state.sallaCustomers, state.clients])
  const timeline = useMemo(() => scopeSalla(state, state.orderTimeline), [state.orderTimeline, state.clients])
  const shipments = useMemo(() => scopeSalla(state, state.shipments), [state.shipments, state.clients])
  const slas = useMemo(() => scopeSalla(state, state.orderSlas), [state.orderSlas, state.clients])

  // ── Delivery health (from real shipment data)
  const PROBLEM_SHIP = new Set(['cancelled', 'lost', 'damaged', 'return_to_origin', 'return_in_progress', 'unable_to_deliver'])
  const IN_TRANSIT = new Set(['created', 'creating', 'updated', 'in_progress', 'in_transit', 'delivering', 'shipped', 'to_be_reattempted', 'reattempted', 'received_at_final_hub'])
  const delivery = useMemo(() => {
    const problems = shipments.filter((s) => PROBLEM_SHIP.has(s.status))
    const moving = shipments.filter((s) => IN_TRANSIT.has(s.status))
    const done = shipments.filter((s) => s.status === 'delivered' || s.status === 'partially_delivered')
    const slaRisky = slas.filter((s) => s.sla_state === 'at_risk' || s.sla_state === 'delayed')
    return { problems: problems.length, moving: moving.length, delivered: done.length, hasAny: shipments.length > 0, slaRisky: slaRisky.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipments, slas])

  const intel = useMemo(() => computeCustomerIntel(customers, orders), [customers, orders])
  const customerById = useMemo(() => {
    const m = new Map<string, CustomerIntel>()
    for (const i of intel) m.set(i.customer.id, i)
    return m
  }, [intel])

  // Status tabs ordered canonically, with counts
  const statusCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of orders) m.set(o.status, (m.get(o.status) ?? 0) + 1)
    return [...m.entries()]
      .sort((a, b) => {
        const ia = STATUS_ORDER.indexOf(a[0]); const ib = STATUS_ORDER.indexOf(b[0])
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || b[1] - a[1]
      })
  }, [orders])

  const filtered = useMemo(() => {
    let list = orders
    if (statusFilter !== 'all') list = list.filter((o) => o.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((o) => {
        if (String(o.salla_id ?? '').includes(q) || (o.reference ?? '').includes(q)) return true
        const cust = o.customer_id ? customerById.get(o.customer_id)?.customer : null
        if (cust && `${cust.first_name} ${cust.last_name}`.toLowerCase().includes(q)) return true
        if (Array.isArray(o.items) && o.items.some((it) => itemName(it as { name?: string }).toLowerCase().includes(q))) return true
        return false
      })
    }
    return list.sort((a, b) => new Date(b.date_created ?? b.synced_at).getTime() - new Date(a.date_created ?? a.synced_at).getTime())
  }, [orders, statusFilter, search, customerById])

  const validRevenue = orders
    .filter((o) => !['canceled', 'cancelled', 'refunded', 'deleted', 'restocked'].includes(o.status))
    .reduce((s, o) => s + o.total_amount, 0)

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
  const todayOrders = orders.filter((o) => new Date(o.date_created ?? o.synced_at).getTime() >= startOfDay.getTime())

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-[var(--text-muted)]">
            {orders.length} orders · {validRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} SAR revenue · {todayOrders.length} today
          </div>
        </div>
      </div>

      <LiveBadge />

      {/* Delivery health strip */}
      {delivery.hasAny && (
        <div className="glass-card px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
          <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-[var(--text-muted)] text-[11px]">
            <Truck size={12} /> Delivery
          </span>
          <span className="text-[var(--text-muted)]">{delivery.moving} in transit</span>
          <span className="text-[var(--positive)]">{delivery.delivered} delivered</span>
          {delivery.problems > 0 && (
            <span className="flex items-center gap-1.5 font-semibold px-2 py-0.5 rounded-full"
              style={{ color: '#ef4444', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)' }}>
              <ShieldAlert size={12} /> {delivery.problems} need attention
            </span>
          )}
          {delivery.slaRisky > 0 && (
            <span className="flex items-center gap-1.5 font-semibold px-2 py-0.5 rounded-full"
              style={{ color: '#f59e0b', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)' }}>
              <Clock size={12} /> {delivery.slaRisky} past SLA
            </span>
          )}
        </div>
      )}

      {/* Status color legend */}
      {statusCounts.length > 0 && (
        <div className="glass-card px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <Layers size={12} /> Legend
          </span>
          {statusCounts.map(([s]) => {
            const meta = orderStatusMeta(s)
            return (
              <span key={s} className="flex items-center gap-1.5 text-xs" style={{ color: meta.color }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                {meta.label}
              </span>
            )
          })}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatusFilter('all')} className={`chip ${statusFilter === 'all' ? '!border-[#d29a0c66] !bg-[#f0c42e18] !text-[var(--text-primary)] font-semibold' : ''}`}>
          All <span className="ml-0.5 opacity-70">{orders.length}</span>
        </button>
        {statusCounts.map(([s, count]) => {
          const meta = orderStatusMeta(s)
          const active = statusFilter === s
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(active ? 'all' : s)}
              className={`chip ${active ? 'font-semibold' : ''}`}
              style={active ? { borderColor: `${meta.color}77`, color: meta.color, background: `${meta.color}16` } : undefined}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
              {meta.label} <span className="ml-0.5 opacity-70">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by order #, product or customer…" className="field !pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No orders found" hint="New orders appear here automatically the moment they happen in your store." />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((o: SallaOrder) => {
            const meta = orderStatusMeta(o.status)
            const cust = o.customer_id ? customerById.get(o.customer_id) : undefined
            const when = o.date_created ?? o.synced_at
            return (
              <div key={o.id} className="glass-card relative overflow-hidden hover-lift px-4 sm:px-5 py-3.5 cursor-pointer"
                role="button" tabIndex={0}
                onClick={() => setSelectedOrder(o)}
                onKeyDown={(e) => { if (e.key === 'Enter') setSelectedOrder(o) }}>
                {/* status accent stripe */}
                <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: meta.color }} />
                <div className="flex flex-wrap md:flex-nowrap items-start gap-x-4 gap-y-2">
                  {/* Order id + exact time */}
                  <div className="min-w-[150px]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--text-primary)] tabular-nums">#{o.reference ?? String(o.salla_id ?? o.id).replace('ord_salla_', '')}</span>
                      {o.reference && (
                        <span className="text-[10px] text-[var(--text-muted)] tabular-nums" title="Internal Salla id">id {o.salla_id}</span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                        style={{ color: meta.color, background: `${meta.color}1f`, border: `1px solid ${meta.color}44` }}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] mt-0.5 tabular-nums">
                      <Clock size={10} /> {exactDateTime(when)}
                    </div>
                    <div className="text-[10px]" style={{ color: meta.color }}>{relativeFromIso(when)}</div>
                  </div>

                  {/* Customer chip */}
                  <button
                    onClick={() => cust && setSelectedCustomer(cust)}
                    disabled={!cust}
                    title={cust ? 'Open customer profile' : 'No customer linked'}
                    className={`flex items-center gap-1.5 text-xs max-w-[170px] ${cust ? 'cursor-pointer hover:underline decoration-dotted underline-offset-2 text-[var(--text-primary)]' : 'text-[var(--text-muted)] cursor-default'}`}
                  >
                    <User size={12} className="shrink-0 text-[var(--text-muted)]" />
                    <span className="truncate">{cust ? `${cust.customer.first_name} ${cust.customer.last_name}`.trim() : 'Guest / unlinked'}</span>
                  </button>

                  {/* Items + payment */}
                  <div className="min-w-0 flex-1">
                    {Array.isArray(o.items) && o.items.length > 0 ? (
                      <div className="text-xs text-[var(--text-muted)] truncate">
                        {o.items.slice(0, 2).map((it, i) => (
                          <span key={i}>{i > 0 && ' · '}{itemName(it as { name?: string })} ×{itemQty(it as { qty?: number; quantity?: number })}</span>
                        ))}
                        {o.items.length > 2 && ` +${o.items.length - 2} more`}
                      </div>
                    ) : (
                      <div className="text-xs text-[var(--text-muted)]">{o.items_count} items</div>
                    )}
                    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-[var(--text-muted)] capitalize">
                      {o.payment_method && <span className="flex items-center gap-1"><CreditCard size={10} />{String(o.payment_method).replace(/_/g, ' ')}</span>}
                      {o.selling_channel && <span>{o.selling_channel}</span>}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right ml-auto shrink-0">
                    <div className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{o.total_amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-[11px] font-medium opacity-60">{o.currency ?? 'SAR'}</span></div>
                    {o.shipping_cost > 0 && <div className="text-[10px] text-[var(--text-muted)]">incl. {o.shipping_cost.toLocaleString()} shipping</div>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CustomerDrawer intel={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      <OrderDrawer
        order={selectedOrder}
        timeline={timeline}
        shipments={shipments}
        slas={slas}
        customerName={
          selectedOrder?.customer_id
            ? (() => { const c = customerById.get(selectedOrder.customer_id)?.customer; return c ? `${c.first_name} ${c.last_name}`.trim() : undefined })()
            : undefined
        }
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  )
}
