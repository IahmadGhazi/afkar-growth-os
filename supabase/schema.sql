-- ============================================================
-- AFKAR GROWTH OS - Supabase schema
-- Run this in the Supabase SQL Editor. Idempotent and additive.
-- Tables mirror src/types/database.ts. No login/auth yet: the app
-- reads/writes with the anon key, so RLS grants anon + authenticated
-- full access for now. Tighten policies when auth lands.
-- ============================================================

-- ---------- ENUMS ----------
do $$ begin
  create type user_role as enum ('super_admin','account_manager','owner','seo','media_buyer','social_media','designer','product_research','viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('backlog','planned','in_progress','review','approved','done','blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('critical','high','medium','low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type department as enum ('seo','media','social','design','product_research','management');
exception when duplicate_object then null; end $$;

-- ---------- ORGANIZATIONS ----------
create table if not exists public.organizations (
  id text primary key,
  name text not null,
  slug text not null unique,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- CLIENTS ----------
create table if not exists public.clients (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  domain text,
  status text not null default 'active' check (status in ('active','paused','archived')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

-- ---------- PROFILES (the team / users) ----------
create table if not exists public.profiles (
  id text primary key,
  organization_id text references public.organizations(id) on delete set null,
  email text not null,
  full_name text,
  avatar_url text,
  role user_role not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- CLIENT ASSIGNMENTS ----------
create table if not exists public.client_assignments (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  client_id text not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);

-- ---------- TASKS ----------
create table if not exists public.tasks (
  id text primary key,
  client_id text not null references public.clients(id) on delete cascade,
  playbook_instance_id text,
  title text not null,
  description text,
  brief text,
  expected_output text,
  success_criteria text,
  status task_status not null default 'backlog',
  priority task_priority not null default 'medium',
  assignee_id text references public.profiles(id) on delete set null,
  reviewer_id text references public.profiles(id) on delete set null,
  created_by text references public.profiles(id) on delete set null,
  department department,
  due_date date,
  started_at timestamptz,
  completed_at timestamptz,
  result text,
  blocked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- WEEKLY OBJECTIVES ----------
create table if not exists public.weekly_objectives (
  id text primary key,
  client_id text not null references public.clients(id) on delete cascade,
  title text not null,
  description text,
  week_start date not null,
  week_end date not null,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  progress_pct numeric not null default 0,
  created_by text references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- KEY RESULTS ----------
create table if not exists public.key_results (
  id text primary key,
  objective_id text not null references public.weekly_objectives(id) on delete cascade,
  client_id text not null references public.clients(id) on delete cascade,
  title text not null,
  metric_name text,
  metric_target numeric,
  metric_current numeric,
  metric_unit text,
  status text not null default 'on_track' check (status in ('on_track','at_risk','behind','achieved','missed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- KPI DEFINITIONS ----------
create table if not exists public.kpi_definitions (
  id text primary key,
  client_id text not null references public.clients(id) on delete cascade,
  name text not null,
  department department,
  unit text check (unit in ('currency','percentage','count','ratio')),
  direction text check (direction in ('higher_better','lower_better','target')),
  source text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- KPI SNAPSHOTS ----------
create table if not exists public.kpi_snapshots (
  id text primary key,
  kpi_id text not null references public.kpi_definitions(id) on delete cascade,
  client_id text not null references public.clients(id) on delete cascade,
  snapshot_date date not null,
  value numeric not null,
  source text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- KPI TARGETS ----------
create table if not exists public.kpi_targets (
  id text primary key,
  kpi_id text not null references public.kpi_definitions(id) on delete cascade,
  client_id text not null references public.clients(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  target_value numeric not null,
  created_at timestamptz not null default now()
);

-- ---------- NOTIFICATIONS ----------
create table if not exists public.notifications (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  client_id text references public.clients(id) on delete set null,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- ACTIVITY LOGS ----------
create table if not exists public.activity_logs (
  id text primary key,
  user_id text references public.profiles(id) on delete set null,
  client_id text references public.clients(id) on delete set null,
  entity_type text not null,
  entity_id text,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ---------- CHAT MESSAGES ----------
create table if not exists public.messages (
  id text primary key,
  client_id text not null references public.clients(id) on delete cascade,
  author_id text not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------- PRODUCT RESEARCH (the funnel: many discovered, few win) ----------
create table if not exists public.product_candidates (
  id text primary key,
  client_id text not null references public.clients(id) on delete cascade,
  name text not null,
  category text,
  source_url text,
  competitor text,
  estimated_price numeric,
  demand_evidence text,
  notes text,
  score_demand integer check (score_demand between 0 and 10),
  score_competition integer check (score_competition between 0 and 10),
  score_margin integer check (score_margin between 0 and 10),
  score_creative integer check (score_creative between 0 and 10),
  score_brand_fit integer check (score_brand_fit between 0 and 10),
  score_trend integer check (score_trend between 0 and 10),
  status text not null default 'discovered' check (status in (
    'discovered','filtered','validating','shortlisted','testing','winner','scaled','killed'
  )),
  decision_notes text,
  researcher_id text references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- CAMPAIGNS ----------
create table if not exists public.campaigns (
  id text primary key,
  client_id text not null references public.clients(id) on delete cascade,
  name text not null,
  platform text not null default 'other' check (platform in ('google_ads','tiktok_ads','snap_ads','salla','other')),
  status text not null default 'planned' check (status in ('planned','active','paused','completed','archived')),
  budget numeric,
  objective text,
  start_date date,
  end_date date,
  created_by text references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- CAMPAIGN METRICS (the media buyer's daily log) ----------
create table if not exists public.campaign_metrics (
  id text primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  client_id text not null references public.clients(id) on delete cascade,
  date date not null,
  impressions integer not null default 0,
  clicks integer not null default 0,
  spend numeric not null default 0,
  purchases integer not null default 0,
  revenue numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- TASK COMMENTS (the handoff conversation) ----------
create table if not exists public.task_comments (
  id text primary key,
  task_id text not null references public.tasks(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- ---------- CONNECTIONS ----------
create table if not exists public.connections (
  id text primary key,
  client_id text references public.clients(id) on delete cascade,
  connected boolean not null default false,
  last_sync_at timestamptz,
  sync_error text,
  config jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- SYNC RUNS ----------
create table if not exists public.sync_runs (
  id text primary key,
  source text not null,
  status text not null check (status in ('success','error')),
  row_count integer not null default 0,
  error text,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Additive migration for DBs created before this column existed.
alter table public.sync_runs add column if not exists created_at timestamptz not null default now();

-- ============================================================
-- RLS
-- No login yet: grant anon + authenticated full access so the app
-- (which uses the anon key) works end to end. Replace these with
-- per-user / per-org policies when authentication is added.
-- ============================================================
alter table public.organizations enable row level security;
alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.client_assignments enable row level security;
alter table public.tasks enable row level security;
alter table public.weekly_objectives enable row level security;
alter table public.key_results enable row level security;
alter table public.kpi_definitions enable row level security;
alter table public.kpi_snapshots enable row level security;
alter table public.kpi_targets enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.messages enable row level security;
alter table public.product_candidates enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_metrics enable row level security;
alter table public.task_comments enable row level security;
alter table public.connections enable row level security;
alter table public.sync_runs enable row level security;

do $$ begin
  create policy "anon full access organizations" on public.organizations for all to anon using (true) with check (true);
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  create policy "anon full access clients" on public.clients for all to anon using (true) with check (true);
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  create policy "anon full access profiles" on public.profiles for all to anon using (true) with check (true);
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  create policy "anon full access client_assignments" on public.client_assignments for all to anon using (true) with check (true);
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  create policy "anon full access tasks" on public.tasks for all to anon using (true) with check (true);
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  create policy "anon full access weekly_objectives" on public.weekly_objectives for all to anon using (true) with check (true);
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  create policy "anon full access key_results" on public.key_results for all to anon using (true) with check (true);
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  create policy "anon full access kpi_definitions" on public.kpi_definitions for all to anon using (true) with check (true);
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  create policy "anon full access kpi_snapshots" on public.kpi_snapshots for all to anon using (true) with check (true);
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  create policy "anon full access kpi_targets" on public.kpi_targets for all to anon using (true) with check (true);
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  create policy "anon full access notifications" on public.notifications for all to anon using (true) with check (true);
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  create policy "anon full access activity_logs" on public.activity_logs for all to anon using (true) with check (true);
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  create policy "anon full access messages" on public.messages for all to anon using (true) with check (true);
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  create policy "anon full access product_candidates" on public.product_candidates for all to anon using (true) with check (true);
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  create policy "anon full access campaigns" on public.campaigns for all to anon using (true) with check (true);
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  create policy "anon full access campaign_metrics" on public.campaign_metrics for all to anon using (true) with check (true);
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  create policy "anon full access task_comments" on public.task_comments for all to anon using (true) with check (true);
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  create policy "anon full access connections" on public.connections for all to anon using (true) with check (true);
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  create policy "anon full access sync_runs" on public.sync_runs for all to anon using (true) with check (true);
exception when duplicate_object then null; when others then null; end $$;

-- ============================================================
-- SEED DATA
-- One org, one client. 2 admin users + the rest as testing users.
-- ============================================================
insert into public.organizations (id, name, slug, settings, created_at, updated_at)
values ('org_afkar', 'AFKAR Growth', 'afkar-growth', '{"notify_task_assignments":true,"notify_review":true,"notify_overdue":true}', now(), now())
on conflict (id) do nothing;

insert into public.clients (id, organization_id, name, slug, domain, status, settings, created_at, updated_at)
values ('cli_afkar', 'org_afkar', 'Afkar Modern', 'afkar-modern', 'afkar-modern.com', 'active',
        '{"platform":"salla","industry":"wall-art-furniture","abandoned_carts":70000}', now(), now())
on conflict (id) do nothing;

-- 2 ADMIN users
insert into public.profiles (id, organization_id, email, full_name, avatar_url, role, is_active, created_at, updated_at) values
  ('usr_omar', 'org_afkar', 'ibrahim@afkar-growth.com', 'Ibrahim', null, 'super_admin', true, now(), now()),
  ('usr_ahmad', 'org_afkar', 'ahmad@afkar-growth.com', 'Ahmad', null, 'account_manager', true, now(), now())
on conflict (id) do nothing;

-- testing users
insert into public.profiles (id, organization_id, email, full_name, avatar_url, role, is_active, created_at, updated_at) values
  ('usr_sara', 'org_afkar', 'sara@afkar-growth.com', 'Sara', null, 'seo', true, now(), now()),
  ('usr_mohammed', 'org_afkar', 'mohammed@afkar-growth.com', 'Mohammed', null, 'product_research', true, now(), now()),
  ('usr_ali', 'org_afkar', 'ali@afkar-growth.com', 'Ali', null, 'media_buyer', true, now(), now()),
  ('usr_fatima', 'org_afkar', 'fatima@afkar-growth.com', 'Fatima', null, 'social_media', true, now(), now())
on conflict (id) do nothing;

insert into public.client_assignments (id, user_id, client_id, created_at) values
  ('ca_1', 'usr_omar', 'cli_afkar', now()),
  ('ca_2', 'usr_ahmad', 'cli_afkar', now()),
  ('ca_3', 'usr_sara', 'cli_afkar', now()),
  ('ca_4', 'usr_mohammed', 'cli_afkar', now()),
  ('ca_5', 'usr_ali', 'cli_afkar', now()),
  ('ca_6', 'usr_fatima', 'cli_afkar', now())
on conflict (id) do nothing;

-- Tasks
insert into public.tasks (id, client_id, playbook_instance_id, title, description, brief, expected_output, success_criteria, status, priority, assignee_id, reviewer_id, created_by, department, due_date, started_at, completed_at, result, blocked_reason, created_at, updated_at) values
  ('task_01', 'cli_afkar', null, 'Create 3 creatives for wall-art campaign', 'High-converting creatives for the winning wall-art products', 'Use the National Day palette, focus on living room setups', '3 static + 2 video creatives', 'ROAS above 4 in the first test window', 'in_progress', 'high', 'usr_ahmad', 'usr_omar', 'usr_omar', 'design', now(), now(), null, null, null, now(), now()),
  ('task_02', 'cli_afkar', null, 'Review SEO keyword opportunities', 'Validate the commercial keywords list from this weeks research', null, 'Approved keyword list with priority tags', 'Top 20 keywords tagged and assigned', 'planned', 'medium', 'usr_sara', 'usr_omar', 'usr_omar', 'seo', now() + interval '1 day', null, null, null, null, now(), now()),
  ('task_03', 'cli_afkar', null, 'Finalize product research shortlist', 'Score and shortlist the discovered wall-art products', '40 discovered, shortlist to top 10', 'Top 10 shortlist with scores', 'Every product scored on all 6 dimensions', 'blocked', 'critical', 'usr_mohammed', 'usr_omar', 'usr_omar', 'product_research', now() - interval '2 days', now(), null, null, 'Waiting for supplier pricing confirmation', now(), now()),
  ('task_04', 'cli_afkar', null, 'Launch Meta campaign for new products', 'Test the approved products against the retargeting audience', null, 'Live campaign with 2 ad sets', 'At least 1,000 impressions in 48h', 'planned', 'high', 'usr_ali', 'usr_omar', 'usr_omar', 'media', now() + interval '2 days', null, null, null, null, now(), now()),
  ('task_05', 'cli_afkar', null, 'Create 5 Instagram reels', 'Reels showcasing the living room wall-art collections', 'UGC style, before/after transitions', '5 published reels', '500+ reach each', 'planned', 'medium', 'usr_fatima', 'usr_omar', 'usr_omar', 'social', now() + interval '3 days', null, null, null, null, now(), now()),
  ('task_06', 'cli_afkar', null, 'Optimize product pages for SEO', 'Meta tags, titles and internal links for top wall-art pages', null, '10 optimized pages', 'Click share improves by next week', 'in_progress', 'medium', 'usr_sara', 'usr_omar', 'usr_omar', 'seo', now() + interval '4 days', now(), null, null, null, now(), now()),
  ('task_07', 'cli_afkar', null, 'Test 3 winning creatives', 'Put the 3 approved creatives into paid testing', null, 'Performance data for the 3 creatives', 'Clear winner identified after 7 days', 'review', 'high', 'usr_ali', 'usr_omar', 'usr_omar', 'media', now() + interval '1 day', now(), null, 'Waiting on reviewer sign-off', null, now(), now()),
  ('task_08', 'cli_afkar', null, 'Research 40 wall-art products', 'Discover high-demand wall-art products in the Saudi market', null, '40 discovered products with sources', 'Each product has demand evidence', 'done', 'medium', 'usr_mohammed', 'usr_omar', 'usr_omar', 'product_research', now() - interval '3 days', now(), now(), '40 products discovered, 15 qualified', null, now(), now()),
  ('task_09', 'cli_afkar', null, 'National Day landing page (SEO)', 'Create the national-day-offers category page', 'Target: "\u0639\u0631\u0648\u0636 \u0627\u0644\u064a\u0648\u0645 \u0627\u0644\u0648\u0637\u0646\u064a" keywords, internal links from menu and footer', 'Published landing page', 'Indexed and ranking for the offer keywords', 'in_progress', 'high', 'usr_sara', 'usr_omar', 'usr_omar', 'seo', now() + interval '2 days', now(), null, null, null, now(), now()),
  ('task_10', 'cli_afkar', null, 'National Day store banners', '3 banners in the National Day palette for the store', 'Green and gold, luxury furniture feel', '3 store banners', 'Approved and live on Salla', 'review', 'high', 'usr_ahmad', 'usr_omar', 'usr_omar', 'design', now(), now(), null, '2 versions delivered, awaiting approval', null, now(), now()),
  ('task_11', 'cli_afkar', null, 'Cart abandonment retargeting campaign', 'Build a retargeting campaign for the 70k+ abandoned carts', 'Custom audience from Salla add-to-cart events', 'Retargeting campaign live', 'Reclaims 10% of abandoned carts', 'planned', 'critical', 'usr_ali', 'usr_omar', 'usr_omar', 'media', now() + interval '5 days', null, null, null, null, now(), now()),
  ('task_12', 'cli_afkar', null, 'WhatsApp welcome series', 'Automated welcome message for new customers with a first-order code', 'Trigger: purchase or signup on Salla', 'Flow documented and live', '30% open rate on the welcome message', 'backlog', 'medium', 'usr_fatima', 'usr_omar', 'usr_omar', 'social', now() + interval '7 days', null, null, null, null, now(), now()),
  ('task_13', 'cli_afkar', null, 'Design product research templates', 'A template for scoring and shortlisting products', null, 'Reusable scoring template', 'Used by research team weekly', 'backlog', 'low', 'usr_ahmad', null, 'usr_omar', 'design', now() + interval '6 days', null, null, null, null, now(), now()),
  ('task_14', 'cli_afkar', null, 'Analyze daily ad spend spikes', 'Investigate why spend spikes to 700-800 and drops near zero', null, 'Root cause note on campaign delivery', 'Explanation recorded, budget smoothed', 'planned', 'high', 'usr_ali', 'usr_omar', 'usr_omar', 'media', now() + interval '1 day', null, null, null, null, now(), now())
on conflict (id) do nothing;

-- Weekly objective + key results
insert into public.weekly_objectives (id, client_id, title, description, week_start, week_end, status, progress_pct, created_by, created_at, updated_at) values
  ('obj_week_1', 'cli_afkar', 'Grow revenue while protecting ROAS', 'Scale the winning wall-art products, test new creatives and reclaim abandoned carts ahead of National Day.', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 'active', 65, 'usr_omar', now(), now())
on conflict (id) do nothing;

insert into public.key_results (id, objective_id, client_id, title, metric_name, metric_target, metric_current, metric_unit, status, created_at, updated_at) values
  ('kr_1', 'obj_week_1', 'cli_afkar', 'Hold ROAS above 12 while scaling spend', 'ROAS', 12, 14.27, 'x', 'achieved', now(), now()),
  ('kr_2', 'obj_week_1', 'cli_afkar', 'Test 5 new creatives', 'Creatives tested', 5, 3, '', 'on_track', now(), now()),
  ('kr_3', 'obj_week_1', 'cli_afkar', 'Shortlist 10 products', 'Products shortlisted', 10, 8, '', 'at_risk', now(), now()),
  ('kr_4', 'obj_week_1', 'cli_afkar', 'Complete 8 SEO actions', 'SEO actions', 8, 6, '', 'on_track', now(), now())
on conflict (id) do nothing;

-- KPI definitions
insert into public.kpi_definitions (id, client_id, name, department, unit, direction, source, is_active, created_at, updated_at) values
  ('kpi_revenue', 'cli_afkar', 'Revenue', 'management', 'currency', 'higher_better', 'salla', true, now(), now()),
  ('kpi_orders', 'cli_afkar', 'Orders', 'management', 'count', 'higher_better', 'salla', true, now(), now()),
  ('kpi_aov', 'cli_afkar', 'AOV', 'management', 'currency', 'higher_better', 'salla', true, now(), now()),
  ('kpi_roas', 'cli_afkar', 'ROAS', 'media', 'ratio', 'higher_better', 'manual', true, now(), now()),
  ('kpi_spend', 'cli_afkar', 'Spend', 'media', 'currency', 'lower_better', 'manual', true, now(), now()),
  ('kpi_cac', 'cli_afkar', 'CAC', 'media', 'currency', 'lower_better', 'manual', true, now(), now()),
  ('kpi_conv', 'cli_afkar', 'Conversion Rate', 'management', 'percentage', 'higher_better', 'salla', true, now(), now()),
  ('kpi_organic', 'cli_afkar', 'Organic Sessions', 'seo', 'count', 'higher_better', 'search_console', true, now(), now()),
  ('kpi_content', 'cli_afkar', 'Content Output', 'social', 'count', 'higher_better', 'manual', true, now(), now()),
  ('kpi_salla_spend', 'cli_afkar', 'Salla Spend', 'media', 'currency', 'lower_better', 'salla', true, now(), now()),
  ('kpi_salla_sales', 'cli_afkar', 'Salla Sales', 'management', 'currency', 'higher_better', 'salla', true, now(), now()),
  ('kpi_snap_spend', 'cli_afkar', 'Snapchat Spend', 'media', 'currency', 'lower_better', 'snap_ads', true, now(), now()),
  ('kpi_snap_sales', 'cli_afkar', 'Snapchat Sales', 'management', 'currency', 'higher_better', 'snap_ads', true, now(), now()),
  ('kpi_tiktok_spend', 'cli_afkar', 'TikTok Spend', 'media', 'currency', 'lower_better', 'tiktok_ads', true, now(), now()),
  ('kpi_tiktok_sales', 'cli_afkar', 'TikTok Sales', 'management', 'currency', 'higher_better', 'tiktok_ads', true, now(), now()),
  ('kpi_google_spend', 'cli_afkar', 'Google Ads Spend', 'media', 'currency', 'lower_better', 'google_ads', true, now(), now()),
  ('kpi_google_sales', 'cli_afkar', 'Google Ads Sales', 'management', 'currency', 'higher_better', 'google_ads', true, now(), now()),
  ('kpi_add_to_cart', 'cli_afkar', 'Add to Cart', 'management', 'count', 'higher_better', 'salla', true, now(), now()),
  ('kpi_abandoned_carts', 'cli_afkar', 'Abandoned Carts', 'management', 'count', 'lower_better', 'salla', true, now(), now()),
  ('kpi_cart_conv', 'cli_afkar', 'Cart Conversion Rate', 'management', 'percentage', 'higher_better', 'salla', true, now(), now()),
  ('kpi_cart_recovery', 'cli_afkar', 'Cart Recovery Rate', 'management', 'percentage', 'higher_better', 'manual', true, now(), now()),
  ('kpi_new_customers', 'cli_afkar', 'New Customers', 'management', 'count', 'higher_better', 'salla', true, now(), now()),
  ('kpi_repeat_customers', 'cli_afkar', 'Repeat Customers', 'management', 'count', 'higher_better', 'salla', true, now(), now()),
  ('kpi_repeat_rate', 'cli_afkar', 'Repeat Purchase Rate', 'management', 'percentage', 'higher_better', 'manual', true, now(), now()),
  ('kpi_customer_list', 'cli_afkar', 'Customer List Size', 'management', 'count', 'higher_better', 'manual', true, now(), now())
on conflict (id) do nothing;

-- KPI targets
insert into public.kpi_targets (id, kpi_id, client_id, period_start, period_end, target_value, created_at) values
  ('target_revenue', 'kpi_revenue', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 1500000, now()),
  ('target_orders', 'kpi_orders', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 8000, now()),
  ('target_aov', 'kpi_aov', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 185, now()),
  ('target_roas', 'kpi_roas', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 15, now()),
  ('target_spend', 'kpi_spend', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 100000, now()),
  ('target_cac', 'kpi_cac', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 12, now()),
  ('target_conv', 'kpi_conv', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 3.5, now()),
  ('target_organic', 'kpi_organic', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 6000, now()),
  ('target_content', 'kpi_content', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 15, now()),
  ('target_salla_spend', 'kpi_salla_spend', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 16000, now()),
  ('target_salla_sales', 'kpi_salla_sales', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 520000, now()),
  ('target_snap_spend', 'kpi_snap_spend', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 26000, now()),
  ('target_snap_sales', 'kpi_snap_sales', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 340000, now()),
  ('target_tiktok_spend', 'kpi_tiktok_spend', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 32000, now()),
  ('target_tiktok_sales', 'kpi_tiktok_sales', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 320000, now()),
  ('target_google_spend', 'kpi_google_spend', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 29000, now()),
  ('target_google_sales', 'kpi_google_sales', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 270000, now()),
  ('target_add_to_cart', 'kpi_add_to_cart', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 90000, now()),
  ('target_abandoned_carts', 'kpi_abandoned_carts', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 60000, now()),
  ('target_cart_conv', 'kpi_cart_conv', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 12, now()),
  ('target_cart_recovery', 'kpi_cart_recovery', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 15, now()),
  ('target_new_customers', 'kpi_new_customers', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 520, now()),
  ('target_repeat_customers', 'kpi_repeat_customers', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 240, now()),
  ('target_repeat_rate', 'kpi_repeat_rate', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 30, now()),
  ('target_customer_list', 'kpi_customer_list', 'cli_afkar', (date_trunc('week', now()))::date, ((date_trunc('week', now()) + interval '6 days'))::date, 6000, now())
on conflict (id) do nothing;

-- KPI snapshots (6 weeks of history, ending this week)
insert into public.kpi_snapshots (id, kpi_id, client_id, snapshot_date, value, source, notes, created_at) values
  ('snap_kpi_revenue_0', 'kpi_revenue', 'cli_afkar', (date_trunc('week', now()) - interval '5 weeks')::date, 1020000, null, null, now()),
  ('snap_kpi_revenue_1', 'kpi_revenue', 'cli_afkar', (date_trunc('week', now()) - interval '4 weeks')::date, 1095000, null, null, now()),
  ('snap_kpi_revenue_2', 'kpi_revenue', 'cli_afkar', (date_trunc('week', now()) - interval '3 weeks')::date, 1178000, null, null, now()),
  ('snap_kpi_revenue_3', 'kpi_revenue', 'cli_afkar', (date_trunc('week', now()) - interval '2 weeks')::date, 1268000, null, null, now()),
  ('snap_kpi_revenue_4', 'kpi_revenue', 'cli_afkar', (date_trunc('week', now()) - interval '1 week')::date, 1320000, null, null, now()),
  ('snap_kpi_revenue_5', 'kpi_revenue', 'cli_afkar', (date_trunc('week', now()))::date, 1378810.8, 'manual', null, now()),
  ('snap_kpi_orders_0', 'kpi_orders', 'cli_afkar', (date_trunc('week', now()) - interval '5 weeks')::date, 5610, null, null, now()),
  ('snap_kpi_orders_1', 'kpi_orders', 'cli_afkar', (date_trunc('week', now()) - interval '4 weeks')::date, 6040, null, null, now()),
  ('snap_kpi_orders_2', 'kpi_orders', 'cli_afkar', (date_trunc('week', now()) - interval '3 weeks')::date, 6520, null, null, now()),
  ('snap_kpi_orders_3', 'kpi_orders', 'cli_afkar', (date_trunc('week', now()) - interval '2 weeks')::date, 7010, null, null, now()),
  ('snap_kpi_orders_4', 'kpi_orders', 'cli_afkar', (date_trunc('week', now()) - interval '1 week')::date, 7310, null, null, now()),
  ('snap_kpi_orders_5', 'kpi_orders', 'cli_afkar', (date_trunc('week', now()))::date, 7658, 'manual', null, now()),
  ('snap_kpi_aov_0', 'kpi_aov', 'cli_afkar', (date_trunc('week', now()) - interval '5 weeks')::date, 172, null, null, now()),
  ('snap_kpi_aov_1', 'kpi_aov', 'cli_afkar', (date_trunc('week', now()) - interval '4 weeks')::date, 174, null, null, now()),
  ('snap_kpi_aov_2', 'kpi_aov', 'cli_afkar', (date_trunc('week', now()) - interval '3 weeks')::date, 176, null, null, now()),
  ('snap_kpi_aov_3', 'kpi_aov', 'cli_afkar', (date_trunc('week', now()) - interval '2 weeks')::date, 178, null, null, now()),
  ('snap_kpi_aov_4', 'kpi_aov', 'cli_afkar', (date_trunc('week', now()) - interval '1 week')::date, 179, null, null, now()),
  ('snap_kpi_aov_5', 'kpi_aov', 'cli_afkar', (date_trunc('week', now()))::date, 180, 'manual', null, now()),
  ('snap_kpi_roas_0', 'kpi_roas', 'cli_afkar', (date_trunc('week', now()) - interval '5 weeks')::date, 11.9, null, null, now()),
  ('snap_kpi_roas_1', 'kpi_roas', 'cli_afkar', (date_trunc('week', now()) - interval '4 weeks')::date, 12.4, null, null, now()),
  ('snap_kpi_roas_2', 'kpi_roas', 'cli_afkar', (date_trunc('week', now()) - interval '3 weeks')::date, 13.0, null, null, now()),
  ('snap_kpi_roas_3', 'kpi_roas', 'cli_afkar', (date_trunc('week', now()) - interval '2 weeks')::date, 13.5, null, null, now()),
  ('snap_kpi_roas_4', 'kpi_roas', 'cli_afkar', (date_trunc('week', now()) - interval '1 week')::date, 13.9, null, null, now()),
  ('snap_kpi_roas_5', 'kpi_roas', 'cli_afkar', (date_trunc('week', now()))::date, 14.27, 'manual', null, now()),
  ('snap_kpi_spend_0', 'kpi_spend', 'cli_afkar', (date_trunc('week', now()) - interval '5 weeks')::date, 85700, null, null, now()),
  ('snap_kpi_spend_1', 'kpi_spend', 'cli_afkar', (date_trunc('week', now()) - interval '4 weeks')::date, 88300, null, null, now()),
  ('snap_kpi_spend_2', 'kpi_spend', 'cli_afkar', (date_trunc('week', now()) - interval '3 weeks')::date, 90600, null, null, now()),
  ('snap_kpi_spend_3', 'kpi_spend', 'cli_afkar', (date_trunc('week', now()) - interval '2 weeks')::date, 93900, null, null, now()),
  ('snap_kpi_spend_4', 'kpi_spend', 'cli_afkar', (date_trunc('week', now()) - interval '1 week')::date, 95400, null, null, now()),
  ('snap_kpi_spend_5', 'kpi_spend', 'cli_afkar', (date_trunc('week', now()))::date, 96630.41, 'manual', null, now()),
  ('snap_kpi_cac_0', 'kpi_cac', 'cli_afkar', (date_trunc('week', now()) - interval '5 weeks')::date, 15.2, null, null, now()),
  ('snap_kpi_cac_1', 'kpi_cac', 'cli_afkar', (date_trunc('week', now()) - interval '4 weeks')::date, 14.7, null, null, now()),
  ('snap_kpi_cac_2', 'kpi_cac', 'cli_afkar', (date_trunc('week', now()) - interval '3 weeks')::date, 14.0, null, null, now()),
  ('snap_kpi_cac_3', 'kpi_cac', 'cli_afkar', (date_trunc('week', now()) - interval '2 weeks')::date, 13.4, null, null, now()),
  ('snap_kpi_cac_4', 'kpi_cac', 'cli_afkar', (date_trunc('week', now()) - interval '1 week')::date, 12.9, null, null, now()),
  ('snap_kpi_cac_5', 'kpi_cac', 'cli_afkar', (date_trunc('week', now()))::date, 12.62, 'manual', null, now()),
  ('snap_kpi_conv_0', 'kpi_conv', 'cli_afkar', (date_trunc('week', now()) - interval '5 weeks')::date, 2.6, null, null, now()),
  ('snap_kpi_conv_1', 'kpi_conv', 'cli_afkar', (date_trunc('week', now()) - interval '4 weeks')::date, 2.7, null, null, now()),
  ('snap_kpi_conv_2', 'kpi_conv', 'cli_afkar', (date_trunc('week', now()) - interval '3 weeks')::date, 2.9, null, null, now()),
  ('snap_kpi_conv_3', 'kpi_conv', 'cli_afkar', (date_trunc('week', now()) - interval '2 weeks')::date, 3.0, null, null, now()),
  ('snap_kpi_conv_4', 'kpi_conv', 'cli_afkar', (date_trunc('week', now()) - interval '1 week')::date, 3.1, null, null, now()),
  ('snap_kpi_conv_5', 'kpi_conv', 'cli_afkar', (date_trunc('week', now()))::date, 3.2, 'manual', null, now()),
  ('snap_kpi_organic_0', 'kpi_organic', 'cli_afkar', (date_trunc('week', now()) - interval '5 weeks')::date, 4100, null, null, now()),
  ('snap_kpi_organic_1', 'kpi_organic', 'cli_afkar', (date_trunc('week', now()) - interval '4 weeks')::date, 4400, null, null, now()),
  ('snap_kpi_organic_2', 'kpi_organic', 'cli_afkar', (date_trunc('week', now()) - interval '3 weeks')::date, 4700, null, null, now()),
  ('snap_kpi_organic_3', 'kpi_organic', 'cli_afkar', (date_trunc('week', now()) - interval '2 weeks')::date, 5100, null, null, now()),
  ('snap_kpi_organic_4', 'kpi_organic', 'cli_afkar', (date_trunc('week', now()) - interval '1 week')::date, 5400, null, null, now()),
  ('snap_kpi_organic_5', 'kpi_organic', 'cli_afkar', (date_trunc('week', now()))::date, 5650, 'manual', null, now()),
  ('snap_kpi_content_0', 'kpi_content', 'cli_afkar', (date_trunc('week', now()) - interval '5 weeks')::date, 10, null, null, now()),
  ('snap_kpi_content_1', 'kpi_content', 'cli_afkar', (date_trunc('week', now()) - interval '4 weeks')::date, 11, null, null, now()),
  ('snap_kpi_content_2', 'kpi_content', 'cli_afkar', (date_trunc('week', now()) - interval '3 weeks')::date, 12, null, null, now()),
  ('snap_kpi_content_3', 'kpi_content', 'cli_afkar', (date_trunc('week', now()) - interval '2 weeks')::date, 13, null, null, now()),
  ('snap_kpi_content_4', 'kpi_content', 'cli_afkar', (date_trunc('week', now()) - interval '1 week')::date, 14, null, null, now()),
  ('snap_kpi_content_5', 'kpi_content', 'cli_afkar', (date_trunc('week', now()))::date, 15, 'manual', null, now())
on conflict (id) do nothing;

-- Platform KPI snapshots (only current week to keep this concise; extend as needed)
insert into public.kpi_snapshots (id, kpi_id, client_id, snapshot_date, value, source, notes, created_at) values
  ('snap_kpi_salla_spend_5', 'kpi_salla_spend', 'cli_afkar', (date_trunc('week', now()))::date, 15000, 'manual', null, now()),
  ('snap_kpi_salla_sales_5', 'kpi_salla_sales', 'cli_afkar', (date_trunc('week', now()))::date, 500000, 'manual', null, now()),
  ('snap_kpi_snap_spend_5', 'kpi_snap_spend', 'cli_afkar', (date_trunc('week', now()))::date, 24630.41, 'manual', null, now()),
  ('snap_kpi_snap_sales_5', 'kpi_snap_sales', 'cli_afkar', (date_trunc('week', now()))::date, 320000, 'manual', null, now()),
  ('snap_kpi_tiktok_spend_5', 'kpi_tiktok_spend', 'cli_afkar', (date_trunc('week', now()))::date, 30000, 'manual', null, now()),
  ('snap_kpi_tiktok_sales_5', 'kpi_tiktok_sales', 'cli_afkar', (date_trunc('week', now()))::date, 300000, 'manual', null, now()),
  ('snap_kpi_google_spend_5', 'kpi_google_spend', 'cli_afkar', (date_trunc('week', now()))::date, 27000, 'manual', null, now()),
  ('snap_kpi_google_sales_5', 'kpi_google_sales', 'cli_afkar', (date_trunc('week', now()))::date, 258810.8, 'manual', null, now()),
  ('snap_kpi_add_to_cart_5', 'kpi_add_to_cart', 'cli_afkar', (date_trunc('week', now()))::date, 78294, 'manual', null, now()),
  ('snap_kpi_abandoned_carts_5', 'kpi_abandoned_carts', 'cli_afkar', (date_trunc('week', now()))::date, 70636, 'manual', null, now()),
  ('snap_kpi_cart_conv_5', 'kpi_cart_conv', 'cli_afkar', (date_trunc('week', now()))::date, 9.8, 'manual', null, now()),
  ('snap_kpi_cart_recovery_5', 'kpi_cart_recovery', 'cli_afkar', (date_trunc('week', now()))::date, 8.2, 'manual', null, now()),
  ('snap_kpi_new_customers_5', 'kpi_new_customers', 'cli_afkar', (date_trunc('week', now()))::date, 462, 'manual', null, now()),
  ('snap_kpi_repeat_customers_5', 'kpi_repeat_customers', 'cli_afkar', (date_trunc('week', now()))::date, 214, 'manual', null, now()),
  ('snap_kpi_repeat_rate_5', 'kpi_repeat_rate', 'cli_afkar', (date_trunc('week', now()))::date, 24.5, 'manual', null, now()),
  ('snap_kpi_customer_list_5', 'kpi_customer_list', 'cli_afkar', (date_trunc('week', now()))::date, 554, 'manual', null, now())
on conflict (id) do nothing;

-- Connections
insert into public.connections (id, client_id, connected, last_sync_at, sync_error, config, created_at, updated_at) values
  ('salla', 'cli_afkar', false, null, null, null, now(), now()),
  ('google_ads', 'cli_afkar', false, null, null, null, now(), now()),
  ('tiktok_ads', 'cli_afkar', false, null, null, null, now(), now()),
  ('snap_ads', 'cli_afkar', false, null, null, null, now(), now()),
  ('excel', 'cli_afkar', false, null, null, null, now(), now()),
  ('google_sheets', 'cli_afkar', false, null, null, null, now(), now())
on conflict (id) do nothing;

-- Notifications
insert into public.notifications (id, user_id, client_id, type, title, body, link, is_read, created_at) values
  ('ntf_1', 'usr_omar', 'cli_afkar', 'task_review', '5 tasks awaiting review', 'Two creatives and a campaign test need your review', '/tasks', false, now()),
  ('ntf_2', 'usr_omar', 'cli_afkar', 'task_overdue', 'Product research shortlist overdue', 'Task "Finalize product research shortlist" is blocked', '/my-work', false, now())
on conflict (id) do nothing;

-- Sync log
insert into public.sync_runs (id, source, status, row_count, error, synced_at, created_at) values
  ('sync_1', 'manual', 'success', 8, null, now(), now())
on conflict (id) do nothing;

-- Chat messages (a few to start the conversation)
insert into public.messages (id, client_id, author_id, body, created_at) values
  ('msg_1', 'cli_afkar', 'usr_omar', 'Welcome everyone 👋 Let\u2019s keep all updates and handoffs here so nothing gets lost in WhatsApp.', now() - interval '2 days'),
  ('msg_2', 'cli_afkar', 'usr_ahmad', 'Perfect \u2014 I\u2019ll post the National Day banner files here once approved.', now() - interval '2 days' + interval '1 hour'),
  ('msg_3', 'cli_afkar', 'usr_sara', 'SEO landing page is live: /national-day-offers. Internal links added to menu + footer.', now() - interval '1 day'),
  ('msg_4', 'cli_afkar', 'usr_ali', 'Cart abandonment retargeting campaign is running. ROAS holding above 12 so far.', now() - interval '3 hours')
on conflict (id) do nothing;

-- Product research seed (the funnel in motion)
insert into public.product_candidates (id, client_id, name, category, source_url, competitor, estimated_price, demand_evidence, notes, score_demand, score_competition, score_margin, score_creative, score_brand_fit, score_trend, status, decision_notes, researcher_id, created_at, updated_at) values
  ('prod_1', 'cli_afkar', 'Abstract Gold Canvas 3-Piece Set', 'Living Room', 'https://competitor.com/gold-canvas', 'Competitor A', 449, '1.2k reviews, restocked 3x this quarter', 'Strong margin at supplier price', 9, 6, 8, 8, 9, 7, 'shortlisted', null, 'usr_mohammed', now() - interval '5 days', now() - interval '5 days'),
  ('prod_2', 'cli_afkar', 'Neon Islamic Calligraphy Frame', 'Bedroom', 'https://competitor.com/neon-calligraphy', 'Competitor B', 299, 'Trending on TikTok #homedecor KSA', null, 8, 7, 7, 9, 8, 9, 'testing', 'Ad test started, 3 creatives live', 'usr_mohammed', now() - interval '4 days', now() - interval '1 day'),
  ('prod_3', 'cli_afkar', 'Majlis Floor Cushion Set', 'Majlis', 'https://competitor.com/majlis-cushions', 'Competitor C', 899, 'Ramadan seasonal spike expected', null, 7, 8, 6, 6, 9, 5, 'discovered', null, 'usr_mohammed', now() - interval '2 days', now() - interval '2 days'),
  ('prod_4', 'cli_afkar', 'Minimalist Line-Art Diptych', 'Office', null, 'Competitor D', 199, 'Low engagement on competitor listings', 'Weak differentiation, likely kill', 4, 8, 5, 4, 5, 4, 'killed', 'Demand evidence insufficient', 'usr_mohammed', now() - interval '6 days', now() - interval '3 days'),
  ('prod_5', 'cli_afkar', '3D Wooden World Map XL', 'Living Room', 'https://competitor.com/world-map-3d', 'Competitor E', 1299, 'Highest AOV product at two competitors', 'Premium hero candidate for National Day bundle', 10, 5, 9, 9, 10, 8, 'winner', 'Scaled: 34 sales first week, ROAS 11.2', 'usr_mohammed', now() - interval '12 days', now() - interval '2 days')
on conflict (id) do nothing;

-- Campaigns + a few days of real-shaped metrics
insert into public.campaigns (id, client_id, name, platform, status, budget, objective, start_date, created_by) values
  ('camp_1', 'cli_afkar', 'Cart Abandonment Retargeting', 'snap_ads', 'active', 30000, 'Reclaim 10% of the 70k abandoned carts', (now() - interval '10 days')::date, 'usr_ali'),
  ('camp_2', 'cli_afkar', 'National Day Winners Scaling', 'google_ads', 'active', 40000, 'Scale the winning wall-art products', (now() - interval '5 days')::date, 'usr_ali'),
  ('camp_3', 'cli_afkar', 'Majlis Collection Teaser', 'tiktok_ads', 'planned', 15000, 'Warm up the audience before launch', ((now() + interval '7 days'))::date, 'usr_ali')
on conflict (id) do nothing;

insert into public.campaign_metrics (id, campaign_id, client_id, date, impressions, clicks, spend, purchases, revenue) values
  ('cm_1a', 'camp_1', 'cli_afkar', (now() - interval '2 days')::date, 41200, 980, 1450, 38, 31200),
  ('cm_1b', 'camp_1', 'cli_afkar', (now() - interval '1 day')::date, 44800, 1120, 1520, 44, 38600),
  ('cm_2a', 'camp_2', 'cli_afkar', (now() - interval '1 day')::date, 22400, 640, 1180, 21, 52400)
on conflict (id) do nothing;

-- Snapshot integrity: one value per KPI per day. Dedupe keeping the newest
-- write, then enforce with a unique index. Both guarded so a re-run can
-- never abort the file mid-way.
do $$ begin
  delete from public.kpi_snapshots a using public.kpi_snapshots b
    where a.kpi_id = b.kpi_id
      and a.snapshot_date = b.snapshot_date
      and a.created_at < b.created_at;
exception when others then null; end $$;

do $$ begin
  execute 'create unique index if not exists kpi_snapshots_unique_day on public.kpi_snapshots (kpi_id, snapshot_date)';
exception when others then null; end $$;

-- One metric row per campaign per day.
do $$ begin
  execute 'create unique index if not exists campaign_metrics_unique_day on public.campaign_metrics (campaign_id, date)';
exception when others then null; end $$;

-- ============================================================
-- REALTIME: live sync across devices. Idempotent (re-adding a
-- table to the publication raises 42710 - swallowed here).
-- ============================================================
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.tasks;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.product_candidates;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.kpi_snapshots;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.task_comments;
exception when others then null; end $$;
