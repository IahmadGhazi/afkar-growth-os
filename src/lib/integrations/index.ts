import type { DataSourceId } from '../../types/database'

export interface SourceInfo {
  id: DataSourceId
  name: string
  description: string
  kpis: string[]
  setup: string[]
}

export const SOURCES: SourceInfo[] = [
  {
    id: 'salla',
    name: 'Salla',
    description: 'Store revenue, orders, AOV, conversion rate from afkar-modern.com',
    kpis: ['Revenue', 'Orders', 'AOV', 'Conversion Rate', 'Salla Spend', 'Salla Sales'],
    setup: [
      'Create a Salla merchant app at https://salla.partners (Merchant API).',
      'OAuth: authorize at https://accounts.salla.sa/oauth2/auth and request the orders.read + products.read scopes (access tokens expire after ~14 days, so keep the refresh token).',
      'Run the connect flow, approve the app for your store, then store the tokens server-side (never in the client bundle).',
    ],
  },
  {
    id: 'google_ads',
    name: 'Google Ads',
    description: 'Google Ads campaign spend and attributed sales',
    kpis: ['Google Ads Spend', 'Google Ads Sales'],
    setup: [
      'Create a Google Ads manager account (MCC) and add the client account.',
      'Create a Google Cloud project, enable the Google Ads API, and create OAuth credentials (client ID + secret, scope https://www.googleapis.com/auth/adwords).',
      'Apply for a developer token in the API Center (needs 2FA; approval can take a day), then complete OAuth and store the refresh token + customer ID server-side.',
    ],
  },
  {
    id: 'tiktok_ads',
    name: 'TikTok Ads',
    description: 'TikTok campaign spend and attributed sales',
    kpis: ['TikTok Spend', 'TikTok Sales'],
    setup: [
      'Create a TikTok for Business app (Marketing API product) and add your advertiser accounts.',
      'Request the scopes ad_management_basic (read campaigns/groups/ads) and ad_management_reporting (read reports).',
      'Exchange the auth code at https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/ (app_id + secret + auth_code) to get the access token + advertiser ID, and store the refresh token server-side.',
    ],
  },
  {
    id: 'snap_ads',
    name: 'Snapchat Ads',
    description: 'Snapchat campaign spend and attributed sales',
    kpis: ['Snapchat Spend', 'Snapchat Sales'],
    setup: [
      'In Snap Business Manager go to Business Details and create an OAuth app (you must be an Organization Admin).',
      'Request the snapchat-marketing-api scope and the "reports" role (Data Analyst) for campaign stats.',
      'Exchange the auth code at https://accounts.snapchat.com/login/oauth2/access_token (client id + secret) and store the long-lived refresh token server-side.',
    ],
  },
  {
    id: 'excel',
    name: 'Excel',
    description: 'Import or export an Excel workbook with KPI names and values',
    kpis: ['Any defined KPI'],
    setup: [
      'Use "Export to Excel" to download the current KPI template.',
      'Edit the Value column in Excel and import the file back.',
      'Rows: first column = KPI name, second = value. A third Date column (YYYY-MM-DD) is optional.',
    ],
  },
  {
    id: 'google_sheets',
    name: 'Google Sheets',
    description: 'Sync KPIs from a Google Sheet shared with anyone with the link',
    kpis: ['Any defined KPI'],
    setup: [
      'Create a Google Sheet with columns: KPI name, value (date optional).',
      'Share the sheet via Share > General access > "Anyone with the link" (Viewer).',
      'Paste the sheet link in the Data page and connect — no API keys required.',
    ],
  },
  {
    id: 'manual',
    name: 'Manual / CSV',
    description: 'Type numbers in or paste a spreadsheet - works today with no setup',
    kpis: [],
    setup: [],
  },
]

export function sourceInfo(id: string): SourceInfo | null {
  return SOURCES.find((source) => source.id === id) ?? null
}

export function sourceLabel(id: string): string {
  return sourceInfo(id)?.name ?? id
}

export interface ParsedMetricRow {
  name: string
  value: number
}

export function parseMetricCsv(text: string): ParsedMetricRow[] {
  const rows: ParsedMetricRow[] = []
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    const parts = line.split(/[\t,;]/).map((part) => part.trim()).filter(Boolean)
    if (parts.length < 2) continue
    const name = parts[0]
    const value = parseFloat(parts[1].replace(/[^\d.-]/g, ''))
    if (!name || isNaN(value)) continue
    rows.push({ name, value })
  }
  return rows
}