/**
 * POST /api/salla/sync - pulls customers, orders, products, reviews,
 * shipments and abandoned carts from the Salla API using stored tokens.
 * Staff gate: admin / account_manager / media_buyer.
 *
 * Subrequest budget: Cloudflare allows ~50 subrequests per invocation and
 * BOTH Salla reads AND Supabase writes count. We budget Salla reads at 42
 * and batch all DB writes into one request per table, so the whole six-type
 * sync fits comfortably inside one invocation.
 */
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "x-content-type-options": "nosniff" } })
const STAFF = new Set(["super_admin", "account_manager", "media_buyer"])
const BASE = "https://api.salla.dev/admin/v2"

export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request, env } = context
  if (request.method !== "POST") return json({ error: "POST only" }, 405)
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: "not_configured" }, 501)

  // Auth gate
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  let role: string | null = null
  if (token) {
    try {
      const me = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${token}` } })
      if (me.ok) {
        const meJson = (await me.json()) as { id?: string }
        if (meJson.id) {
          const prof = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?auth_user_id=eq.${meJson.id}&select=role`, {
            headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
          })
          if (prof.ok) role = ((await prof.json()) as { role?: string }[])?.[0]?.role ?? null
        }
      }
    } catch { role = null }
  }
  if (!role) return json({ error: "unauthorized" }, 401)
  if (!STAFF.has(role)) return json({ error: "forbidden" }, 403)

  // Get the Salla access token
  const tokenRes = await fetch(`${env.SUPABASE_URL}/rest/v1/integration_tokens?platform=eq.salla&select=*`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  })
  const tokens = (await tokenRes.json()) as Array<{ access_token: string; client_id: string }>
  if (!tokens.length) return json({ error: "no_salla_token", message: "Connect Salla first." }, 404)
  const { access_token: sallaToken, client_id: clientId } = tokens[0]

  const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json", prefer: "resolution=merge-duplicates,return=minimal" }
  const sallaH = { authorization: `Bearer ${sallaToken}`, "content-type": "application/json" }
  const now = new Date().toISOString()
  const results: Record<string, string> = {}

  function num(v: unknown): number | null {
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string" && v.trim() !== "" && !isNaN(parseFloat(v))) return parseFloat(v)
    return null
  }

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

  // BATCH upsert: one HTTP request per table (rows chunked at 200).
  async function upsertMany(table: string, rows: Array<Record<string, unknown>>) {
    if (!rows.length) return
    for (let i = 0; i < rows.length; i += 200) {
      const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?on_conflict=id`, {
        method: "POST", headers: H, body: JSON.stringify(rows.slice(i, i + 200)),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(`${table} upsert ${res.status}: ${text.slice(0, 200)}`)
      }
    }
  }

  let sallaCalls = 0
  const SALLA_BUDGET = 42
  async function sallaGet(path: string, params: Record<string, string> = {}) {
    if (++sallaCalls > SALLA_BUDGET) throw new Error("paused: sync budget reached")
    const url = new URL(`${BASE}${path}`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    const res = await fetch(url.toString(), { headers: sallaH, signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`Salla API ${res.status}: ${(await res.text()).slice(0, 200)}`)
    return res.json()
  }

  // ---- CUSTOMERS ----
  try {
    const rows: Array<Record<string, unknown>> = []
    let page = 1
    while (page <= 6) {
      const body = await sallaGet("/customers", { page: String(page), per_page: "50" })
      const list = (body?.data ?? []) as any[]
      for (const c of list) {
        rows.push({
          id: `cust_salla_${c.id}`, client_id: clientId, salla_id: c.id,
          first_name: c.first_name, last_name: c.last_name,
          mobile: c.mobile, mobile_code: c.mobile_code, email: c.email,
          gender: c.gender, city: c.city, country: c.country,
          avatar_url: c.avatar, synced_at: now,
        })
      }
      const totalPages = body?.pagination?.totalPages ?? 1
      if (page >= totalPages || list.length === 0) break
      page++
    }
    await upsertMany("customers", rows)
    results.customers = `${rows.length} synced`
  } catch (e) { results.customers = `error: ${String((e as Error).message).slice(0, 160)}` }

  // ---- ORDERS ----
  try {
    const custRes = await fetch(`${env.SUPABASE_URL}/rest/v1/customers?client_id=eq.${clientId}&select=id,salla_id`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    })
    const custList = custRes.ok ? (await custRes.json()) as Array<{ id: string; salla_id: number | null }> : []
    const custMap = new Map<number, string>()
    for (const c of custList) { if (c.salla_id) custMap.set(c.salla_id, c.id) }

    const rows: Array<Record<string, unknown>> = []
    let page = 1
    while (page <= 12) {
      const body = await sallaGet("/orders", { page: String(page), per_page: "50" })
      const list = (body?.data ?? []) as any[]
      for (const o of list) {
        const totalAmt = typeof o.total === "number" ? o.total : num(o.amounts?.total?.amount)
        const sallaCustId = typeof o.customer?.id === "number" ? o.customer.id
          : typeof o.customer_id === "number" ? o.customer_id : null
        rows.push({
          id: `ord_salla_${o.id}`, client_id: clientId, salla_id: o.id,
          reference: o.reference_id != null ? String(o.reference_id) : null,
          customer_id: sallaCustId ? (custMap.get(sallaCustId) ?? null) : null,
          status: typeof o.status === "string" ? o.status : (o.status?.slug ?? o.status?.name ?? "payment_completed"),
          payment_method: typeof o.payment_method === "string" ? o.payment_method : (o.payment_method?.slug ?? null),
          selling_channel: o.selling_channel ?? null,
          total_amount: num(totalAmt) ?? 0,
          shipping_cost: num(o.amounts?.shipping?.amount) ?? 0,
          tax_amount: num(o.amounts?.tax?.amount) ?? 0,
          currency: o.amounts?.total?.currency ?? "SAR",
          items_count: Array.isArray(o.items) ? o.items.length : 0,
          items: Array.isArray(o.items)
            ? o.items.map((it: any) => ({ name: it.name, quantity: it.quantity, amount: it.amounts?.price?.amount ?? null }))
            : [],
          date_created: sallaIso(o.date),
          date_completed: sallaIso(o.completed_at),
          synced_at: now,
        })
      }
      const totalPages = body?.pagination?.totalPages ?? 1
      if (page >= totalPages || list.length === 0) break
      page++
    }
    try {
      await upsertMany("orders", rows)
    } catch (e) {
      // reference column not added yet? land everything except it
      if (String((e as Error).message).includes("column orders.reference")) {
        await upsertMany("orders", rows.map(({ reference, ...rest }) => rest))
      } else throw e
    }
    results.orders = `${rows.length} synced`
  } catch (e) { results.orders = `error: ${String((e as Error).message).slice(0, 160)}` }

  // ---- PRODUCTS ----
  try {
    const statusMap: Record<string, string> = { sale: "active", available: "active", hidden: "hidden", out_of_stock: "out_of_stock" }
    const rows: Array<Record<string, unknown>> = []
    let page = 1
    while (page <= 6) {
      const body = await sallaGet("/products", { page: String(page), per_page: "50" })
      const list = (body?.data ?? []) as any[]
      for (const p of list) {
        rows.push({
          id: `sp_salla_${p.id}`, client_id: clientId, salla_id: p.id,
          name: p.name, sku: p.sku,
          price: num(p.price?.amount),
          sale_price: num(p.sale_price?.amount),
          status: statusMap[p.status] ?? "active",
          category: p.categories?.[0]?.name ?? null,
          image_url: p.thumbnail ?? null,
          quantity: num(p.quantity) ?? 0,
          synced_at: now,
        })
      }
      const totalPages = body?.pagination?.totalPages ?? 1
      if (page >= totalPages || list.length === 0) break
      page++
    }
    await upsertMany("store_products", rows)
    results.products = `${rows.length} synced`
  } catch (e) { results.products = `error: ${String((e as Error).message).slice(0, 160)}` }

  // ---- REVIEWS ----
  try {
    const rows: Array<Record<string, unknown>> = []
    let page = 1
    while (page <= 4) {
      const body = await sallaGet("/feedbacks", { per_page: "50", type: "product", page: String(page) })
      const list = (body?.data ?? []) as any[]
      for (const r of list) {
        rows.push({
          id: `rev_salla_${r.id}`, client_id: clientId, salla_id: r.id,
          type: r.type ?? "product", rating: num(r.rating),
          content: typeof r.content === "string" ? r.content : null,
          customer_name: r.customer?.name ?? null,
          product_name: r.product?.name ?? null,
          is_published: r.is_published ?? true,
          likes_count: num(r.likes_count) ?? 0,
          created_at: sallaIso(r.created_at) ?? now,
        })
      }
      const totalPages = body?.pagination?.totalPages ?? 1
      if (page >= totalPages || list.length === 0) break
      page++
    }
    await upsertMany("reviews", rows)
    results.reviews = `${rows.length} synced`
  } catch (e) { results.reviews = `error: ${String((e as Error).message).slice(0, 160)}` }

  // ---- SHIPMENTS ----
  try {
    // FK shield: only link orders that actually exist — a shipment for an
    // unknown/deleted order must not block the whole batch.
    const ordRes = await fetch(`${env.SUPABASE_URL}/rest/v1/orders?client_id=eq.${clientId}&select=id`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    })
    const knownOrders = ordRes.ok ? new Set(((await ordRes.json()) as Array<{ id: string }>).map((o) => o.id)) : new Set()

    const rows: Array<Record<string, unknown>> = []
    let page = 1
    while (page <= 6) {
      const body = await sallaGet("/shipments", { page: String(page), per_page: "50" })
      const list = (body?.data ?? []) as any[]
      for (const s of list) {
        const linkedOrder = s.order_id ? `ord_salla_${s.order_id}` : null
        rows.push({
          id: `shp_salla_${s.id}`, client_id: clientId,
          order_id: linkedOrder && knownOrders.has(linkedOrder) ? linkedOrder : null,
          salla_shipment_id: s.id,
          status: typeof s.status === "string" ? s.status : (s.status?.slug ?? "created"),
          shipping_company: s.shipping_company?.name ?? s.courier?.name ?? null,
          tracking_number: s.tracking_number ?? null,
          shipment_date: s.shipment_date?.date ?? null,
          created_at: s.created_at?.date ?? now,
          updated_at: now,
        })
      }
      const totalPages = body?.pagination?.totalPages ?? 1
      if (page >= totalPages || list.length === 0) break
      page++
    }
    try {
      await upsertMany("shipments", rows)
    } catch (e) {
      // Widened status constraint not applied yet? Retry with legacy buckets.
      if (String((e as Error).message).includes("23514")) {
        const LEGACY: Record<string, string> = {
          creating: "creating", created: "created", delivered: "delivered",
        }
        const bucket = (raw: string): string => {
          if (LEGACY[raw]) return LEGACY[raw]
          if (["cancelled", "lost", "damaged", "return_to_origin", "return_in_progress"].includes(raw)) return "cancelled"
          return "updated"
        }
        await upsertMany("shipments", rows.map((r) => ({ ...r, status: bucket(String(r.status)) })))
      } else throw e
    }
    results.shipments = `${rows.length} synced`
  } catch (e) { results.shipments = `error: ${String((e as Error).message).slice(0, 160)}` }

  // ---- ABANDONED CARTS ----
  try {
    // customer FK must resolve or be null — never block a cart on it
    const custRes = await fetch(`${env.SUPABASE_URL}/rest/v1/customers?client_id=eq.${clientId}&select=id,salla_id`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    })
    const custList = custRes.ok ? (await custRes.json()) as Array<{ id: string; salla_id: number | null }> : []
    const cartCustMap = new Map<number, string>()
    for (const c of custList) { if (c.salla_id) cartCustMap.set(c.salla_id, c.id) }

    const rows: Array<Record<string, unknown>> = []
    const baseRows: Array<Record<string, unknown>> = []
    let page = 1
    while (page <= 5) {
      const body = await sallaGet("/carts/abandoned", { page: String(page), per_page: "60" })
      const list = (body?.data ?? []) as any[]
      for (const c of list) {
        const items = Array.isArray(c.items)
          ? c.items.map((it: any) => ({ name: it.name ?? it.product?.name ?? "Item", quantity: num(it.quantity) ?? 1, amount: num(it.amounts?.price?.amount ?? it.price?.amount) }))
          : []
        const cSallaId = typeof c.customer?.id === "number" ? c.customer.id : null
        const base = {
          id: `cart_salla_${c.id}`, client_id: clientId, salla_cart_id: c.id,
          customer_id: cSallaId ? (cartCustMap.get(cSallaId) ?? null) : null,
          status: c.status === "purchased" ? "purchased" : "abandoned",
          cart_total: num(c.total?.amount) ?? 0,
          items,
          created_at: c.created_at?.date ?? now,
          updated_at: c.updated_at?.date ?? now,
        }
        baseRows.push(base)
        rows.push({
          ...base,
          checkout_url: c.checkout_url ?? null,
          customer_name: c.customer?.name ?? null,
          customer_mobile: c.customer?.mobile ? `${c.customer.mobile_code ?? ""}${c.customer.mobile}` : null,
          customer_email: c.customer?.email ?? null,
          coupon_code: c.coupon?.code ?? null,
          age_minutes: num(c.age_in_minutes),
        })
      }
      const totalPages = body?.pagination?.totalPages ?? 1
      if (page >= totalPages || list.length === 0) break
      page++
    }
    try {
      await upsertMany("abandoned_carts", rows)
    } catch (e) {
      if (String((e as Error).message).includes("abandoned_carts.")) {
        await upsertMany("abandoned_carts", baseRows)
      } else throw e
    }
    results.abandonedCarts = `${rows.length} synced`
  } catch (e) { results.abandonedCarts = `error: ${String((e as Error).message).slice(0, 160)}` }

  // ---- CUSTOMER GROUPS (for store-side coupon targeting) ----
  try {
    const gRes = await sallaGet("/customers/groups", { per_page: "50" })
    const groups = ((gRes?.data ?? []) as any[]).map((g) => ({ id: String(g.id), name: String(g.name ?? "Group") }))
    if (groups.length) {
      const clRes = await fetch(`${env.SUPABASE_URL}/rest/v1/clients?id=eq.${clientId}&select=settings`, {
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
      })
      const current = clRes.ok ? ((await clRes.json()) as Array<{ settings?: Record<string, unknown> }>)[0]?.settings ?? {} : {}
      await fetch(`${env.SUPABASE_URL}/rest/v1/clients?id=eq.${clientId}`, {
        method: "PATCH",
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json", prefer: "return=minimal" },
        body: JSON.stringify({ settings: { ...current, salla_groups: groups }, updated_at: now }),
      })
      results.groups = `${groups.length} synced`
    } else {
      results.groups = "0 synced"
    }
  } catch (e) { results.groups = `error: ${String((e as Error).message).slice(0, 120)}` }

  return json({ ok: true, results })
}
