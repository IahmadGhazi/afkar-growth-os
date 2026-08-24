import { useMemo, useState } from 'react'
import { Search, Users, Mail, Phone, MapPin, Crown } from 'lucide-react'
import { useApp } from '../../lib/store'
import { EmptyState } from '../../components/shared/ui'

export function Customers() {
  const { state } = useApp()
  const [search, setSearch] = useState('')
  const customers = state.sallaCustomers ?? []

  const filtered = useMemo(() => {
    if (!search.trim()) return customers
    const q = search.toLowerCase()
    return customers.filter((c) =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.mobile ?? '').includes(q) ||
      (c.city ?? '').toLowerCase().includes(q),
    )
  }, [customers, search])

  const totalValue = customers.reduce((s, c) => s + c.total_spent, 0)
  const vipCount = customers.filter((c) => c.total_orders >= 5).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Customers</h2>
          <div className="text-sm text-[var(--text-muted)]">
            {customers.length} customers · {vipCount} VIP · {totalValue.toLocaleString()} SAR lifetime value
          </div>
        </div>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, phone, city…" className="field !pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No customers found" hint="Sync from Salla to load your customer base." />
      ) : (
        <div className="glass-card divide-y divide-[var(--hairline)] overflow-hidden">
          {filtered.map((c) => (
            <div key={c.id} className="px-4 sm:px-5 py-3.5 flex items-center gap-3 sm:gap-4 hover:bg-[var(--hover)] transition-colors">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f0c42e] to-[#d29a0c] flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-[#1a1405]">{(c.first_name?.charAt(0) ?? '?')}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{c.first_name} {c.last_name}</div>
                <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mt-0.5">
                  {c.email && <span className="flex items-center gap-1"><Mail size={11} />{c.email}</span>}
                  {c.mobile && <span className="hidden sm:flex items-center gap-1"><Phone size={11} />{c.mobile_code}{c.mobile}</span>}
                  {c.city && <span className="hidden md:flex items-center gap-1"><MapPin size={11} />{c.city}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{c.total_spent.toLocaleString()} SAR</div>
                <div className="text-xs text-[var(--text-muted)]">{c.total_orders} orders · {c.loyalty_points} pts</div>
              </div>
              {c.total_orders >= 5 && (
                <span className="badge bg-[var(--warning-soft)] text-[var(--warning)] shrink-0 hidden lg:inline-flex">
                  <Crown size={11} /> VIP
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
