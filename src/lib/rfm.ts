import type { SallaCustomer, SallaOrder } from '../types/database'

export type SegmentId =
  | 'champion'
  | 'loyal'
  | 'promising'
  | 'new'
  | 'one_time'
  | 'at_risk'
  | 'dormant'

export interface Segment {
  id: SegmentId
  label: string
  hint: string
  color: string // css color for text/border
}

export const SEGMENTS: Record<SegmentId, Segment> = {
  champion: { id: 'champion', label: 'Champions', hint: 'Buy often, recently, big baskets', color: '#d29a0c' },
  loyal: { id: 'loyal', label: 'Loyal', hint: 'Repeat buyers who keep coming back', color: '#3b82f6' },
  promising: { id: 'promising', label: 'Promising', hint: 'Good spenders warming up', color: '#8b5cf6' },
  new: { id: 'new', label: 'New', hint: 'First order in the last 14 days', color: '#10b981' },
  one_time: { id: 'one_time', label: 'One-time', hint: 'Single purchase so far', color: '#64748b' },
  at_risk: { id: 'at_risk', label: 'At Risk', hint: 'Were active — went quiet', color: '#f59e0b' },
  dormant: { id: 'dormant', label: 'Dormant', hint: 'No orders in a long time', color: '#ef4444' },
}

export interface CustomerIntel {
  customer: SallaCustomer
  /** real order rows linked to this customer */
  orders: SallaOrder[]
  orderCount: number
  lifetimeValue: number
  avgOrderValue: number
  daysSinceLastOrder: number | null
  firstOrderDaysAgo: number | null
  segment: SegmentId
  rfm: { r: number; f: number; m: number }
  favoriteProducts: { name: string; qty: number }[]
}

function bucket(v: number, cuts: number[]): number {
  // returns 1..5, higher is better
  let score = 1
  for (const c of cuts) if (v > c) score++
  return Math.min(5, Math.max(1, score))
}

const DAY = 86_400_000

/**
 * RFM + segment engine. Pure client-side computation over already-loaded
 * customers & orders — zero backend cost, updates instantly with realtime.
 */
export function computeCustomerIntel(customers: SallaCustomer[], allOrders: SallaOrder[]): CustomerIntel[] {
  const byCustomer = new Map<string, SallaOrder[]>()
  for (const o of allOrders) {
    if (!o.customer_id) continue
    const list = byCustomer.get(o.customer_id)
    if (list) list.push(o)
    else byCustomer.set(o.customer_id, [o])
  }

  const now = Date.now()
  const intel: CustomerIntel[] = []

  for (const c of customers) {
    const orders = (byCustomer.get(c.id) ?? [])
      .slice()
      .sort((a, b) => (new Date(b.date_created ?? b.synced_at).getTime()) - (new Date(a.date_created ?? a.synced_at).getTime()))

    const dates = orders.map((o) => new Date(o.date_created ?? o.synced_at).getTime()).filter((t) => !isNaN(t))
    const ltv = orders.length ? orders.reduce((s, o) => s + o.total_amount, 0) : c.total_spent ?? 0
    const count = orders.length || c.total_orders || 0
    const lastDate = dates[0] ?? (c.last_order_date ? new Date(c.last_order_date).getTime() : NaN)
    const firstDate = dates[dates.length - 1] ?? (c.first_order_date ? new Date(c.first_order_date).getTime() : NaN)
    const daysSince = isNaN(lastDate) ? null : Math.max(0, Math.floor((now - lastDate) / DAY))
    const firstDaysAgo = isNaN(firstDate) ? null : Math.max(0, Math.floor((now - firstDate) / DAY))

    // product affinity from items jsonb
    const favMap = new Map<string, number>()
    for (const o of orders) {
      if (!Array.isArray(o.items)) continue
      for (const it of o.items as Array<{ name?: string; quantity?: number; name_ar?: string }>) {
        const nm = (it as any)?.name
        if (typeof nm === 'string' && nm.trim()) favMap.set(nm, (favMap.get(nm) ?? 0) + (typeof (it as any)?.quantity === 'number' ? (it as any).quantity : 1))
      }
    }
    const favoriteProducts = [...favMap.entries()]
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)

    intel.push({
      customer: c,
      orders,
      orderCount: count,
      lifetimeValue: ltv,
      avgOrderValue: count ? ltv / count : 0,
      daysSinceLastOrder: daysSince,
      firstOrderDaysAgo: firstDaysAgo,
      segment: 'one_time',
      rfm: { r: 1, f: 1, m: 1 },
      favoriteProducts,
    })
  }

  if (intel.length === 0) return intel

  // quintile cuts computed on THIS store's distribution
  const recents = intel.map((i) => i.daysSinceLastOrder ?? 9999)
  const freqs = intel.map((i) => i.orderCount)
  const spends = intel.map((i) => i.lifetimeValue)
  const q = (arr: number[]) => {
    const s = arr.slice().sort((a, b) => a - b)
    return [0.2, 0.4, 0.6, 0.8].map((p) => s[Math.floor(p * (s.length - 1))])
  }
  const rcuts = q(recents)
  const fcuts = q(freqs)
  const mcuts = q(spends)

  for (const i of intel) {
    // R: lower days = better score
    const r = i.daysSinceLastOrder == null ? 1 : 6 - bucket(i.daysSinceLastOrder, rcuts)
    const f = bucket(i.orderCount, fcuts)
    const m = bucket(i.lifetimeValue, mcuts)
    i.rfm = { r, f, m }

    let seg: SegmentId
    if (r >= 4 && f >= 4) seg = 'champion'
    else if (f >= 3 && r >= 3) seg = 'loyal'
    else if (m >= 4 && f <= 2 && r >= 3) seg = 'promising'
    else if ((i.firstOrderDaysAgo ?? 9999) <= 14 && i.orderCount <= 2) seg = 'new'
    else if (i.orderCount <= 1) seg = 'one_time'
    else if (r <= 2 && f >= 2) seg = 'at_risk'
    else seg = 'dormant'
    i.segment = seg
  }

  return intel
}
