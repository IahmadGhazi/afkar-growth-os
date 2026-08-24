import { useEffect, useRef, useState } from 'react'
import { ShoppingCart, UserPlus, Package, Star, Zap } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type PulseKind = 'order' | 'customer' | 'product' | 'review'

interface PulseItem {
  key: string
  kind: PulseKind
  title: string
  detail: string
  at: number // epoch ms of the event
}

const KIND_META: Record<PulseKind, { icon: typeof ShoppingCart; color: string; bg: string; label: string }> = {
  order: { icon: ShoppingCart, color: '#d29a0c', bg: 'rgba(240,196,46,.12)', label: 'Order' },
  customer: { icon: UserPlus, color: '#10b981', bg: 'rgba(16,185,129,.12)', label: 'Customer' },
  product: { icon: Package, color: '#8b5cf6', bg: 'rgba(139,92,246,.12)', label: 'Product' },
  review: { icon: Star, color: '#f59e0b', bg: 'rgba(245,158,11,.12)', label: 'Review' },
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

/**
 * Store Pulse — live heartbeat of the store.
 * Subscribes to Salla tables via Supabase Realtime AND polls as a safety
 * net every 30s (only while the tab is visible), so new orders/customers/
 * products appear without any refresh even if realtime is unavailable.
 */
export function useStorePulse(enabled: boolean) {
  const [items, setItems] = useState<PulseItem[]>([])
  const [live, setLive] = useState(false)
  const lastPoll = useRef(Date.now())
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    if (!enabled || !supabase) return

    const push = (it: PulseItem) => {
      if (!mounted.current) return
      setItems((prev) => [it, ...prev.filter((p) => p.key !== it.key)].slice(0, 30))
    }

    const describe = (kind: PulseKind, row: Record<string, unknown>): PulseItem => {
      if (kind === 'order') {
        const amt = Number(row.total_amount ?? 0)
        return {
          key: String(row.id), kind,
          title: `Order #${String(row.salla_id ?? row.id).replace('ord_salla_', '')} · ${amt.toLocaleString()} ${row.currency ?? 'SAR'}`,
          detail: `${row.items_count ?? 0} items · ${String(row.status ?? '').replace(/_/g, ' ')}`,
          at: Date.now(),
        }
      }
      if (kind === 'customer') {
        const name = [row.first_name, row.last_name].filter(Boolean).join(' ') || 'New customer'
        return { key: String(row.id), kind, title: name, detail: row.city ? `Joined from ${row.city}` : 'Joined your store', at: Date.now() }
      }
      if (kind === 'product') {
        return { key: String(row.id), kind, title: String(row.name ?? 'Product updated'), detail: row.price != null ? `Price ${Number(row.price).toLocaleString()} SAR` : 'Catalog updated', at: Date.now() }
      }
      return {
        key: String(row.id), kind,
        title: `${'★'.repeat(Math.min(5, Number(row.rating ?? 0))) || 'Review'} ${row.product_name ?? ''}`.trim(),
        detail: String(row.content ?? '').slice(0, 80),
        at: Date.now(),
      }
    }

    // ── seed from what already exists in memory (recent rows) via REST
    ;(async () => {
      if (!supabase) return
      try {
        const since = new Date(Date.now() - 6 * 3600_000).toISOString()
        const res = await supabase.from('orders').select('*').gte('synced_at', since).order('synced_at', { ascending: false }).limit(10)
        if (!res.error && res.data) {
          for (const row of res.data.reverse()) {
            const it = describe('order', row as Record<string, unknown>)
            it.at = new Date(String(row.synced_at)).getTime()
            push(it)
          }
        }
      } catch { /* non-fatal */ }
    })()

    // ── realtime subscription
    const ch = supabase.channel('store-pulse', { config: { broadcast: { self: false } } })
    for (const table of ['orders', 'customers', 'store_products']) {
      ch.on('postgres_changes' as never, { event: 'INSERT', schema: 'public', table } as never, (payload: { new?: Record<string, unknown> }) => {
        setLive(true)
        const kind: PulseKind = table === 'orders' ? 'order' : table === 'customers' ? 'customer' : 'product'
        if (payload.new) push(describe(kind, payload.new))
      })
    }
    ch.subscribe((status) => { if (status === 'SUBSCRIBED') setLive(true) })

    // ── polling fallback: catches webhooks even when realtime is blocked
    const poll = async () => {
      if (!supabase || document.hidden) return
      const since = new Date(lastPoll.current).toISOString()
      lastPoll.current = Date.now()
      try {
        const res = await supabase.from('orders').select('*').gte('synced_at', since).order('synced_at', { ascending: false }).limit(10)
        if (!res.error && res.data?.length) {
          for (const row of res.data) push(describe('order', row as Record<string, unknown>))
        }
      } catch { /* non-fatal */ }
    }
    const timer = setInterval(poll, 30_000)

    return () => {
      mounted.current = false
      clearInterval(timer)
      if (supabase) void supabase.removeChannel(ch)
    }
  }, [enabled])

  return { items, live }
}

export function StorePulse({ enabled }: { enabled: boolean }) {
  const { items, live } = useStorePulse(enabled)
  const [, force] = useState(0)

  // re-render "x ago" labels periodically
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 15_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="glass-card p-5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={15} style={{ color: live ? '#d29a0c' : 'var(--text-muted)' }} />
          <span className="text-sm font-semibold text-[var(--text-primary)]">Store Pulse</span>
        </div>
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: live ? '#10b981' : 'var(--text-muted)' }}>
          <span className={`w-1.5 h-1.5 rounded-full ${live ? 'animate-pulse' : ''}`} style={{ background: live ? '#10b981' : 'var(--text-muted)' }} />
          {live ? 'Live' : 'Connecting…'}
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
              <div key={it.key} className="flex items-start gap-3 rounded-lg px-3 py-2.5 border border-[var(--hairline)] bg-[var(--card)] animate-[pulseIn_.45s_var(--ease-spring)_both]" style={{ ['--delay' as string]: '0s' }}>
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
