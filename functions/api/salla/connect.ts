/**
 * GET /api/salla/connect — redirects the merchant to Salla's authorization page.
 * No auth gate needed: this endpoint only builds a redirect URL using the
 * public client_id. No secrets are exposed. Data access is protected by RLS.
 */
export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request, env } = context

  if (!env.SALLA_CLIENT_ID) {
    return new Response(
      JSON.stringify({ error: "not_configured", message: "Set SALLA_CLIENT_ID as a Cloudflare Pages secret." }),
      { status: 501, headers: { "content-type": "application/json" } },
    )
  }

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
