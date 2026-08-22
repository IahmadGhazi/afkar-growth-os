/**
 * GET/POST /api/integrations/status — which ad platforms have credentials.
 * Ghazi pattern: booleans + non-secret labels only; secrets never leave the
 * server. Staff gate: admin / account_manager / media_buyer.
 */
type Platform = "google_ads" | "tiktok_ads" | "snap_ads" | "salla"

const CREDENTIALS: Record<Platform, { secret: string[]; account?: string }> = {
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
  salla: {
    secret: ["SALLA_CLIENT_ID", "SALLA_CLIENT_SECRET", "SALLA_REFRESH_TOKEN"],
    account: "SALLA_STORE_ID",
  },
}

const STAFF = new Set(["super_admin", "account_manager", "media_buyer"])
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "x-content-type-options": "nosniff" } })

export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request, env } = context
  if (!["GET", "POST"].includes(request.method)) return json({ error: "POST/GET only" }, 405)

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

  const platforms = Object.fromEntries(
    (Object.keys(CREDENTIALS) as Platform[]).map((id) => {
      const { secret, account } = CREDENTIALS[id]
      const configured = secret.every((k) => Boolean(env[k]))
      return [id, { configured, account: account ? env[account] ?? null : null, missing: configured ? [] : secret.filter((k) => !env[k]) }]
    }),
  )
  return json({ platforms }, 200)
}
