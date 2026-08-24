/**
 * POST /api/salla/coupons/update — edit an existing Salla coupon:
 *   { id, percentOff?, expiresAt? (ISO), status?: 'active'|'inactive' }
 * Uses Salla's Update Coupon endpoint (marketing.read_write).
 * Staff-gated.
 */
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "x-content-type-options": "nosniff" } })
const STAFF = new Set(["super_admin", "account_manager", "media_buyer"])

export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request, env } = context
  if (request.method !== "POST") return json({ error: "POST only" }, 405)
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: "not_configured" }, 501)

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

  let body: { id?: number | string; percentOff?: number; expiresAt?: string; status?: string } = {}
  try { body = await request.json() } catch { return json({ error: "invalid_json" }, 400) }
  const id = String(body.id ?? "")
  if (!/^\d+$/.test(id)) return json({ error: "invalid_id" }, 400)

  const GET = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
  const tokenRes = await fetch(`${env.SUPABASE_URL}/rest/v1/integration_tokens?platform=eq.salla&select=access_token`, { headers: GET })
  const tokens = (await tokenRes.json()) as Array<{ access_token: string }>
  if (!tokens.length) return json({ error: "no_salla_token" }, 404)

  // Build ONLY the fields being changed
  const patch: Record<string, unknown> = {}
  if (body.percentOff != null) {
    patch.type = "percentage"
    patch.amount = Math.min(90, Math.max(1, Math.round(body.percentOff)))
  }
  if (body.expiresAt) {
    const d = new Date(body.expiresAt)
    if (isNaN(d.getTime())) return json({ error: "invalid_expiresAt" }, 400)
    const pad = (n: number) => String(n).padStart(2, "0")
    patch.expiry_date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`
  }
  if (body.status === "active" || body.status === "inactive") {
    patch.status = body.status
  }
  if (!Object.keys(patch).length) return json({ error: "nothing_to_update" }, 400)

  const res = await fetch(`https://api.salla.dev/admin/v2/coupons/${id}`, {
    method: "PUT",
    headers: { authorization: `Bearer ${tokens[0].access_token}`, "content-type": "application/json" },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    return json({ error: `update_failed_${res.status}`, detail: (await res.text().catch(() => "")).slice(0, 300) }, 502)
  }
  return json({ ok: true, applied: Object.keys(patch) })
}
