/**
 * POST /api/salla/coupons/create — mints a REAL discount coupon in the
 * merchant's Salla store via the marketing API (scope: marketing.read_write).
 *
 * Body: { cartId?: string, percentOff?: number, validHours?: number }
 *  - cartId: also stamps the generated code onto that abandoned cart so the
 *    recovery message picks it up automatically.
 *
 * Staff gate: super_admin / account_manager / media_buyer.
 */
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "x-content-type-options": "nosniff" } })
const STAFF = new Set(["super_admin", "account_manager", "media_buyer"])

function makeCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789" // no lookalikes (I,L,O,0,1)
  let out = ""
  const bytes = crypto.getRandomValues(new Uint8Array(5))
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return `AF${out}`
}

export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request, env } = context
  if (request.method !== "POST") return json({ error: "POST only" }, 405)
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: "not_configured" }, 501)

  // ── Auth gate (same posture as sync)
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

  let body: {
    cartId?: string; percentOff?: number; validHours?: number;
    name?: string; usageLimit?: number; minimumAmount?: number;
    batchSize?: number; groupName?: string; customerGroupIds?: number[];
  } = {}
  try { body = await request.json() } catch { /* defaults below */ }

  const percentOff = Math.min(90, Math.max(1, Math.round(body.percentOff ?? 15)))
  const validHours = Math.min(2160, Math.max(1, Math.round(body.validHours ?? 48)))
  const batchSize = body.batchSize ? Math.min(200, Math.max(1, Math.round(body.batchSize))) : 0

  // ── Get the store token + client
  const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json", prefer: "resolution=merge-duplicates,return=minimal" }
  const GET = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
  const tokenRes = await fetch(`${env.SUPABASE_URL}/rest/v1/integration_tokens?platform=eq.salla&select=access_token,client_id`, { headers: GET })
  const tokens = (await tokenRes.json()) as Array<{ access_token: string; client_id: string }>
  if (!tokens.length) return json({ error: "no_salla_token" }, 404)
  const { access_token: sallaToken, client_id: clientId } = tokens[0]

  // ── Mint the coupon in Salla (single, or GROUP batch for bulk campaigns)
  const code = makeCode()
  const expiry = new Date(Date.now() + validHours * 3600_000)
  const pad = (n: number) => String(n).padStart(2, "0")
  const expiryStr = `${expiry.getFullYear()}-${pad(expiry.getMonth() + 1)}-${pad(expiry.getDate())} ${pad(expiry.getHours())}:${pad(expiry.getMinutes())}:00`

  const payload: Record<string, unknown> = {
    code,
    type: "percentage",
    amount: percentOff,
    free_shipping: false,
    expiry_date: expiryStr,
    exclude_sale_products: false,
    status: "active",
  }
  if (body.name) payload.marketing_name = body.name.slice(0, 120)
  if (body.usageLimit && body.usageLimit > 0) payload.usage_limit = Math.round(body.usageLimit)
  if (body.minimumAmount && body.minimumAmount > 0) payload.minimum_amount = Math.round(body.minimumAmount)
  if (Array.isArray(body.customerGroupIds) && body.customerGroupIds.length) {
    payload.include_customer_group_ids = body.customerGroupIds.slice(0, 20).map((g) => String(g))
  }
  if (batchSize > 1) {
    // GROUP coupon: one parent, N unique child codes — the leak-proof way
    // to arm many carts (each cart gets its own traceable code).
    payload.is_group = true
    payload.group_coupons_count = batchSize
    payload.group_suffix = "AF"
    payload.group_name = (body.groupName ?? `Batch ${percentOff}%`).slice(0, 60)
  }

  const createRes = await fetch("https://api.salla.dev/admin/v2/coupons", {
    method: "POST",
    headers: { authorization: `Bearer ${sallaToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => null)

  if (!createRes || !createRes.ok) {
    const errText = createRes ? await createRes.text().catch(() => "") : "fetch failed"
    return json({ error: "salla_coupon_create_failed", detail: errText.slice(0, 300) }, 502)
  }
  const created = (await createRes.json()) as { data?: { id?: number; code?: string; group_coupons?: string[] | null } }
  const childCodes = Array.isArray(created.data?.group_coupons) ? created.data!.group_coupons! : null

  // ── Stamp the code onto the abandoned cart (if one was targeted)
  let cartUpdated = false
  if (body.cartId && /^[a-z0-9_]+$/i.test(body.cartId)) {
    const patch = await fetch(`${env.SUPABASE_URL}/rest/v1/abandoned_carts?id=eq.${encodeURIComponent(body.cartId)}&client_id=eq.${clientId}`, {
      method: "PATCH", headers: H, body: JSON.stringify({ coupon_code: code }),
    })
    cartUpdated = patch.ok
  }

  // ── Leave an audit trail
  await fetch(`${env.SUPABASE_URL}/rest/v1/activity_logs`, {
    method: "POST", headers: H,
    body: JSON.stringify({
      id: `coupon_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      entity_type: "coupon", entity_id: String(created.data?.id ?? code),
      action: `created ${percentOff}% coupon ${code} (${validHours}h)`,
      client_id: clientId, details: {},
    }),
  }).catch(() => {})

  return json({
    ok: true,
    code,
    codes: childCodes,
    sallaCouponId: created.data?.id ?? null,
    percentOff,
    expiresAt: expiry.toISOString(),
    cartUpdated,
  })
}
