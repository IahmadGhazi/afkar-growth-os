/**
 * POST /api/integrations/sync — trigger the ads puller Worker now.
 * Ghazi pattern: server-to-server relay; puller token never in the browser.
 * Env: ADS_PULLER_URL, ADS_PULLER_TOKEN. Without them: honest 501.
 */
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "x-content-type-options": "nosniff" } })
const STAFF = new Set(["super_admin", "account_manager", "media_buyer"])

export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request, env } = context
  if (request.method !== "POST") return json({ error: "POST only" }, 405)

  const url = env.SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  let role: string | null = null
  if (url && serviceKey && token) {
    try {
      const me = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, authorization: `Bearer ${token}` } })
      if (me.ok) {
        const meJson = (await me.json()) as { id?: string }
        if (meJson.id) {
          const prof = await fetch(`${url}/rest/v1/profiles?auth_user_id=eq.${meJson.id}&select=role`, {
            headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
          })
          if (prof.ok) role = ((await prof.json()) as { role?: string }[])?.[0]?.role ?? null
        }
      }
    } catch { role = null }
  }
  if (!role) return json({ error: "unauthorized" }, 401)
  if (!STAFF.has(role)) return json({ error: "forbidden" }, 403)

  if (!env.ADS_PULLER_URL || !env.ADS_PULLER_TOKEN)
    return json({ error: "sync_not_configured" }, 501)

  try {
    const res = await fetch(env.ADS_PULLER_URL, {
      method: "POST",
      headers: { "x-puller-token": env.ADS_PULLER_TOKEN },
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return json({ error: `puller refused (${res.status})`, detail: text.slice(0, 200) }, 502)
    }
    return json(await res.json())
  } catch (e) {
    return json({ error: "could not reach the puller", detail: String((e as Error).message) }, 502)
  }
}
