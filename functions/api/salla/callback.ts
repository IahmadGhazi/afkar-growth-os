/**
 * GET /api/salla/callback — Salla redirects here after merchant authorization.
 * Every step is wrapped: any failure redirects to /data with the reason
 * visible in the URL so the user knows exactly what went wrong.
 */
export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const origin = new URL(context.request.url).origin

  try {
    const url = new URL(context.request.url)
    const code = url.searchParams.get("code")
    const oauthError = url.searchParams.get("error")

    if (oauthError || !code) {
      return Response.redirect(`${origin}/data?salla=error&reason=${encodeURIComponent(oauthError ?? "no_code_in_callback")}`, 302)
    }

    const env = context.env
    if (!env.SALLA_CLIENT_ID || !env.SALLA_CLIENT_SECRET || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return Response.redirect(`${origin}/data?salla=error&reason=missing_secrets_on_server`, 302)
    }

    // Step 1: Exchange code for tokens
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
    }).catch((e) => { throw new Error(`token exchange fetch failed: ${e.message}`) })

    const tokenText = await tokenRes.text()
    if (!tokenRes.ok) {
      throw new Error(`token exchange http ${tokenRes.status}: ${tokenText.slice(0, 200)}`)
    }

    let tokens: Record<string, unknown>
    try { tokens = JSON.parse(tokenText) } catch { throw new Error("token exchange returned non-JSON") }

    if (!tokens.access_token) {
      throw new Error(`no access_token in response: ${tokenText.slice(0, 200)}`)
    }

    // Step 2: Get merchant/store info
    let userInfo: Record<string, any> = {}
    try {
      const infoRes = await fetch("https://accounts.salla.sa/oauth2/user/info", {
        headers: { authorization: `Bearer ${tokens.access_token}` },
      })
      if (infoRes.ok) userInfo = await infoRes.json()
    } catch { /* non-critical: use fallbacks */ }

    const storeId = String(userInfo.merchant?.id ?? userInfo.id ?? `store_${Date.now()}`)
    const storeName = userInfo.merchant?.name ?? userInfo.name ?? "Salla Store"
    const clientId = `cli_salla_${storeId}`
    const expiresAt = new Date(Date.now() + (Number(tokens.expires) || 1209599) * 1000).toISOString()

    const H = {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    }

    // Step 3: Upsert client row
    const clientRes = await fetch(`${env.SUPABASE_URL}/rest/v1/clients?on_conflict=id`, {
      method: "POST", headers: H,
      body: JSON.stringify({
        id: clientId, organization_id: "org_afkar",
        name: storeName, slug: `salla-${storeId}`,
        domain: null, status: "active", settings: {},
      }),
    })
    if (!clientRes.ok) {
      const errText = await clientRes.text().catch(() => "")
      throw new Error(`client upsert http ${clientRes.status}: ${errText.slice(0, 200)}`)
    }

    // Step 4: Store tokens
    const tokenId = `token_salla_${storeId}`
    const tokenInsertRes = await fetch(`${env.SUPABASE_URL}/rest/v1/integration_tokens?on_conflict=id`, {
      method: "POST", headers: H,
      body: JSON.stringify({
        id: tokenId,
        client_id: clientId, platform: "salla",
        access_token: tokens.access_token, refresh_token: tokens.refresh_token,
        expires_at: expiresAt, store_id: storeId, store_name: storeName,
        merchant_id: userInfo.merchant?.id ?? null, scope: (tokens.scope as string) ?? null,
      }),
    })
    if (!tokenInsertRes.ok) {
      const errText = await tokenInsertRes.text().catch(() => "")
      throw new Error(`token storage http ${tokenInsertRes.status}: ${errText.slice(0, 200)}`)
    }

    // SUCCESS
    return Response.redirect(`${origin}/data?salla=connected&store=${encodeURIComponent(storeName)}`, 302)
  } catch (err) {
    // Every failure redirects with the reason visible in the URL
    const reason = encodeURIComponent(String((err as Error).message).slice(0, 300))
    return Response.redirect(`${origin}/data?salla=error&reason=${reason}`, 302)
  }
}
