import { useMemo } from 'react'
import { Flame, ShoppingCart, AlertTriangle, Package, Target, ArrowRight, Snowflake } from 'lucide-react'
import { useApp } from '../../lib/store'
import { LiveBadge } from '../../components/shared/LiveBadge'
import { isTaskOverdue, tasksForClient, currentClient } from '../../lib/selectors'
import { computeCustomerIntel } from '../../lib/rfm'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Late night, boss'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function Briefing({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { state } = useApp()
  const orders = state.sallaOrders ?? []
  const customers = state.sallaCustomers ?? []
  const carts = (state.abandonedCarts ?? []).filter((c) => c.status !== 'purchased')
  const tasks = tasksForClient(state, currentClient(state)?.id ?? null)
  const overdue = tasks.filter(isTaskOverdue)
  const products = state.sallaProducts ?? []
  const intel = useMemo(() => computeCustomerIntel(customers, orders), [customers, orders])

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000)

  const todaysOrders = orders.filter((o) => new Date(o.date_created ?? o.synced_at).getTime() >= startOfToday.getTime())
  const yesterdaysOrders = orders.filter((o) => {
    const t = new Date(o.date_created ?? o.synced_at).getTime()
    return t >= startOfYesterday.getTime() && t < startOfToday.getTime()
  })
  const yesterdayRevenue = yesterdaysOrders.reduce((s, o) => s + o.total_amount, 0)
  const todayRevenue = todaysOrders.reduce((s, o) => s + o.total_amount, 0)
  const newCustomersToday = customers.filter((c) => new Date(c.synced_at).getTime() >= startOfToday.getTime()).length

  const hotCarts = carts
    .filter((c) => (c.age_minutes ?? Infinity) <= 60 * 24)
    .sort((a, b) => b.cart_total - a.cart_total)
    .slice(0, 5)
  const hotValue = hotCarts.reduce((s, c) => s + c.cart_total, 0)

  const lowStock = products.filter((p) => p.status === 'active' && p.quantity > 0 && p.quantity <= 5)
  const outOfStock = products.filter((p) => p.status === 'active' && p.quantity === 0)
  const atRiskCustomers = intel.filter((i) => i.segment === 'at_risk' || i.segment === 'dormant')

  const fires = [
    ...(overdue.length ? [{ label: `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`, path: '/tasks', color: '#ef4444' }] : []),
    ...(hotCarts.length ? [{ label: `${hotCarts.length} warm carts worth ${Math.round(hotValue).toLocaleString()} SAR`, path: '/carts', color: '#f59e0b' }] : []),
    ...(outOfStock.length ? [{ label: `${outOfStock.length} product${outOfStock.length > 1 ? 's' : ''} sold out`, path: '/store-products', color: '#ef4444' }] : []),
    ...(lowStock.length ? [{ label: `${lowStock.length} product${lowStock.length > 1 ? 's' : ''} running low`, path: '/store-products', color: '#f59e0b' }] : []),
    ...(atRiskCustomers.length >= 3 ? [{ label: `${atRiskCustomers.length} customers drifting away`, path: '/retention', color: '#8b5cf6' }] : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-[var(--text-muted)]">{greeting()} — here's your store at a glance.</div>
        </div>
      </div>

      <LiveBadge />

      {/* Yesterday / Today */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger">
        {[
          { k: 'Yesterday', v: `${yesterdaysOrders.length} orders`, s: `${Math.round(yesterdayRevenue).toLocaleString()} SAR` },
          { k: 'Today so far', v: `${todaysOrders.length} orders`, s: `${Math.round(todayRevenue).toLocaleString()} SAR` },
          { k: 'New customers', v: String(newCustomersToday), s: 'today' },
          { k: 'Live carts', v: String(carts.length), s: `${Math.round(carts.reduce((x, c) => x + c.cart_total, 0)).toLocaleString()} SAR waiting` },
        ].map((m) => (
          <div key={m.k} className="glass-card p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{m.k}</div>
            <div className="text-xl font-bold text-[var(--text-primary)] tabular-nums mt-1">{m.v}</div>
            <div className="text-xs text-[var(--text-muted)] tabular-nums">{m.s}</div>
          </div>
        ))}
      </div>

      {/* Fires — needs you now */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
          <Flame size={14} style={{ color: fires.length ? '#ef4444' : 'var(--positive)' }} />
          {fires.length ? 'Fires to put out' : 'All calm. Nothing burns.'}
        </h3>
        {fires.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <div className="text-sm font-semibold text-[var(--positive)]">Your store ran itself overnight.</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">No overdue work, no stock emergencies, no drifting customers.</div>
          </div>
        ) : (
          <div className="space-y-2">
            {fires.map((f, i) => (
              <button key={i} onClick={() => onNavigate(f.path)}
                className="glass-card w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[var(--hover)] transition-colors"
                style={{ borderLeft: `3px solid ${f.color}` }}>
                <AlertTriangle size={15} style={{ color: f.color }} />
                <span className="text-sm text-[var(--text-primary)] flex-1" dir="auto">{f.label}</span>
                <ArrowRight size={14} className="text-[var(--text-muted)]" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Money waiting */}
      {hotCarts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <ShoppingCart size={14} style={{ color: '#25D366' }} /> Biggest carts still open
          </h3>
          <div className="glass-card divide-y divide-[var(--hairline)] overflow-hidden">
            {hotCarts.map((c) => (
              <button key={c.id} onClick={() => onNavigate('/carts')} className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-[var(--hover)] transition-colors">
                <Snowflake size={13} className="text-[var(--text-muted)]" />
                <span className="text-sm text-[var(--text-primary)] flex-1 truncate" dir="auto">{c.customer_name ?? 'Guest'} · {Array.isArray(c.items) && c.items[0]?.name ? c.items[0].name : 'items'}…</span>
                <span className="text-sm font-bold tabular-nums text-[var(--text-primary)]">{Math.round(c.cart_total).toLocaleString()} SAR</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ritual footer */}
      <div className="glass-card px-5 py-4 flex items-start gap-3">
        <Target size={16} style={{ color: '#d29a0c' }} className="mt-0.5 shrink-0" />
        <div className="text-xs text-[var(--text-muted)] leading-relaxed">
          This is your morning ritual: two minutes here beats an hour of scrolling dashboards.
          When WhatsApp Business API goes live, this briefing lands in your pocket at 8:00 AM Riyadh automatically.
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] px-1">
        <Package size={11} /> Data refreshes live via webhooks — this page is always current.
      </div>
    </div>
  )
}
