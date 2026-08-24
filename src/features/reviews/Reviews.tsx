import { useMemo, useState } from 'react'
import { Star, MessageSquare, X } from 'lucide-react'
import { useApp } from '../../lib/store'
import { EmptyState } from '../../components/shared/ui'
import { LiveBadge } from '../../components/shared/LiveBadge'

export function Reviews() {
  const { state } = useApp()
  const [typeFilter, setTypeFilter] = useState('all')
  const [starFilter, setStarFilter] = useState(0)
  const reviews = state.sallaReviews ?? []

  const filtered = useMemo(() => {
    let list = reviews
    if (typeFilter !== 'all') list = list.filter((r) => r.type === typeFilter)
    if (starFilter > 0) list = list.filter((r) => r.rating === starFilter)
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [reviews, typeFilter, starFilter])

  const dist = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]
    reviews.forEach((r) => { if (r.rating) counts[r.rating - 1]++ })
    return counts.reverse() // 5★ first
  }, [reviews])

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length).toFixed(1) : '—'
  const maxCount = Math.max(...dist, 1)

  const types = ['all', 'product', 'store', 'shipping']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Reviews</h2>
          <div className="text-sm text-[var(--text-muted)]">{reviews.length} reviews · avg {avgRating}★</div>
        </div>
      </div>

      <LiveBadge />

      {/* Rating distribution */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-6">
          <div className="text-center shrink-0">
            <div className="text-4xl font-extrabold text-[var(--text-primary)]">{avgRating}</div>
            <div className="flex items-center gap-0.5 justify-center mt-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={14} className={`text-[var(--warning)] ${i <= Math.round(Number(avgRating)) ? 'fill-[var(--warning)]' : ''}`} />
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-1">
            {dist.map((count, i) => {
              const stars = 5 - i
              return (
                <button key={stars} onClick={() => setStarFilter(starFilter === stars ? 0 : stars)} className="w-full flex items-center gap-2 group">
                  <span className="text-xs text-[var(--text-muted)] w-6 text-right">{stars}★</span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--track)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--warning)] transition-all" style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                  <span className={`text-xs w-6 text-right ${starFilter === stars ? 'text-[var(--brand)] font-bold' : 'text-[var(--text-muted)]'}`}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Type filter */}
      <div className="flex gap-2 flex-wrap">
        {types.map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)} className={`chip capitalize ${typeFilter === t ? '!border-[var(--brand)] !text-[var(--brand)] font-semibold' : ''}`}>
            {t}
          </button>
        ))}
        {starFilter > 0 && (
          <button onClick={() => setStarFilter(0)} className="chip !border-[var(--warning)] !text-[var(--warning)] font-semibold">
            {starFilter}★ <X size={10} className="ml-0.5" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Star} title="No reviews found" hint="Reviews from your Salla store will appear here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="glass-card p-4 sm:p-5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} size={13} className={`${i <= (r.rating ?? 0) ? 'text-[var(--warning)] fill-[var(--warning)]' : 'text-[var(--track)]'}`} />
                    ))}
                  </div>
                  <span className="badge bg-[var(--surface)] text-[var(--text-muted)] capitalize">{r.type}</span>
                </div>
                <span className="text-xs text-[var(--text-muted)]">{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              </div>
              {r.content && <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{r.content}</p>}
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>{r.customer_name ?? 'Anonymous'}</span>
                {r.product_name && <span className="flex items-center gap-1"><MessageSquare size={11} />{r.product_name}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
