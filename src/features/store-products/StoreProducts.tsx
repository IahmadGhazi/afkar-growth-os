import { useMemo, useState } from 'react'
import { Search, Package, PackageX, Star, AlertTriangle } from 'lucide-react'
import { useApp } from '../../lib/store'
import { EmptyState } from '../../components/shared/ui'
import { LiveBadge } from '../../components/shared/LiveBadge'

export function StoreProducts() {
  const { state } = useApp()
  const [search, setSearch] = useState('')
  const products = useMemo(
    () => (state.sallaProducts ?? []).filter((p) => !state.currentClientId || p.client_id === state.currentClientId),
    [state.sallaProducts, state.currentClientId],
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const q = search.toLowerCase()
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.sku ?? '').toLowerCase().includes(q) ||
      (p.category ?? '').toLowerCase().includes(q),
    )
  }, [products, search])

  const lowStock = products.filter((p) => p.quantity <= 5 && p.status === 'active')
  const bestSellers = [...products].sort((a, b) => b.sales_count - a.sales_count).slice(0, 3)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Products</h2>
          <div className="text-sm text-[var(--text-muted)]">
            {products.filter((p) => p.status === 'active').length} active · {lowStock.length} low stock
          </div>
        </div>
      </div>

      <LiveBadge />

      {/* Best sellers + low stock alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--positive)] mb-2">★ Best Sellers</div>
          {bestSellers.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 text-sm py-1">
              <span className="text-[var(--text-muted)] w-4">{i + 1}.</span>
              <span className="text-[var(--text-primary)] truncate flex-1">{p.name}</span>
              <span className="font-semibold text-[var(--positive)] shrink-0">{p.sales_count} sold</span>
            </div>
          ))}
        </div>
        {lowStock.length > 0 && (
          <div className="glass-card p-4 border-[var(--warning)]">
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--warning)] mb-2">⚠ Low Stock Alert</div>
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm py-1">
                <AlertTriangle size={13} className="text-[var(--warning)] shrink-0" />
                <span className="text-[var(--text-primary)] truncate flex-1">{p.name}</span>
                <span className="font-semibold text-[var(--warning)] shrink-0">{p.quantity} left</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" className="field !pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Package} title="No products yet" hint="Sync from Salla to load your product catalog." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const outOfStock = p.status === 'out_of_stock' || p.quantity === 0
            const low = !outOfStock && p.quantity <= 5
            return (
              <div key={p.id} className={`glass-card hover-lift p-4 space-y-2 relative overflow-hidden ${outOfStock ? 'opacity-80' : ''}`}
                style={outOfStock ? { borderColor: 'rgba(239,68,68,.35)' } : undefined}>
                {/* stock accent stripe */}
                <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]"
                  style={{ background: outOfStock ? '#ef4444' : low ? '#f59e0b' : 'transparent' }} />
                {outOfStock && (
                  <span className="absolute top-3 right-3 z-10 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md"
                    style={{ background: 'rgba(239,68,68,.14)', color: '#ef4444', border: '1px solid rgba(239,68,68,.3)' }}>
                    <PackageX size={11} /> Out of stock
                  </span>
                )}
                <div className="flex items-start justify-between gap-2 pr-1">
                  <div className="font-semibold text-sm text-[var(--text-primary)] leading-snug" dir="auto">{p.name}</div>
                  {!outOfStock && (
                    <span className={`badge shrink-0 ${p.status === 'active' ? 'bg-[var(--positive-soft)] text-[var(--positive)]' : 'bg-[var(--track)] text-[var(--text-muted)]'}`}>{p.status.replace(/_/g, ' ')}</span>
                  )}
                </div>
                {p.image_url ? (
                  <div className="relative">
                    <img src={p.image_url} alt={p.name} className={`w-full h-32 object-cover rounded-lg ${outOfStock ? 'grayscale opacity-45' : ''}`} />
                    {outOfStock && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold uppercase tracking-widest"
                        style={{ color: '#ef4444', textShadow: '0 1px 8px rgba(0,0,0,.6)' }}>Sold out</span>
                    )}
                  </div>
                ) : null}
                <div className="flex items-center justify-between text-sm">
                  <div>
                    {p.sale_price ? (
                      <>
                        <span className="text-[var(--text-muted)] line-through text-xs">{p.price?.toLocaleString()}</span>
                        <span className="font-bold text-[var(--critical)] ml-1.5">{p.sale_price?.toLocaleString()} SAR</span>
                      </>
                    ) : (
                      <span className="font-bold text-[var(--text-primary)]">{p.price?.toLocaleString()} SAR</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Star size={12} className={p.rating_avg && p.rating_avg >= 4 ? 'text-[var(--warning)] fill-[var(--warning)]' : 'text-[var(--text-muted)]'} />
                    {p.rating_avg?.toFixed(1) ?? '—'} ({p.reviews_count})
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--hairline)]">
                  <span className="text-[var(--text-muted)]">{p.category ?? 'Uncategorized'}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-[var(--text-muted)]">{p.sales_count} sold</span>
                    {outOfStock ? (
                      <span className="font-bold" style={{ color: '#ef4444' }}>Restock needed</span>
                    ) : low ? (
                      <span className="flex items-center gap-1 font-semibold text-[var(--warning)]">
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-[var(--warning)]" /> Only {p.quantity} left
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">{p.quantity} in stock</span>
                    )}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
