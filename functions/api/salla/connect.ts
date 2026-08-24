/**
 * GET /api/salla/connect — redirects the merchant to Salla's authorization page.
 * Requires: SALLA_CLIENT_ID env secret. Without it: honest 501.
 * Staff gate: admin / account_manager / media_buyer only.
 */
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "x-content-type-options": "nosniff" } })
const STAFF = new Set(["super_admin", "account_manager", "media_buyer"])

export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request, env } = context
  if (!env.SALLA_CLIENT_ID) return json({ error: "not_configured", message: "Set SALLA_CLIENT_ID as a Cloudflare Pages secret." }, 501)

  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  let role: string | null = null
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && token) {
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

  const origin = new URL(request.url).origin
  const state = crypto.randomUUID()
  const authUrl = new URL("https://accounts.salla.sa/oauth2/auth")
  authUrl.searchParams.set("client_id", env.SALLA_CLIENT_ID)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("redirect_uri", `${origin}/api/salla/callback`)
  authUrl.searchParams.set("scope", "customers.read orders.read products.read reviews.read carts.read offline_access")
  authUrl.searchParams.set("state", state)

  return Response.redirect(authUrl.toString(), 302)
}
