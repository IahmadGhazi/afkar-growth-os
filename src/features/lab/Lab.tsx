import { useEffect, useState } from 'react'
import {
  FlaskConical, Check, X, Sparkles, Sun, Moon, MessageSquare,
  FileText, Target, BarChart3, Command, HeartPulse, TrendingUp, Users, ShoppingBag,
} from 'lucide-react'
import { getStoredTheme } from '../../lib/theme'
import { cn } from '../../lib/utils'

/* ═══════════════════════════════════════════════════════════
   UI/UX LAB v3 — PROTOTYPE GALLERY
   Numbered, live-rendered proposals. Approve by number.
   Production stays untouched until you say the word.
   ═══════════════════════════════════════════════════════════ */

type Verdict = 'none' | 'approved' | 'skipped'

interface Proto {
  n: number
  id: string
  title: string
  why: string
  effort: 'S' | 'M'
  targets: string
}

const PROTOS: Proto[] = [
  { n: 1, id: 'chat-palette', title: 'Chat member identity palette', why: '18 ad-hoc hues today — members can share colors and some wash out in dark mode. One curated 8-color set, even spacing, calibrated for both themes.', effort: 'S', targets: 'Team Chat' },
  { n: 2, id: 'goal-gauge', title: 'Goal gauge on Command Center', why: 'Set a monthly target → see daily run-rate and a live gap arrow. Turns the dashboard into a commitment device.', effort: 'M', targets: 'Command Center' },
  { n: 3, id: 'report-print', title: 'Report print discipline', why: 'The client-facing sheet: near-monochrome ink ramp + gold. Legibility and restraint, not rainbow.', effort: 'S', targets: 'Client Report' },
  { n: 4, id: 'coupon-roi', title: 'Coupon ROI mini-chart', why: 'coupon.applied is live — rescued carts per code, plotted. Proof the coupons earn.', effort: 'M', targets: 'Cart Recovery / Coupons' },
  { n: 5, id: 'cmdk-v2', title: 'Command palette v2 (⌘K)', why: 'QuickAdd grows up: navigate anywhere, run actions, all from one keyboard-first palette.', effort: 'M', targets: 'Global' },
  { n: 6, id: 'retention-harmony', title: 'Retention segment harmonization', why: '7 RFM identities into one saturation family — distinct hues, designed-together feel.', effort: 'S', targets: 'Retention' },
]

/* ── sample data ── */
const CHAOS = ['#ec4899', '#6366f1', '#14b8a6', '#f97316', '#8b5cf6', '#0fa96c']
const CURATED = ['#d29a0c', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4']
const MEMBERS = ['Ghazi', 'Sara', 'MAHMOUD', 'Fatima', 'TestSara', 'Noura']

function VerdictButtons({ n, verdicts, set }: { n: number; verdicts: Record<number, Verdict>; set: (n: number, v: Verdict) => void }) {
  const v = verdicts[n] ?? 'none'
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => set(n, 'approved')}
        className={cn('btn !text-xs !px-3 !py-1.5 inline-flex items-center gap-1.5',
          v === 'approved' ? 'btn-primary' : 'btn-outline')}
        style={v === 'approved' ? undefined : { color: 'var(--positive)', borderColor: 'rgba(16,185,129,.35)' }}>
        <Check size={12} /> Approve
      </button>
      <button onClick={() => set(n, 'skipped')}
        className={cn('btn !text-xs !px-3 !py-1.5 inline-flex items-center gap-1.5',
          v === 'skipped' ? 'btn-primary' : 'btn-outline')}>
        <X size={12} /> Skip
      </button>
      {v !== 'none' && (
        <span className="text-[11px] font-semibold" style={{ color: v === 'approved' ? 'var(--positive)' : 'var(--text-muted)' }}>
          {v === 'approved' ? 'Queued for build' : 'Skipped'}
        </span>
      )}
    </div>
  )
}

function ProtoShell({ p, verdicts, set, children }: { p: Proto; verdicts: Record<number, Verdict>; set: (n: number, v: Verdict) => void; children: React.ReactNode }) {
  const v = verdicts[p.n] ?? 'none'
  return (
    <div className="glass-card overflow-hidden" style={v === 'approved' ? { borderColor: 'var(--brand)', boxShadow: '0 0 0 1px var(--brand)' } : v === 'skipped' ? { opacity: 0.55 } : undefined}>
      <div className="px-5 pt-4 pb-3 flex items-start gap-3 flex-wrap">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-sm font-bold shrink-0"
          style={{ background: 'var(--warning-soft)', color: 'var(--brand)' }}>{p.n}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-[var(--text-primary)]">{p.title}</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{p.why}</div>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--track)] text-[var(--text-muted)]">effort {p.effort}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--track)] text-[var(--text-muted)]">{p.targets}</span>
          </div>
        </div>
        <VerdictButtons n={p.n} verdicts={verdicts} set={set} />
      </div>
      {/* live prototype frame */}
      <div className="px-5 pb-5">
        <div className="rounded-xl border border-[var(--hairline)] bg-[var(--bg)] p-4 overflow-hidden">{children}</div>
      </div>
    </div>
  )
}

export function Lab() {
  // Preview starts from your REAL current theme
  const [theme, setTheme] = useState<'light' | 'dark'>(getStoredTheme())
  const [verdicts, setVerdicts] = useState<Record<number, Verdict>>({})

  // True preview: flips the live data-theme attribute (what every token reads),
  // and restores your saved theme when you leave the Lab.
  const togglePreview = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    const root = document.documentElement
    if (next === 'dark') root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
  }
  useEffect(() => () => {
    const stored = getStoredTheme()
    const root = document.documentElement
    if (stored === 'dark') root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
  }, [])

  const set = (n: number, v: Verdict) => setVerdicts((prev) => ({ ...prev, [n]: v }))
  const approved = Object.entries(verdicts).filter(([, v]) => v === 'approved').map(([n]) => n)

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <FlaskConical size={18} style={{ color: 'var(--brand)' }} />
            UI/UX Lab — Prototype Gallery
          </h2>
          <div className="text-sm text-[var(--text-muted)]">
            {PROTOS.length} numbered prototypes, rendered live. Nothing touches production until you approve by number.
          </div>
        </div>
        <button onClick={togglePreview}
          className="btn btn-outline !text-xs !px-3 !py-2 inline-flex items-center gap-1.5">
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          {theme === 'dark' ? 'Light' : 'Dark'} preview
        </button>
      </div>

      {/* Your verdict summary */}
      <div className="rounded-xl border border-[var(--hairline)] bg-[var(--card)] px-4 py-3 text-xs flex flex-wrap items-center gap-2">
        <Sparkles size={13} style={{ color: 'var(--brand)' }} />
        {approved.length === 0 ? (
          <span className="text-[var(--text-muted)]">Review the prototypes below — then tell me your numbers (e.g. "1, 2 and 5 approved; 3 and 4 not").</span>
        ) : (
          <span className="text-[var(--text-primary)]">
            Approved: <b>{approved.join(', ')}</b> · Skipped: {Object.entries(verdicts).filter(([, v]) => v === 'skipped').map(([n]) => n).join(', ') || 'none'}
          </span>
        )}
      </div>

      {/* ── P1 CHAT PALETTE */}
      <ProtoShell p={PROTOS[0]} verdicts={verdicts} set={set}>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#ef4444] mb-2">Current — 18 ad-hoc hues</div>
            <div className="space-y-1.5">
              {MEMBERS.slice(0, 5).map((m, i) => (
                <div key={m} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: CHAOS[i] }}>{m[0]}</span>
                  <span className="text-xs font-medium" style={{ color: CHAOS[i] }}>{m}</span>
                </div>
              ))}
              <div className="text-[10px] text-[var(--text-muted)] pt-1">+12 more hues… uneven saturation, dark-mode washouts</div>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--positive)] mb-2">Proposed — curated 8</div>
            <div className="space-y-1.5">
              {MEMBERS.map((m, i) => (
                <div key={m} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: CURATED[i % CURATED.length] }}>{m[0]}</span>
                  <span className="text-xs font-medium" style={{ color: CURATED[i % CURATED.length] }}>{m}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ProtoShell>

      {/* ── P2 GOAL GAUGE */}
      <ProtoShell p={PROTOS[1]} verdicts={verdicts} set={set}>
        <div className="flex flex-wrap items-center gap-8">
          {/* gauge */}
          <div className="relative w-40 h-24">
            <svg viewBox="0 0 200 110" className="w-full h-full">
              <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--track)" strokeWidth="14" strokeLinecap="round" />
              <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--brand)" strokeWidth="14" strokeLinecap="round"
                strokeDasharray="251" strokeDashoffset="70" />
              <text x="100" y="88" textAnchor="middle" className="fill-[var(--text-primary)]" style={{ fontSize: 26, fontWeight: 800 }}>72%</text>
              <text x="100" y="104" textAnchor="middle" fill="var(--text-muted)" style={{ fontSize: 10 }}>of monthly target</text>
            </svg>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Target size={14} style={{ color: 'var(--brand)' }} />
              <span className="text-[var(--text-muted)]">Target</span>
              <b className="text-[var(--text-primary)] tabular-nums">150,000 SAR</b>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-[var(--positive)]" />
              <span className="text-[var(--text-muted)]">Month-to-date</span>
              <b className="text-[var(--text-primary)] tabular-nums">108,400 SAR</b>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 size={14} className="text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)]">Needed / day</span>
              <b className="text-[var(--text-primary)] tabular-nums">4,160 SAR</b>
            </div>
            <div className="text-xs px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 mt-1"
              style={{ background: 'rgba(16,185,129,.1)', color: 'var(--positive)' }}>
              On pace — keep this rhythm and you land 4% above target
            </div>
          </div>
        </div>
      </ProtoShell>

      {/* ── P3 REPORT PRINT */}
      <ProtoShell p={PROTOS[2]} verdicts={verdicts} set={set}>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-[var(--hairline)] bg-white p-4">
            <div className="text-[10px] font-semibold uppercase text-[#ef4444] mb-2">Current — 8 hues on paper</div>
            <div className="space-y-1.5 text-[13px]" style={{ color: '#171a21' }}>
              <div>Revenue <b style={{ color: '#0fa96c' }}>+81%</b> · Spend <b style={{ color: '#dd5a5a' }}>+0%</b></div>
              <div>ROAS <b style={{ color: '#c8920b' }}>25.9x</b> · CAC <b style={{ color: '#e0902e' }}>12.6</b></div>
              <div className="text-[11px]" style={{ color: '#969eab' }}>Two greens, two reds, two ambers…</div>
            </div>
          </div>
          <div className="rounded-lg border border-[var(--hairline)] bg-white p-4">
            <div className="text-[10px] font-semibold uppercase text-[var(--positive)] mb-2">Proposed — ink + gold</div>
            <div className="space-y-1.5 text-[13px]" style={{ color: '#171a21' }}>
              <div>Revenue <b style={{ color: '#0fa96c' }}>+81%</b> · Spend <b>±0%</b></div>
              <div>ROAS <b style={{ color: '#c8920b' }}>25.9x</b> · CAC <b>12.6</b></div>
              <div className="text-[11px]" style={{ color: '#565d6b' }}>One green, one gold, ink for the rest — print-calm.</div>
            </div>
          </div>
        </div>
      </ProtoShell>

      {/* ── P4 COUPON ROI */}
      <ProtoShell p={PROTOS[3]} verdicts={verdicts} set={set}>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Recovered by coupons</div>
            <div className="text-4xl font-extrabold text-[var(--text-primary)] tabular-nums mt-1">3,470 <span className="text-lg font-bold">SAR</span></div>
            <div className="text-xs text-[var(--text-muted)] mt-1">7 carts rescued · 4 codes in play</div>
          </div>
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-end gap-2 h-24">
              {[30, 45, 35, 60, 52, 78, 100].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%`, background: i === 6 ? 'var(--brand)' : 'var(--track)' }} />
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
              <span>6w ago</span><span>last week</span><span className="font-semibold" style={{ color: 'var(--brand)' }}>this week</span>
            </div>
          </div>
        </div>
      </ProtoShell>

      {/* ── P5 COMMAND PALETTE */}
      <ProtoShell p={PROTOS[4]} verdicts={verdicts} set={set}>
        <div className="max-w-md mx-auto">
          <div className="rounded-xl border border-[var(--hairline)] bg-[var(--card)] shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--hairline)] flex items-center gap-2">
              <Command size={14} style={{ color: 'var(--brand)' }} />
              <span className="text-sm text-[var(--text-muted)]">Type a command or search…</span>
              <span className="ml-auto text-[10px] text-[var(--text-muted)] border border-[var(--hairline)] rounded px-1.5 py-0.5">ESC</span>
            </div>
            <div className="px-2 py-2 space-y-0.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-2 py-1">Navigate</div>
              {[['Orders', ShoppingBag], ['Cart Recovery', HeartPulse], ['Customers', Users]].map(([label, Icon]: any) => (
                <div key={label} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs hover:bg-[var(--hover)]">
                  <Icon size={13} className="text-[var(--text-muted)]" /> {label}
                </div>
              ))}
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-2 py-1 pt-2">Actions</div>
              {[['Log numbers', BarChart3], ['Mint a coupon', FileText]].map(([label, Icon]: any) => (
                <div key={label} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs hover:bg-[var(--hover)]">
                  <Icon size={13} className="text-[var(--text-muted)]" /> {label}
                </div>
              ))}
            </div>
          </div>
          <div className="text-[11px] text-[var(--text-muted)] text-center mt-2">QuickAdd, navigation and actions — one ⌘K away.</div>
        </div>
      </ProtoShell>

      {/* ── P6 RETENTION HARMONY */}
      <ProtoShell p={PROTOS[5]} verdicts={verdicts} set={set}>
        <div className="space-y-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#ef4444] mb-2">Current — scattered saturation</div>
            <div className="flex flex-wrap gap-2">
              {[['Champions', '#d29a0c'], ['Loyal', '#3b82f6'], ['Promising', '#8b5cf6'], ['New', '#10b981'], ['One-time', '#64748b'], ['At Risk', '#f59e0b'], ['Dormant', '#ef4444']].map(([l, c]: any) => (
                <span key={l} className="chip text-xs" style={{ color: c, background: `${c}1a` }}>{l}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--positive)] mb-2">Proposed — one family, distinct hues</div>
            <div className="flex flex-wrap gap-2">
              {[['Champions', '#b8860b'], ['Loyal', '#9a7b0a'], ['Promising', '#7a6d9e'], ['New', '#4a8fa8'], ['One-time', '#64748b'], ['At Risk', '#b8742a'], ['Dormant', '#8a5a5a']].map(([l, c]: any) => (
                <span key={l} className="chip text-xs" style={{ color: c, background: `${c}18`, borderColor: `${c}40` }}>{l}</span>
              ))}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-2">Muted, equal saturation — the set reads as one system.</div>
          </div>
        </div>
      </ProtoShell>

      {/* Archive pointer */}
      <div className="glass-card px-5 py-4 text-xs text-[var(--text-muted)] flex items-center gap-2">
        <MessageSquare size={12} className="shrink-0" />
        <span>Sweep-one archive (7 shipped fixes) lives in the previous Lab revision — every item is in production today.</span>
      </div>
    </div>
  )
}
