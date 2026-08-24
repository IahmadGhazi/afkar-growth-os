/**
 * GET  /api/salla/coupons — list coupons from the Salla store (with usage stats).
 * DELETE /api/salla/coupons?id=<salla_coupon_id> — delete a coupon (cleanup).
 * Staff-gated. Scope: marketing.read_write (read for list, write for delete).
 */
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "x-content-type-options": "nosniff" } })
const STAFF = new Set(["super_admin", "account_manager", "media_buyer"])

async function gate(request: Request, env: Record<string, string | undefined>): Promise<string | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return "not_configured"
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  if (!token) return "unauthorized"
  try {
    const me = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${token}` } })
    if (!me.ok) return "unauthorized"
    const meJson = (await me.json()) as { id?: string }
    if (!meJson.id) return "unauthorized"
    const prof = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?auth_user_id=eq.${meJson.id}&select=role`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    })
    const role = prof.ok ? ((await prof.json()) as { role?: string }[])?.[0]?.role ?? null : null
    if (!role || !STAFF.has(role)) return "forbidden"
    return null
  } catch { return "unauthorized" }
}

export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request, env } = context
  const denied = await gate(request, env)
  if (denied === "not_configured") return json({ error: denied }, 501)
  if (denied) return json({ error: denied }, denied === "forbidden" ? 403 : 401)

  const GET = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
  const tokenRes = await fetch(`${env.SUPABASE_URL}/rest/v1/integration_tokens?platform=eq.salla&select=access_token`, { headers: GET })
  const tokens = (await tokenRes.json()) as Array<{ access_token: string }>
  if (!tokens.length) return json({ error: "no_salla_token" }, 404)
  const sallaH = { authorization: `Bearer ${tokens[0].access_token}`, "content-type": "application/json" }

  // ── DELETE
  if (request.method === "DELETE") {
    const id = new URL(request.url).searchParams.get("id")
    if (!id || !/^\d+$/.test(id)) return json({ error: "invalid_id" }, 400)
    const del = await fetch(`https://api.salla.dev/admin/v2/coupons/${id}`, { method: "DELETE", headers: sallaH })
    if (!del.ok && del.status !== 404) {
      return json({ error: `delete_failed_${del.status}`, detail: (await del.text().catch(() => "")).slice(0, 200) }, 502)
    }
    return json({ ok: true })
  }

  // ── LIST (GET)
  if (request.method !== "GET") return json({ error: "GET or DELETE only" }, 405)
  const listRes = await fetch("https://api.salla.dev/admin/v2/coupons?per_page=50", { headers: sallaH })
  if (!listRes.ok) {
    const t = await listRes.text().catch(() => "")
    return json({ error: `list_failed_${listRes.status}`, detail: t.slice(0, 200) }, 502)
  }
  const body = (await listRes.json()) as { data?: any[] }
  const coupons = (body.data ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    type: c.type,
    amount: c.amount?.amount ?? (c.type === "percentage" ? c.marketing_amount?.amount ?? null : null),
    status: c.status,
    isGroup: Boolean(c.is_group),
    expiryDate: c.expiry_date ?? null,
    startDate: c.start_date ?? null,
    freeShipping: Boolean(c.free_shipping),
    usage: {
      times: c.statistics?.num_of_usage ?? null,
      customers: c.statistics?.num_of_customers ?? null,
      sales: c.statistics?.coupon_sales?.amount ?? null,
    },
  }))
  return json({ ok: true, coupons })
}
