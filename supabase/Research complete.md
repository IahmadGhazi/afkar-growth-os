Research complete. I have full knowledge of the Salla API surface. Now let me deliver the god-plan.

---

# 🏛️ AFKAR GROWTH OS — THE GOD PLAN
### Salla Integration Architecture · New Pages · Report Engine · SaaS Template Strategy

---

## 0 · WHAT YOU SAID THAT CHANGES EVERYTHING

> *"The client report is hard-made I think? How tf can I make it when the client is with me!! It must be made from the actual web app not coding like this!!"*

**You're 100% right and this is the most important thing you've said.** Right now, the Report page is hand-written JSX that renders hardcoded sections. It should be a **dynamic report engine** that pulls live numbers, auto-generates narrative text, and lets you layer human insight on top — all rendered from data, never from code. That's what separates a tool from a product.

This plan fixes that as part of the architecture.

---

## 1 · SALLA API — WHAT WE CAN DO

| Capability | Endpoint | Scope | Rate Limit |
|---|---|---|---|
| List customers | `GET /customers` | `customers.read` | 500 req / 10 min |
| Customer details | `GET /customers/{id}` | `customers.read` | same |
| Loyalty points | `GET /customers/loyalty/points` | `customers.read` | same |
| Update loyalty | `PUT /customers/{id}/loyalty/points` | `customers.read_write` | same |
| List orders | `GET /orders` | `orders.read` | standard |
| Order details | `GET /orders/{id}` | `orders.read` | standard |
| List products | `GET /products` | `products.read` | standard |
| Product details | `GET /products/{id}` | `products.read` | standard |
| List reviews | `GET /feedbacks` | `reviews.read` | standard |
| Abandoned carts | webhook `abandoned_cart.created` | `carts.read` | n/a |

**Auth:** OAuth2 authorization_code flow. Access token expires in 14 days. Refresh token is single-use. Store must install our app via Salla Partners portal OR we redirect them to `accounts.salla.sa/oauth2/auth`.

**Easy Mode** (recommended for published apps): Salla sends us the access token automatically via the `app.store.authorize` webhook when a merchant installs our app. Zero OAuth code needed on our side.

---

## 2 · NEW PAGES & DATA MODEL

### 2.1 Customers

```
Table: customers
├── id (salla_id, integer)
├── client_id → clients.id
├── first_name, last_name
├── mobile, mobile_code, email
├── gender, city, country
├── avatar_url
├── total_orders, total_spent
├── loyalty_points
├── first_order_date, last_order_date
├── tags (jsonb array)
├── groups (jsonb array)
├── is_active
└── synced_at
```

**Page features:**
- Table with search (name/email/mobile), sort by spend/orders/date
- Customer detail drawer: order history, loyalty points, lifetime value, tags
- Segments: VIP (top 10% by spend), Repeat (>1 order), One-time, At-risk (no order in 90d)
- Export to Excel
- Sync button → pulls from Salla API

### 2.2 Orders

```
Table: orders
├── id (salla_id, integer)
├── client_id → clients.id
├── customer_id → customers.id
├── status (payment_completed, delivered, shipped, cancelled...)
├── payment_method
├── total_amount, shipping_cost, tax_amount
├── currency
├── items_count
├── items (jsonb: product names, quantities, prices)
├── date_created, date_completed
├── selling_channel (online, branch, etc.)
└── synced_at
```

**Page features:**
- Table with status filter tabs, date range picker, search
- Order detail drawer: line items, customer info, timeline
- Revenue chart (daily/weekly/monthly toggle)
- Top products widget
- Sync button → pulls from Salla API

### 2.3 Products (renamed from current Products tab)

```
Table: store_products
├── id (salla_id, integer)
├── client_id → clients.id
├── name, sku
├── price, sale_price
├── status (active, hidden, out_of_stock)
├── category
├── image_url
├── quantity
├── views, sales_count
├── rating_avg, reviews_count
└── synced_at
```

Current "Products" tab becomes "Product Research" (the discovery funnel). New "Products" tab shows the actual Salla catalog.

**Page features:**
- Grid/list view of real Salla products
- Sort by sales/views/rating/price
- Low-stock alerts
- Best sellers highlight
- Sync button → pulls from Salla API

### 2.4 Loyalty

```
No new table needed — reads from Salla API:
GET /customers/loyalty/points?customer_id=X
```

**Page features:**
- Loyalty leaderboard: top point holders
- Points issued vs redeemed chart
- Expiring points alert list
- Per-customer loyalty history in their detail view
- Manual adjust points (via PUT endpoint)

### 2.5 Reviews

```
Table: reviews
├── id (salla_id, integer)
├── client_id → clients.id
├── type (product, shipping, store, blog)
├── rating (1-5)
├── content
├── customer_name, customer_avatar
├── product_name (if type=product)
├── order_reference
├── is_published
├── likes_count
├── images (jsonb array)
└── created_at
```

**Page features:**
- Star-rating distribution bar (5★ ████████ 4★★█ 3★█ ...)
- Filter by type/stars/date/product
- Reply-to-review inline (if scope allows write)
- Sentiment tagging (auto or manual)
- Review-to-task button ("Follow up on this")

---

## 3 · REAL SALLA OAUTH CONNECTION

### 3.1 The Flow (Custom Mode)

```
[Data & Sources page]
       │
       │ User clicks "Connect Salla"
       ▼
[Cloudflare Function: /api/salla/connect]
       │
       │ Returns authorize URL:
       │ https://accounts.salla.sa/oauth2/auth
       │   ?client_id={SALLA_CLIENT_ID}
       │   &scope=customers.read+orders.read+products.read+reviews.read+carts.read+offline_access
       │   &redirect_uri={origin}/api/salla/callback
       │   &state={random_csrf_token}
       │
       ▼ [browser redirects to Salla login]
[Salla Authorization Server]
       │
       │ Merchant logs in + grants scopes
       │
       ▼ [redirects back with ?code=xxx&state=xxx]
[Cloudflare Function: /api/salla/callback]
       │
       │ POST accounts.salla.sa/oauth2/token
       │   {client_id, client_secret, code, grant_type: 'authorization_code'}
       │ Receives: {access_token, refresh_token, expires}
       │
       │ Stores tokens in integration_tokens table (service-role only)
       │ Fetches merchant info from /oauth2/user/info
       │ Creates/updates client row with Salla store details
       │
       ▼ [redirects back to /data with ?connected=salla&status=success]
[Data & Sources page shows "Connected ✓"]
```

### 3.2 Token Refresh Worker

Access tokens expire every 14 days. A scheduled Worker runs daily:

```sql
-- Find tokens expiring within 3 days
SELECT * FROM integration_tokens 
WHERE platform = 'salla' 
AND expires_at < now() + interval '3 days'
```

Refreshes each one via POST to token endpoint with refresh_token. Updates stored tokens.

### 3.3 Secrets Needed (set once by owner)

```powershell
npx wrangler pages secret put SALLA_CLIENT_ID --project-name afkar-growth-os
npx wrangler pages secret put SALLA_CLIENT_SECRET --project-name afkar-growth-os
```

These come from [Salla Partners Portal](https://salla.partners) → your App → Credentials.

---

## 4 · CLIENT REPORT ENGINE (fixing your concern)

You're right — the report should be a **data-driven engine**, not hardcoded HTML. Here's how it works:

```
┌─────────────────────────────────────────────┐
│           REPORT GENERATOR                  │
│                                             │
│  INPUTS (all automatic):                    │
│  ├── KPI snapshots (revenue, ROAS...)      │
│  ├── Campaign metrics (spend, revenue)     │
│  ├── Task completion rates                 │
│  ├── Product funnel stats                   │
│  ├── Customer segments                      │
│  └── Review ratings                         │
│                                             │
│  AUTO-GENERATES:                            │
│  ├── Executive summary text                 │
│  ├── What's working (green KPIs)           │
│  ├── Needs attention (red/orange KPIs)     │
│  ├── Next week recommendations              │
│  └── Platform breakdown                     │
│                                             │
│  HUMAN LAYER (editable on top):             │
│  ├── Override executive summary             │
│  ├── Add custom wins/concerns               │
│  ├── Set next week focus                    │
│  └── Saved per week, versioned              │
│                                             │
│  OUTPUT:                                    │
│  ├── On-screen report (beautiful)          │
│  ├── Print/PDF export                       │
│  └── Shareable link (future)                │
└─────────────────────────────────────────────┘
```

**What changes in code:**

1. **New table:** `client_reports` (already designed in previous round, needs schema run)
2. **Report generator service** (`src/lib/reportEngine.ts`):
   - Takes `clientId`, `weekStart`, `weekEnd`
   - Queries all relevant tables
   - Computes deltas, identifies winners/losers
   - Generates narrative text using templates
   - Returns structured JSON
3. **Report.tsx renders from structured data**, not from hardcoded JSX blocks
4. **Edit mode** overrides any generated field
5. When Salla is connected: report pulls real orders/customers/products instead of manual KPI entries

---

## 5 · FIXING EXISTING INTEGRATIONS CODE

| Issue | Fix |
|---|---|
| `functions/api/integrations/status.ts` checks env vars that don't match Salla naming | Rename to `SALLA_CLIENT_ID`, `SALLA_CLIENT_SECRET`, `SALLA_REFRESH_TOKEN`, `SALLA_STORE_ID` |
| No OAuth callback handler exists | Build `/api/salla/connect` + `/api/salla/callback` functions |
| Puller worker writes to `kpi_snapshots` directly but doesn't know about campaigns | Puller now also upserts `campaign_metrics` rows so the Campaigns page gets real data too |
| No webhook receiver | Build `/api/webhooks/salla` function to receive `order.created`, `customer.updated`, `abandoned_cart.created` events |
| Missing `integration_tokens` table for secure token storage | New schema table |

---

## 6 · WEBHOOKS (real-time updates from Salla)

When our app is published on the Salla App Store, merchants who install it trigger webhooks:

| Webhook Event | What We Do |
|---|---|
| `order.created` | Create order row, update revenue KPI, notify if high-value |
| `order.status.updated` | Update order status, notify if delivered |
| `customer.created` | Create customer row, update customer count KPI |
| `product.created` | Create product row |
| `review.created` | Create review row, notify if ≤2 stars |
| `abandoned_cart.created` | Track cart abandonment count |

Webhook receiver function validates the incoming payload, matches it to the correct client via the merchant's store ID, and writes to the appropriate table.

---

## 7 · BUILD ORDER & TIMELINE

| Phase | What | Depends On |
|---|---|---|
| **Phase A** — Schema + OAuth | New tables (customers, orders, store_products, reviews, integration_tokens, platform_accounts) · OAuth connect/callback functions · Token refresh worker | You create Salla Partner app |
| **Phase B** — Sync Worker | Scheduled puller: fetches customers, orders, products, reviews from Salla API daily · Writes to tables | Phase A + secrets set |
| **Phase C** — Pages | Customers page · Orders page · Products page (Salla catalog) · Reviews page · Loyalty page | Phase B data exists |
| **Phase D** — Webhooks | Webhook receiver function · Real-time notifications when events fire | Phase A |
| **Phase E** — Report Engine v2 | Report generator queries ALL new data sources · Auto-narrative includes customer/order/product insights | Phases B+C |
| **Phase F** — Polish | Loyalty leaderboard charts · Review sentiment tagging · Export buttons | Phase E |

---

## 8 · WHAT I NEED FROM YOU

| Step | What | Where |
|---|---|---|
| **1** | Create account on [Salla Partners](https://salla.partners) | salla.partners |
| **2** | Create an App: name "AFKAR Growth OS", set redirect_uri to `https://afkar-growth-os.pages.dev/api/salla/callback` | Partners Dashboard |
| **3** | Select scopes: `customers.read`, `orders.read`, `products.read`, `reviews.read`, `carts.read`, `offline_access` | App settings |
| **4** | Copy Client ID + Client Secret → give me ONLY the Client ID (never share secret in chat) | App credentials |
| **5** | Run the updated `schema.sql` when I push it | Supabase SQL Editor |
| **6** | Set `SALLA_CLIENT_ID` and `SALLA_CLIENT_SECRET` as Cloudflare Pages secrets | PowerShell |

---

## 💭 THE BIGGER VISION: TEMPLATING THIS AS A SAAS

Here's my honest assessment:

**What you've built is genuinely valuable.** Most Salla merchants (~200K stores) manage their growth through WhatsApp chaos, Google Sheets, and gut feeling. They have no idea what their ROAS is, no system for product research, no way to track whether their team actually did anything this week. You're solving a real problem.

**The template opportunity:**

Our app already has multi-tenant foundations (organizations → clients → RLS). The pivot from "internal tool" to "SaaS product" requires three things:

| Requirement | Current State | Gap |
|---|---|---|
| Multi-client support | ✅ Schema ready (org→clients) | Need UI switcher + RLS enforcement |
| Self-service onboarding | ❌ Admin creates users manually | Need signup flow + Salla app install = auto-onboarding |
| Billing | ❌ None | Salla App Store handles billing natively — publish there and they take care of subscriptions |

**The killer move:** Publish on the [Salla App Store](https://apps.salla.sa). When a merchant installs our app:
1. Easy Mode fires `app.store.authorize` webhook → we get access token automatically
2. We auto-create their client row, pull initial data, generate their first report
3. They see a beautiful dashboard within 60 seconds of installing
4. Zero manual setup for either you or the merchant

That's the difference between a consulting tool and a product.

**Pricing model:** Salla App Store supports subscription pricing. Charge 99–299 SAR/month depending on tier (Basic: dashboard + chat, Pro: + products/campaigns/reports, Enterprise: + loyalty/reviews/API access).

**Demo strategy:** Create a demo store with realistic data (which you already have), deploy to a clean URL, record a 2-minute Loom walkthrough showing: "Connect your store → see your revenue, ROAS, and team performance instantly → assign tasks → track products → get weekly reports." Send it to 20 Salla store owners in your network. If 3–5 say "how much?", you have product-market fit signal.

---

## 📊 FINAL SUMMARY

| What | Count |
|---|---|
| New database tables | 6 (customers, orders, store_products, reviews, integration_tokens, platform_accounts) |
| New Cloudflare Functions | 4 (connect, callback, webhook-receiver, token-refresh) |
| New pages | 5 (Customers, Orders, Products, Loyalty, Reviews) |
| Existing pages enhanced | 3 (Data & Sources rebuilt, Report engine v2, Product Research renamed) |
| New Worker | 1 (token refresh cron) |
| Owner steps | 5 (listed in section 7) |
| Estimated effort | 3–5 focused sessions |

---

Say **GO** and I start Phase A.