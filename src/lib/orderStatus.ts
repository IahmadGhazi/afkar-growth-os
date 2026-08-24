export interface StatusMeta {
  label: string
  color: string
}

const ORDER_STATUS_MAP: Record<string, StatusMeta> = {
  pending: { label: 'Pending', color: '#f59e0b' },
  payment_pending: { label: 'Payment pending', color: '#f59e0b' },
  under_review: { label: 'Under review', color: '#8b5cf6' },
  processing: { label: 'Processing', color: '#06b6d4' },
  in_progress: { label: 'In progress', color: '#06b6d4' },
  restoring: { label: 'Restoring', color: '#06b6d4' },
  shipped: { label: 'Shipped', color: '#3b82f6' },
  delivering: { label: 'Delivering', color: '#3b82f6' },
  delivered: { label: 'Delivered', color: '#10b981' },
  completed: { label: 'Completed', color: '#10b981' },
  paid: { label: 'Paid', color: '#10b981' },
  canceled: { label: 'Canceled', color: '#ef4444' },
  cancelled: { label: 'Cancelled', color: '#ef4444' },
  refunded: { label: 'Refunded', color: '#f97316' },
  restocked: { label: 'Restocked', color: '#64748b' },
  deleted: { label: 'Deleted', color: '#94a3b8' },
}

export function orderStatusMeta(status: string | null | undefined): StatusMeta {
  const key = String(status ?? '').toLowerCase()
  return ORDER_STATUS_MAP[key] ?? { label: key ? key.replace(/_/g, ' ') : 'Unknown', color: '#94a3b8' }
}

/** Canonical order for the legend / filter tabs. */
export const STATUS_ORDER = [
  'payment_pending',
  'under_review',
  'processing',
  'shipped',
  'delivered',
  'completed',
  'canceled',
  'refunded',
  'restocked',
  'deleted',
]

/** Formats an ISO timestamp as exact local date + time (with seconds). */
export function exactDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export function relativeFromIso(iso: string | null | undefined): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (isNaN(t)) return ''
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (s < 10) return 'seconds ago'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}
