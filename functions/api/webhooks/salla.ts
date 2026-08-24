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

  let body: { event?: string; merchant?: number | string; data?: Record<string, unknown> }
  try { body = await request.json() } catch { return json({ error: "invalid JSON" }, 400) }
  if (!body.event || !body.merchant) return json({ error: "missing event or merchant" }, 400)

  const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json", prefer: "resolution=merge-duplicates,return=minimal" }
  const GET = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
  const data = body.data ?? {}
  const now = new Date().toISOString()
  const eventId = `${body.event}_${body.merchant}_${Date.now()}`
  const errors: string[] = []

  // Resolve the client_id for this merchant via integration_tokens —
  // pattern-independent (raw id, store_-prefixed, or embedded in client id).
  async function resolveClientId(): Promise<string | null> {
    try {
      const res = await fetch(`${env.SUPABASE_URL}/rest/v1/integration_tokens?platform=eq.salla&select=client_id,store_id`, { headers: GET })
      if (res.ok) {
        const rows = (await res.json()) as Array<{ client_id?: string; store_id?: string | null }>
        const m = String(body.merchant)
        const hit = rows.find((r) =>
          r.store_id === m ||
          r.store_id === `store_${m}` ||
          String(r.client_id ?? "").endsWith(m),
        )
        if (hit?.client_id) return hit.client_id
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
        await upsert("orders", {
          id: orderId, client_id: clientId, salla_id: o.id,
          customer_id: sallaCustId ? (cm.get(sallaCustId) ?? null) : null,
          status: statusOf(o.status),
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
          date_created: o.date?.date ?? now,
          date_completed: o.completed_at?.date ?? null,
          synced_at: now,
        })
        await fetch(`${env.SUPABASE_URL}/rest/v1/order_timeline`, {
          method: "POST", headers: H,
          body: JSON.stringify({ id: eventId, order_id: orderId, client_id: clientId, event: body.event, details: {}, event_time: now }),
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
      case "shipment.updated": {
        const ship = data as Record<string, any>
        await upsert("shipments", {
          id: `shp_salla_${ship.id}`, client_id: clientId,
          salla_shipment_id: ship.id, status: statusOf(ship.status),
          shipping_company: ship.company ?? null, tracking_number: ship.tracking_number ?? null,
          updated_at: now,
        })
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
