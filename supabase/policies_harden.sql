-- ══════════════════════════════════════════════════════════════
-- AFKAR ARMOR — RLS hardening + schema upgrades for Phase 2/3
-- Run once in Supabase SQL Editor. Idempotent (safe to re-run).
-- ══════════════════════════════════════════════════════════════

-- ── 1. THE CROWN JEWELS: integration_tokens → service role ONLY.
--    No browser JWT may ever read store access/refresh tokens again.
drop policy if exists "team full access integration_tokens" on public.integration_tokens;

-- ── 2. platform_accounts: enable RLS (was never enabled!) + lock down.
alter table public.platform_accounts enable row level security;
drop policy if exists "team full access platform_accounts" on public.platform_accounts;

-- ── 3. Salla data tables: everyone on the team may READ,
--    but only STAFF roles may WRITE. viewer role becomes read-only in the DB,
--    not just in the UI. Uses the existing my_role() helper.
do $$
declare t text;
begin
  foreach t in array array[
    'customers','orders','store_products','reviews',
    'shipments','order_sla','order_timeline','abandoned_carts'
  ] loop
    execute format('drop policy if exists "team full access %I" on public.%I', t, t);
    execute format(
      'create policy "%s read team" on public.%I for select to authenticated using (true)',
      t, t);
    execute format(
      'create policy "%s staff write" on public.%I for all to authenticated using (public.my_role() in (''super_admin'',''account_manager'',''media_buyer'')) with check (public.my_role() in (''super_admin'',''account_manager'',''media_buyer''))',
      t, t);
  end loop;
end $$;

-- ── 4. Shipments: widen status to Salla's real 16-state vocabulary.
alter table public.shipments drop constraint if exists shipments_status_check;
alter table public.shipments add constraint shipments_status_check
  check (status in (
    'creating','created','updated','cancelled','delivered',            -- legacy AFKAR values
    'in_progress','in_transit','received_at_final_hub','to_be_reattempted',
    'reattempted','unable_to_deliver','delivering','shipped',
    'partially_delivered','lost','damaged','return_to_origin','return_in_progress'
  ));

-- ── 5. Abandoned carts: columns the Recovery Engine needs.
alter table public.abandoned_carts add column if not exists checkout_url text;
alter table public.abandoned_carts add column if not exists customer_name text;
alter table public.abandoned_carts add column if not exists customer_mobile text;
alter table public.abandoned_carts add column if not exists customer_email text;
alter table public.abandoned_carts add column if not exists coupon_code text;
alter table public.abandoned_carts add column if not exists age_minutes integer;
alter table public.abandoned_carts add column if not exists last_contacted_at timestamptz;

-- ── 6. Orders: reference column (if not already added).
alter table public.orders add column if not exists reference text;

-- ── 7. Timezone correction for previously-stored order dates
--    (wall time was stored as UTC; Riyadh = UTC+3). RUN ONCE ONLY.
--    ⚠️ Skip this block if you already ran it earlier today.
-- UPDATE public.orders SET date_created   = date_created   - INTERVAL '3 hours' WHERE date_created   IS NOT NULL;
-- UPDATE public.orders SET date_completed = date_completed - INTERVAL '3 hours' WHERE date_completed IS NOT NULL;
