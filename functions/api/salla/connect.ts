/**
 * GET /api/salla/connect — redirects the merchant to Salla's authorization page.
 * No auth gate needed: this endpoint only builds a redirect URL using the
 * public client_id. No secrets are exposed. Data access is protected by RLS.
 * The OAuth `state` is HMAC-signed (SALLA_WEBHOOK_SECRET) with a timestamp;
 * the callback verifies signature + freshness to defeat CSRF.
 */
async function hmacSign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request, env } = context

  if (!env.SALLA_CLIENT_ID || !env.SALLA_WEBHOOK_SECRET) {
    return new Response(
      JSON.stringify({ error: "not_configured", message: "Set SALLA_CLIENT_ID and SALLA_WEBHOOK_SECRET as Cloudflare Pages secrets." }),
      { status: 501, headers: { "content-type": "application/json" } },
    )
  }

  const origin = new URL(request.url).origin
  const url = new URL(request.url)
  // Full mode requests every scope we want. If Salla rejects any of them
  // (invalid_scope), the callback bounces back here in basic mode so the
  // connection NEVER bricks — coupons just wait until the portal scope
  // is truly enabled and a later reconnect upgrades again.
  const mode = url.searchParams.get("mode") === "basic" ? "basic" : "full"
  const scopes = mode === "basic"
    ? ["customers.read", "orders.read", "products.read", "reviews.read", "carts.read", "offline_access"]
    : ["customers.read", "orders.read", "products.read", "reviews.read", "carts.read", "marketing.read_write", "shipping.read", "offline_access"]

  const payload = JSON.stringify({ t: Date.now(), n: crypto.randomUUID(), m: mode })
  const sig = await hmacSign(payload, env.SALLA_WEBHOOK_SECRET)
  const state = `${Buffer.from(payload).toString("base64url")}.${sig}`
  const authUrl = new URL("https://accounts.salla.sa/oauth2/auth")
  authUrl.searchParams.set("client_id", env.SALLA_CLIENT_ID)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("redirect_uri", `${origin}/api/salla/callback`)
  authUrl.searchParams.set("scope", scopes.join(" "))
  authUrl.searchParams.set("state", state)

  return Response.redirect(authUrl.toString(), 302)
}
