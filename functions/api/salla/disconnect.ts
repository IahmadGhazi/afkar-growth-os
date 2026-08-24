/**
 * POST /api/salla/disconnect — revokes AFKAR's access to the store by
 * deleting every Salla integration_tokens row. Staff-gated.
 * The client row + collected data are KEPT (history stays); only live
 * API access and webhooks attribution stop working until re-connect.
 */
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "x-content-type-options": "nosniff" } })
const STAFF = new Set(["super_admin", "account_manager", "media_buyer"])

export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request, env } = context
  if (request.method !== "POST") return json({ error: "POST only" }, 405)
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: "not_configured" }, 501)

  // ── Auth gate
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

  const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
  const del = await fetch(`${env.SUPABASE_URL}/rest/v1/integration_tokens?platform=eq.salla`, { method: "DELETE", headers: H })
  if (!del.ok) {
    return json({ error: `delete_failed_${del.status}` }, 502)
  }

  // Audit trail
  await fetch(`${env.SUPABASE_URL}/rest/v1/activity_logs`, {
    method: "POST",
    headers: { ...H, "content-type": "application/json", prefer: "return=minimal" },
    body: JSON.stringify({
      id: `disconnect_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      entity_type: "integration", entity_id: "salla",
      action: "disconnected — all salla tokens revoked", details: {},
    }),
  }).catch(() => {})

  return json({ ok: true, message: "Salla disconnected. Re-connect anytime." })
}
