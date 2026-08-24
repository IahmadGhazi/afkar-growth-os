/* AFKAR ADS PULLER — daily insights from Google/TikTok/Snap + Salla store
   orders, written into kpi_snapshots with the same deterministic ids the
   app's manual auto-feed uses (snap_<kpi>_<date>), so platform Spend/Sales
   cards stay live without anyone typing numbers.

   SECURITY: every token is READ-ONLY scoped (ads_read family). Secrets live
   in Worker env only. A missing token = that platform is skipped honestly.
   Adapted from the Ghazi ads-puller (battle-tested endpoints/parsers). */

export const PLATFORM_KPI: Record<string, [string, string]> = {
  google_ads: ["kpi_google_spend", "kpi_google_sales"],
  tiktok_ads: ["kpi_tiktok_spend", "kpi_tiktok_sales"],
  snap_ads: ["kpi_snap_spend", "kpi_snap_sales"],
  salla: ["kpi_salla_spend", "kpi_salla_sales"],
}

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const iso = (d: Date) => d.toISOString().slice(0, 10)

export function dayWindow(now = new Date()) {
  const end = new Date(now); end.setUTCDate(end.getUTCDate() - 1)
  const start = iso(end)
  return { start, end: start } // single day: yesterday
}

async function jfetch(url: string, init: RequestInit & { signal?: AbortSignal }) {
  const res = await fetch(url, init)
  const text = await res.text()
  let body: any = null
  try { body = JSON.parse(text) } catch {}
  if (!res.ok) throw new Error(`http ${res.status}: ${(text || "").replace(/\s+/g, " ").slice(0, 160)}`)
  return body
}
const t = () => ({ signal: AbortSignal.timeout(20000) })

/* ---- TOKEN MINTS (refresh-token pattern for Google/Snap; client_credentials
   for TikTok. Salla uses refresh_token like Snap.) ---- */
async function mintGoogle(env: any) {
  const r = await jfetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `client_id=${encodeURIComponent(env.GOOGLE_ADS_CLIENT_ID)}&client_secret=${encodeURIComponent(env.GOOGLE_ADS_CLIENT_SECRET)}&refresh_token=${encodeURIComponent(env.GOOGLE_ADS_REFRESH_TOKEN)}&grant_type=refresh_token`,
    ...t(),
  })
  if (!r?.access_token) throw new Error("google token mint failed")
  return r.access_token as string
}
async function mintTikTok(env: any) {
  const r = await jfetch("https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ app_id: env.TIKTOK_CLIENT_KEY, secret: env.TIKTOK_CLIENT_SECRET, grant_type: "client_credentials" }),
    ...t(),
  })
  if (!r?.data?.access_token) throw new Error("tiktok token mint failed")
  return r.data.access_token as string
}
async function mintRefresh(host: string, env: any, idKey: string, secKey: string, tokKey: string) {
  const r = await jfetch(host, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `client_id=${encodeURIComponent(env[idKey])}&client_secret=${encodeURIComponent(env[secKey])}&refresh_token=${encodeURIComponent(env[tokKey])}&grant_type=refresh_token`,
    ...t(),
  })
  if (!r?.access_token) throw new Error("token mint failed")
  return r.access_token as string
}

/* ---- FETCHERS: one read-only call per platform, returns {spend, sales}. ---- */
async function fetchGoogle(env: any, day: string) {
  const access = await mintGoogle(env)
  const body = await jfetch(`https://googleads.googleapis.com/v24/customers/${env.GOOGLE_ADS_CUSTOMER_ID}/googleAds:searchStream`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${access}`,
      "developer-token": env.GOOGLE_ADS_DEVELOPER_TOKEN,
      ...(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ? { "login-customer-id": env.GOOGLE_ADS_LOGIN_CUSTOMER_ID } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query: `SELECT metrics.cost_micros, metrics.conversions_value FROM customer WHERE segments.date = '${day}'`,
    }),
    ...t(),
  })
  const m = (body as any[])?.[0]?.results?.[0]?.metrics ?? {}
  return { spend: num(m.cost_micros) / 1e6, sales: num(m.conversions_value) }
}

async function fetchTikTok(env: any, day: string) {
  const access = await mintTikTok(env)
  const body = await jfetch("https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/", {
    method: "POST",
    headers: { "content-type": "application/json", "Access-Token": access },
    body: JSON.stringify({
      advertiser_id: env.TIKTOK_ADVERTISER_ID,
      service_type: "AUCTION",
      report_type: "BASIC",
      data_level: "AUCTION_ADVERTISER",
      dimensions: ["stat_time_day"],
      metrics: ["spend", "complete_payment_roas"],
      start_date: day,
      end_date: day,
      page_size: 10,
    }),
    ...t(),
  })
  const list = (body as any)?.data?.list ?? []
  let spend = 0, sales = 0
  for (const row of list) { spend += num(row?.metrics?.spend); sales += num(row?.metrics?.complete_payment_roas) * num(row?.metrics?.spend) }
  return { spend, sales }
}

async function fetchSnap(env: any, day: string) {
  // Snap spend is MICRO-currency: divide by 1e6.
  const access = await mintRefresh(
    "https://accounts.snapchat.com/login/oauth2/access_token",
    env, "SNAP_CLIENT_ID", "SNAP_CLIENT_SECRET", "SNAP_REFRESH_TOKEN",
  )
  const body = await jfetch(
    `https://adsapi.snapchat.com/v1/adaccounts/${env.SNAP_AD_ACCOUNT_ID}/stats?start_time=${day}T00:00:00Z&end_time=${day}T23:59:59Z&granularity=TOTAL`,
    { headers: { authorization: `Bearer ${access}` }, ...t() },
  )
  const stats = (body as any)?.total_stats?.[0]?.total_stat?.stats ?? {}
  return { spend: num(stats.spend) / 1e6, sales: 0 } // Snap v3 has no purchase value on this endpoint
}

async function fetchSalla(env: any, day: string) {
  // Salla Admin API v2: sum completed-order totals for the day.
  const access = await mintRefresh(
    "https://accounts.salla.sa/oauth2/token",
    env, "SALLA_CLIENT_ID", "SALLA_CLIENT_SECRET", "SALLA_REFRESH_TOKEN",
  )
  let page = 1, sales = 0, orders = 0
  while (page <= 5) {
    const body = await jfetch(
      `https://api.salla.dev/admin/v2/orders?created_after=${day}T00:00:00Z&created_before=${day}T23:59:59Z&page=${page}&per_page=50`,
      { headers: { authorization: `Bearer ${access}` }, ...t() },
    )
    const list = ((body as any)?.data ?? []) as Array<{ amounts?: { total?: { amount?: number } }; total?: number }>
    for (const o of list) { sales += num(o.amounts?.total?.amount ?? o.total); orders += 1 }
    const totalPages = num((body as any)?.meta?.totalPages)
    if (page >= totalPages || list.length === 0) break
    page += 1
  }
  return { spend: 0, sales, orders } // Salla is the store: organic sales, no ad spend
}

/* ---- WRITE: deterministic kpi_snapshot rows (same ids as manual feed). ---- */
async function writeSnapshots(env: any, clientId: string, day: string, feeds: Array<{ kpiId: string; value: number }>, source: string) {
  const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json", prefer: "resolution=merge-duplicates,return=minimal" }
  const rows = feeds.map((f) => ({
    id: `snap_${f.kpiId}_${day}`, kpi_id: f.kpiId, client_id: clientId,
    snapshot_date: day, value: Math.round(f.value * 100) / 100,
    source, notes: null, created_at: new Date().toISOString(),
  }))
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/kpi_snapshots?on_conflict=id`, {
    method: "POST", headers: H, body: JSON.stringify(rows), ...t(),
  })
  if (!res.ok) throw new Error(`snapshot write http ${res.status}`)
}

export async function runPull(env: any, opts: { now?: Date } = {}) {
  const now = opts.now ?? new Date()
  const { start: day } = dayWindow(now)
  const out: Array<Record<string, unknown>> = []

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { pulled: out }

  // The client we pull FOR (single-client phase): first client in the book.
  const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json" }
  const clientRes = await fetch(`${env.SUPABASE_URL}/rest/v1/clients?select=id&limit=1`, { headers: H, ...t() })
  const clients = (await clientRes.json()) as Array<{ id: string }>
  const clientId = clients?.[0]?.id
  if (!clientId) return { pulled: out }

  const jobs: Array<{ platform: string; run: () => Promise<void> }> = []
  if (env.GOOGLE_ADS_REFRESH_TOKEN) jobs.push({ platform: "google_ads", run: async () => {
    const { spend, sales } = await fetchGoogle(env, day)
    await writeSnapshots(env, clientId, day, [
      { kpiId: "kpi_google_spend", value: spend }, { kpiId: "kpi_google_sales", value: sales },
    ], `puller:google_ads`)
  }})
  if (env.TIKTOK_CLIENT_SECRET) jobs.push({ platform: "tiktok_ads", run: async () => {
    const { spend, sales } = await fetchTikTok(env, day)
    await writeSnapshots(env, clientId, day, [
      { kpiId: "kpi_tiktok_spend", value: spend }, { kpiId: "kpi_tiktok_sales", value: sales },
    ], `puller:tiktok_ads`)
  }})
  if (env.SNAP_REFRESH_TOKEN) jobs.push({ platform: "snap_ads", run: async () => {
    const { spend } = await fetchSnap(env, day)
    await writeSnapshots(env, clientId, day, [{ kpiId: "kpi_snap_spend", value: spend }], `puller:snap_ads`)
  }})
  if (env.SALLA_REFRESH_TOKEN) jobs.push({ platform: "salla", run: async () => {
    const { sales, orders } = await fetchSalla(env, day)
    await writeSnapshots(env, clientId, day, [{ kpiId: "kpi_revenue", value: sales }], `puller:salla`)
    console.log(`salla: ${orders} orders`)
  }})

  for (const job of jobs) {
    try { await job.run(); out.push({ platform: job.platform, status: "ok" }) }
    catch (e) { out.push({ platform: job.platform, status: "error", error: String((e as Error).message).slice(0, 200) }) }
  }

  // ── SLA WATCHDOG: tattle on slow deliveries every run (3h cadence).
  try { out.push(await runSlaSweep(env)) } catch (e) {
    out.push({ platform: "sla_watchdog", status: "error", error: String((e as Error).message).slice(0, 160) })
  }
  return { pulled: out, day }
}

/* ---- SLA WATCHDOG: orders still 'shipped' too long get flagged. ----
   >24h in transit  → at_risk
   >48h in transit  → delayed
   Delivered/completed orders → resolved. Idempotent via upsert on order_id. */
async function runSlaSweep(env: any): Promise<Record<string, unknown>> {
  const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json", prefer: "resolution=merge-duplicates,return=minimal" }
  const GET = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
  const now = Date.now()
  const counts = { atRisk: 0, delayed: 0, resolved: 0 }

  // Orders currently sitting in a shipped-ish state
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/orders?status=in.(shipped,in_transit,delivering,out_for_delivery)&select=id,date_created`, { headers: GET })
  if (!res.ok) throw new Error(`sla read ${res.status}`)
  const shipped = (await res.json()) as Array<{ id: string; date_created: string | null }>

  const rows: Array<Record<string, unknown>> = []
  for (const o of shipped) {
    if (!o.date_created) continue
    const ageH = (now - new Date(o.date_created).getTime()) / 3600_000
    if (ageH > 48) rows.push({ id: `sla_${o.id}`, order_id: o.id, sla_state: "delayed", updated_at: new Date().toISOString() })
    else if (ageH > 24) rows.push({ id: `sla_${o.id}`, order_id: o.id, sla_state: "at_risk", updated_at: new Date().toISOString() })
  }
  if (rows.length) {
    const w = await fetch(`${env.SUPABASE_URL}/rest/v1/order_sla?on_conflict=order_id`, {
      method: "POST", headers: H, body: JSON.stringify(rows),
    })
    if (!w.ok) throw new Error(`sla write ${w.status}: ${(await w.text()).slice(0, 120)}`)
    counts.atRisk = rows.filter((r) => r.sla_state === "at_risk").length
    counts.delayed = rows.filter((r) => r.sla_state === "delayed").length
  }

  // Auto-resolve: delivered/completed orders whose SLA is still open
  const doneRes = await fetch(`${env.SUPABASE_URL}/rest/v1/order_sla?sla_state=in.(at_risk,delayed)&select=id,order_id`, { headers: GET })
  if (doneRes.ok) {
    const open = (await doneRes.json()) as Array<{ id: string; order_id: string }>
    for (const s of open) {
      const ordRes = await fetch(`${env.SUPABASE_URL}/rest/v1/orders?id=eq.${s.order_id}&select=status`, { headers: GET })
      if (!ordRes.ok) continue
      const st = ((await ordRes.json()) as Array<{ status?: string }>)[0]?.status
      if (st && ["delivered", "completed", "canceled", "cancelled", "refunded", "deleted"].includes(st)) {
        await fetch(`${env.SUPABASE_URL}/rest/v1/order_sla?on_conflict=order_id`, {
          method: "POST", headers: H,
          body: JSON.stringify([{ id: s.id, order_id: s.order_id, sla_state: "resolved", updated_at: new Date().toISOString() }]),
        })
        counts.resolved++
      }
    }
  }
  return { platform: "sla_watchdog", status: "ok", ...counts }
}

/* Scheduled entry + manual trigger via fetch (for the Sync-now button
   relayed through /api/integrations/sync). */
export default {
  async scheduled(_event: unknown, env: any, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
    ctx.waitUntil(runPull(env))
  },
  async fetch(request: Request, env: any, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
    if (request.method !== "POST") return new Response("POST only", { status: 405 })
    // Fail closed: if PULLER_TOKEN is not configured, the HTTP trigger is disabled.
    if (!env.PULLER_TOKEN || request.headers.get("x-puller-token") !== env.PULLER_TOKEN)
      return new Response("unauthorized", { status: 401 })
    const result = await runPull(env)
    return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } })
  },
}
