# AFKAR Growth OS

A single-client growth operations app for **Afkar Modern** (afkar-modern.com).

Tracks KPIs, objectives, weekly plans, tasks, insights, client reporting, and a
command center — all in one place, all fully working, all E2E-verified.

## Stack

- Vite 8 + React 19 + TypeScript + Tailwind CSS 4
- Local-first state in `localStorage` (key `afkar-growth-os:v1`) with versioned,
  merge-safe migrations — the app works with **zero backend**.
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

### Local-first seed

The store auto-seeds real business data for Afkar Modern on first run. Bump the
seed version in `src/data/seed.ts` when the KPI definitions change; the
migration merges definitions and preserves user connections/config.

## Testing

`smoke_test.py` (Playwright) drives the built app and asserts every feature
works. It uses an isolated browser context, so test mutations never touch your
real data.

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

The app runs without Supabase today — the client is gated behind
`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`. Supabase becomes the home of the
server-side sync backend (token proxy + history) when real API sync is turned
on:

1. Create the new Supabase account → new project.
2. Copy the project URL + anon key into Cloudflare Pages env vars
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and rebuild.
3. Free-tier note: projects **pause after 7 days of inactivity** — the Ghazi
   Portal solved this with a keep-alive cron Worker; do the same here if you
   need the backend always warm.

### Live API sync (Salla / Meta / TikTok / Snap)

Client-side direct calls would leak tokens and hit CORS. Production sync runs
through a server-side proxy (Cloudflare Pages Function or Supabase Edge
Function) that holds the secrets and refreshes tokens. The Data page setup text
per source documents the exact app/scopes to request.

## Data shape

KPIs snapshot daily per source (manual, excel, google_sheets, and API sources),
keeping full history for the client report and insights.