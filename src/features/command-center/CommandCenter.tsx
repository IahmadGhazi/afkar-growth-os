import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Target,
  ArrowRight,
  Activity,
  Play,
  CheckCheck,
  Undo2,
  Database,
  Sparkles,
  ShoppingCart,
  Gauge,
  FileText,
  CheckCircle2,
} from 'lucide-react'
import { useApp } from '../../lib/store'
import {
  currentClient,
  isTaskOverdue,
  tasksForClient,
  kpisForClient,
  activeObjective,
  changePct,
  departmentLabel,
  DEPARTMENT_LABELS,
  DONE_STATUSES,
  ACTIVE_STATUSES,
  getConnection,
  type KpiWithValue,
  platformResults,
  isPlatformKpi,
} from '../../lib/selectors'
import { Sparkline, TrendChart, type TrendDatum } from '../../components/shared/charts'
import {
  buildBriefing,
  spendPacing,
  cartOpportunity,
  kpiSeriesFor,
} from '../../lib/insights'
import { SectionTitle } from '../../components/shared/ui'
import { StorePulse } from '../pulse/StorePulse'
import { GoalGauge } from './GoalGauge'
import { formatFull } from '../../lib/date'
import type { DataSourceId } from '../../types/database'

interface StatCard {
  name: string
  value: string
  change: string | null
  good: boolean
  series: TrendDatum[]
}

const unitFormats: Record<string, (v: number) => string> = {
  currency: (v) => `${v.toLocaleString(undefined, { maximumFractionDigits: v < 100 ? 1 : 0 })} SAR`,
  count: (v) => Math.round(v).toLocaleString(),
  ratio: (v) => `${v.toFixed(2)}x`,
  percentage: (v) => `${v.toFixed(1)}%`,
}

const compact = (v: number): string => {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return `${Math.round(v)}`
}

const ratioCompact = (v: number): string => `${v.toFixed(1)}x`

const sourceChips: { id: DataSourceId; label: string }[] = [
  { id: 'salla', label: 'Salla' },
  { id: 'google_ads', label: 'Google Ads' },
  { id: 'tiktok_ads', label: 'TikTok Ads' },
  { id: 'snap_ads', label: 'Snapchat Ads' },
  { id: 'excel', label: 'Excel' },
  { id: 'google_sheets', label: 'Google Sheets' },
]

const trendOrder: { name: string; mode: 'area' | 'bar' | 'line' }[] = [
  { name: 'Revenue', mode: 'area' },
  { name: 'Orders', mode: 'bar' },
  { name: 'ROAS', mode: 'line' },
  { name: 'Spend', mode: 'bar' },
]

export function CommandCenter({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { state, actions } = useApp()
  const client = currentClient(state)
  const clientId = state.currentClientId
  const tasks = tasksForClient(state, clientId)
  const kpis = kpisForClient(state, clientId)
  const objective = activeObjective(state, clientId)

  const statCards: StatCard[] = kpis
    .filter((kpi) => !isPlatformKpi(kpi.name))
    .map((kpi: KpiWithValue) => {
    const format = unitFormats[kpi.unit ?? 'count']
    const change = kpi.previous != null ? changePct(kpi.current, kpi.previous) : null
    const changeNum = change ? parseFloat(change) : 0
    const isUp = changeNum >= 0
    const invert = kpi.direction === 'lower_better'
    return {
      name: kpi.name,
      value: format(kpi.current),
      change,
      good: change == null ? true : invert ? !isUp : isUp,
      series: kpiSeriesFor(state, kpi.id, clientId),
    }
  })

  const overdueTasks = tasks.filter(
    (task) => isTaskOverdue(task) && task.status !== 'blocked' && task.status !== 'review',
  )
  const blockedTasks = tasks.filter((task) => task.status === 'blocked')
  const reviewTasks = tasks.filter((task) => task.status === 'review')

  const weekStart = objective?.week_start
  const weekEnd = objective?.week_end
  const departments = Object.keys(DEPARTMENT_LABELS)
  const teamExecution = departments
    .map((department) => {
      const deptTasks = tasks.filter((task) => task.department === department)
      const relevant = weekStart && weekEnd
        ? deptTasks.filter((task) => {
            const due = task.due_date ?? ''
            return due >= weekStart && due <= weekEnd
          })
        : deptTasks
      if (relevant.length === 0) return null
      const done = relevant.filter((task) => DONE_STATUSES.includes(task.status)).length
      const active = relevant.filter((task) => ACTIVE_STATUSES.includes(task.status)).length
      const percentage = relevant.length === 0 ? 0 : Math.round((done / relevant.length) * 100)
      return { department: departmentLabel(department), done, active, total: relevant.length, percentage }
    })
    .filter(Boolean) as { department: string; done: number; active: number; total: number; percentage: number }[]

  const briefing = buildBriefing(state, clientId)
  const pacing = spendPacing(state, clientId)
  const platform = platformResults(state, clientId)
  const aov = kpis.find((k) => k.name === 'AOV')?.current ?? 0
  const opportunity = cartOpportunity(client, aov)
  const cartTask = tasks.find((t) => /abandoned/i.test(t.title))
  const cartLaunched = cartTask ? DONE_STATUSES.includes(cartTask.status) : false

  return (
    <div className="space-y-8">
      {client && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Activity size={14} />
          <span>{client.name} · local data · {formatFull(new Date().toISOString())}</span>
        </div>
      )}

      {/* Data sources strip */}
      <section>
        <div className="flex items-center gap-2 flex-wrap">
          <Database size={14} className="text-[var(--text-muted)]" />
          {sourceChips.map((source) => {
            const connection = getConnection(state, source.id)
            return (
              <button
                key={source.id}
                onClick={() => onNavigate?.('/data')}
                className={`chip cursor-pointer transition-all ${
                  connection?.connected
                    ? 'text-[var(--positive)] bg-[var(--positive-soft)]'
                    : 'hover:text-[var(--brand)]'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${connection?.connected ? 'bg-[var(--positive)] breathing-dot' : 'bg-[var(--text-muted)]'}`} />
                {source.label}
                {connection?.connected && '· connected'}
              </button>
            )
          })}
          <button
            onClick={() => onNavigate?.('/data')}
            className="text-sm text-[var(--brand)] hover:underline flex items-center gap-1 font-medium"
          >
            Log numbers <ArrowRight size={13} />
          </button>
        </div>
      </section>

      {/* Hero metrics — the two numbers the whole business hangs on */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
        {[...['Revenue', 'ROAS'].entries()].map(([idx, heroName]: [number, string]) => {
          const kpi = kpis.find((k) => k.name === heroName)
          if (!kpi) return null
          const format = unitFormats[kpi.unit ?? 'count']
          const change = kpi.previous != null ? changePct(kpi.current, kpi.previous) : null
          const changeNum = change ? parseFloat(change) : 0
          const isUp = changeNum >= 0
          const invert = kpi.direction === 'lower_better'
          const good = change == null ? true : invert ? !isUp : isUp
          return (
            <div key={heroName} className="glass-card hover-lift p-5 sm:p-6" style={{ '--i': idx } as React.CSSProperties}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--text-muted)]">{kpi.name}</div>
                  <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)] mt-2 break-words">
                    {format(kpi.current)}
                  </div>
                  <div className={`flex items-center gap-1 mt-3 text-xs sm:text-sm font-medium ${
                    change ? (good ? 'text-[var(--positive)]' : 'text-[var(--critical)]') : 'text-[var(--text-muted)]'
                  }`}>
                    {change ? (
                      <>
                        {change.startsWith('-') ? <TrendingDown size={15} /> : <TrendingUp size={15} />}
                        <span>{change}</span>
                        <span className="hidden sm:inline">vs last week</span>
                      </>
                    ) : 'No history yet'}
                  </div>
                </div>
                <div className="w-[90px] sm:w-[110px] shrink-0 self-end">
                  <Sparkline
                    data={kpiSeriesFor(state, kpi.id, clientId).map((d) => d.value)}
                    color={kpi.unit === 'ratio' ? '#f0c42e' : good ? '#19b87a' : '#dd5a5a'}
                  />
                </div>
              </div>
            </div>
          )
        })}

        {/* Growth Score — donut ring with animated fill + department bars */}
        {(() => {
          const scored = kpis.filter((k) => !isPlatformKpi(k.name))
          const points: Record<string, number> = { achieved: 1, on_track: 0.8, at_risk: 0.5, behind: 0.2 }
          const avg = (list: typeof scored) =>
            list.length === 0 ? 0 : Math.round((list.reduce((sum, k) => sum + points[k.status], 0) / list.length) * 100)
          const score = avg(scored)
          const tone = score >= 80 ? 'var(--positive)' : score >= 60 ? 'var(--brand)' : score >= 40 ? 'var(--warning)' : 'var(--critical)'
          const depts = Object.keys(DEPARTMENT_LABELS)
            .map((d) => ({ dept: d, list: scored.filter((k) => k.department === d) }))
            .filter((g) => g.list.length > 0)

          // Donut ring geometry
          const R = 42
          const C = 2 * Math.PI * R
          const dash = (score / 100) * C

          return (
            <div className="glass-card hover-lift p-5 sm:p-6 flex flex-col md:col-span-1">
              <div className="flex items-center gap-4">
                {/* Donut ring */}
                <div className="relative w-[88px] h-[88px] shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r={R} fill="none" stroke="var(--track)" strokeWidth="7" />
                    <circle
                      cx="50" cy="50" r={R} fill="none" stroke={tone} strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={`${dash} ${C}`}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-extrabold tabular-nums" style={{ color: tone }}>{score}</span>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">Growth Score</div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">out of 100</div>
                </div>
              </div>
              <div className="mt-auto pt-4 space-y-1.5">
                {depts.map(({ dept, list }) => {
                  const s = avg(list)
                  return (
                    <div key={dept} className="flex items-center gap-2 text-xs">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: s >= 80 ? 'var(--positive)' : s >= 60 ? 'var(--brand)' : s >= 40 ? 'var(--warning)' : 'var(--critical)' }}
                      />
                      <span className="text-[var(--text-secondary)] w-24 truncate">{departmentLabel(dept)}</span>
                      <div className="flex-1 h-1 rounded-full bg-[var(--track)] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${s}%`, backgroundColor: s >= 80 ? 'var(--positive)' : s >= 60 ? 'var(--brand)' : s >= 40 ? 'var(--warning)' : 'var(--critical)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </section>

      {/* Goal gauge — monthly target vs live run-rate */}
      <GoalGauge />

      {/* Key metrics — everything else, dense and scannable by department */}
      <section>
        <SectionTitle>Business Performance</SectionTitle>
        <div className="glass-card divide-y divide-[var(--hairline)] overflow-hidden">
          {statCards
            .filter((s) => s.name !== 'Revenue' && s.name !== 'ROAS')
            .map((stat) => (
              <div key={stat.name} className="px-4 sm:px-5 py-3 hover:bg-[var(--hover)] transition-colors first:rounded-t-[18px] last:rounded-b-[18px]">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-[var(--text-secondary)] truncate">{stat.name}</div>
                  </div>
                  <div className="hidden md:block w-[90px] shrink-0">
                    <Sparkline data={stat.series.map((d) => d.value)} color={stat.good ? '#19b87a' : stat.change ? '#dd5a5a' : '#d29a0c'} width={90} height={26} />
                  </div>
                  <div className="w-24 sm:w-28 text-right text-base sm:text-lg font-bold text-[var(--text-primary)] tabular-nums shrink-0">{stat.value}</div>
                  <div className={`w-14 sm:w-20 text-right text-xs font-medium shrink-0 ${
                    stat.change ? (stat.good ? 'text-[var(--positive)]' : 'text-[var(--critical)]') : 'text-[var(--text-muted)]'
                  }`}>
                    {stat.change ?? '—'}
                  </div>
                </div>
                {/* mobile: sparkline under the name */}
                <div className="sm:hidden mt-1.5 h-[22px] w-full max-w-[180px] opacity-80">
                  <Sparkline data={stat.series.map((d) => d.value)} color={stat.good ? '#19b87a' : stat.change ? '#dd5a5a' : '#d29a0c'} width={160} height={22} />
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* Platform Results */}
      <section>
        <SectionTitle>Platform Results</SectionTitle>
        <div className="glass-card p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {platform.rows.map((row) => (
              <div key={row.platform} className="rounded-xl border border-[var(--border)] p-4">
                <div className="text-sm font-semibold text-[var(--text-primary)]">{row.platform}</div>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">Spend</span>
                    <span className="font-semibold text-[var(--text-primary)]">{compact(row.spend)} SAR</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">Sales</span>
                    <span className="font-semibold text-[var(--text-primary)]">{compact(row.sales)} SAR</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">ROAS</span>
                    <span className={`font-semibold ${row.roas >= 4 ? 'text-[var(--positive)]' : 'text-[var(--warning)]'}`}>
                      {row.spend > 0 ? `${row.roas.toFixed(2)}x` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-[var(--border)] pt-4 text-sm">
            <div>
              <span className="text-[var(--text-muted)]">Total overall spend across all platforms: </span>
              <span className="font-bold text-[var(--text-primary)]">{compact(platform.totalSpend)} SAR</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Total overall sales across all platforms: </span>
              <span className="font-bold text-[var(--text-primary)]">{compact(platform.totalSales)} SAR</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Blended ROAS: </span>
              <span className="font-bold text-[var(--text-primary)]">
                {platform.totalSpend > 0 ? `${platform.totalRoas.toFixed(2)}x` : '—'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Performance Trends */}
      <section>
        <SectionTitle>Performance Trends</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trendOrder.map((t) => {
            const kpi = kpis.find((k) => k.name === t.name)
            if (!kpi) return null
            const format = unitFormats[kpi.unit ?? 'count']
            const series = kpiSeriesFor(state, kpi.id, clientId)
            const formatY = kpi.unit === 'ratio' ? ratioCompact : compact
            const targetLabel = kpi.target
              ? `target ${kpi.unit === 'ratio' ? `${kpi.target.toFixed(1)}x` : compact(kpi.target)}`
              : undefined
            return (
              <div key={t.name} className="glass-card p-5">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{t.name}</div>
                  <div className="text-lg font-bold text-[var(--text-primary)]">{format(kpi.current)}</div>
                </div>
                <TrendChart
                  data={series}
                  mode={t.mode}
                  formatValue={formatY}
                  target={kpi.target || undefined}
                  targetLabel={targetLabel}
                />
              </div>
            )
          })}
        </div>
      </section>

      {/* AI Briefing */}
      <section>
        <div className="glass-card p-6 bg-gradient-to-br from-[rgba(210,154,12,0.09)] to-[rgba(210,154,12,0.02)] border-[rgba(210,154,12,0.25)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-[var(--brand-soft)] flex items-center justify-center">
              <Sparkles size={18} className="text-[var(--brand)]" />
            </div>
            <div>
              <div className="font-semibold text-[var(--text-primary)]">AI Briefing</div>
              <div className="text-xs text-[var(--text-muted)]">Generated from your numbers</div>
            </div>
            <button
              onClick={() => onNavigate?.('/report')}
              className="ml-auto btn btn-outline text-xs px-3 py-2"
            >
              <FileText size={13} /> Weekly report
            </button>
          </div>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{briefing.summary}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {briefing.highlights.map((highlight, i) => (
              <span key={i} className="chip">
                <CheckCircle2 size={12} className="text-[var(--positive)]" />
                {highlight}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Abandoned Cart Opportunity */}
      <section>
        <div className="glass-card glass-danger p-6">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-[var(--warning-soft)] flex items-center justify-center shrink-0">
              <ShoppingCart size={20} className="text-[var(--warning)]" />
            </div>
            <div className="flex-1 min-w-[260px]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[var(--text-primary)]">
                  {opportunity.carts.toLocaleString()} abandoned carts
                </span>
                <span className="badge bg-[var(--warning-soft)] text-[var(--warning)]">
                  {cartLaunched ? 'Launched' : 'Not launched'}
                </span>
              </div>
              <div className="text-sm text-[var(--text-secondary)] mt-1">
                {opportunity.carts.toLocaleString()} carts × {Math.round(opportunity.aov)} SAR AOV ≈{' '}
                <span className="font-semibold text-[var(--text-primary)]">{Math.round(opportunity.potential).toLocaleString()} SAR</span>{' '}
                of recoverable revenue — ~{Math.round(opportunity.recoverable).toLocaleString()} SAR at a 10% recovery rate.
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {['Email recovery flow', 'WhatsApp broadcast', 'Retargeting campaign'].map((lever) => (
                  <span key={lever} className="chip">{lever}</span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              {cartTask && (
                <button
                  onClick={() => onNavigate?.('/tasks')}
                  className="btn btn-primary"
                >
                  Open cart recovery task <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Store Pulse — live heartbeat of the store */}
        <section className="lg:col-span-1 order-first lg:order-none">
          <SectionTitle>Store Pulse</SectionTitle>
          <StorePulse orders={state.sallaOrders ?? []} customers={state.sallaCustomers ?? []} products={state.sallaProducts ?? []} />
        </section>

        {/* Needs Attention */}
        <section className="lg:col-span-2">
          <SectionTitle>Needs Attention</SectionTitle>
          {overdueTasks.length + blockedTasks.length + reviewTasks.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <div className="text-sm font-semibold text-[var(--positive)]">Nothing needs you. Everything is moving.</div>
              <div className="text-sm text-[var(--text-muted)] mt-1">All tasks are on track.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {overdueTasks.map((task) => (
                <div
                  key={task.id}
                  className="glass-card flex items-center gap-3 p-4"
                >
                  <AlertTriangle size={18} className="text-[var(--warning)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[var(--text-primary)] truncate">{task.title}</div>
                    <div className="text-sm text-[var(--text-muted)]">
                      {departmentLabel(task.department)} · overdue
                    </div>
                  </div>
                  {task.status === 'planned' || task.status === 'backlog' ? (
                    <button
                      onClick={() => actions.moveTask(task.id, 'in_progress')}
                      className="btn btn-primary text-xs px-3 py-2"
                    >
                      <Play size={12} /> Start
                    </button>
                  ) : task.status === 'blocked' ? null : (
                    <button
                      onClick={() => actions.moveTask(task.id, 'done')}
                      className="btn btn-positive text-xs px-3 py-2"
                    >
                      <CheckCheck size={12} /> Complete
                    </button>
                  )}
                </div>
              ))}

              {blockedTasks.map((task) => (
                <div
                  key={task.id}
                  className="glass-card flex items-center gap-3 p-4"
                >
                  <AlertTriangle size={18} className="text-[var(--critical)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[var(--text-primary)] truncate">{task.title}</div>
                    <div className="text-sm text-[var(--text-muted)] truncate">
                      Blocked: {task.blocked_reason ?? 'reason not set'}
                    </div>
                  </div>
                  <button
                    onClick={() => actions.moveTask(task.id, 'in_progress')}
                    className="btn btn-outline text-xs px-3 py-2"
                  >
                    <Undo2 size={12} /> Unblock
                  </button>
                </div>
              ))}

              {reviewTasks.map((task) => (
                <div
                  key={task.id}
                  className="glass-card flex items-center gap-3 p-4"
                >
                  <Clock size={18} className="text-[var(--brand)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[var(--text-primary)] truncate">{task.title}</div>
                    <div className="text-sm text-[var(--text-muted)]">
                      {departmentLabel(task.department)} · awaiting review
                    </div>
                  </div>
                  <button
                    onClick={() => actions.moveTask(task.id, 'approved')}
                    className="btn btn-positive text-xs px-3 py-2"
                  >
                    <CheckCheck size={12} /> Approve
                  </button>
                  <button
                    onClick={() => actions.moveTask(task.id, 'in_progress')}
                    className="btn btn-outline text-xs px-3 py-2"
                  >
                    <Undo2 size={12} /> Send back
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Spend Pacing & Anomaly */}
        <section>
          <SectionTitle>Spend Pacing & Anomaly</SectionTitle>
          {!pacing ? (
            <div className="glass-card p-4 text-sm text-[var(--text-muted)]">
              Add a Spend KPI to enable pacing tracking.
            </div>
          ) : (
            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-[var(--text-muted)]">Weekly budget used</div>
                  <div className={`text-3xl font-extrabold ${
                    pacing.usedPct > 100
                      ? 'text-[var(--critical)]'
                      : pacing.usedPct >= 90
                      ? 'text-[var(--warning)]'
                      : 'text-[var(--positive)]'
                  }`}>
                    {pacing.usedPct.toFixed(0)}%
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {Math.round(pacing.weekSpend).toLocaleString()} of {Math.round(pacing.weeklyBudget).toLocaleString()} SAR
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[var(--brand-soft)] flex items-center justify-center">
                  <Gauge size={20} className="text-[var(--brand)]" />
                </div>
              </div>
              <TrendChart
                data={pacing.series}
                mode="bar"
                color="#d29a0c"
                formatValue={compact}
                target={pacing.weeklyBudget}
                targetLabel="budget"
              />
              <div className={`flex items-start gap-2 text-sm p-3 rounded-xl ${
                pacing.anomaly
                  ? 'bg-[var(--warning-soft)] text-[var(--warning)]'
                  : 'bg-[var(--positive-soft)] text-[var(--positive)]'
              }`}>
                {pacing.anomaly ? (
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                )}
                <span>
                  {pacing.anomaly ?? 'No anomalies this week — spend tracking the budget.'}
                </span>
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                Weekly pacing from logged numbers. Daily spike detection activates when daily spend is logged or a source is connected.
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Objective Progress */}
        {objective && (
          <section className="lg:col-span-2">
            <SectionTitle>Weekly Objective</SectionTitle>
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-[var(--brand-soft)] flex items-center justify-center">
                  <Target size={18} className="text-[var(--brand)]" />
                </div>
                <span className="font-semibold text-[var(--text-primary)]">
                  {objective.title}
                </span>
                <span className="ml-auto text-sm text-[var(--text-muted)]">{objective.progress_pct}% complete</span>
              </div>
              <div className="h-2 bg-[var(--track)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#f0c42e] to-[#d29a0c] rounded-full"
                  style={{ width: `${objective.progress_pct}%` }}
                />
              </div>
            </div>
          </section>
        )}

        {/* Team Execution */}
        <section>
          <SectionTitle>Team Execution</SectionTitle>
          <div className="space-y-3">
            {teamExecution.length === 0 ? (
              <div className="glass-card p-4 text-sm text-[var(--text-muted)]">
                No tasks this week
              </div>
            ) : teamExecution.map((dept) => (
              <div
                key={dept.department}
                className="glass-card p-4"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {dept.department}
                  </span>
                  <span className="text-sm text-[var(--text-muted)]">
                    {dept.done}/{dept.total} done
                  </span>
                </div>
              <div className="h-2 bg-[var(--track)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      dept.percentage === 100
                        ? 'bg-gradient-to-r from-[#19b87a] to-[#0f9c68]'
                        : dept.percentage >= 70
                        ? 'bg-gradient-to-r from-[#f0c42e] to-[#d29a0c]'
                        : 'bg-gradient-to-r from-[#f2b04a] to-[#e0902e]'
                    }`}
                    style={{ width: `${dept.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
