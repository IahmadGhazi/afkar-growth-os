export type PlatformId = "salla" | "google" | "tiktok" | "snap" | "meta"

export interface PlatformSetup {
  id: PlatformId
  difficulty: "fast" | "moderate" | "slow"
  gate: string
  steps: { title: string; detail: string; env?: string }[]
  docs: string
}

export const DIFFICULTY_LABEL: Record<PlatformSetup["difficulty"], string> = {
  fast: "No review needed",
  moderate: "Approval required",
  slow: "Review and audit",
}

export const PLATFORM_SETUP: Record<PlatformId, PlatformSetup> = {
  salla: {
    id: "salla",
    difficulty: "fast",
    gate: "You have a Salla Partners app already. Install on your demo store to connect.",
    docs: "https://docs.salla.dev/421118m0",
    steps: [
      { title: "Install on your demo store", detail: "In Salla Partners, scroll to App Testing → Demo Stores → click Store next to Ahmad Ghazi Test." },
      { title: "Salla fires the authorize webhook", detail: "The app.store.authorize event sends access + refresh tokens to your webhook receiver automatically." },
      { title: "Tokens are stored", detail: "The receiver stores them in integration_tokens and creates the client row.", env: "SALLA_CLIENT_ID" },
      { title: "Click Sync Now", detail: "Pulls customers, orders, products, reviews from the Salla API into your pages." },
    ],
  },
  google: {
    id: "google",
    difficulty: "slow",
    gate: "Developer token needs Google approval for production traffic.",
    docs: "https://developers.google.com/google-ads/api/docs/start",
    steps: [
      { title: "Apply for a developer token", detail: "Google Ads manager account → API Center. Test access is immediate; production needs approval." },
      { title: "Create OAuth credentials", detail: "Google Cloud Console → OAuth client for web app → your deployed domain as redirect." },
      { title: "Generate a refresh token", detail: "Run the OAuth consent once to mint a long-lived refresh token.", env: "GOOGLE_ADS_REFRESH_TOKEN" },
      { title: "Copy the developer token and customer id", detail: "Developer token is a secret; customer id is not.", env: "GOOGLE_ADS_DEVELOPER_TOKEN / GOOGLE_ADS_CUSTOMER_ID" },
      { title: "Put the secrets in Cloudflare", detail: "wrangler pages secret put GOOGLE_ADS_*", env: "GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET" },
    ],
  },
  tiktok: {
    id: "tiktok",
    difficulty: "slow",
    gate: "App review AND a data-security audit before production. Start early.",
    docs: "https://business-api.tiktok.com/portal/docs",
    steps: [
      { title: "Create a developer app", detail: "TikTok for Business → Developers portal. You get a client key + secret." },
      { title: "Work in sandbox first", detail: "Sandbox advertiser lets you build and test while review is pending." },
      { title: "Submit for app review", detail: "Describe: reading ad performance for accounts you manage." },
      { title: "Complete data-security audit", detail: "Required for production. Takes weeks — start early." },
      { title: "Copy the client secret", detail: "Authorises the app.", env: "TIKTOK_CLIENT_SECRET" },
      { title: "Copy the advertiser id", detail: "From TikTok Ads Manager. Not a secret.", env: "TIKTOK_ADVERTISER_ID" },
      { title: "Put the secret in Cloudflare", detail: "wrangler pages secret put TIKTOK_CLIENT_SECRET" },
    ],
  },
  snap: {
    id: "snap",
    difficulty: "moderate",
    gate: "Open OAuth since 2018. You must be an Organization Admin.",
    docs: "https://developers.snap.com/api/marketing-api/Ads-API/introduction",
    steps: [
      { title: "Confirm Organization Admin role", detail: "Snap Business Manager → Business Details. Without this the OAuth option does not appear." },
      { title: "Create an OAuth app", detail: "Business Details → OAuth Apps → Create one." },
      { title: "Copy the client id and secret", detail: "Identifies and authorises the app.", env: "SNAP_CLIENT_ID / SNAP_CLIENT_SECRET" },
      { title: "Complete consent to get a refresh token", detail: "Run the OAuth consent URL with snapchat-marketing-api scope, copy the refresh token.", env: "SNAP_REFRESH_TOKEN" },
      { title: "Copy the ad account id", detail: "From Snap Ads Manager. Not a secret.", env: "SNAP_AD_ACCOUNT_ID" },
      { title: "Put the secrets in Cloudflare", detail: "wrangler pages secret put SNAP_*" },
    ],
  },
  meta: {
    id: "meta",
    difficulty: "fast",
    gate: "No App Review for your own ad accounts. A System User token is enough.",
    docs: "https://developers.facebook.com/docs/marketing-apis",
    steps: [
      { title: "Open Business Settings", detail: "Meta Business Manager → Business Settings for the ad account owner." },
      { title: "Create a System User", detail: "Users → System Users → Add one with Admin access." },
      { title: "Assign the ad account", detail: "Assign the ad account to that System User with View Performance." },
      { title: "Generate a token with ads_read", detail: "Generate New Token → pick your app → select ads_read + read_insights. Copy once.", env: "META_ACCESS_TOKEN" },
      { title: "Copy the ad account id", detail: "Looks like act_1234567890. Not a secret.", env: "META_AD_ACCOUNT_ID" },
      { title: "Put the token in Cloudflare", detail: "wrangler pages secret put META_ACCESS_TOKEN" },
    ],
  },
}

export const PLATFORM_META: Record<PlatformId, { name: string; sub: string; color: string; bg: string; scopes: string[] }> = {
  salla: { name: "Salla", sub: "Store · Orders · Customers", color: "#00E5CE", bg: "#00E5CE", scopes: ["customers.read", "orders.read", "products.read", "reviews.read"] },
  google: { name: "Google Ads", sub: "Search · YouTube · Display", color: "#F9AB00", bg: "#F9AB00", scopes: ["adwords.readonly"] },
  tiktok: { name: "TikTok", sub: "TikTok Ads Manager", color: "#00E5CE", bg: "#EE1D52", scopes: ["ad.read", "report.read"] },
  snap: { name: "Snapchat", sub: "Snap Ads Manager", color: "#FFFC00", bg: "#FFFC00", scopes: ["snapchat-marketing-api (read)"] },
  meta: { name: "Meta", sub: "Facebook + Instagram Ads", color: "#0866FF", bg: "#0866FF", scopes: ["ads_read", "read_insights"] },
}

export const SECURITY_NOTES = [
  { title: "Tokens live server-side", body: "Access tokens are held by Cloudflare secrets, never shipped to the browser." },
  { title: "Read-only, least privilege", body: "We request only read scopes. We can see performance, never move money or post." },
  { title: "Revoke anytime", body: "Disconnect here or from the platform itself. Access ends immediately." },
]
