import { useMemo, useState } from 'react'
import { Search, ShoppingCart, Copy, Check, ExternalLink, MessageCircle, Phone, Flame, Clock, Snowflake, Trophy, RefreshCw, TicketPercent } from 'lucide-react'
import { useApp } from '../../lib/store'
import { scopeSalla } from '../../lib/selectors'
import { EmptyState } from '../../components/shared/ui'
import { LiveBadge } from '../../components/shared/LiveBadge'
import { toast } from '../../lib/toast'
import { supabase } from '../../lib/supabase'
import { refreshFromServer } from '../../lib/store'
import type { AbandonedCart } from '../../types/database'

type Temp = 'hot' | 'warm' | 'cold'

function tempOf(cart: AbandonedCart): Temp {
  const mins = cart.age_minutes ?? Math.floor((Date.now() - new Date(cart.updated_at).getTime()) / 60000)
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

async function mintCoupon(cart: AbandonedCart, sbToken: string): Promise<{ ok: boolean; code?: string; error?: string }> {
  try {
    const res = await fetch('/api/salla/coupons/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sbToken}` },
      body: JSON.stringify({ cartId: cart.id, percentOff: 15, validHours: 48 }),
    })
    const body = await res.json().catch(() => ({}) as Record<string, unknown>)
    if (!res.ok || !body.ok) {
      const raw = String(body.detail ?? body.error ?? `HTTP ${res.status}`)
      if (raw.includes("marketing.read_write")) {
        return { ok: false, error: "Store token predates the marketing scope — reconnect Salla once (Data & Sources) and retry" }
      }
      return { ok: false, error: raw.slice(0, 140) }
    }
    return { ok: true, code: String((body as { code?: string }).code ?? '') }
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
  const codeFor = (c: AbandonedCart): string | null => c.coupon_code ?? freshCodes.get(c.id) ?? null

  const onMint = async (cart: AbandonedCart) => {
    if (!supabase) { toast.error('Backend not configured'); return }
    setMinting((prev) => new Set(prev).add(cart.id))
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) { toast.error('Sign in required'); return }
      const result = await mintCoupon(cart, token)
      if (result.ok && result.code) {
        setFreshCodes((prev) => new Map(prev).set(cart.id, result.code!))
        toast.success(`Coupon ${result.code} is live in your store — 15% for 48h`)
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
                  </div>

                  <div className="flex items-center gap-2 ml-auto shrink-0">
                    <span className="text-base font-bold text-[var(--text-primary)] tabular-nums mr-1">
                      {Math.round(cart.cart_total).toLocaleString()} <span className="text-xs font-medium opacity-60">SAR</span>
                    </span>
                    {!codeFor(cart) && (
                      <button onClick={() => onMint(cart)} disabled={minting.has(cart.id)}
                        title="Mint a 15% / 48h coupon in your Salla store and attach it"
                        className="btn !px-3 !py-1.5 text-xs inline-flex items-center gap-1.5" style={{ background: 'rgba(240,196,46,.12)', color: '#d29a0c', border: '1px solid rgba(210,154,12,.3)' }}>
                        <TicketPercent size={13} /> {minting.has(cart.id) ? 'Minting…' : 'Coupon'}
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
    </div>
  )
}
