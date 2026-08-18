# AFKAR Growth OS

A single-client growth operations app for **Afkar Modern** (afkar-modern.com).

Tracks KPIs, objectives, weekly plans, tasks, insights, client reporting, and a
command center — all in one place, all fully working, all E2E-verified.

## Stack

- Vite 8 + React 19 + TypeScript + Tailwind CSS 4
- Data lives in **Supabase** (Postgres). The store bootstraps from the backend on
  load and every mutation writes through to it. No browser localStorage is used.
- The current user is derived from the backend `profiles` table (no login UI
  yet — the first active admin is used).
- Data entry today: manual/CSV, **Excel (.xlsx) import + export**, and **Google
  Sheets** sync (link only, no API key required).
- Real API integrations (Salla, Google Ads, TikTok Ads, Snapchat Ads) are wired as
  connection slots with honest setup docs on the Data page; live sync needs a
  server-side token proxy (see Deployment).

## Develop

```bash
npm install
npm run dev       # http://localhost:5173
npm run lint
npm run build
```

## Database (Supabase)

Run `supabase/schema.sql` in the Supabase SQL Editor. It is idempotent and
creates every table (organizations, clients, profiles, client_assignments,
tasks, weekly_objectives, key_results, kpi_definitions, kpi_snapshots,
kpi_targets, notifications, activity_logs, connections, sync_runs) plus RLS
policies and baseline seed data (1 org, 1 client, 2 admin users, testing users,
tasks, objectives, KPIs, snapshots, connections).

RLS currently grants anon + authenticated full access because there is no
login yet — tighten the policies when authentication is added.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` (local dev)
and as Cloudflare Pages env vars (production).

## Testing

`smoke_test.py` (Playwright) drives the built app and asserts every feature
loads from the backend and renders. `verify_backend.py` checks the full data
surface (KPIs, tasks, team, report) and write-through.

```bash
# build first, then with the dev/preview server running on :5173
python smoke_test.py
```

## Deployment — Cloudflare Pages + Supabase

The app is a static SPA: `npm run build` outputs `dist/`, and
`public/_redirects` gives SPA fallback. It deploys as-is to Cloudflare Pages.

> We use **separate Cloudflare and Supabase accounts** so the Ghazi Portal's
> free-tier allowances are never affected.

### 1. GitHub

Push this repo to your GitHub account (same account is fine — Pages projects
are per-repo, and this repo is separate from `ghazi-portal`).

### 2. Cloudflare Pages (new account or new user under an existing account)

1. Create the new Cloudflare account (or a fresh user) — do **not** reuse the
   Ghazi account.
2. **Workers & Pages → Create → Pages → Connect to Git**.
3. Pick this repo. Build settings:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Save and deploy. You get a free `https://<project>.pages.dev` URL.

### 3. Supabase (new project under the new account)

1. Create the new Supabase account → new project.
2. Run `supabase/schema.sql` in the SQL Editor.
3. Copy the project URL + anon key into Cloudflare Pages env vars
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and rebuild.
4. Free-tier note: projects **pause after 7 days of inactivity** — a keep-alive
   cron Worker (`afkar-supabase-keeper`) pings the project every 15 minutes so
   it never pauses.

### Live API sync (Salla / Google Ads / TikTok / Snapchat)

Client-side direct calls would leak tokens and hit CORS. Production sync runs
through a server-side proxy (Cloudflare Pages Function or Supabase Edge
Function) that holds the secrets and refreshes tokens. The Data page setup text
per source documents the exact app/scopes to request.

## Data shape

KPIs snapshot daily per source (manual, excel, google_sheets, and API sources),
keeping full history for the client report and insights.