/**
 * GET /api/salla/callback — Salla redirects here after merchant authorization.
 * Exchanges the code for tokens, stores them, redirects back to /data.
 * Requires: SALLA_CLIENT_ID, SALLA_CLIENT_SECRET env secrets.
 */
export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request, env } = context
  const origin = new URL(request.url).origin
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const error = url.searchParams.get("error")

  if (error || !code) {
    return Response.redirect(`${origin}/data?salla=error&reason=${encodeURIComponent(error ?? "no_code")}`, 302)
  }

  if (!env.SALLA_CLIENT_ID || !env.SALLA_CLIENT_SECRET || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.redirect(`${origin}/data?salla=error&reason=not_configured`, 302)
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://accounts.salla.sa/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.SALLA_CLIENT_ID,
      client_secret: env.SALLA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${origin}/api/salla/callback`,
    }),
  })

  if (!tokenRes.ok) {
    const detail = await tokenRes.text().catch(() => "")
    return Response.redirect(`${origin}/data?salla=error&reason=${encodeURIComponent(detail.slice(0, 200))}`, 302)
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string
    refresh_token: string
    expires: number
    scope: string
  }

  // Get merchant/store info
  const userInfo = await fetch("https://accounts.salla.sa/oauth2/user/info", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  }).then((r) => r.json() as Promise<{
    id?: number
    name?: string
    email?: string
    merchant?: { id?: number; name?: string; id?: number }
  }>).catch(() => ({}))

  const storeId = String(userInfo.merchant?.id ?? userInfo.id ?? "unknown")
  const storeName = userInfo.merchant?.name ?? userInfo.name ?? "Salla Store"
  const expiresAt = new Date(Date.now() + (tokens.expires ?? 1209599) * 1000).toISOString()

  // Upsert the client row for this store
  const clientId = `cli_salla_${storeId}`
  const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json", prefer: "resolution=merge-duplicates,return=minimal" }

  await fetch(`${env.SUPABASE_URL}/rest/v1/clients?on_conflict=id`, {
    method: "POST", headers: H,
    body: JSON.stringify({ id: clientId, organization_id: "org_afkar", name: storeName, slug: `salla-${storeId}`, domain: null, status: "active", settings: {} }),
  })

  // Store tokens
  await fetch(`${env.SUPABASE_URL}/rest/v1/integration_tokens?on_conflict=client_id,platform`, {
    method: "POST", headers: H,
    body: JSON.stringify({
      client_id: clientId, platform: "salla",
      access_token: tokens.access_token, refresh_token: tokens.refresh_token,
      expires_at: expiresAt, store_id: storeId, store_name: storeName,
      merchant_id: userInfo.merchant?.id ?? null, scope: tokens.scope,
    }),
  })

  return Response.redirect(`${origin}/data?salla=connected&store=${encodeURIComponent(storeName)}`, 302)
}
