/**
 * POST /api/webhooks/salla — receives ALL Salla webhook events.
 * Validates the payload, matches to the correct client, writes to the
 * appropriate table. No auth gate (Salla calls this server-to-server).
 * Security: validates the payload structure and matches merchant ID.
 */
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "x-content-type-options": "nosniff" } })

export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }) {
  const { request, env } = context
  if (request.method !== "POST") return json({ error: "POST only" }, 405)
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    return json({ error: "not_configured" }, 501)

  let body: {
    event?: string
    merchant?: number
    data?: Record<string, unknown>
  }
  try { body = await request.json() } catch { return json({ error: "invalid JSON" }, 400) }
  if (!body.event || !body.merchant) return json({ error: "missing event or merchant" }, 400)

  const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json", prefer: "resolution=merge-duplicates,return=minimal" }
  const clientId = `cli_salla_${body.merchant}`
  const data = body.data ?? {}
  const now = new Date().toISOString()

  // Find the client for this merchant
  const clientRes = await fetch(`${env.SUPABASE_URL}/rest/v1/clients?id=eq.${clientId}&select=id`, { headers: H })
  if (!(await clientRes.json()).length) return json({ error: "unknown merchant" }, 404)

  const eventId = `${body.event}_${body.merchant}_${Date.now()}`

  switch (body.event) {
    case "order.created":
    case "order.updated": {
      const order = data as Record<string, unknown>
      const orderId = `ord_salla_${order.id}`
      await fetch(`${env.SUPABASE_URL}/rest/v1/orders?on_conflict=id`, {
        method: "POST", headers: H,
        body: JSON.stringify({
          id: orderId, client_id: clientId, salla_id: order.id,
          status: order.status ?? "payment_completed",
          payment_method: (order.payment_method as string) ?? null,
          total_amount: ((order.amounts as any)?.total?.amount ?? (order.total as number) ?? 0),
          shipping_cost: ((order.amounts as any)?.shipping?.amount ?? 0),
          tax_amount: ((order.amounts as any)?.tax?.amount ?? 0),
          items_count: Array.isArray(order.items) ? order.items.length : 0,
          items: order.items ?? [],
          date_created: (order.date as any)?.date ?? now,
          synced_at: now,
        }),
      })
      // Add to timeline
      await fetch(`${env.SUPABASE_URL}/rest/v1/order_timeline`, {
        method: "POST", headers: H,
        body: JSON.stringify({ id: eventId, order_id: orderId, client_id: clientId, event: body.event, details: data, event_time: now }),
      })
      break
    }
    case "order.status.updated": {
      const orderId = `ord_salla_${(data as any)?.id ?? "unknown"}`
      const newStatus = (data as any)?.status ?? "unknown"
      await fetch(`${env.SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
        method: "PATCH", headers: H,
        body: JSON.stringify({ status: newStatus, updated_at: now }),
      })
      await fetch(`${env.SUPABASE_URL}/rest/v1/order_timeline`, {
        method: "POST", headers: H,
        body: JSON.stringify({ id: eventId, order_id: orderId, client_id: clientId, event: body.event, details: data, event_time: now }),
      })
      // SLA: if completed/delivered → resolved
      if (["completed", "delivered"].includes(newStatus)) {
        await fetch(`${env.SUPABASE_URL}/rest/v1/order_sla?on_conflict=order_id`, {
          method: "POST", headers: H,
          body: JSON.stringify({ id: `sla_${orderId}`, order_id: orderId, client_id: clientId, sla_state: "resolved", updated_at: now }),
        })
      }
      break
    }
    case "customer.created":
    case "customer.updated": {
      const cust = data as Record<string, any>
      await fetch(`${env.SUPABASE_URL}/rest/v1/customers?on_conflict=id`, {
        method: "POST", headers: H,
        body: JSON.stringify({
          id: `cust_salla_${cust.id}`, client_id: clientId, salla_id: cust.id,
          first_name: cust.first_name, last_name: cust.last_name,
          mobile: cust.mobile, mobile_code: cust.mobile_code, email: cust.email,
          gender: cust.gender, city: cust.city, country: cust.country,
          avatar_url: cust.avatar, synced_at: now,
        }),
      })
      break
    }
    case "product.created":
    case "product.updated": {
      const prod = data as Record<string, any>
      await fetch(`${env.SUPABASE_URL}/rest/v1/store_products?on_conflict=id`, {
        method: "POST", headers: H,
        body: JSON.stringify({
          id: `sp_salla_${prod.id}`, client_id: clientId, salla_id: prod.id,
          name: prod.name, sku: prod.sku, status: prod.status ?? "active",
          price: (prod.price as any)?.amount ?? null, quantity: prod.quantity ?? 0,
          synced_at: now,
        }),
      })
      break
    }
    case "shipment.created":
    case "shipment.updated": {
      const ship = data as Record<string, any>
      await fetch(`${env.SUPABASE_URL}/rest/v1/shipments?on_conflict=id`, {
        method: "POST", headers: H,
        body: JSON.stringify({
          id: `shp_salla_${ship.id}`, client_id: clientId,
          salla_shipment_id: ship.id, status: ship.status ?? "created",
          shipping_company: ship.company ?? null, tracking_number: ship.tracking_number ?? null,
          updated_at: now,
        }),
      })
      break
    }
    case "review.created": {
      // Handled by the reviews table insert
      break
    }
    default:
      // Store unknown events in the activity log for future processing
      await fetch(`${env.SUPABASE_URL}/rest/v1/activity_logs`, {
        method: "POST", headers: H,
        body: JSON.stringify({ id: eventId, entity_type: "webhook", entity_id: String(body.merchant), action: body.event, details: data }),
      })
  }

  return json({ ok: true, event: body.event })
}
