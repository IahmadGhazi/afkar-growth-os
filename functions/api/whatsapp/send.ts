/**
 * POST /api/whatsapp/send — Meta WhatsApp Cloud API transport.
 * Dormant (501) until WHATSAPP_TOKEN + WHATSAPP_PHONE_ID secrets exist.
 * Body: { to: "9665xxxxxxxx", text: "message" }
 */
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "x-content-type-options": "nosniff" } })
const STAFF = new Set(["super_admin", "account_manager", "media_buyer"])

export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request, env } = context
  if (request.method !== "POST") return json({ error: "POST only" }, 405)
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: "not_configured" }, 501)

  // Staff gate
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

  // Transport config
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_ID) {
    return json({ error: "not_configured", message: "Set WHATSAPP_TOKEN + WHATSAPP_PHONE_ID secrets to enable automated sending." }, 501)
  }

  let body: { to?: string; text?: string } = {}
  try { body = await request.json() } catch { return json({ error: "invalid_json" }, 400) }
  const to = (body.to ?? "").replace(/[^\d]/g, "")
  const text = (body.text ?? "").slice(0, 4096)
  if (!to || !text) return json({ error: "missing_to_or_text" }, 400)

  const res = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.WHATSAPP_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { preview_url: true, body: text },
    }),
  })
  const out = (await res.json().catch(() => ({}))) as { messages?: Array<{ id?: string }>; error?: { message?: string } }
  if (!res.ok) {
    return json({ error: "whatsapp_send_failed", detail: out.error?.message?.slice(0, 200) ?? res.status }, 502)
  }
  return json({ ok: true, messageId: out.messages?.[0]?.id ?? null })
}
