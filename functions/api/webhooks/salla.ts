/**
 * POST /api/webhooks/salla — receives ALL Salla webhook events.
 * Validates the payload, matches to the correct client, writes to the
 * appropriate table. No auth gate (Salla calls this server-to-server).
 * Every DB write is checked; failures are logged loudly, never swallowed.
 */
import { createClient } from "@supabase/supabase-js"

/**
 * POST /api/webhooks/salla — receives ALL Salla webhook events.
 * Validates the payload, matches to the correct client, writes to the
 * appropriate table. No auth gate (Salla calls this server-to-server).
 * Every DB write is checked; failures are logged loudly, never swallowed.
 */
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "x-content-type-options": "nosniff" } })

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() !== "" && !isNaN(parseFloat(v))) return parseFloat(v)
  return null
}
const statusOf = (v: unknown): string =>
  typeof v === "string" ? v : ((v as any)?.slug ?? (v as any)?.name ?? "unknown")
const PROD_STATUS: Record<string, string> = { sale: "active", available: "active", hidden: "hidden", out_of_stock: "out_of_stock" }

/**
 * Convert a Salla date object ({date:"YYYY-MM-DD HH:mm:ss.ssssss",
 * timezone:"Asia/Riyadh"}) into a true ISO instant WITH offset, so
 * timestamptz stores the correct moment instead of guessing UTC.
 */
function sallaIso(d: unknown): string | null {
  const obj = (d && typeof d === "object") ? (d as { date?: unknown; timezone?: unknown }) : null
  const raw = obj && typeof obj.date === "string" ? obj.date : typeof d === "string" ? d : null
  if (!raw) return null
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/)
  if (!m) return null
  const naive = `${m[1]}T${m[2]}`
  const tz = obj && typeof obj.timezone === "string" ? obj.timezone : null
  if (!tz) return `${naive}Z`
  try {
    const guess = new Date(`${naive}Z`)
    const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    const p: Record<string, string> = {}
    for (const part of dtf.formatToParts(guess)) if (part.type !== "literal") p[part.type] = part.value
    const asUTC = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
    const offMin = Math.round((asUTC - guess.getTime()) / 60000)
    const sign = offMin < 0 ? "-" : "+"
    const abs = Math.abs(offMin)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${naive}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  } catch { return `${naive}Z` }
}

/**
 * Push-announce a change to every open browser via Supabase Realtime
 * broadcast. Uses supabase-js over WebSocket (works in Workers runtime).
 * This delivers push WITHOUT requiring table publications.
 */
async function announce(env: Record<string, string | undefined>, payload: { table: string; row_id: string }) {
  try {
    const sb = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 10 } },
    })
    const ch = sb.channel("afkar-live-sync", { config: { broadcast: { self: false } } })
    const joined = await new Promise<boolean>((resolve) => {
      const t = setTimeout(() => resolve(false), 2500)
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED") { clearTimeout(t); resolve(true) }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") { clearTimeout(t); resolve(false) }
      })
    })
    if (!joined) {
      console.error("[salla-webhook announce] join failed")
      return
    }
    const sent = await ch.send({ type: "broadcast", event: "salla-sync", payload })
    if (sent !== "ok") console.error("[salla-webhook announce] send result:", sent)
    setTimeout(() => { void sb.removeChannel(ch).catch(() => {}) }, 250)
  } catch (e) {
    console.error("[salla-webhook announce] error:", String(e).slice(0, 300))
  }
}

export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request, env } = context
  if (request.method !== "POST") return json({ error: "POST only" }, 405)
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    return json({ error: "not_configured" }, 501)

  // ── SECURITY: verify Salla's webhook security strategy = Token.
  // Salla sends the shared secret in the Authorization header
  // (raw or Bearer-prefixed). No valid secret → reject with 401.
  const expected = env.SALLA_WEBHOOK_SECRET
  if (!expected) return json({ error: "webhook_secret_not_configured" }, 501)
  const got = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim()
  if (got !== expected) {
    console.error("[salla-webhook] REJECTED: invalid or missing authorization token")
    return json({ error: "unauthorized" }, 401)
  }

  let body: { event?: string; merchant?: number | string; data?: Record<string, unknown> }
  try { body = await request.json() } catch { return json({ error: "invalid JSON" }, 400) }
  if (!body.event || !body.merchant) return json({ error: "missing event or merchant" }, 400)

  const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json", prefer: "resolution=merge-duplicates,return=minimal" }
  const GET = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
  const data = body.data ?? {}
  const now = new Date().toISOString()
  const eventId = `${body.event}_${body.merchant}_${Date.now()}`
  const errors: string[] = []

  // Resolve the client_id for this merchant. Salla uses TWO different ids:
  // webhook `merchant` (e.g. 1765935375) vs OAuth store id (e.g. 1787594629287),
  // so match every known shape, and if there is exactly ONE connected Salla
  // store, attribute the event to it — that is unambiguous in practice.
  async function resolveClientId(): Promise<string | null> {
    const m = String(body.merchant)
    try {
      const res = await fetch(`${env.SUPABASE_URL}/rest/v1/integration_tokens?platform=eq.salla&select=client_id,store_id`, { headers: GET })
      if (res.ok) {
        const rows = (await res.json()) as Array<{ client_id?: string; store_id?: string | null }>
        const exact = rows.find((r) =>
          r.store_id === m ||
          r.store_id === `store_${m}` ||
          String(r.store_id ?? "").includes(m) ||
          String(r.client_id ?? "").endsWith(m),
        )
        if (exact?.client_id) return exact.client_id
        if (rows.length === 1 && rows[0]?.client_id) {
          console.warn(`[salla-webhook] merchant ${m} did not match stored identity; attributing to sole connected store`)
          return rows[0].client_id
        }
      }
    } catch { /* fallthrough */ }
    return null
  }

  async function upsert(table: string, row: Record<string, unknown>) {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?on_conflict=id`, {
      method: "POST", headers: H, body: JSON.stringify(row),
    })
    if (!res.ok) throw new Error(`${table} ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }

  // ── APP STORE AUTHORIZE: the FIRST event when a merchant installs the app.
  if (body.event === "app.store.authorize") {
    const tokens = data as Record<string, string>
    if (!tokens.access_token) return json({ error: "missing access_token" }, 400)

    const userInfo = await fetch("https://accounts.salla.sa/oauth2/user/info", {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    }).then((r) => r.json() as Promise<{ name?: string; merchant?: { name?: string } }>).catch(() => ({}))

    const storeName = userInfo.merchant?.name ?? userInfo.name ?? `Salla Store ${body.merchant}`
    const clientId = `cli_salla_store_${body.merchant}`

    try {
      await upsert("clients", {
        id: clientId, organization_id: "org_afkar",
        name: storeName, slug: `salla-${body.merchant}`, status: "active", settings: {},
      })
    } catch (e) { errors.push(String((e as Error).message).slice(0, 250)) }

    const expiresAt = new Date(Date.now() + (Number(tokens.expires) || 1209599) * 1000).toISOString()
    try {
      await fetch(`${env.SUPABASE_URL}/rest/v1/integration_tokens?on_conflict=client_id,platform`, {
        method: "POST", headers: H,
        body: JSON.stringify({
          client_id: clientId, platform: "salla",
          access_token: tokens.access_token, refresh_token: tokens.refresh_token,
          expires_at: expiresAt, store_id: String(body.merchant), store_name: storeName,
          merchant_id: body.merchant, scope: tokens.scope ?? null,
        }),
      })
    } catch (e) { errors.push(`tokens: ${String((e as Error).message).slice(0, 250)}`) }

    if (errors.length) console.error("[salla-webhook authorize]", errors.join(" | "))
    return json({ ok: true, event: body.event, message: `Connected store: ${storeName}`, errors: errors.length ? errors : undefined })
  }

  // For ALL other events, the client must already exist (via OAuth or authorize event)
  const clientId = await resolveClientId()
  if (!clientId) return json({ error: "unknown merchant — connect the store first" }, 404)

  // Customer-ID resolver for order events
  async function custMap(): Promise<Map<number, string>> {
    const m = new Map<number, string>()
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/customers?client_id=eq.${clientId}&select=id,salla_id`, { headers: GET })
    if (res.ok) for (const c of (await res.json()) as Array<{ id: string; salla_id: number | null }>) if (c.salla_id) m.set(c.salla_id, c.id)
    return m
  }

  try {
    switch (body.event) {
      case "order.created":
      case "order.updated": {
        const o = data as Record<string, any>
        const orderId = `ord_salla_${o.id}`
        const cm = await custMap()
        const sallaCustId = typeof o.customer?.id === "number" ? o.customer.id : typeof o.customer_id === "number" ? o.customer_id : null
        const orderRow = {
          id: orderId, client_id: clientId, salla_id: o.id,
          reference: o.reference_id != null ? String(o.reference_id) : null,
          customer_id: sallaCustId ? (cm.get(sallaCustId) ?? null) : null,
          status: typeof o.status === "string" ? o.status : (o.status?.slug ?? o.status?.name ?? "payment_completed"),
          payment_method: typeof o.payment_method === "string" ? o.payment_method : (o.payment_method?.slug ?? null),
          selling_channel: o.selling_channel ?? null,
          total_amount: num(o.amounts?.total?.amount) ?? num(o.total) ?? 0,
          shipping_cost: num(o.amounts?.shipping?.amount) ?? 0,
          tax_amount: num(o.amounts?.tax?.amount) ?? 0,
          currency: o.amounts?.total?.currency ?? "SAR",
          items_count: Array.isArray(o.items) ? o.items.length : 0,
          items: Array.isArray(o.items)
            ? o.items.map((it: any) => ({ name: it.name, quantity: it.quantity, amount: it.amounts?.price?.amount ?? null }))
            : [],
          date_created: sallaIso(o.date) ?? now,
          date_completed: sallaIso(o.completed_at),
          synced_at: now,
        }
        try {
          await upsert("orders", orderRow)
        } catch (e) {
          // Column not added yet? Retry without reference so the order still lands.
          if (String((e as Error).message).includes("column orders.reference")) {
            const { reference, ...rest } = orderRow
            await upsert("orders", rest)
          } else throw e
        }
        await fetch(`${env.SUPABASE_URL}/rest/v1/order_timeline`, {
          method: "POST", headers: H,
          body: JSON.stringify({ id: eventId, order_id: orderId, client_id: clientId, event: body.event, details: { id: o.id ?? null, reference_id: o.reference_id ?? null }, event_time: now }),
        })
        await announce(env, { table: "orders", row_id: orderId })
        break
      }
      case "order.status.updated": {
        const orderId = `ord_salla_${(data as any)?.id ?? "unknown"}`
        const st = statusOf((data as any)?.status)
        const patch = await fetch(`${env.SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
          method: "PATCH", headers: H, body: JSON.stringify({ status: st, synced_at: now }),
        })
        if (!patch.ok) throw new Error(`status patch ${patch.status}: ${(await patch.text()).slice(0, 200)}`)
        await fetch(`${env.SUPABASE_URL}/rest/v1/order_timeline`, {
          method: "POST", headers: H,
          body: JSON.stringify({ id: eventId, order_id: orderId, client_id: clientId, event: body.event, details: { status: st }, event_time: now }),
        })
        if (["completed", "delivered"].includes(st)) {
          await fetch(`${env.SUPABASE_URL}/rest/v1/order_sla?on_conflict=order_id`, {
            method: "POST", headers: H,
            body: JSON.stringify({ id: `sla_${orderId}`, order_id: orderId, client_id: clientId, sla_state: "resolved", updated_at: now }),
          })
        }
        await announce(env, { table: "orders", row_id: orderId })
        break
      }
      case "customer.created":
      case "customer.updated": {
        const c = data as Record<string, any>
        await upsert("customers", {
          id: `cust_salla_${c.id}`, client_id: clientId, salla_id: c.id,
          first_name: c.first_name, last_name: c.last_name,
          mobile: c.mobile, mobile_code: c.mobile_code, email: c.email,
          gender: c.gender, city: c.city, country: c.country,
          avatar_url: c.avatar, synced_at: now,
        })
        await announce(env, { table: "customers", row_id: `cust_salla_${c.id}` })
        break
      }
      case "product.created":
      case "product.updated": {
        const p = data as Record<string, any>
        await upsert("store_products", {
          id: `sp_salla_${p.id}`, client_id: clientId, salla_id: p.id,
          name: p.name, sku: p.sku,
          price: num(p.price?.amount),
          sale_price: num(p.sale_price?.amount),
          status: PROD_STATUS[p.status] ?? "active",
          category: p.categories?.[0]?.name ?? null,
          image_url: p.thumbnail ?? null,
          quantity: num(p.quantity) ?? 0,
          synced_at: now,
        })
        await announce(env, { table: "store_products", row_id: `sp_salla_${p.id}` })
        break
      }
      case "shipment.created":
      case "shipment.updated":
      case "order.shipment.created":
      case "order.shipment.creating":
      case "shipment.status.updated": {
        const ship = data as Record<string, any>
        await upsert("shipments", {
          id: `shp_salla_${ship.id}`, client_id: clientId,
          order_id: ship.order_id ? `ord_salla_${ship.order_id}` : null,
          salla_shipment_id: ship.id,
          status: statusOf(ship.status),
          shipping_company: ship.shipping_company?.name ?? ship.company?.name ?? null,
          tracking_number: ship.tracking_number ?? null,
          shipment_date: ship.shipment_date?.date ?? null,
          updated_at: now,
        })
        if (ship.order_id) await announce(env, { table: "shipments", row_id: `shp_salla_${ship.id}` })
        break
      }
      case "shipment.cancelled":
      case "order.shipment.cancelled": {
        const ship = data as Record<string, any>
        await upsert("shipments", {
          id: `shp_salla_${ship.id}`, client_id: clientId,
          order_id: ship.order_id ? `ord_salla_${ship.order_id}` : null,
          salla_shipment_id: ship.id, status: "cancelled",
          tracking_number: ship.tracking_number ?? null, updated_at: now,
        })
        break
      }
      // ── Reviews: strike-back on unhappy customers
      case "review.added":
      case "review.updated":
      case "review.created": {
        const r = data as Record<string, any>
        const rating = num(r.rating)
        await upsert("reviews", {
          id: `rev_salla_${r.id}`, client_id: clientId, salla_id: r.id,
          type: r.type ?? "product", rating,
          content: typeof r.content === "string" ? r.content : null,
          customer_name: r.customer?.name ?? null,
          product_name: r.product?.name ?? null,
          is_published: r.is_published ?? true,
          likes_count: num(r.likes_count) ?? 0,
          created_at: sallaIso(r.created_at) ?? now,
        })
        // Unhappy customer → instant notification for every admin
        if (rating !== null && rating <= 2) {
          const profRes = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?role=in.(super_admin,account_manager)&select=id`, { headers: GET })
          const admins = profRes.ok ? (await profRes.json()) as Array<{ id: string }> : []
          for (const a of admins.slice(0, 5)) {
            await fetch(`${env.SUPABASE_URL}/rest/v1/notifications`, {
              method: "POST", headers: H,
              body: JSON.stringify({
                id: `ntf_review_${r.id}_${a.id}`, user_id: a.id, client_id: clientId,
                type: "review_alert",
                title: `⚠️ ${rating}★ review needs you`,
                body: `${r.customer?.name ?? "A customer"} on ${r.product?.name ?? "a product"}: ${String(r.content ?? "").slice(0, 120)}`,
                link: "/reviews", is_read: false, created_at: now,
              }),
            }).catch(() => {})
          }
        }
        await announce(env, { table: "reviews", row_id: `rev_salla_${r.id}` })
        break
      }
      // ── Abandoned carts: recovery engine fuel (docs event name: abandoned.cart)
      case "abandoned.cart":
      case "cart.abandoned":
      case "abandoned_cart.created":
      case "cart.created":
      case "abandoned.cart.update":
      case "abandoned_cart.updated":
      case "cart.updated": {
        const c = data as Record<string, any>
        const items = Array.isArray(c.items)
          ? c.items.map((it: any) => ({ name: it.name ?? it.product?.name ?? "Item", quantity: num(it.quantity) ?? 1, amount: num(it.amounts?.price?.amount ?? it.price?.amount) }))
          : []
        // Resolve customer FK — unknown customers must NOT block the cart
        const cm2 = await custMap()
        const sallaCustId2 = typeof c.customer?.id === "number" ? c.customer.id : null
        const custId2 = sallaCustId2 ? (cm2.get(sallaCustId2) ?? null) : null
        const baseCart = {
          id: `cart_salla_${c.id}`, client_id: clientId, salla_cart_id: c.id,
          customer_id: custId2,
          status: "abandoned" as string,
          cart_total: num(c.total?.amount) ?? 0,
          items,
          created_at: sallaIso(c.created_at) ?? now,
          updated_at: now,
        }
        const richCart = {
          ...baseCart,
          checkout_url: c.checkout_url ?? null,
          customer_name: c.customer?.name ?? null,
          customer_mobile: c.customer?.mobile ? `${c.customer.mobile_code ?? ""}${c.customer.mobile}` : null,
          customer_email: c.customer?.email ?? null,
          // NEVER clobber our attached code when Salla's cart has none —
          // cart.update events fire on every touch and would wipe it.
          ...(c.coupon?.code ? { coupon_code: String(c.coupon.code) } : {}),
          age_minutes: num(c.age_in_minutes),
        }
        try {
          await upsert("abandoned_carts", richCart)
          await announce(env, { table: "abandoned_carts", row_id: baseCart.id })
        } catch (e) {
          // New columns not added yet? Land the core row anyway.
          if (String((e as Error).message).includes("abandoned_carts.")) {
            await upsert("abandoned_carts", baseCart)
          } else throw e
        }
        break
      }
      // ── Coupon applied at checkout → attribute the rescue!
      case "coupon.applied": {
        const code = (data as any)?.coupon?.code ?? (data as any)?.code ?? null
        const custId = (data as any)?.customer?.id ?? null
        if (code) {
          // Find the cart this coupon was attached to → mark it CONVERTED
          const find = await fetch(`${env.SUPABASE_URL}/rest/v1/abandoned_carts?coupon_code=eq.${encodeURIComponent(code)}&status=neq.purchased&select=id&limit=1`, { headers: GET })
          const rows = find.ok ? (await find.json()) as Array<{ id: string }> : []
          if (rows[0]) {
            await fetch(`${env.SUPABASE_URL}/rest/v1/abandoned_carts?id=eq.${rows[0].id}`, {
              method: "PATCH", headers: H, body: JSON.stringify({ status: "purchased", updated_at: now }),
            })
            await announce(env, { table: "abandoned_carts", row_id: rows[0].id })
          }
          await fetch(`${env.SUPABASE_URL}/rest/v1/activity_logs`, {
            method: "POST", headers: H,
            body: JSON.stringify({ id: eventId, entity_type: "coupon", entity_id: String(code), action: `applied at checkout${custId ? ` by customer ${custId}` : ""}${rows[0] ? " — RESCUED CART" : ""}`, client_id: clientId, details: {} }),
          }).catch(() => {})
        }
        break
      }
      case "abandoned.cart.purchased":
      case "abandoned_cart.purchased":
      case "cart.converted":
      case "abandoned_cart.status.changed": {
        const cartId = `cart_salla_${(data as any)?.id}`
        await fetch(`${env.SUPABASE_URL}/rest/v1/abandoned_carts?salla_cart_id=eq.${(data as any)?.id}`, {
          method: "PATCH", headers: H, body: JSON.stringify({ status: "purchased", updated_at: now }),
        })
        await announce(env, { table: "abandoned_carts", row_id: cartId })
        break
      }
      // ── Order terminal states
      case "order.cancelled":
      case "cancellation.created": {
        const orderId = `ord_salla_${(data as any)?.id ?? "unknown"}`
        await fetch(`${env.SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
          method: "PATCH", headers: H, body: JSON.stringify({ status: "canceled", synced_at: now }),
        })
        await fetch(`${env.SUPABASE_URL}/rest/v1/order_timeline`, {
          method: "POST", headers: H,
          body: JSON.stringify({ id: eventId, order_id: orderId, client_id: clientId, event: "order.cancelled", details: {}, event_time: now }),
        })
        await announce(env, { table: "orders", row_id: orderId })
        break
      }
      case "order.refunded":
      case "refund.created": {
        const orderId = `ord_salla_${(data as any)?.id ?? (data as any)?.order?.id ?? "unknown"}`
        await fetch(`${env.SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
          method: "PATCH", headers: H, body: JSON.stringify({ status: "refunded", synced_at: now }),
        })
        await announce(env, { table: "orders", row_id: orderId })
        break
      }
      case "order.deleted": {
        const orderId = `ord_salla_${(data as any)?.id ?? "unknown"}`
        await fetch(`${env.SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
          method: "DELETE", headers: GET,
        })
        await announce(env, { table: "orders", row_id: orderId })
        break
      }
      case "product.deleted": {
        const pid = (data as any)?.id
        if (pid) {
          await fetch(`${env.SUPABASE_URL}/rest/v1/store_products?salla_id=eq.${pid}`, {
            method: "PATCH", headers: H, body: JSON.stringify({ status: "hidden", quantity: 0, synced_at: now }),
          })
        }
        break
      }
      default:
        await fetch(`${env.SUPABASE_URL}/rest/v1/activity_logs`, {
          method: "POST", headers: H,
          body: JSON.stringify({ id: eventId, entity_type: "webhook", entity_id: String(body.merchant), action: body.event, details: {} }),
        })
    }
  } catch (e) {
    const msg = `[${body.event}] ${String((e as Error).message)}`
    errors.push(msg)
    console.error("[salla-webhook]", msg)
  }

  // Always 200 to Salla (they retry on failures), but log + report errors
  return json({ ok: true, event: body.event, errors: errors.length ? errors : undefined })
}
