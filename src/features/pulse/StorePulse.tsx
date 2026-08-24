import { useEffect, useRef, useState } from 'react'
import { ShoppingCart, UserPlus, Package, Zap } from 'lucide-react'
import type { SallaCustomer, SallaOrder, SallaProduct } from '../../types/database'

type PulseKind = 'order' | 'customer' | 'product'

export interface PulseItem {
  key: string
  kind: PulseKind
  title: string
  detail: string
  at: number
}

const KIND_META: Record<PulseKind, { icon: typeof ShoppingCart; color: string; bg: string }> = {
  order: { icon: ShoppingCart, color: '#d29a0c', bg: 'rgba(240,196,46,.12)' },
  customer: { icon: UserPlus, color: '#10b981', bg: 'rgba(16,185,129,.12)' },
  product: { icon: Package, color: '#8b5cf6', bg: 'rgba(139,92,246,.12)' },
}

function ago(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000)
  if (s < 5) return 'now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

interface PulseProps {
  orders: SallaOrder[]
  customers: SallaCustomer[]
  products: SallaProduct[]
}

/**
 * Store Pulse — derives live activity by diffing app state.
 * Every refresh path (webhook broadcast push, realtime postgres_changes,
 * safety-net poll, manual sync) flows through state → new rows animate in.
 */
export function StorePulse({ orders, customers, products }: PulseProps) {
  const [items, setItems] = useState<PulseItem[]>([])
  const known = useRef<Map<PulseKind, Set<string>> | null>(null)
  const [, force] = useState(0)

  const orderItem = (o: SallaOrder): PulseItem => ({
    key: o.id,
    kind: 'order',
    title: `Order #${String(o.salla_id ?? o.id).replace('ord_salla_', '')} · ${(o.total_amount ?? 0).toLocaleString()} ${o.currency ?? 'SAR'}`,
    detail: `${o.items_count ?? 0} items · ${String(o.status ?? '').replace(/_/g, ' ')}`,
    at: new Date(o.synced_at ?? Date.now()).getTime(),
  })

  // Seed + diff
  useEffect(() => {
    if (!known.current) {
      // First render: remember everything that already exists; show recent orders only
      known.current = new Map([
        ['order', new Set((orders ?? []).map((o) => o.id))],
        ['customer', new Set((customers ?? []).map((c) => String(c.id)))],
        ['product', new Set((products ?? []).map((p) => String(p.id)))],
      ])
      const seed = [...(orders ?? [])]
        .sort((a, b) => new Date(b.synced_at).getTime() - new Date(a.synced_at).getTime())
        .slice(0, 6)
        .map(orderItem)
      setItems(seed)
      return
    }

    const fresh: PulseItem[] = []
    const kOrders = known.current.get('order')!
    for (const o of orders ?? []) if (!kOrders.has(o.id)) { kOrders.add(o.id); fresh.push(orderItem(o)) }
    const kCust = known.current.get('customer')!
    for (const c of customers ?? []) {
      const id = String(c.id)
      if (!kCust.has(id)) {
        kCust.add(id)
        fresh.push({
          key: id, kind: 'customer',
          title: ([c.first_name as string, c.last_name as string].filter(Boolean).join(' ') || 'New customer'),
          detail: c.city ? `Joined from ${String(c.city)}` : 'Joined your store',
          at: new Date(String(c.synced_at ?? Date.now())).getTime(),
        })
      }
    }
    const kProd = known.current.get('product')!
    for (const p of products ?? []) {
      const id = String(p.id)
      if (!kProd.has(id)) {
        kProd.add(id)
        fresh.push({
          key: id, kind: 'product',
          title: String(p.name ?? 'Product updated'),
          detail: p.price != null ? `Price ${Number(p.price).toLocaleString()} SAR` : 'Catalog updated',
          at: new Date(String(p.synced_at ?? Date.now())).getTime(),
        })
      }
    }
    if (fresh.length) setItems((prev) => [...fresh.reverse(), ...prev].slice(0, 30))
  }, [orders, customers, products])

  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 15_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="glass-card p-5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={15} style={{ color: '#d29a0c' }} />
          <span className="text-sm font-semibold text-[var(--text-primary)]">Store Pulse</span>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-[#10b981]">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10b981' }} />
          Live
        </span>
      </div>

      {items.length === 0 ? (
        <div className="text-xs text-[var(--text-muted)] py-6 text-center">
          Listening to your store… new orders & customers will appear here instantly.
        </div>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {items.map((it) => {
            const meta = KIND_META[it.kind]
            const Icon = meta.icon
            return (
              <div key={it.key} className="flex items-start gap-3 rounded-lg px-3 py-2.5 border border-[var(--hairline)] bg-[var(--card)]" style={{ animation: 'pulseIn .45s var(--ease-spring) both' }}>
                <span className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
                  <Icon size={13} style={{ color: meta.color }} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{it.title}</div>
                  <div className="text-[11px] text-[var(--text-muted)] truncate">{it.detail}</div>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] shrink-0 tabular-nums">{ago(it.at)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
