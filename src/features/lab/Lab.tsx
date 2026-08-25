import { useState } from 'react'
import {
  FlaskConical, Check, Palette, Sparkles, Info,
  Type, Ruler, MousePointerClick, Layers, Sun, Moon,
} from 'lucide-react'

interface ShippedFinding {
  id: string
  title: string
  detail: string
  shippedIn: string
}

const SHIPPED: ShippedFinding[] = [
  { id: 'F1', title: '15 duplicate page titles stripped', detail: 'TopBar owns the title; pages speak through content.', shippedIn: 'Promotion pass 1' },
  { id: 'F2', title: 'One primary button per view', detail: '11 demotions across Data, Tasks, Integrations, Products, Campaigns.', shippedIn: 'Promotion pass 1' },
  { id: 'F3', title: 'Spacing rhythm codified', detail: 'pages space-y-6 · cards p-5 · rows py-3 — constitution published in tokens.', shippedIn: 'Promotion pass 1' },
  { id: 'F4', title: 'Solid modal surfaces', detail: 'Glass-over-overlay gray mud eliminated in both themes.', shippedIn: 'UI reckoning' },
  { id: 'F5', title: 'Browser confirms exterminated', detail: 'App-styled dialogs everywhere, including Disconnect.', shippedIn: 'Promotion pass 1' },
  { id: 'F6', title: 'Ghost tokens buried', detail: 'var(--gold) and var(--gold-soft) replaced with real tokens.', shippedIn: 'Promotion pass 1' },
  { id: 'F7', title: 'Sticky topbar + solid app bar', detail: 'Wrapper-pin fix below lg; content no longer ghosts through.', shippedIn: 'Navigation era' },
]

const INVENTIONS: { title: string; why: string; effort: string }[] = [
  { title: 'Chat member palette curation', why: '18 ad-hoc hues to one curated 8-color identity set, calibrated for light and dark.', effort: 'S' },
  { title: 'Goal gauge on Command Center', why: 'Monthly target to daily run-rate to a live gap arrow — the number that focuses everything.', effort: 'M' },
  { title: 'Report print discipline', why: 'Near-monochrome ink ramp plus gold accents — the client-facing sheet deserves restraint.', effort: 'S' },
  { title: 'Coupon ROI mini-chart', why: 'coupon.applied is live — renders rescued carts over time per code.', effort: 'M' },
  { title: 'Keyboard command palette (v2)', why: 'QuickAdd exists; a full nav-plus-action palette is the power-user unlock.', effort: 'M' },
  { title: 'Retention segment harmonization', why: 'Seven RFM identities into one saturation family with distinct hues.', effort: 'S' },
]

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

      <div className="rounded-xl border border-[var(--hairline)] bg-[var(--card)] px-4 py-3 text-xs text-[var(--text-muted)] flex items-center gap-2">
        <Info size={13} className="shrink-0" />
        Sweep one is fully shipped (archive below). The register is clear — new findings and experiments land here.
      </div>

      {/* Shipped archive */}
      <section>
        <SectionTitle icon={Check}>Shipped from the Lab — {SHIPPED.length} fixes living in production</SectionTitle>
        <div className="glass-card divide-y divide-[var(--hairline)] overflow-hidden">
          {SHIPPED.map((f) => (
            <div key={f.id} className="px-4 sm:px-5 py-3 flex items-start gap-3">
              <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center bg-[var(--positive-soft)]">
                <Check size={12} className="text-[var(--positive)]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[var(--text-primary)]">{f.title}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">{f.detail}</div>
              </div>
              <span className="shrink-0 text-[10px] text-[var(--text-muted)] border border-[var(--hairline)] rounded px-1.5 py-0.5">{f.shippedIn}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Invention queue */}
      <section>
        <SectionTitle icon={Sparkles}>Invention queue — what I think we test next</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-3">
          {INVENTIONS.map((inv, i) => (
            <div key={i} className="glass-card p-4 flex items-start gap-3">
              <span className="shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--track)] text-[var(--text-muted)]">{inv.effort}</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text-primary)]">{inv.title}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{inv.why}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-[var(--text-muted)] mt-2">
          Pick one — or say "all S items" — it gets prototyped here first, then promoted with proof.
        </div>
      </section>

      {/* Tokens */}
      <section id="lab-tokens">
        <SectionTitle icon={Palette}>Design tokens — the constitution</SectionTitle>
        <div className="glass-card p-5 space-y-4">
          <p className="text-xs text-[var(--text-muted)]">
            One rhythm: pages <code className="px-1 rounded bg-[var(--track)]">space-y-6</code>, cards <code className="px-1 rounded bg-[var(--track)]">p-5</code>,
            rows <code className="px-1 rounded bg-[var(--track)]">py-3</code>. One accent: <b style={{ color: 'var(--brand)' }}>gold</b> for actions.
            Semantic colors speak only for status.
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
            <span className="text-[var(--text-muted)]">Radii: cards 18 · controls 10 · chips full — consistent, keep it.</span>
          </div>
        </div>
      </section>

      {/* PageHeader pattern */}
      <section id="lab-page-header">
        <SectionTitle icon={Type}>Pattern — PageHeader (shipped: 15 titles stripped)</SectionTitle>
        <div className="glass-card overflow-hidden">
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--hairline)]">
            <div className="p-5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#ef4444] mb-2">Before</div>
              <div className="space-y-2 opacity-80">
                <div className="text-sm font-semibold">Cart Recovery <span className="text-[var(--text-muted)] font-normal">(TopBar)</span></div>
                <div className="text-lg font-semibold text-[var(--text-primary)]">Cart Recovery <span className="text-[var(--text-muted)] font-normal text-sm">(page repeated it)</span></div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">Coupons <span className="text-[var(--text-muted)] font-normal text-xs">(tab repeated again)</span></div>
              </div>
            </div>
            <div className="p-5 border-l-2" style={{ borderColor: 'var(--brand)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--positive)] mb-2">After</div>
              <div className="space-y-2">
                <div className="text-sm font-semibold">Cart Recovery <span className="text-[var(--text-muted)] font-normal">(TopBar owns the title)</span></div>
                <div className="text-sm text-[var(--text-muted)]">Pages speak through content: one metric line, no echo.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Button hierarchy pattern */}
      <section id="lab-buttons">
        <SectionTitle icon={MousePointerClick}>Pattern — Button hierarchy (shipped: 11 demotions)</SectionTitle>
        <div className="glass-card p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#ef4444] mb-2">Before — Data and Sources</div>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary !text-xs !px-3 !py-1.5">Connect</button>
                <button className="btn btn-primary !text-xs !px-3 !py-1.5">Sync all</button>
                <button className="btn btn-primary !text-xs !px-3 !py-1.5">Import</button>
                <button className="btn btn-primary !text-xs !px-3 !py-1.5">Save sheet</button>
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-2">Five gold buttons = zero hierarchy.</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--positive)] mb-2">After</div>
              <div className="flex flex-wrap gap-2 items-center">
                <button className="btn btn-primary !text-xs !px-3 !py-1.5">Sync now</button>
                <button className="btn btn-outline !text-xs !px-3 !py-1.5">Connect platform</button>
                <button className="btn btn-outline !text-xs !px-3 !py-1.5">Import sheet</button>
                <button className="btn !text-xs !px-3 !py-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]">Fetch rates</button>
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-2">One filled = the page's job. Outlines = choices. Ghost = tertiary.</div>
            </div>
          </div>
        </div>
      </section>

      {/* StatHero pattern */}
      <section id="lab-stat-hero">
        <SectionTitle icon={Layers}>Pattern — StatHero band (shipped in Cart Recovery)</SectionTitle>
        <div className="glass-card p-5">
          <div className="rounded-xl border border-[var(--hairline)] bg-[var(--bg)] p-6 flex flex-wrap lg:flex-nowrap items-center gap-8">
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
          <div className="pt-3 mt-3 border-t border-[var(--hairline)] text-[11px] text-[var(--text-muted)]">
            Next targets: Campaigns totals, Orders revenue, Retention LTV.
          </div>
        </div>
      </section>

      {/* Status semantics pattern */}
      <section id="lab-status">
        <SectionTitle icon={Palette}>Pattern — Status semantics (colors that mean something)</SectionTitle>
        <div className="glass-card p-5 grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#ef4444] mb-2">Never again</div>
            <div className="flex flex-wrap gap-2">
              <span className="chip" style={{ background: '#8b5cf622', color: '#8b5cf6' }}>purple chip</span>
              <span className="chip" style={{ background: '#06b6d422', color: '#06b6d4' }}>cyan chip</span>
              <span className="chip" style={{ background: '#ec489922', color: '#ec4899' }}>pink chip</span>
              <span className="text-xs text-[var(--text-muted)] self-center">= decoration, no meaning</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--positive)] mb-2">The vocabulary</div>
            <div className="flex flex-wrap gap-2">
              <span className="chip" style={{ background: 'rgba(16,185,129,.12)', color: '#10b981' }}>live / done</span>
              <span className="chip" style={{ background: 'rgba(245,158,11,.12)', color: '#f59e0b' }}>warning / pending</span>
              <span className="chip" style={{ background: 'rgba(239,68,68,.12)', color: '#ef4444' }}>problem / overdue</span>
              <span className="chip bg-[var(--track)] text-[var(--text-muted)]">neutral / off</span>
            </div>
          </div>
          <div className="md:col-span-2 pt-3 border-t border-[var(--hairline)] text-[11px] text-[var(--text-muted)]">
            Domain palettes (order statuses, shipment states) draw only from these four families.
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="glass-card px-5 py-4 text-xs text-[var(--text-muted)] leading-relaxed">
        <b className="text-[var(--text-primary)]">How promotion works:</b> you approve patterns here → they are implemented against target files in a dedicated pass → each promotion ships with before/after screenshots → nothing touches production until you have seen it rendered.
      </div>
    </div>
  )
}
