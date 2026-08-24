import type { AbandonedCart } from '../types/database'

export interface CouponSuggestion {
  percent: number
  hours: number
  reasons: string[]
  confidence: 'high' | 'medium' | 'low'
}

/**
 * THE KNOWLEDGE BOT — an expert system that reads the cart's vitals and
 * prescribes the minimum discount that will convert. Doctrine:
 *  - Margin is sacred: never discount more than the situation demands.
 *  - Heat beats greed: a 5-minute-old cart needs a nudge, not a bribe.
 *  - Segment overrides value: a Champion gets status, a Dormant gets a jolt.
 */
export function recommendCoupon(
  cart: AbandonedCart,
  intel?: { segment: string; lifetimeValue: number; orderCount: number } | null,
): CouponSuggestion {
  const reasons: string[] = []
  let percent = 10
  let hours = 48
  const value = cart.cart_total ?? 0
  const mins = cart.age_minutes ?? Math.floor((Date.now() - new Date(cart.updated_at).getTime()) / 60000)

  // 1) HEAT — recency decides urgency window
  if (mins <= 60) {
    percent = 5; hours = 24
    reasons.push('cart is HOT (<1h) — a small nudge closes it, deep discounts waste margin')
  } else if (mins <= 60 * 24) {
    percent = 10; hours = 48
    reasons.push('cart is warm (<1 day) — standard gift window')
  } else {
    percent = 15; hours = 72
    reasons.push(`cart is cold (${Math.round(mins / 1440)}d) — needs urgency + a reason to return`)
  }

  // 2) VALUE — margin protection on small baskets, unlock on big ones
  if (value >= 500) {
    percent = Math.max(percent, 15)
    reasons.push(`high-value cart (${Math.round(value).toLocaleString()} SAR) — worth a deeper cut`)
  } else if (value < 100) {
    percent = Math.min(percent, 5)
    reasons.push('small basket — protect margin, keep it light')
  }

  // 3) SEGMENT — relationship overrides everything
  if (intel) {
    if (intel.segment === 'champion' || intel.segment === 'loyal') {
      percent = Math.min(percent, 10)
      reasons.push(`${intel.segment} customer — loyalty is the discount; keep it exclusive, small`)
    } else if (intel.segment === 'at_risk' || intel.segment === 'dormant') {
      percent = Math.max(percent, 20)
      reasons.push(`${intel.segment} customer — inertia is strong, jolt required`)
    } else if (intel.segment === 'new' || intel.segment === 'one_time') {
      percent = Math.max(percent, 10)
      reasons.push('early relationship — remove risk, build the habit')
    }
    if (intel.orderCount >= 5) reasons.push(`${intel.orderCount} lifetime orders — proven buyer, high conversion odds`)
  } else {
    reasons.push('guest cart — no history; let cart value lead')
  }

  // 4) Already has a coupon → escalate or call, never stack
  if (cart.coupon_code) {
    reasons.push(`already holding ${cart.coupon_code} — resend it or escalate, do NOT stack`)
    return { percent: Math.min(percent + 5, 30), hours: Math.min(hours, 48), reasons, confidence: 'medium' }
  }

  const confidence: CouponSuggestion['confidence'] = reasons.length >= 3 ? 'high' : intel ? 'medium' : 'low'
  return { percent, hours, reasons, confidence }
}
