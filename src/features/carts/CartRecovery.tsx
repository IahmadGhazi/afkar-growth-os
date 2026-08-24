import { useEffect, useMemo, useState } from 'react'
import { Search, ShoppingCart, Copy, Check, ExternalLink, MessageCircle, Phone, Flame, Clock, Snowflake, Trophy, RefreshCw, TicketPercent, Brain } from 'lucide-react'
import { useApp } from '../../lib/store'
import { scopeSalla } from '../../lib/selectors'
import { EmptyState } from '../../components/shared/ui'
import { LiveBadge } from '../../components/shared/LiveBadge'
import { toast } from '../../lib/toast'
import { supabase } from '../../lib/supabase'
import { refreshFromServer } from '../../lib/store'
import { computeCustomerIntel } from '../../lib/rfm'
import { recommendCoupon } from '../../lib/couponsBrain'
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
  hot: { label: 'Hot — act now', color: '#ef4444', icon: Flame },
  warm: { label: 'Warm today', color: '#f59e0b', icon: Clock },
  cold: { label: 'Cooling off', color: '#64748b', icon: Snowflake },
}

/**
 * Recovery message — Saudi dialect, built on proven persuasion psychology:
 *  1. Personal warmth (حياك الله) → belonging, not a robot
 *  2. Ownership framing ("سلتك انتظرتك") → endowment: it's already theirs
 *  3. Concrete item list + price → re-anchors the value they chose
 *  4. Scarcity ("الكمية محدودة") → loss aversion kicks in
 *  5. Exclusive gift framing for the coupon (not "discount", but a GIFT) → reciprocity
 *  6. Urgency with reason (ساري لفترة محدودة) → deadline without pressure
 *  7. ONE tiny action ("بضغطة واحدة") → zero friction CTA
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
  const hotCarts = carts.filter((c) => tempOf(c) === 'hot')
  const contactedIds = new Set(carts.filter((c) => c.last_contacted_at).map((c) => c.id))

  // Optimistic coupon codes minted this session (server truth arrives via refresh)
  const [minting, setMinting] = useState<Set<string>>(new Set())
  const [freshCodes, setFreshCodes] = useState<Map<string, string>>(new Map())
  // Coupon strength — YOU decide; the Brain advises per-row
  const [percent, setPercent] = useState(10)
  const [validHours, setValidHours] = useState(48)
  const [rowOverrides, setRowOverrides] = useState<Map<string, { percent: number; hours: number }>>(new Map())
  const [activeCoupons, setActiveCoupons] = useState<Array<{ id: number; code: string; amount: number | null; name?: string | null; expiryDate?: string | null; usage?: { times: number | null } }>>([])
  const codeFor = (c: AbandonedCart): string | null => c.coupon_code ?? freshCodes.get(c.id) ?? null

  const intel = useMemo(() => computeCustomerIntel(state.sallaCustomers ?? [], state.sallaOrders ?? []), [state.sallaCustomers, state.sallaOrders])
  const intelByCustomer = useMemo(() => {
    const m = new Map<string, { segment: string; lifetimeValue: number; orderCount: number }>()
    for (const i of intel) m.set(i.customer.id, { segment: i.segment, lifetimeValue: i.lifetimeValue, orderCount: i.orderCount })
    return m
  }, [intel])

  // Load ACTIVE coupons once for the attach-existing picker
  useEffect(() => {
    void (async () => {
      try {
        if (!supabase) return
        const { data } = await supabase.auth.getSession()
        if (!data.session?.access_token) return
        const res = await fetch('/api/salla/coupons', { headers: { Authorization: `Bearer ${data.session.access_token}` } })
        const body = await res.json()
        if (res.ok && body.ok) {
          setActiveCoupons((body.coupons as Array<{ id: number; code: string; amount: number | null; status: string; expiryDate: string | null }>)
            .filter((c) => c.status === 'active' && (!c.expiryDate || new Date(c.expiryDate.replace(' ', 'T')).getTime() > Date.now()))
            .map((c) => ({ id: c.id, code: c.code, amount: c.amount })))
        }
      } catch { /* picker is optional */ }
    })()
  }, [])

  const attachExisting = async (cart: AbandonedCart, code: string) => {
    if (!supabase) return
    const res = await supabase.from('abandoned_carts').update({ coupon_code: code }).eq('id', cart.id)
    if (res.error) { toast.error(`Attach failed: ${res.error.message}`); return }
    setFreshCodes((prev) => new Map(prev).set(cart.id, code))
    toast.success(`${code} armed on this cart — WhatsApp/Copy now carry it`)
    void refreshFromServer()
  }

  // ── Picker modal state (rich cards + confirm step — no accidental applies)
  const [pickerCart, setPickerCart] = useState<AbandonedCart | null>(null)
  const [pickerSelected, setPickerSelected] = useState<{ id: number; code: string; amount: number | null; name?: string | null; expiryDate?: string | null; usage?: { times: number | null } } | null>(null)

  // ── BATCH ARM: mint ONE group coupon (N unique codes) → arm every warm/hot cart
  const [batching, setBatching] = useState(false)
  const armable = filtered.filter((c) => !codeFor(c) && c.customer_mobile)
  const batchArm = async () => {
    const targets = armable.slice(0, 50)
    if (targets.length === 0) { toast.error('Every visible cart already has a coupon'); return }
    if (!window.confirm(`Arm ${targets.length} carts?\n\nMints ONE group coupon with ${targets.length} unique ${percent}% codes (valid ${validHours >= 24 ? `${Math.round(validHours / 24)}d` : `${validHours}h`}) and attaches one code per cart. Each code is private + traceable.`)) return
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Cart Recovery</h2>
          <div className="text-sm text-[var(--text-muted)]">
            {carts.length} live carts · {potentialValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} SAR on the table
          </div>
        </div>
      </div>

      <LiveBadge />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger">
        <div className="glass-card p-4 flex items-center gap-3" style={{ borderColor: 'rgba(239,68,68,.25)' }}>
          <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,.12)' }}>
            <Flame size={18} style={{ color: '#ef4444' }} />
          </span>
          <div>
            <div className="text-xl font-bold text-[var(--text-primary)] tabular-nums">{hotCarts.length}</div>
            <div className="text-xs text-[var(--text-muted)]">Hot carts (&lt;1h old)</div>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--warning-soft)]">
            <ShoppingCart size={18} className="text-[var(--warning)]" />
          </span>
          <div>
            <div className="text-xl font-bold text-[var(--text-primary)] tabular-nums">{potentialValue.toLocaleString()} <span className="text-sm">SAR</span></div>
            <div className="text-xs text-[var(--text-muted)]">Recoverable value</div>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--positive-soft)]">
            <Trophy size={18} className="text-[var(--positive)]" />
          </span>
          <div>
            <div className="text-xl font-bold text-[var(--text-primary)] tabular-nums">{contactedIds.size}</div>
            <div className="text-xs text-[var(--text-muted)]">Already contacted</div>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, phone or product…" className="field !pl-9" />
      </div>

      {/* Coupon strength toolbar — you decide the discount */}
      <div className="glass-card px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          <TicketPercent size={12} /> Coupon strength
        </span>
        <div className="flex gap-1.5">
          {[5, 10, 15, 20, 25].map((p) => (
            <button key={p} onClick={() => setPercent(p)}
              className={`chip !px-2.5 !py-1 text-xs ${percent === p ? 'font-bold' : ''}`}
              style={percent === p ? { borderColor: '#d29a0c88', color: '#d29a0c', background: 'rgba(240,196,46,.12)' } : undefined}>
              {p}%
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {[[24, '1 day'], [48, '2 days'], [168, '1 week']].map(([h, label]) => (
            <button key={h} onClick={() => setValidHours(h as number)}
              className={`chip !px-2.5 !py-1 text-xs ${validHours === h ? 'font-bold' : ''}`}
              style={validHours === h ? { borderColor: '#d29a0c88', color: '#d29a0c', background: 'rgba(240,196,46,.12)' } : undefined}>
              {label as string}
            </button>
          ))}
        </div>
        {armable.length > 1 && (
          <button onClick={() => void batchArm()} disabled={batching}
            title={`Mint ONE group coupon with ${Math.min(armable.length, 50)} unique ${percent}% codes and arm every warm cart — leak-proof bulk`}
            className="btn !text-[11px] !px-2.5 !py-1 inline-flex items-center gap-1 ml-auto"
            style={{ background: 'rgba(139,92,246,.1)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,.3)' }}>
            ⚡ {batching ? 'Arming…' : `Arm all ${Math.min(armable.length, 50)}`}
          </button>
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
            const Icon = meta.icon
            const contacted = Boolean(cart.last_contacted_at)
            const override = rowOverrides.get(cart.id)
            const brain = recommendCoupon(cart, cart.customer_id ? intelByCustomer.get(cart.customer_id) ?? null : null)
            const effPercent = override?.percent ?? percent
            const effHours = override?.hours ?? validHours
            const brainMatches = brain.percent === effPercent && brain.hours === effHours
            return (
              <div key={cart.id} className="glass-card relative overflow-hidden hover-lift px-4 sm:px-5 py-3.5"
                style={temp === 'hot' ? { borderColor: 'rgba(239,68,68,.35)' } : undefined}>
                <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: meta.color }} />
                <div className="flex flex-wrap md:flex-nowrap items-start gap-x-4 gap-y-2">
                  <div className="min-w-[130px]">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                      style={{ color: meta.color, background: `${meta.color}1a`, border: `1px solid ${meta.color}40` }}>
                      <Icon size={10} /> {meta.label.split('—')[0]}
                    </span>
                    <div className="text-[11px] text-[var(--text-muted)] mt-1">
                      {cart.age_minutes != null ? `${cart.age_minutes < 60 ? `${cart.age_minutes}m` : `${Math.floor(cart.age_minutes / 60)}h`} ago` : ''}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text-primary)] truncate" dir="auto">{cart.customer_name ?? 'Guest'}</span>
                      {contacted && (
                        <span className="badge bg-[var(--positive-soft)] text-[var(--positive)] text-[9px]"><Check size={9} /> contacted</span>
                      )}
                      {codeFor(cart) && (
                        <span className="badge text-[9px] font-mono" style={{ background: 'rgba(37,211,102,.12)', color: '#25D366', border: '1px solid rgba(37,211,102,.3)' }}>
                          <TicketPercent size={9} /> {codeFor(cart)}
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
                    {/* 🤖 THE KNOWLEDGE BOT — prescribed dose for THIS cart */}
                    {!codeFor(cart) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-md"
                          style={{ background: 'rgba(139,92,246,.1)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,.3)' }}
                          title={brain.reasons.join(' · ')}>
                          <Brain size={10} /> Brain says {brain.percent}% · {brain.hours >= 24 ? `${Math.round(brain.hours / 24)}d` : `${brain.hours}h`}
                          <span className="opacity-60">({brain.confidence})</span>
                        </span>
                        {!brainMatches && (
                          <button onClick={() => setRowOverrides((prev) => new Map(prev).set(cart.id, { percent: brain.percent, hours: brain.hours }))}
                            className="text-[10px] font-semibold hover:underline" style={{ color: '#8b5cf6' }}>
                            Apply
                          </button>
                        )}
                        {override && (
                          <button onClick={() => setRowOverrides((prev) => { const n = new Map(prev); n.delete(cart.id); return n })}
                            className="text-[10px] text-[var(--text-muted)] hover:underline">reset to {percent}%</button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-auto shrink-0">
                    <span className="text-base font-bold text-[var(--text-primary)] tabular-nums mr-1">
                      {Math.round(cart.cart_total).toLocaleString()} <span className="text-xs font-medium opacity-60">SAR</span>
                    </span>
                    {!codeFor(cart) && (
                      <button onClick={() => onMint(cart)} disabled={minting.has(cart.id)}
                        title={`Mint a ${effPercent}% / ${effHours >= 24 ? `${Math.round(effHours / 24)}d` : `${effHours}h`} coupon in your Salla store and attach it`}
                        className="btn !px-3 !py-1.5 text-xs inline-flex items-center gap-1.5" style={{ background: 'rgba(240,196,46,.12)', color: '#d29a0c', border: '1px solid rgba(210,154,12,.3)' }}>
                        <TicketPercent size={13} /> {minting.has(cart.id) ? 'Minting…' : `${effPercent}%`}
                      </button>
                    )}
                    {!codeFor(cart) && activeCoupons.length > 0 && (
                      <button onClick={() => { setPickerCart(cart); setPickerSelected(null) }}
                        title="Pick from your existing active coupons"
                        className="btn !px-3 !py-1.5 text-xs inline-flex items-center gap-1.5"
                        style={{ background: 'rgba(16,185,129,.1)', color: '#10b981', border: '1px solid rgba(16,185,129,.3)' }}>
                        📎 Attach
                      </button>
                    )}
                    {cart.checkout_url && (
                      <a href={cart.checkout_url} target="_blank" rel="noopener noreferrer"
                        title="Open customer's checkout link"
                        className="btn btn-primary !px-3 !py-1.5 text-xs inline-flex items-center gap-1.5">
                        <ExternalLink size={12} /> Checkout
                      </a>
                    )}
                    <button onClick={() => openWhatsApp(cart, codeFor(cart))} title="Send WhatsApp recovery message (Arabic)"
                      className="btn !px-3 !py-1.5 text-xs inline-flex items-center gap-1.5" style={{ background: 'rgba(37,211,102,.14)', color: '#25D366', border: '1px solid rgba(37,211,102,.3)' }}>
                      <MessageCircle size={13} /> WhatsApp
                    </button>
                    <button onClick={() => copyMsg(cart, codeFor(cart))} title="Copy Arabic recovery message"
                      className="btn !px-2.5 !py-1.5 text-xs inline-flex items-center">
                      {copied === cart.id ? <Check size={13} className="text-[var(--positive)]" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* WABA foundation note */}
      <div className="glass-card px-4 py-3 text-[11px] text-[var(--text-muted)] flex items-start gap-2">
        <RefreshCw size={12} className="mt-0.5 shrink-0" />
        <span>
          Manual recovery today — one tap sends via WhatsApp deep-link with a prefilled message.
          Automated WhatsApp Business API campaigns are wired into the roadmap; the message templates here are already WABA-compatible.
        </span>
      </div>

      {/* ── COUPON PICKER: rich cards → select → CONFIRM (never accidental) */}
      {pickerCart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[fadeIn_.2s_ease]" onClick={() => { setPickerCart(null); setPickerSelected(null) }} />
          <div className="relative glass-card p-5 w-full max-w-lg space-y-4 animate-[pulseIn_.3s_var(--ease-spring)_both] max-h-[85vh] overflow-y-auto">
            <div>
              <div className="text-sm font-bold text-[var(--text-primary)]">Pick a coupon for <span dir="auto">{pickerCart.customer_name ?? 'Guest'}</span></div>
              <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Cart {Math.round(pickerCart.cart_total).toLocaleString()} SAR · select one, then confirm — nothing applies until you say so.
              </div>
            </div>

            <div className="space-y-2">
              {activeCoupons.map((ac) => {
                const selected = pickerSelected?.id === ac.id
                return (
                  <button key={ac.id} onClick={() => setPickerSelected(ac)}
                    className="w-full text-left rounded-xl border px-4 py-3 transition-all flex items-center gap-3"
                    style={selected
                      ? { borderColor: '#d29a0c', background: 'rgba(240,196,46,.1)', boxShadow: '0 0 0 1px #d29a0c55' }
                      : { borderColor: 'var(--hairline)', background: 'var(--card)' }}>
                    <span className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 font-mono text-xs font-bold"
                      style={{ background: selected ? 'rgba(240,196,46,.18)' : 'var(--track)', color: selected ? '#d29a0c' : 'var(--text-primary)' }}>
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
                    {selected && <Check size={16} style={{ color: '#d29a0c' }} className="shrink-0" />}
                  </button>
                )
              })}
              {activeCoupons.length === 0 && (
                <div className="text-xs text-[var(--text-muted)] py-4 text-center">
                  No active coupons in your store — mint one with the {percent}% button, or create from the Coupons tab.
                </div>
              )}
            </div>

            {/* Confirm step — the ritual */}
            <div className="rounded-xl border border-[var(--hairline)] bg-[var(--card)] px-4 py-3 flex items-center gap-3">
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
      )}
    </div>
  )
}
