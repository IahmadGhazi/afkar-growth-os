import { useMemo, useState } from 'react'
import {
  FlaskConical, AlertTriangle, AlertCircle, Info, Check, Palette,
  Type, Ruler, MousePointerClick, Layers, Sun, Moon, ArrowRight,
} from 'lucide-react'

/* ────────────────────────────────────────────────────────────
   UI/UX LAB — the staging ground.
   Every proposed fix lands HERE first, rendered LIVE with real
   tokens, before any promotion into the production surfaces.
   The rest of the app stays read-only while you review.
   ──────────────────────────────────────────────────────────── */

interface Finding {
  id: string
  severity: 'P0' | 'P1' | 'P2'
  area: string
  title: string
  detail: string
  files: string[]
  labFix?: string // which lab pattern below addresses it
}

const FINDINGS: Finding[] = [
  { id: 'F1', severity: 'P0', area: 'Global', title: '15 pages render a duplicate title', detail: 'TopBar already displays the page name; every page ALSO renders its own <h2>. Three levels of "Products" repeat on one screen.', files: ['Briefing', 'Campaigns', 'CartRecovery', 'Chat', 'Customers', 'Kpis', 'WeeklyPlan', 'Orders', 'Products', 'Retention', 'Reviews', 'Settings', 'StoreProducts', 'Team'], labFix: 'page-header' },
  { id: 'F2', severity: 'P0', area: 'Data.tsx', title: '5 competing primary buttons on one page', detail: 'btn-primary appears 5× in Data & Sources (plus 4 in Tasks, 4 in IntegrationsPanel). A filled gold button should be THE action — one per view.', files: ['Data', 'Tasks', 'IntegrationsPanel', 'Products', 'QuickAdd', 'CouponsManager', 'Campaigns'], labFix: 'buttons' },
  { id: 'F3', severity: 'P1', area: 'Global', title: 'Spacing anarchy — five competing rhythms', detail: 'Page containers use space-y-3/4/5/6/8 with no system: 16 pages use y-3, 15 use y-6, others scattered. Same-level cards use p-4/p-5/p-6 arbitrarily.', files: ['all pages'], labFix: 'tokens' },
  { id: 'F4', severity: 'P1', area: 'Drawers/Report', title: 'Accent soup — up to 8 inline hues per surface', detail: 'OrderDrawer & Report carry 8 distinct hex colors, Chat/Retention 7. Status colors leak into decoration; semantic meaning drowns.', files: ['OrderDrawer', 'Report', 'Chat', 'Retention'], labFix: 'status' },
  { id: 'F5', severity: 'P1', area: 'IntegrationsPanel', title: 'Last browser confirm() alive', detail: 'Disconnect still uses window.confirm at line 78 — every other destructive action migrated to the in-app dialog.', files: ['IntegrationsPanel'], labFix: undefined },
  { id: 'F6', severity: 'P2', area: 'Customers', title: 'Ghost tokens — var(--gold), var(--gold-soft)', detail: 'Referenced but never defined in index.css. They silently render empty. Replace with --brand / --warning-soft.', files: ['Customers'], labFix: 'tokens' },
  { id: 'F7', severity: 'P2', area: 'Modals', title: 'Glass modals over dark overlays = gray mud', detail: 'Fixed for picker/edit/playbook/confirm — the pattern is now codified here so it never regresses.', files: ['fixed'], labFix: 'modal' },
]

const SEV_STYLE: Record<string, string> = {
  P0: '#ef4444',
  P1: '#f59e0b',
  P2: '#64748b',
}

function SectionTitle({ icon: Icon, children }: { icon: typeof FlaskConical; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={15} style={{ color: 'var(--brand)' }} />
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{children}</h3>
    </div>
  )
}

export function Lab() {
  const [theme, setTheme] = useState<'light' | 'dark'>(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  const [promoted, setPromoted] = useState<Set<string>>(new Set())

  const counts = useMemo(() => ({
    p0: FINDINGS.filter((f) => f.severity === 'P0').length,
    p1: FINDINGS.filter((f) => f.severity === 'P1').length,
    p2: FINDINGS.filter((f) => f.severity === 'P2').length,
  }), [])

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <FlaskConical size={18} style={{ color: 'var(--brand)' }} />
            UI/UX Lab
          </h2>
          <div className="text-sm text-[var(--text-muted)]">
            Staging ground — every fix renders here first. Nothing promotes without your approval.
          </div>
        </div>
        <button onClick={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')}
          className="btn btn-outline !text-xs !px-3 !py-2 inline-flex items-center gap-1.5">
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          Preview {theme === 'dark' ? 'light' : 'dark'}
        </button>
      </div>

      {/* Theme preview scope note */}
      <div className="rounded-xl border border-[var(--hairline)] bg-[var(--card)] px-4 py-3 text-xs text-[var(--text-muted)] flex items-center gap-2">
        <Info size={13} className="shrink-0" />
        Components below render inside a preview frame forced to <b>{theme}</b> tokens — how they'll look promoted.
        Full-page dark/light verification happens per promotion.
      </div>

      {/* ── 1. AUDIT FINDINGS */}
      <section>
        <SectionTitle icon={AlertTriangle}>Audit sweep — {counts.p0} critical · {counts.p1} major · {counts.p2} minor</SectionTitle>
        <div className="glass-card divide-y divide-[var(--hairline)] overflow-hidden">
          {FINDINGS.map((f) => (
            <div key={f.id} className="px-4 sm:px-5 py-3.5 flex items-start gap-3">
              <span className="shrink-0 mt-0.5 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ color: SEV_STYLE[f.severity], background: `color-mix(in srgb, ${SEV_STYLE[f.severity]} 12%, transparent)` }}>
                {f.severity}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[var(--text-primary)]">{f.title}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{f.detail}</div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {f.files.map((file) => (
                    <span key={file} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--track)] text-[var(--text-muted)]">{file}</span>
                  ))}
                </div>
              </div>
              {f.labFix && (
                <a href={`#lab-${f.labFix}`} className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium hover:underline" style={{ color: 'var(--brand)' }}>
                  Fix pattern <ArrowRight size={11} />
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 2. TOKEN SHEET */}
      <section id="lab-tokens">
        <SectionTitle icon={Palette}>Design tokens — the constitution</SectionTitle>
        <div className="glass-card p-5 space-y-4">
          <p className="text-xs text-[var(--text-muted)]">
            One rhythm: pages <code className="px-1 rounded bg-[var(--track)]">space-y-6</code>, cards <code className="px-1 rounded bg-[var(--track)]">p-5</code>,
            rows <code className="px-1 rounded bg-[var(--track)]">py-3</code>. One accent: <b style={{ color: 'var(--brand)' }}>gold</b> for actions.
            Semantic colors speak ONLY for status.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { v: 'var(--brand)', n: 'brand / action' },
              { v: '#10b981', n: 'positive status' },
              { v: '#f59e0b', n: 'warning status' },
              { v: '#ef4444', n: 'danger status' },
            ].map((c) => (
              <div key={c.n} className="rounded-lg border border-[var(--hairline)] overflow-hidden">
                <div className="h-10" style={{ background: c.v }} />
                <div className="px-2 py-1.5 text-[10px] text-[var(--text-muted)]">{c.n}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Type ramp</div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">1,058 <span className="text-sm font-medium">hero numerals</span></div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">Section title · semibold 14</div>
              <div className="text-xs text-[var(--text-muted)]">Body muted 12 · the workhorse line</div>
              <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">Eyebrow label 11</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Ruler size={13} className="text-[var(--text-muted)]" />
            <span className="text-[var(--text-muted)]">Radii: cards 18 · controls 10 · chips full — already consistent, keep it.</span>
          </div>
        </div>
      </section>

      {/* ── 3. PATTERN: PAGE HEADER */}
      <section id="lab-page-header">
        <SectionTitle icon={Type}>Pattern — PageHeader (kills 15 duplicate titles)</SectionTitle>
        <div className="glass-card overflow-hidden">
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--hairline)]">
            <div className="p-5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#ef4444] mb-2">Current ✗</div>
              <div className="space-y-2 opacity-80">
                <div className="text-sm font-semibold">Cart Recovery <span className="text-[var(--text-muted)] font-normal">(TopBar)</span></div>
                <div className="text-lg font-semibold text-[var(--text-primary)]">Cart Recovery <span className="text-[var(--text-muted)] font-normal text-sm">(page repeats it)</span></div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">Coupons <span className="text-[var(--text-muted)] font-normal text-xs">(tab repeats again)</span></div>
              </div>
            </div>
            <div className="p-5 border-l-2" style={{ borderColor: 'var(--brand)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--positive)] mb-2">Proposed ✓</div>
              <div className="space-y-2">
                <div className="text-sm font-semibold">Cart Recovery <span className="text-[var(--text-muted)] font-normal">(TopBar owns the title)</span></div>
                <div className="text-sm text-[var(--text-muted)]">Page speaks only through <b className="text-[var(--text-primary)]">content</b>: one eyebrow + one metric line.</div>
              </div>
            </div>
          </div>
          <div className="px-5 pb-4 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[11px] text-[var(--text-muted)]">Promote = strip 15 h2 blocks, add one PageHeader component. Targets listed in F1.</span>
            <button onClick={() => setPromoted((s) => new Set(s).add('page-header'))}
              className="btn btn-outline !text-xs !px-3 !py-1.5 inline-flex items-center gap-1.5">
              {promoted.has('page-header') ? <><Check size={12} /> Approved (queued)</> : <>Approve for promotion</>}
            </button>
          </div>
        </div>
      </section>

      {/* ── 4. PATTERN: BUTTON HIERARCHY */}
      <section id="lab-buttons">
        <SectionTitle icon={MousePointerClick}>Pattern — Button hierarchy (one filled per view)</SectionTitle>
        <div className="glass-card p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#ef4444] mb-2">Current ✗ — Data & Sources</div>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary !text-xs !px-3 !py-1.5">Connect</button>
                <button className="btn btn-primary !text-xs !px-3 !py-1.5">Sync all</button>
                <button className="btn btn-primary !text-xs !px-3 !py-1.5">Import</button>
                <button className="btn btn-primary !text-xs !px-3 !py-1.5">Save sheet</button>
                <button className="btn btn-primary !text-xs !px-3 !py-1.5">Fetch</button>
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-2">Five gold buttons = zero hierarchy.</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--positive)] mb-2">Proposed ✓</div>
              <div className="flex flex-wrap gap-2 items-center">
                <button className="btn btn-primary !text-xs !px-3 !py-1.5">Sync now</button>
                <button className="btn btn-outline !text-xs !px-3 !py-1.5">Connect platform</button>
                <button className="btn btn-outline !text-xs !px-3 !py-1.5">Import sheet</button>
                <button className="btn !text-xs !px-3 !py-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]">Fetch rates</button>
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-2">One filled = the page's job. Outlines = choices. Ghost = tertiary.</div>
            </div>
          </div>
          <div className="pt-3 border-t border-[var(--hairline)] flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[11px] text-[var(--text-muted)]">Rule: exactly ONE btn-primary per view. Everything else outline or ghost.</span>
            <button onClick={() => setPromoted((s) => new Set(s).add('buttons'))}
              className="btn btn-outline !text-xs !px-3 !py-1.5 inline-flex items-center gap-1.5">
              {promoted.has('buttons') ? <><Check size={12} /> Approved</> : <>Approve for promotion</>}
            </button>
          </div>
        </div>
      </section>

      {/* ── 5. PATTERN: STAT HERO */}
      <section id="lab-stat-hero">
        <SectionTitle icon={Layers}>Pattern — StatHero band (Command-Center DNA everywhere)</SectionTitle>
        <div className="glass-card p-5">
          <div className="rounded-xl border border-[var(--hairline)] bg-[var(--bg)] p-6 flex flex-wrap lg:flex-nowrap items-center gap-8"
            style={{ filter: theme === 'dark' ? 'invert(0)' : undefined }}>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Pipeline value</div>
              <div className="text-5xl font-extrabold text-[var(--text-primary)] tabular-nums mt-1 leading-none">2,340 <span className="text-xl font-bold">SAR</span></div>
              <div className="text-sm text-[var(--text-muted)] mt-2">across 7 open deals</div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="flex h-3 rounded-full overflow-hidden bg-[var(--track)]">
                <div className="w-1/4" style={{ background: '#ef4444' }} />
                <div className="w-1/2" style={{ background: '#f59e0b' }} />
                <div className="w-1/4" style={{ background: '#94a3b8' }} />
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs text-[var(--text-muted)]">
                <span><span className="w-2 h-2 rounded-full mr-1.5 inline-block" style={{ background: '#ef4444' }} />Now · <b className="text-[var(--text-primary)]">587</b></span>
                <span><span className="w-2 h-2 rounded-full mr-1.5 inline-block" style={{ background: '#f59e0b' }} />This week · <b className="text-[var(--text-primary)]">1,170</b></span>
                <span><span className="w-2 h-2 rounded-full mr-1.5 inline-block" style={{ background: '#94a3b8' }} />Later · <b className="text-[var(--text-primary)]">583</b></span>
              </div>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-[var(--hairline)] flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[11px] text-[var(--text-muted)]">Live-proven in Cart Recovery. Next targets: Campaigns totals, Orders revenue, Retention LTV.</span>
            <button onClick={() => setPromoted((s) => new Set(s).add('stat-hero'))}
              className="btn btn-outline !text-xs !px-3 !py-1.5 inline-flex items-center gap-1.5">
              {promoted.has('stat-hero') ? <><Check size={12} /> Approved</> : <>Approve for promotion</>}
            </button>
          </div>
        </div>
      </section>

      {/* ── 6. PATTERN: STATUS SEMANTICS */}
      <section id="lab-status">
        <SectionTitle icon={AlertCircle}>Pattern — Status semantics (colors that mean something)</SectionTitle>
        <div className="glass-card p-5 grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#ef4444] mb-2">Never again ✗</div>
            <div className="flex flex-wrap gap-2">
              <span className="chip" style={{ background: '#8b5cf622', color: '#8b5cf6' }}>purple chip</span>
              <span className="chip" style={{ background: '#06b6d422', color: '#06b6d4' }}>cyan chip</span>
              <span className="chip" style={{ background: '#ec489922', color: '#ec4899' }}>pink chip</span>
              <span className="text-xs text-[var(--text-muted)] self-center">= decoration, no meaning</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--positive)] mb-2">The vocabulary ✓</div>
            <div className="flex flex-wrap gap-2">
              <span className="chip" style={{ background: 'rgba(16,185,129,.12)', color: '#10b981' }}>● live / done</span>
              <span className="chip" style={{ background: 'rgba(245,158,11,.12)', color: '#f59e0b' }}>● warning / pending</span>
              <span className="chip" style={{ background: 'rgba(239,68,68,.12)', color: '#ef4444' }}>● problem / overdue</span>
              <span className="chip bg-[var(--track)] text-[var(--text-muted)]">● neutral / off</span>
            </div>
          </div>
          <div className="md:col-span-2 pt-3 border-t border-[var(--hairline)] flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[11px] text-[var(--text-muted)]">Domain palettes (order statuses, shipment states) keep their maps — but draw only from these four families.</span>
            <button onClick={() => setPromoted((s) => new Set(s).add('status'))}
              className="btn btn-outline !text-xs !px-3 !py-1.5 inline-flex items-center gap-1.5">
              {promoted.has('status') ? <><Check size={12} /> Approved</> : <>Approve for promotion</>}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="glass-card px-5 py-4 text-xs text-[var(--text-muted)] leading-relaxed">
        <b className="text-[var(--text-primary)]">How promotion works:</b> you approve patterns here → I implement them against their target files in a dedicated pass → each promotion ships with before/after screenshots → nothing touches production until you've seen it rendered.
        The audit list above stays live — new findings land here first.
      </div>
    </div>
  )
}
