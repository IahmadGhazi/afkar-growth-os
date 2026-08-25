import { useEffect, useMemo, useState } from 'react'
import { Search, ShoppingCart, Copy, Check, ExternalLink, MessageCircle, Phone, Flame, Clock, Snowflake, Trophy, TicketPercent, Brain, X, RefreshCw } from 'lucide-react'
import { useApp } from '../../lib/store'
import { scopeSalla } from '../../lib/selectors'
import { EmptyState } from '../../components/shared/ui'
import { LiveBadge } from '../../components/shared/LiveBadge'
import { toast } from '../../lib/toast'
import { supabase } from '../../lib/supabase'
import { refreshFromServer } from '../../lib/store'
import { computeCustomerIntel } from '../../lib/rfm'
import { recommendCoupon } from '../../lib/couponsBrain'
import { confirm } from '../../components/shared/Confirm'
import type { AbandonedCart } from '../../types/database'

type Temp = 'hot' | 'warm' | 'cold'

function tempOf(cart: AbandonedCart): Temp {
  // LIVE age from updated_at — age_minutes is a stale snapshot from sync time
  const mins = Math.floor((Date.now() - new Date(cart.updated_at).getTime()) / 60000)
  if (!Number.isFinite(mins) || mins < 0) return 'cold'
  if (mins <= 60) return 'hot'
  if (mins <= 60 * 24) return 'warm'
  return 'cold'
}

const TEMP_META: Record<Temp, { label: string; color: string; icon: typeof Flame }> = {
  hot: { label: 'Hot', color: '#ef4444', icon: Flame },
  warm: { label: 'Warm', color: '#f59e0b', icon: Clock },
  cold: { label: 'Cooling', color: '#64748b', icon: Snowflake },
}

/**
 * Recovery message — Saudi dialect, persuasion stack:
 * warmth → ownership → value re-anchor → gift framing → honest urgency → one CTA.
 */
function recoveryMessage(cart: AbandonedCart): string {
  const name = (cart.customer_name ?? '').split(' ')[0] || 'أبو فلان'
  const items = Array.isArray(cart.items) && cart.items.length > 0
    ? cart.items.map((i) => `• ${i.name}${i.quantity && i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join('\n')
    : '• منتجاتك المختارة'
  const total = `${Math.round(cart.cart_total).toLocaleString('ar-SA')} ر.س`
  const link = cart.checkout_url ?? ''

  const lines: string[] = []
  lines.push(`حياك الله يا ${name} 👋`)
  lines.push('')
  lines.push('سلتك انتظرتك وما كملت الطلب:')
  lines.push(items)
  lines.push(`\n💰 الإجمالي: ${total}`)

  if (cart.coupon_code) {
    lines.push(`\n🎁 وخصمنا لك هدية خاصة: **${cart.coupon_code}**`)
    lines.push('🔑 الكود خاص فيك وما يستخدمه غيرك')
    lines.push('⏰ الكود ساري لفترة قصيرة فقط، لا يفوتك!')
  } else {
    lines.push('\n⚠️ الكمية محدودة ونفسنا توصلك قبل نفادها')
  }

  if (link) {
    lines.push('\nأكمل طلبك بضغطة واحدة 👇')
    lines.push(link)
  }
  lines.push('\n— فريق أفكار مودرن')
  return lines.join('\n')
}

async function mintCoupon(cart: AbandonedCart, sbToken: string, percentOff: number, validHours: number): Promise<{ ok: boolean; code?: string; error?: string; cartUpdated?: boolean }> {
  try {
    const res = await fetch('/api/salla/coupons/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sbToken}` },
      body: JSON.stringify({ cartId: cart.id, percentOff, validHours }),
    })
    const body = await res.json().catch(() => ({}) as Record<string, unknown>)
    if (!res.ok || !body.ok) {
      const raw = String(body.detail ?? body.error ?? `HTTP ${res.status}`)
      if (raw.includes("marketing.read_write")) {
        return { ok: false, error: "Store token predates the marketing scope — reconnect Salla once (Data & Sources) and retry" }
      }
      return { ok: false, error: raw.slice(0, 140) }
    }
    return { ok: true, code: String((body as { code?: string }).code ?? ''), cartUpdated: Boolean((body as { cartUpdated?: boolean }).cartUpdated) }
  } catch (e) {
    return { ok: false, error: String((e as Error).message).slice(0, 120) }
  }
}

export function CartRecovery() {
  const { state } = useApp()
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const allCarts = useMemo(
    () => scopeSalla(state, state.abandonedCarts),
    [state.abandonedCarts, state.clients],
  )

  // Active carts only (purchased ones converted)
  const carts = useMemo(
    () => allCarts.filter((c) => c.status !== 'purchased'),
    [allCarts],
  )
  const rescuedCount = allCarts.filter((c) => c.status === 'purchased').length

  const filtered = useMemo(() => {
    let list = carts
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((c) =>
        (c.customer_name ?? '').toLowerCase().includes(q) ||
        (c.customer_mobile ?? '').includes(q) ||
        (Array.isArray(c.items) && c.items.some((i) => (i.name ?? '').toLowerCase().includes(q))),
      )
    }
    return list.sort((a, b) => (a.age_minutes ?? 9e9) - (b.age_minutes ?? 9e9))
  }, [carts, search])

  const potentialValue = carts.reduce((s, c) => s + c.cart_total, 0)

  // Coupon strength — YOU decide; the Brain advises per-row
  const [percent, setPercent] = useState(10)
  const [validHours, setValidHours] = useState(48)
  const [customPct, setCustomPct] = useState<string>('')
  const [customHrs, setCustomHrs] = useState<string>('')
  const [rowOverrides, setRowOverrides] = useState<Map<string, { percent: number; hours: number }>>(new Map())
  const [allCoupons, setAllCoupons] = useState<Array<{ id: number; code: string; amount: number | null; name?: string | null; status: string; expiryDate?: string | null; isGroup?: boolean }>>([])
  const [activeCoupons, setActiveCoupons] = useState<Array<{ id: number; code: string; amount: number | null; name?: string | null; expiryDate?: string | null }>>([])
  const [minting, setMinting] = useState<Set<string>>(new Set())
  const [freshCodes, setFreshCodes] = useState<Map<string, string>>(new Map())
  const codeFor = (c: AbandonedCart): string | null => c.coupon_code ?? freshCodes.get(c.id) ?? null

  const intel = useMemo(() => computeCustomerIntel(state.sallaCustomers ?? [], state.sallaOrders ?? []), [state.sallaCustomers, state.sallaOrders])
  const intelByCustomer = useMemo(() => {
    const m = new Map<string, { segment: string; lifetimeValue: number; orderCount: number }>()
    for (const i of intel) m.set(i.customer.id, { segment: i.segment, lifetimeValue: i.lifetimeValue, orderCount: i.orderCount })
    return m
  }, [intel])

  /** Status of an armed code: live / expired / unknown (paused or deleted) */
  const codeHealth = (code: string | null): 'live' | 'expired' | 'unknown' | 'none' => {
    if (!code) return 'none'
    const hit = allCoupons.find((c) => c.code === code)
    if (!hit) return 'unknown'
    if (hit.status !== 'active') return 'expired'
    if (hit.expiryDate && new Date(hit.expiryDate.replace(' ', 'T')).getTime() < Date.now()) return 'expired'
    return 'live'
  }

  // Load coupon universe once — powers health badges + attach picker
  useEffect(() => {
    void (async () => {
      try {
        if (!supabase) return
        const { data } = await supabase.auth.getSession()
        if (!data.session?.access_token) return
        const res = await fetch('/api/salla/coupons', { headers: { Authorization: `Bearer ${data.session.access_token}` } })
        const body = await res.json()
        if (res.ok && body.ok) {
          const all = body.coupons as Array<{ id: number; code: string; amount: number | null; name?: string | null; status: string; expiryDate: string | null; isGroup: boolean }>
          setAllCoupons(all)
          setActiveCoupons(all
            .filter((c) => c.status === 'active' && !c.isGroup && (!c.expiryDate || new Date(c.expiryDate.replace(' ', 'T')).getTime() > Date.now()))
            .map((c) => ({ id: c.id, code: c.code, amount: c.amount, name: c.name, expiryDate: c.expiryDate })))
        }
      } catch { /* optional */ }
    })()
  }, [])

  const onMint = async (cart: AbandonedCart) => {
    if (!supabase) { toast.error('Backend not configured'); return }
    setMinting((prev) => new Set(prev).add(cart.id))
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) { toast.error('Sign in required'); return }
      const result = await mintCoupon(cart, token, rowOverrides.get(cart.id)?.percent ?? percent, rowOverrides.get(cart.id)?.hours ?? validHours)
      if (result.ok && result.code) {
        setFreshCodes((prev) => new Map(prev).set(cart.id, result.code!))
        if (result.cartUpdated === false) {
          toast.error(`Coupon ${result.code} created but couldn't attach to this cart — see Coupons tab in Products`)
        } else {
          toast.success(`Coupon ${result.code} is live — ${rowOverrides.get(cart.id)?.percent ?? percent}% for ${rowOverrides.get(cart.id)?.hours ?? validHours}h`)
        }
        void refreshFromServer()
      } else {
        toast.error(`Coupon failed: ${result.error}`)
      }
    } finally {
      setMinting((prev) => { const n = new Set(prev); n.delete(cart.id); return n })
    }
  }

  const attachExisting = async (cart: AbandonedCart, code: string) => {
    if (!supabase) return
    const res = await supabase.from('abandoned_carts').update({ coupon_code: code }).eq('id', cart.id)
    if (res.error) { toast.error(`Attach failed: ${res.error.message}`); return }
    setFreshCodes((prev) => new Map(prev).set(cart.id, code))
    toast.success(`${code} armed — WhatsApp/Copy now carry it`)
    void refreshFromServer()
  }

  // ── Picker modal (rich cards → select → confirm)
  const [pickerCart, setPickerCart] = useState<AbandonedCart | null>(null)
  const [pickerSelected, setPickerSelected] = useState<{ id: number; code: string; amount: number | null; name?: string | null } | null>(null)

  // ── BATCH ARM: one group coupon, N unique codes
  const [batching, setBatching] = useState(false)
  const armable = filtered.filter((c) => !codeFor(c) && c.customer_mobile)
  const batchArm = async () => {
    const targets = armable.slice(0, 50)
    if (targets.length === 0) { toast.error('Every visible cart already has a coupon'); return }
    const ok = await confirm({
      title: `Arm ${targets.length} carts?`,
      message: `Mints ONE group coupon with ${targets.length} unique ${percent}% codes (valid ${validHours >= 24 ? `${Math.round(validHours / 24)}d` : `${validHours}h`}) and attaches one code per cart.\nEach code is private + traceable — leak-proof bulk.`,
      confirmLabel: 'Arm them',
    })
    if (!ok) return
    setBatching(true)
    try {
      const { data } = await supabase!.auth.getSession()
      const token = data.session?.access_token
      if (!token) { toast.error('Sign in required'); return }
      const res = await fetch('/api/salla/coupons/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ percentOff: percent, validHours, batchSize: targets.length, name: `Batch recovery ${percent}%` }),
      })
      const body = await res.json()
      const codes: string[] | null = body.codes
      if (!res.ok || !body.ok || !codes?.length) {
        toast.error(`Batch failed: ${String(body.detail ?? body.error ?? res.status).slice(0, 110)}`)
        return
      }
      let armed = 0
      for (let i = 0; i < targets.length; i++) {
        const code = codes[i % codes.length]
        const r = await supabase!.from('abandoned_carts').update({ coupon_code: code }).eq('id', targets[i].id)
        if (!r.error) { armed++; setFreshCodes((prev) => new Map(prev).set(targets[i].id, code)) }
      }
      toast.success(`⚡ ${armed}/${targets.length} carts armed with unique ${percent}% codes`)
      void refreshFromServer()
    } finally {
      setBatching(false)
    }
  }

  const copyMsg = async (cart: AbandonedCart, codeOverride?: string | null) => {
    try {
      const msg = recoveryMessage(codeOverride ? { ...cart, coupon_code: codeOverride } : cart)
      await navigator.clipboard.writeText(msg)
      setCopied(cart.id)
      setTimeout(() => setCopied(null), 1500)
      toast.success('Recovery message copied')
    } catch {
      toast.error('Copy failed — select manually')
    }
  }

  const openWhatsApp = (cart: AbandonedCart, codeOverride?: string | null) => {
    const mobile = (cart.customer_mobile ?? '').replace(/[^\d+]/g, '')
    if (!mobile) { toast.error('No phone number on this cart'); return }
    let intl = mobile.startsWith('+') ? mobile.slice(1) : mobile
    if (intl.startsWith('00')) intl = intl.slice(2)
    const msg = recoveryMessage(codeOverride ? { ...cart, coupon_code: codeOverride } : cart)
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
  }

  const detachCoupon = async (cart: AbandonedCart) => {
    const code = codeFor(cart)
    if (!code) return
    const ok = await confirm({
      title: `Remove ${code}?`,
      message: `Detaches from ${cart.customer_name ?? 'this cart'}.\nThe coupon stays alive in your store (Products → Coupons) — the cart just becomes coupon-free again.`,
      confirmLabel: 'Detach',
    })
    if (!ok) return
    if (!supabase) return
    const res = await supabase.from('abandoned_carts').update({ coupon_code: null }).eq('id', cart.id)
    if (res.error) { toast.error(`Detach failed: ${res.error.message}`); return }
    setFreshCodes((prev) => { const n = new Map(prev); n.delete(cart.id); return n })
    toast.success(`${code} detached — cart is coupon-free again`)
    void refreshFromServer()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Cart Recovery</h2>
          <div className="text-sm text-[var(--text-muted)]">
            {carts.length} live carts · <span className="text-[var(--positive)] font-medium">{rescuedCount} rescued</span> all-time
          </div>
        </div>
      </div>

      <LiveBadge />

      {/* HERO — the number, the temperature map, the trophy */}
      <div className="glass-card p-6">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-8">
          <div className="min-w-[220px]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Recoverable value</div>
            <div className="text-5xl font-extrabold text-[var(--text-primary)] tabular-nums mt-1 leading-none">
              {potentialValue.toLocaleString()} <span className="text-xl font-bold">SAR</span>
            </div>
            <div className="text-sm text-[var(--text-muted)] mt-2">
              sitting in {carts.length} abandoned carts
            </div>
          </div>

          {/* Temperature value map */}
          <div className="flex-1 min-w-[240px]">
            {(() => {
              const byTemp = { hot: 0, warm: 0, cold: 0 }
              const counts = { hot: 0, warm: 0, cold: 0 }
              for (const c of carts) { const t = tempOf(c); byTemp[t] += c.cart_total; counts[t]++ }
              const total = byTemp.hot + byTemp.warm + byTemp.cold || 1
              const seg = [
                { t: 'hot' as Temp, color: '#ef4444', label: 'Hot <1h' },
                { t: 'warm' as Temp, color: '#f59e0b', label: 'Warm <1d' },
                { t: 'cold' as Temp, color: '#94a3b8', label: 'Cooling' },
              ]
              return (
                <>
                  <div className="flex h-3 rounded-full overflow-hidden bg-[var(--track)]">
                    {seg.map((s) => byTemp[s.t] > 0 && (
                      <div key={s.t} style={{ width: `${(byTemp[s.t] / total) * 100}%`, background: s.color }} title={`${s.label}: ${Math.round(byTemp[s.t]).toLocaleString()} SAR`} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
                    {seg.map((s) => (
                      <span key={s.t} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                        <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                        {s.label} · <span className="font-semibold text-[var(--text-primary)] tabular-nums">{Math.round(byTemp[s.t]).toLocaleString()}</span>
                        <span className="opacity-60">({counts[s.t]})</span>
                      </span>
                    ))}
                  </div>
                </>
              )
            })()}
          </div>

          {/* Trophy */}
          <div className="flex items-center gap-3 lg:ml-auto lg:border-l lg:border-[var(--hairline)] lg:pl-8">
            <span className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--positive-soft)]">
              <Trophy size={20} className="text-[var(--positive)]" />
            </span>
            <div>
              <div className="text-2xl font-extrabold text-[var(--text-primary)] tabular-nums leading-none">{rescuedCount}</div>
              <div className="text-xs text-[var(--text-muted)]">carts rescued</div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, phone or product…" className="field !pl-9" />
      </div>

      {/* Strength toolbar */}
      <div className="glass-card px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Strength</span>
        <div className="flex gap-1 items-center">
          {[5, 10, 15, 20, 25].map((p) => (
            <button key={p} onClick={() => { setPercent(p); setCustomPct('') }}
              className={`chip !px-2.5 !py-1 text-xs ${percent === p && !customPct ? 'font-semibold' : ''}`}
              style={percent === p && !customPct ? { borderColor: 'var(--brand)', color: 'var(--brand)' } : undefined}>
              {p}%
            </button>
          ))}
          <input type="number" min={1} max={90} placeholder="%" value={customPct} aria-label="Custom discount percent"
            onChange={(e) => { const v = e.target.value; setCustomPct(v); if (v && Number(v) >= 1) setPercent(Math.min(90, Math.max(1, Number(v)))) }}
            className="field !w-16 !py-1 !text-xs tabular-nums" />
        </div>
        <div className="flex gap-1 items-center">
          {[[24, '1d'], [48, '2d'], [168, '1w']].map(([h, label]) => (
            <button key={h} onClick={() => { setValidHours(h as number); setCustomHrs('') }}
              className={`chip !px-2.5 !py-1 text-xs ${validHours === h && !customHrs ? 'font-semibold' : ''}`}
              style={validHours === h && !customHrs ? { borderColor: 'var(--brand)', color: 'var(--brand)' } : undefined}>
              {label as string}
            </button>
          ))}
          <input type="number" min={1} max={2160} placeholder="hrs" value={customHrs} aria-label="Custom validity hours"
            onChange={(e) => { const v = e.target.value; setCustomHrs(v); if (v && Number(v) >= 1) setValidHours(Math.min(2160, Number(v))) }}
            className="field !w-16 !py-1 !text-xs tabular-nums" />
        </div>
        {armable.length > 1 && (
          <button onClick={() => void batchArm()} disabled={batching}
            title={`Mint ONE group coupon with ${Math.min(armable.length, 50)} unique ${percent}% codes and arm every warm cart`}
            className="btn btn-outline !text-xs !px-3 !py-1.5 ml-auto inline-flex items-center gap-1.5">
            {batching ? 'Arming…' : `Arm all ${Math.min(armable.length, 50)}`}
          </button>
        )}
        {armable.length === 0 && carts.length > 0 && (
          <span className="text-[11px] text-[var(--text-muted)] ml-auto">
            All carts armed — click a coupon code to swap it, ✕ to detach
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No abandoned carts right now"
          hint="The moment a customer leaves items behind, they appear here with their checkout link ready. Click Sync Now in Data & Sources to pull the current list."
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((cart) => {
            const temp = tempOf(cart)
            const meta = TEMP_META[temp]
            const TempIcon = meta.icon
            const contacted = Boolean(cart.last_contacted_at)
            const override = rowOverrides.get(cart.id)
            // LIVE minutes — one source of truth for label + brain + temp
            const liveMins = Math.max(0, Math.floor((Date.now() - new Date(cart.updated_at).getTime()) / 60000))
            const brain = recommendCoupon({ ...cart, age_minutes: liveMins }, cart.customer_id ? intelByCustomer.get(cart.customer_id) ?? null : null)
            const effPercent = override?.percent ?? percent
            const effHours = override?.hours ?? validHours
            const brainMatches = brain.percent === effPercent && brain.hours === effHours
            const armedCode = codeFor(cart)
            const health = codeHealth(armedCode)
            const ageLabel = liveMins < 60 ? `${liveMins}m` : liveMins < 1440 ? `${Math.floor(liveMins / 60)}h` : `${Math.floor(liveMins / 1440)}d`
            return (
              <div key={cart.id} className="glass-card relative overflow-hidden px-4 sm:px-5 py-3.5">
                <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: meta.color }} />

                <div className="flex flex-wrap md:flex-nowrap items-start gap-x-4 gap-y-2">
                  {/* Temp */}
                  <div className="min-w-[86px]">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: meta.color }}>
                      <TempIcon size={11} /> {meta.label}
                    </span>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5 tabular-nums">
                      {ageLabel}
                    </div>
                  </div>

                  {/* Who + what */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[var(--text-primary)] truncate" dir="auto">{cart.customer_name ?? 'Guest'}</span>
                      {contacted && <span className="text-[10px] text-[var(--positive)]">✓ contacted</span>}
                      {armedCode && (
                        <span className="inline-flex items-center gap-1.5">
                          <button onClick={() => { setPickerCart(cart); setPickerSelected(null) }}
                            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded border transition-colors hover:bg-[var(--hover)]"
                            title="Click to swap this coupon"
                            style={{
                              borderColor: health === 'live' ? 'rgba(16,185,129,.35)' : 'rgba(239,68,68,.4)',
                              color: health === 'live' ? '#10b981' : '#ef4444',
                            }}>
                            <TicketPercent size={10} /> {armedCode}{health !== 'live' && <span className="font-sans">· {health === 'expired' ? 'dead' : 'gone'}</span>}
                          </button>
                          <button onClick={() => void detachCoupon(cart)} aria-label={`Remove ${armedCode} from this cart`}
                            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover)] transition-colors">
                            <X size={12} />
                          </button>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] truncate mt-0.5" dir="auto">
                      {Array.isArray(cart.items) && cart.items.length > 0
                        ? cart.items.slice(0, 3).map((i) => `${i.name} ×${i.quantity ?? 1}`).join(' · ')
                        : `${cart.items?.length ?? 0} items`}
                    </div>
                    {(cart.customer_mobile || cart.customer_email) && (
                      <div className="text-[11px] text-[var(--text-muted)] mt-0.5 flex gap-3" dir="ltr">
                        {cart.customer_mobile && <span className="flex items-center gap-1"><Phone size={10} />{cart.customer_mobile}</span>}
                        {cart.customer_email && <span className="truncate">{cart.customer_email}</span>}
                      </div>
                    )}
                    {/* Brain — quiet advice, gold apply */}
                    {!armedCode && (
                      <div className="mt-1 text-[11px] text-[var(--text-muted)] flex items-center gap-2">
                        <Brain size={11} className="shrink-0" />
                        <span>
                          suggests <span className="font-semibold text-[var(--text-primary)]">{brain.percent}% · {brain.hours >= 24 ? `${Math.round(brain.hours / 24)}d` : `${brain.hours}h`}</span>
                          {!brainMatches && (
                            <button onClick={() => setRowOverrides((prev) => new Map(prev).set(cart.id, { percent: brain.percent, hours: brain.hours }))}
                              className="ml-1.5 font-medium hover:underline" style={{ color: 'var(--brand)' }}>apply</button>
                          )}
                          {override && (
                            <button onClick={() => setRowOverrides((prev) => { const n = new Map(prev); n.delete(cart.id); return n })}
                              className="ml-1.5 hover:underline">reset</button>
                          )}
                          <span className="opacity-60 ml-1" title={brain.reasons.join(' · ')}>— {brain.reasons[0]}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Money + actions — ONE coupon entry, one primary */}
                  <div className="flex items-center gap-2 ml-auto shrink-0">
                    <span className="text-base font-bold text-[var(--text-primary)] tabular-nums mr-1">
                      {Math.round(cart.cart_total).toLocaleString()} <span className="text-xs font-medium opacity-60">SAR</span>
                    </span>
                    {!armedCode && (
                      <button onClick={() => { setPickerCart(cart); setPickerSelected(null) }}
                        title={`Coupon: mint ${effPercent}% or attach an existing one`}
                        className="btn btn-outline !px-3 !py-1.5 text-xs inline-flex items-center gap-1.5">
                        <TicketPercent size={13} /> Coupon
                      </button>
                    )}
                    {cart.checkout_url && (
                      <a href={cart.checkout_url} target="_blank" rel="noopener noreferrer" title="Open checkout link"
                        className="btn btn-primary !px-3 !py-1.5 text-xs inline-flex items-center gap-1.5">
                        <ExternalLink size={12} /> Checkout
                      </a>
                    )}
                    <button onClick={() => openWhatsApp(cart, armedCode)} title="Send WhatsApp recovery message"
                      aria-label="Send WhatsApp recovery message"
                      className="btn btn-outline !px-2.5 !py-1.5 inline-flex items-center">
                      <MessageCircle size={14} />
                    </button>
                    <button onClick={() => copyMsg(cart, armedCode)} title="Copy Arabic message" aria-label="Copy recovery message"
                      className="btn btn-outline !px-2.5 !py-1.5 inline-flex items-center">
                      {copied === cart.id ? <Check size={14} className="text-[var(--positive)]" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="glass-card px-4 py-3 text-[11px] text-[var(--text-muted)] flex items-start gap-2">
        <RefreshCw size={12} className="mt-0.5 shrink-0" />
        <span>
          Manual recovery today — WhatsApp deep-link with a prefilled Arabic message.
          Automated WhatsApp Business API sending is wired and waiting for credentials.
        </span>
      </div>

      {/* ── PICKER: rich cards → select → confirm */}
      {pickerCart && (() => {
        const effPercent = rowOverrides.get(pickerCart.id)?.percent ?? percent
        const effHours = rowOverrides.get(pickerCart.id)?.hours ?? validHours
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/45 animate-[fadeIn_.2s_ease]" onClick={() => { setPickerCart(null); setPickerSelected(null) }} />
          <div className="relative w-full max-w-lg rounded-2xl border border-[var(--hairline)] bg-[var(--card)] shadow-2xl p-5 space-y-4 animate-[pulseIn_.3s_var(--ease-spring)_both] max-h-[85vh] overflow-y-auto">
            <div>
              <div className="text-sm font-bold text-[var(--text-primary)]">Pick a coupon for <span dir="auto">{pickerCart.customer_name ?? 'Guest'}</span></div>
              <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Cart {Math.round(pickerCart.cart_total).toLocaleString()} SAR · select one, then confirm — nothing applies until you say so.
              </div>
            </div>

            <div className="space-y-2">
              {/* Mint-new — first card, uses toolbar strength or this row's Brain override */}
              <button onClick={() => { const c = pickerCart; setPickerCart(null); setPickerSelected(null); void onMint(c) }}
                disabled={minting.has(pickerCart.id)}
                className="w-full text-left rounded-xl border px-4 py-3 transition-colors flex items-center gap-3"
                style={{ borderColor: 'var(--brand)', background: 'var(--warning-soft)' }}>
                <span className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 font-mono text-xs font-bold"
                  style={{ background: 'var(--warning-soft)', color: 'var(--brand)', border: '1px dashed var(--brand)' }}>
                  {effPercent}%
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[var(--text-primary)]">
                    {minting.has(pickerCart.id) ? 'Minting…' : `Mint a new ${effPercent}% coupon`}
                  </span>
                  <span className="block text-[11px] text-[var(--text-muted)] mt-0.5">
                    Valid {effHours >= 24 ? `${Math.round(effHours / 24)} days` : `${effHours}h`} · private to this customer · attached automatically
                  </span>
                </span>
                <TicketPercent size={16} style={{ color: 'var(--brand)' }} className="shrink-0" />
              </button>

              {activeCoupons.length > 0 && (
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] pt-1">or attach an existing one</div>
              )}
              {activeCoupons.map((ac) => {
                const selected = pickerSelected?.id === ac.id
                return (
                  <button key={ac.id} onClick={() => setPickerSelected(ac)}
                    className="w-full text-left rounded-xl border px-4 py-3 transition-colors flex items-center gap-3"
                    style={selected
                      ? { borderColor: 'var(--brand)', background: 'var(--warning-soft)' }
                      : { borderColor: 'var(--hairline)', background: 'var(--bg)' }}>
                    <span className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 font-mono text-xs font-bold"
                      style={{ background: selected ? 'var(--warning-soft)' : 'var(--track)', color: selected ? 'var(--brand)' : 'var(--text-primary)' }}>
                      {ac.amount != null ? `${ac.amount}%` : '★'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-bold font-mono text-[var(--text-primary)]">{ac.code}</span>
                        {ac.name && <span className="text-[11px] text-[var(--text-muted)] truncate" dir="auto">{ac.name}</span>}
                      </span>
                      <span className="block text-[11px] text-[var(--text-muted)] mt-0.5">
                        {ac.amount != null ? `${ac.amount}% off` : 'Special'} · active now
                      </span>
                    </span>
                    {selected && <Check size={16} style={{ color: 'var(--brand)' }} className="shrink-0" />}
                  </button>
                )
              })}
              {activeCoupons.length === 0 && (
                <div className="text-xs text-[var(--text-muted)] py-4 text-center">
                  No active coupons — mint one with the {percent}% button, or from the Coupons tab.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[var(--hairline)] bg-[var(--bg)] px-4 py-3 flex items-center gap-3">
              {pickerSelected ? (
                <>
                  <div className="min-w-0 flex-1 text-xs text-[var(--text-primary)]">
                    Arm <span className="font-mono font-bold">{pickerSelected.code}</span>
                    {pickerSelected.amount != null && <span className="text-[var(--text-muted)]"> ({pickerSelected.amount}% off)</span>}
                    {' '}on <span className="font-semibold" dir="auto">{pickerCart.customer_name ?? 'Guest'}</span>'s cart?
                  </div>
                  <button onClick={() => { setPickerCart(null); setPickerSelected(null) }} className="btn btn-outline !text-xs !px-3 !py-1.5">Cancel</button>
                  <button onClick={() => { const code = pickerSelected.code; setPickerCart(null); setPickerSelected(null); void attachExisting(pickerCart, code) }}
                    className="btn btn-primary !text-xs !px-4 !py-1.5">
                    Confirm attach
                  </button>
                </>
              ) : (
                <div className="text-xs text-[var(--text-muted)] flex-1">Select a coupon above to continue.</div>
              )}
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}
