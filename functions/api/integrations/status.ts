/**
 * GET /api/integrations/status — which platforms are connected and how.
 *
 * Salla: checks the integration_tokens TABLE (OAuth tokens stored by the
 *   app.store.authorize webhook). NOT env vars — Salla tokens are dynamic.
 * Google/TikTok/Snap/Meta: checks ENV VARS (static API keys).
 *
 * Staff gate: admin / account_manager / media_buyer.
 */
type Platform = "salla" | "google_ads" | "tiktok_ads" | "snap_ads" | "meta"

const ENV_CREDENTIALS: Record<string, { secret: string[]; account?: string }> = {
  google_ads: {
    secret: ["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_REFRESH_TOKEN"],
    account: "GOOGLE_ADS_CUSTOMER_ID",
  },
  tiktok_ads: {
    secret: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    account: "TIKTOK_ADVERTISER_ID",
  },
  snap_ads: {
    secret: ["SNAP_CLIENT_ID", "SNAP_CLIENT_SECRET", "SNAP_REFRESH_TOKEN"],
    account: "SNAP_AD_ACCOUNT_ID",
  },
  meta: {
    secret: ["META_ACCESS_TOKEN"],
    account: "META_AD_ACCOUNT_ID",
  },
}

const STAFF = new Set(["super_admin", "account_manager", "media_buyer"])
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "x-content-type-options": "nosniff" } })

export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request, env } = context
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

  const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }

  // Salla: check integration_tokens TABLE (OAuth tokens stored by webhook)
  let sallaConfigured = false
  let sallaAccount: string | null = null
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/integration_tokens?platform=eq.salla&select=store_name,store_id`, { headers: H })
    const tokens = (await res.json()) as Array<{ store_name?: string; store_id?: string }>
    if (tokens.length > 0) {
      sallaConfigured = true
      sallaAccount = tokens[0].store_name ?? tokens[0].store_id ?? null
    }
  } catch { sallaConfigured = false }

  const sallaStatus = {
    configured: sallaConfigured,
    account: sallaAccount,
    missing: sallaConfigured ? [] : ["Install the app on your Salla store"],
  }

  // Other platforms: check env vars
  const envPlatforms: Record<string, { configured: boolean; account: string | null; missing: string[] }> = {}
  for (const [id, cred] of Object.entries(ENV_CREDENTIALS)) {
    const configured = cred.secret.every((k) => Boolean(env[k]))
    envPlatforms[id] = {
      configured,
      account: cred.account ? env[cred.account] ?? null : null,
      missing: configured ? [] : cred.secret.filter((k) => !env[k]),
    }
  }

  return json({
    platforms: {
      salla: sallaStatus,
      ...envPlatforms,
    },
  }, 200)
}
