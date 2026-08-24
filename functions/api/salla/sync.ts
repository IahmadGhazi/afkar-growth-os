/**
 * POST /api/salla/sync — pulls customers, orders, products, reviews from
 * the Salla API using stored tokens. Writes to the respective tables.
 * Staff gate: admin / account_manager / media_buyer.
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

  // Helper: coerce unknown Salla value to number or null
  function num(v: unknown): number | null {
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string" && v.trim() !== "" && !isNaN(parseFloat(v))) return parseFloat(v)
    return null
  }

  // Helper: paginated GET from Salla API
  async function sallaGet(path: string, params: Record<string, string> = {}) {
    const url = new URL(`${BASE}${path}`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    const res = await fetch(url.toString(), { headers: sallaH, signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`Salla API ${res.status}: ${(await res.text()).slice(0, 200)}`)
    return res.json()
  }

  // Helper: upsert a row into Supabase and CHECK the response
  async function upsert(table: string, row: Record<string, unknown>) {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?on_conflict=id`, {
      method: "POST", headers: H, body: JSON.stringify(row),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`${table} upsert ${res.status}: ${text.slice(0, 200)}`)
    }
  }

  // ---- SYNC CUSTOMERS ----
  try {
    let page = 1
    let total = 0
    while (page <= 10) {
      const body = await sallaGet("/customers", { page: String(page), per_page: "50" })
      const list = (body?.data ?? []) as any[]
      for (const c of list) {
        await upsert("customers", {
          id: `cust_salla_${c.id}`, client_id: clientId, salla_id: c.id,
          first_name: c.first_name, last_name: c.last_name,
          mobile: c.mobile, mobile_code: c.mobile_code, email: c.email,
          gender: c.gender, city: c.city, country: c.country,
          avatar_url: c.avatar, synced_at: now,
        })
        total++
      }
      const totalPages = body?.pagination?.totalPages ?? 1
      if (page >= totalPages || list.length === 0) break
      page++
    }
    results.customers = `${total} synced`
  } catch (e) { results.customers = `error: ${String((e as Error).message).slice(0, 200)}` }

  // ---- SYNC ORDERS ----
  try {
    // Build a map of Salla customer IDs to our customer row IDs for linking
    const custRes = await fetch(`${env.SUPABASE_URL}/rest/v1/customers?client_id=eq.${clientId}&select=id,salla_id`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    })
    const custList = custRes.ok ? (await custRes.json()) as Array<{ id: string; salla_id: number | null }> : []
    const custMap = new Map<number, string>()
    for (const c of custList) { if (c.salla_id) custMap.set(c.salla_id, c.id) }

    let page = 1
    let total = 0
    while (page <= 10) {
      const body = await sallaGet("/orders", { page: String(page), per_page: "50" })
      const list = (body?.data ?? []) as any[]
      for (const o of list) {
        const totalAmt = typeof o.total === 'number' ? o.total : num(o.amounts?.total?.amount)
        // Resolve the linked customer by their Salla ID
        const sallaCustId = typeof o.customer?.id === "number" ? o.customer.id
          : typeof o.customer_id === "number" ? o.customer_id : null
        await upsert("orders", {
          id: `ord_salla_${o.id}`, client_id: clientId, salla_id: o.id,
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
          date_created: o.date?.date ?? null,
          date_completed: o.completed_at?.date ?? null,
          synced_at: now,
        })
        total++
      }
      const totalPages = body?.pagination?.totalPages ?? 1
      if (page >= totalPages || list.length === 0) break
      page++
    }
    results.orders = `${total} synced`
  } catch (e) { results.orders = `error: ${String((e as Error).message).slice(0, 200)}` }

  // ---- SYNC PRODUCTS ----
  try {
    let page = 1
    let total = 0
    while (page <= 10) {
      const body = await sallaGet("/products", { page: String(page), per_page: "50" })
      const list = (body?.data ?? []) as any[]
      for (const p of list) {
        const statusMap: Record<string, string> = { sale: "active", available: "active", hidden: "hidden", out_of_stock: "out_of_stock" }
        await upsert("store_products", {
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
        total++
      }
      const totalPages = body?.pagination?.totalPages ?? 1
      if (page >= totalPages || list.length === 0) break
      page++
    }
    results.products = `${total} synced`
  } catch (e) { results.products = `error: ${String((e as Error).message).slice(0, 200)}` }

  // ---- SYNC REVIEWS ----
  try {
    const body = await sallaGet("/feedbacks", { per_page: "50", type: "product" })
    const list = (body?.data ?? []) as any[]
    let total = 0
    for (const r of list) {
      await upsert("reviews", {
        id: `rev_salla_${r.id}`, client_id: clientId, salla_id: r.id,
        type: r.type ?? "product", rating: r.rating ?? null,
        content: r.content ?? null,
        customer_name: r.customer?.name ?? null,
        product_name: r.product?.name ?? null,
        is_published: r.is_published ?? true,
        likes_count: r.likes_count ?? 0,
        created_at: r.created_at ?? now,
      })
      total++
    }
    results.reviews = `${total} synced`
  } catch (e) { results.reviews = `error: ${String((e as Error).message).slice(0, 200)}` }

  return json({ ok: true, results })
}
