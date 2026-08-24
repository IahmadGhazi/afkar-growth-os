import { useEffect } from 'react'
import { X, Clock, CreditCard, Truck, ShieldCheck, User, Package } from 'lucide-react'
import { orderStatusMeta, exactDateTime } from '../../lib/orderStatus'
import type { SallaOrder, SallaShipment, OrderSla, OrderTimelineEvent } from '../../types/database'

const SHIP_META: Record<string, { label: string; color: string }> = {
  creating: { label: 'Creating', color: '#94a3b8' },
  created: { label: 'Created', color: '#8b5cf6' },
  updated: { label: 'In transit', color: '#3b82f6' },
  cancelled: { label: 'Cancelled / problem', color: '#ef4444' },
  delivered: { label: 'Delivered', color: '#10b981' },
}
const SHIP_PROBLEM = new Set(['cancelled', 'lost', 'damaged', 'return_to_origin', 'return_in_progress', 'unable_to_deliver'])

function shipMeta(raw: string): { label: string; color: string } {
  if (SHIP_META[raw]) return SHIP_META[raw]
  if (SHIP_PROBLEM.has(raw)) return { label: raw.replace(/_/g, ' '), color: '#ef4444' }
  if (raw === 'delivered' || raw === 'partially_delivered') return { label: raw.replace(/_/g, ' '), color: '#10b981' }
  if (['in_transit', 'in_progress', 'delivering', 'shipped'].includes(raw)) return { label: raw.replace(/_/g, ' '), color: '#3b82f6' }
  return { label: raw.replace(/_/g, ' '), color: '#64748b' }
}

interface Props {
  order: SallaOrder | null
  timeline: OrderTimelineEvent[]
  shipments: SallaShipment[]
  slas: OrderSla[]
  customerName?: string
  onClose: () => void
}

export function OrderDrawer({ order, timeline, shipments, slas, customerName, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!order) return null
  const meta = orderStatusMeta(order.status)
  const events = timeline
    .filter((t) => t.order_id === order.id)
    .sort((a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime())
  const orderShipments = shipments.filter((s) => s.order_id === order.id)
  const sla = slas.find((s) => s.order_id === order.id)

  const slaBadge = sla
    ? {
        normal: { label: 'SLA on track', color: '#10b981' },
        resolved: { label: 'SLA resolved', color: '#10b981' },
        at_risk: { label: 'SLA at risk', color: '#f59e0b' },
        delayed: { label: 'SLA delayed', color: '#ef4444' },
      }[sla.sla_state]
    : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[fadeIn_.2s_ease]" onClick={onClose} />
      <aside className="relative w-full max-w-md h-full overflow-y-auto bg-[var(--bg)] border-l border-[var(--hairline)] shadow-2xl animate-[slideInRight_.3s_var(--ease-spring)_both]">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--bg)]/90 backdrop-blur border-b border-[var(--hairline)] px-5 py-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-[var(--text-primary)] tabular-nums">#{order.reference ?? String(order.salla_id ?? '').replace('ord_salla_', '')}</h3>
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                style={{ color: meta.color, background: `${meta.color}1a`, border: `1px solid ${meta.color}44` }}>
                {meta.label}
              </span>
              {slaBadge && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
                  style={{ color: slaBadge.color, background: `${slaBadge.color}14`, border: `1px solid ${slaBadge.color}33` }}>
                  <ShieldCheck size={10} /> {slaBadge.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-1 tabular-nums">
              <Clock size={11} /> {exactDateTime(order.date_created ?? order.synced_at)}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-[var(--hover)] text-[var(--text-muted)] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Money strip */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { k: 'Total', v: `${Math.round(order.total_amount).toLocaleString()} ${order.currency}` },
              { k: 'Shipping', v: order.shipping_cost ? `${Math.round(order.shipping_cost).toLocaleString()}` : '—' },
              { k: 'Tax', v: order.tax_amount ? `${Math.round(order.tax_amount).toLocaleString()}` : '—' },
            ].map((s) => (
              <div key={s.k} className="rounded-xl border border-[var(--hairline)] bg-[var(--card)] px-3 py-2.5">
                <div className="text-sm font-bold text-[var(--text-primary)] tabular-nums leading-tight">{s.v}</div>
                <div className="text-[10px] text-[var(--text-muted)]">{s.k}</div>
              </div>
            ))}
          </div>

          {/* Meta */}
          <div className="space-y-1.5 text-[13px]">
            <div className="flex items-center gap-2 text-[var(--text-primary)]"><User size={13} className="text-[var(--text-muted)]" />{customerName || 'Guest / unlinked'}</div>
            {order.payment_method && <div className="flex items-center gap-2 text-[var(--text-primary)] capitalize"><CreditCard size={13} className="text-[var(--text-muted)]" />{String(order.payment_method).replace(/_/g, ' ')}</div>}
            {order.selling_channel && <div className="flex items-center gap-2 text-[var(--text-primary)] capitalize"><Package size={13} className="text-[var(--text-muted)]" />{order.selling_channel}</div>}
          </div>

          {/* Items */}
          {Array.isArray(order.items) && order.items.length > 0 && (
            <div>
              <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Items</div>
              <div className="space-y-1.5">
                {order.items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-[var(--hairline)] bg-[var(--card)] px-3 py-2 text-xs">
                    <span className="truncate text-[var(--text-primary)]" dir="auto">{it.name}</span>
                    <span className="shrink-0 ml-3 text-[var(--text-muted)] tabular-nums">×{it.quantity} · {(it.amount ?? 0).toLocaleString()} SAR</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shipments */}
          {orderShipments.length > 0 && (
            <div>
              <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Shipments</div>
              <div className="space-y-1.5">
                {orderShipments.map((s) => {
                  const sm = shipMeta(s.status)
                  const problem = SHIP_PROBLEM.has(s.status)
                  return (
                    <div key={s.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-xs"
                      style={{ borderColor: problem ? 'rgba(239,68,68,.35)' : 'var(--hairline)', background: problem ? 'rgba(239,68,68,.05)' : 'var(--card)' }}>
                      <Truck size={13} style={{ color: sm.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold capitalize" style={{ color: sm.color }}>{sm.label}</div>
                        <div className="text-[10px] text-[var(--text-muted)] truncate">{s.shipping_company ?? ''}{s.tracking_number ? ` · ${s.tracking_number}` : ''}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Life of this order</div>
            {events.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--hairline)] py-5 text-center text-xs text-[var(--text-muted)]">
                No events recorded yet — every webhook touch lands here.
              </div>
            ) : (
              <div className="relative pl-4 space-y-3 before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-[var(--hairline)]">
                {events.map((ev) => (
                  <div key={ev.id} className="relative">
                    <span className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full border-2 bg-[var(--bg)]" style={{ borderColor: '#d29a0c' }} />
                    <div className="text-xs font-semibold text-[var(--text-primary)] capitalize">{ev.event.replace(/[._]/g, ' ')}</div>
                    <div className="text-[10px] text-[var(--text-muted)] tabular-nums">{exactDateTime(ev.event_time)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}
