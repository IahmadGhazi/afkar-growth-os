import { Printer } from 'lucide-react'
import { useApp } from '../../lib/store'
import {
  currentClient,
  isTaskOverdue,
  tasksForClient,
  kpisForClient,
  activeObjective,
  departmentLabel,
  DEPARTMENT_LABELS,
  DONE_STATUSES,
  changePct,
  platformResults,
  isPlatformKpi,
} from '../../lib/selectors'
import { TrendChart, type TrendDatum } from '../../components/shared/charts'
import { buildBriefing, kpiSeriesFor } from '../../lib/insights'
import { formatFull } from '../../lib/date'

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

const trendOrder: { name: string; mode: 'area' | 'bar' | 'line' }[] = [
  { name: 'Revenue', mode: 'area' },
  { name: 'Orders', mode: 'bar' },
  { name: 'ROAS', mode: 'line' },
  { name: 'Spend', mode: 'bar' },
]

function TrendBlock({
  name,
  series,
  current,
  format,
  mode,
  target,
  targetLabel,
  formatY,
}: {
  name: string
  series: TrendDatum[]
  current: number
  format: (v: number) => string
  mode: 'area' | 'bar' | 'line'
  target?: number
  targetLabel?: string
  formatY?: (v: number) => string
}) {
  return (
    <div className="break-inside-avoid">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-semibold text-[#171a21]">{name}</span>
        <span className="text-base font-bold text-[#171a21]">{format(current)}</span>
      </div>
      <TrendChart
        data={series}
        mode={mode}
        formatValue={formatY ?? compact}
        target={target}
        targetLabel={targetLabel}
      />
    </div>
  )
}

export function Report() {
  const { state } = useApp()
  const client = currentClient(state)
  const clientId = state.currentClientId
  const tasks = tasksForClient(state, clientId)
  const kpis = kpisForClient(state, clientId)
  const objective = activeObjective(state, clientId)
  const keyResults = state.keyResults.filter((kr) => kr.objective_id === objective?.id)
  const briefing = buildBriefing(state, clientId)
  const platform = platformResults(state, clientId)

  const period = objective
    ? `${formatFull(objective.week_start)} — ${formatFull(objective.week_end)}`
    : formatFull(new Date().toISOString())

  const overdueTasks = tasks.filter(
    (task) => isTaskOverdue(task) && task.status !== 'blocked' && task.status !== 'review',
  )
  const blockedTasks = tasks.filter((task) => task.status === 'blocked')
  const reviewTasks = tasks.filter((task) => task.status === 'review')
  const doneThisWeek = tasks.filter((task) => DONE_STATUSES.includes(task.status)).length
  const attentionTasks = [...overdueTasks, ...blockedTasks, ...reviewTasks]
    .filter((task, index, all) => all.findIndex((t) => t.id === task.id) === index)
    .slice(0, 6)

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
      const percentage = relevant.length === 0 ? 0 : Math.round((done / relevant.length) * 100)
      return { department: departmentLabel(department), done, total: relevant.length, percentage }
    })
    .filter(Boolean) as { department: string; done: number; total: number; percentage: number }[]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="no-print flex items-center justify-between mb-5">
        <div className="text-sm text-[var(--text-muted)]">
          Ready for print or PDF export
        </div>
        <button onClick={() => window.print()} className="btn btn-primary">
          <Printer size={15} /> Print / Save as PDF
        </button>
      </div>

      <div className="report-sheet bg-white rounded-2xl p-8 md:p-10 shadow-[0_1px_2px_rgba(22,26,34,0.06),0_24px_64px_rgba(22,26,34,0.12)] text-[#171a21]">
        {/* Masthead */}
        <div className="flex items-start justify-between border-b border-[rgba(22,26,34,0.12)] pb-6">
          <div>
            <div className="text-[11px] font-extrabold tracking-[0.18em] text-[#4d63f2]">
              AFKAR GROWTH OS
            </div>
            <h1 className="text-2xl font-extrabold mt-1">Client Performance Report</h1>
            <div className="text-sm text-[#565d6b] mt-1">
              {client?.name}
              {client?.domain ? ` · ${client.domain}` : ''}
            </div>
          </div>
          <div className="text-right text-sm text-[#565d6b]">
            <div>Period</div>
            <div className="font-semibold text-[#171a21]">{period}</div>
            <div className="mt-1">Generated {formatFull(new Date().toISOString())}</div>
          </div>
        </div>

        {/* AI Briefing */}
        <div className="py-6">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#4d63f2] mb-2">
            Management Summary
          </div>
          <p className="text-sm leading-relaxed text-[#33373f]">{briefing.summary}</p>
        </div>

        {/* KPI grid */}
        <div className="py-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#969eab] mb-3">
            Key Metrics
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-[rgba(22,26,34,0.08)] rounded-xl overflow-hidden">
            {kpis.filter((kpi) => !isPlatformKpi(kpi.name)).map((kpi) => {
              const format = unitFormats[kpi.unit ?? 'count']
              const change = kpi.previous != null ? changePct(kpi.current, kpi.previous) : null
              const invert = kpi.direction === 'lower_better'
              const good = change == null ? true : invert ? change.startsWith('-') : !change.startsWith('-')
              return (
                <div key={kpi.id} className="bg-white p-3.5">
                  <div className="text-xs text-[#969eab]">{kpi.name}</div>
                  <div className="text-lg font-bold mt-0.5">{format(kpi.current)}</div>
                  <div className={`text-xs font-medium ${change ? (good ? 'text-[#0fa96c]' : 'text-[#dd5a5a]') : 'text-[#969eab]'}`}>
                    {change ? `${change} vs last week` : 'No history yet'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Platform Results */}
        <div className="py-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#969eab] mb-3">
            Platform Results — Spend &amp; Sales
          </div>
          <div className="rounded-xl border border-[rgba(22,26,34,0.1)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[rgba(22,26,34,0.05)] text-left text-xs text-[#565d6b]">
                  <th className="px-4 py-2.5 font-semibold">Platform</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Spend</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Sales</th>
                  <th className="px-4 py-2.5 font-semibold text-right">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(22,26,34,0.07)]">
                {platform.rows.map((row) => (
                  <tr key={row.platform}>
                    <td className="px-4 py-3 font-semibold text-[#171a21]">{row.platform}</td>
                    <td className="px-4 py-3 text-right text-[#33373f]">{Math.round(row.spend).toLocaleString()} SAR</td>
                    <td className="px-4 py-3 text-right text-[#33373f]">{Math.round(row.sales).toLocaleString()} SAR</td>
                    <td className="px-4 py-3 text-right font-medium text-[#33373f]">{row.spend > 0 ? `${row.roas.toFixed(2)}x` : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[rgba(77,99,242,0.08)] text-[#171a21]">
                  <td className="px-4 py-3 font-extrabold">Total across all platforms</td>
                  <td className="px-4 py-3 text-right font-bold">{Math.round(platform.totalSpend).toLocaleString()} SAR</td>
                  <td className="px-4 py-3 text-right font-bold">{Math.round(platform.totalSales).toLocaleString()} SAR</td>
                  <td className="px-4 py-3 text-right font-bold">{platform.totalRoas > 0 ? `${platform.totalRoas.toFixed(2)}x` : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Trends */}
        <div className="py-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#969eab] mb-3">
            Trends
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {trendOrder.map((t) => {
              const kpi = kpis.find((k) => k.name === t.name)
              if (!kpi) return null
              const format = unitFormats[kpi.unit ?? 'count']
              return (
                <TrendBlock
                  key={t.name}
                  name={t.name}
                  series={kpiSeriesFor(state, kpi.id, clientId)}
                  current={kpi.current}
                  format={format}
                  mode={t.mode}
                  formatY={kpi.unit === 'ratio' ? ratioCompact : compact}
                  target={kpi.target || undefined}
                  targetLabel={kpi.target ? `target ${t.name === 'ROAS' ? `${kpi.target.toFixed(1)}x` : compact(kpi.target)}` : undefined}
                />
              )
            })}
          </div>
        </div>

        {/* Execution health */}
        <div className="py-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#969eab] mb-3">
            Execution Health
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Done', value: doneThisWeek, tone: '#0fa96c' },
              { label: 'Awaiting review', value: reviewTasks.length, tone: '#4d63f2' },
              { label: 'Blocked', value: blockedTasks.length, tone: '#dd5a5a' },
              { label: 'Overdue', value: overdueTasks.length, tone: '#e0902e' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-[rgba(22,26,34,0.1)] p-3">
                <div className="text-xl font-bold" style={{ color: item.tone }}>{item.value}</div>
                <div className="text-xs text-[#969eab]">{item.label}</div>
              </div>
            ))}
          </div>

          {attentionTasks.length > 0 && (
            <div className="mt-3 rounded-xl border border-[rgba(22,26,34,0.1)] p-4">
              <div className="text-xs font-semibold text-[#565d6b] mb-2">Needs attention</div>
              <ul className="space-y-1.5">
                {attentionTasks.map((task) => (
                  <li key={task.id} className="text-sm flex gap-2">
                    <span className="text-[#969eab]">•</span>
                    <span className="text-[#33373f]">{task.title}</span>
                    <span className="ml-auto text-xs text-[#969eab] shrink-0">{departmentLabel(task.department)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Team execution */}
        <div className="py-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#969eab] mb-3">
            Department Execution
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teamExecution.length === 0 ? (
              <div className="text-sm text-[#969eab]">No tasks scheduled this period.</div>
            ) : teamExecution.map((dept) => (
              <div key={dept.department} className="rounded-xl border border-[rgba(22,26,34,0.1)] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">{dept.department}</span>
                  <span className="text-xs text-[#969eab]">{dept.done}/{dept.total} done</span>
                </div>
                <div className="h-1.5 bg-[rgba(22,26,34,0.08)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${dept.percentage}%`, backgroundColor: dept.percentage >= 70 ? '#4d63f2' : '#e0902e' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Objective + KRs */}
        {objective && (
          <div className="py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#969eab] mb-3">
              Weekly Objective
            </div>
            <div className="rounded-xl border border-[rgba(22,26,34,0.1)] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold">{objective.title}</span>
                <span className="text-sm font-semibold text-[#4d63f2]">{objective.progress_pct}%</span>
              </div>
              <div className="h-1.5 bg-[rgba(22,26,34,0.08)] rounded-full overflow-hidden mb-4">
                <div className="h-full rounded-full bg-[#4d63f2]" style={{ width: `${objective.progress_pct}%` }} />
              </div>
              {keyResults.length > 0 && (
                <ul className="space-y-1.5">
                  {keyResults.map((kr) => (
                    <li key={kr.id} className="flex items-center gap-2 text-sm">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            kr.status === 'achieved' ? '#0fa96c'
                            : kr.status === 'on_track' ? '#4d63f2'
                            : kr.status === 'at_risk' ? '#e0902e'
                            : '#dd5a5a',
                        }}
                      />
                      <span className="text-[#33373f]">{kr.title}</span>
                      {kr.metric_current != null && kr.metric_target != null && (
                        <span className="ml-auto text-xs text-[#969eab] shrink-0">
                          {kr.metric_current} / {kr.metric_target} {kr.metric_unit}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-6 mt-4 border-t border-[rgba(22,26,34,0.12)] flex items-center justify-between text-xs text-[#969eab]">
          <span>Generated by AFKAR Growth OS</span>
          <span>{client?.name ?? ''}</span>
        </div>
      </div>
    </div>
  )
}
