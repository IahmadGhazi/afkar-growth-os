/**
 * WhatsApp Business API base — the transport layer for automated recovery
 * and briefing delivery. Today the UI uses wa.me deep-links + clipboard;
 * when WABA credentials land (phone number id + permanent token), only this
 * file changes — message templates are already composed in the same shape.
 */
export interface WhatsAppMessage {
  to: string // international format, digits only
  body: string
}

export interface WhatsAppSendResult {
  ok: boolean
  providerMessageId?: string
  error?: string
}

/** Send via Cloudflare Pages Function relay → Meta Cloud API. Dormant until configured. */
export async function sendWhatsApp(msg: WhatsAppMessage): Promise<WhatsAppSendResult> {
  try {
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: msg.to, text: msg.body }),
    })
    if (!res.ok) {
      if (res.status === 501) return { ok: false, error: 'not_configured' }
      const body = await res.text().catch(() => '')
      return { ok: false, error: `http ${res.status}: ${body.slice(0, 120)}` }
    }
    const json = (await res.json()) as { messageId?: string }
    return { ok: true, providerMessageId: json.messageId }
  } catch (e) {
    return { ok: false, error: String((e as Error).message) }
  }
}
