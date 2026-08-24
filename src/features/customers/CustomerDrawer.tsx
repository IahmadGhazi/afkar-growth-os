import { useEffect } from 'react'
import { X, Mail, Phone, MapPin, Crown, ShoppingBag, CalendarClock, Package, TrendingUp } from 'lucide-react'
import type { CustomerIntel } from '../../lib/rfm'
import { SEGMENTS } from '../../lib/rfm'

const STATUS_COLORS: Record<string, string> = {
  shipped: '#3b82f6', delivered: '#10b981', completed: '#10b981',
  canceled: '#ef4444', cancelled: '#ef4444', refunded: '#f97316',
  payment_pending: '#f59e0b', under_review: '#8b5cf6', restocked: '#64748b',
}

function daysLabel(d: number | null): string {
  if (d == null) return 'never'
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d} days ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

export function CustomerDrawer({ intel, onClose }: { intel: CustomerIntel | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!intel) return null
  const c = intel.customer
  const seg = SEGMENTS[intel.segment]
  const isVip = intel.lifetimeValue > 0 && intel.rfm.m >= 4

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[fadeIn_.2s_ease]" onClick={onClose} />
      <aside className="relative w-full max-w-md h-full overflow-y-auto bg-[var(--bg)] border-l border-[var(--hairline)] shadow-2xl animate-[slideInRight_.3s_var(--ease-spring)_both]">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--bg)]/90 backdrop-blur border-b border-[var(--hairline)] px-5 py-4 flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#f0c42e] to-[#d29a0c] flex items-center justify-center shrink-0 text-lg font-bold text-[#1a1405]">
            {(c.first_name?.charAt(0) ?? '?')}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-[var(--text-primary)] truncate">{c.first_name} {c.last_name}</h3>
              {isVip && (
                <span className="badge bg-[var(--warning-soft)] text-[var(--warning)]"><Crown size={11} /> VIP</span>
              )}
            </div>
            <span className="inline-flex items-center gap-1.5 mt-1 text-[11px] font-medium" style={{ color: seg.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: seg.color }} />
              {seg.label}
            </span>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-[var(--hover)] text-[var(--text-muted)] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Lifetime', value: `${Math.round(intel.lifetimeValue).toLocaleString()} SAR`, icon: TrendingUp },
              { label: 'Orders', value: String(intel.orderCount), icon: ShoppingBag },
              { label: 'Avg Order', value: `${Math.round(intel.avgOrderValue).toLocaleString()} SAR`, icon: Package },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-[var(--hairline)] bg-[var(--card)] px-3 py-2.5">
                <s.icon size={13} className="text-[var(--gold,#d29a0c)] mb-1" />
                <div className="text-sm font-bold text-[var(--text-primary)] tabular-nums leading-tight">{s.value}</div>
                <div className="text-[10px] text-[var(--text-muted)]">{s.label}</div>
              </div>
            ))}
          </div>

          {/* RFM strip */}
          <div>
            <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">RFM Score</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { k: 'Recency', v: intel.rfm.r, hint: daysLabel(intel.daysSinceLastOrder) },
                { k: 'Frequency', v: intel.rfm.f, hint: `${intel.orderCount} orders` },
                { k: 'Monetary', v: intel.rfm.m, hint: `${Math.round(intel.avgOrderValue).toLocaleString()} avg` },
              ].map((r) => (
                <div key={r.k} className="rounded-lg border border-[var(--hairline)] px-3 py-2 text-center">
                  <div className="flex justify-center gap-0.5 mb-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className="w-1.5 h-3 rounded-full" style={{ background: n <= r.v ? '#d29a0c' : 'var(--hairline)' }} />
                    ))}
                  </div>
                  <div className="text-[11px] font-semibold text-[var(--text-primary)]">{r.k}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{r.hint}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Contact</div>
            <div className="space-y-1.5 text-[13px]">
              {c.email && <div className="flex items-center gap-2 text-[var(--text-primary)]"><Mail size={13} className="text-[var(--text-muted)]" />{c.email}</div>}
              {c.mobile && <div className="flex items-center gap-2 text-[var(--text-primary)]"><Phone size={13} className="text-[var(--text-muted)]" />{c.mobile_code}{c.mobile}</div>}
              {(c.city || c.country) && <div className="flex items-center gap-2 text-[var(--text-primary)]"><MapPin size={13} className="text-[var(--text-muted)]" />{[c.city, c.country].filter(Boolean).join(', ')}</div>}
              {!c.email && !c.mobile && !c.city && !c.country && <div className="text-[var(--text-muted)]">No contact details synced</div>}
            </div>
          </div>

          {/* Favorite products */}
          {intel.favoriteProducts.length > 0 && (
            <div>
              <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Loves these products</div>
              <div className="flex flex-wrap gap-1.5">
                {intel.favoriteProducts.map((p) => (
                  <span key={p.name} className="chip text-xs">{p.name} <span className="opacity-60">×{p.qty}</span></span>
                ))}
              </div>
            </div>
          )}

          {/* Order history */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Order History</span>
              {intel.orders.length > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                  <CalendarClock size={11} /> last order {daysLabel(intel.daysSinceLastOrder)}
                </span>
              )}
            </div>
            {intel.orders.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--hairline)] py-5 text-center text-xs text-[var(--text-muted)]">
                No orders linked yet — they'll appear the moment this customer checks out.
              </div>
            ) : (
              <div className="space-y-1.5">
                {intel.orders.slice(0, 12).map((o) => (
                  <div key={o.id} className="flex items-center gap-3 rounded-lg border border-[var(--hairline)] bg-[var(--card)] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-[var(--text-primary)] tabular-nums">#{String(o.salla_id ?? o.id).replace('ord_salla_', '')}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {o.date_created ? new Date(o.date_created).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''} · {o.items_count} items
                      </div>
                    </div>
                    <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full font-semibold"
                      style={{
                        color: STATUS_COLORS[o.status] ?? 'var(--text-muted)',
                        background: `color-mix(in srgb, ${STATUS_COLORS[o.status] ?? 'gray'} 14%, transparent)`,
                      }}>
                      {o.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums w-20 text-right">{o.total_amount.toLocaleString()}</span>
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
