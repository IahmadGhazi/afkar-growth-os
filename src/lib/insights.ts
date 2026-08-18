import type { AppState } from '../data/seed'
import type { Client } from '../types/database'
import {
  kpisForClient,
  activeObjective,
  tasksForClient,
  isTaskOverdue,
  DONE_STATUSES,
  changePct,
} from './selectors'

const fmtCurrency = (v: number) => `${Math.round(v).toLocaleString(undefined)} SAR`
const fmtRatio = (v: number) => `${v.toFixed(2)}x`

export interface Briefing {
  summary: string
  highlights: string[]
}

export function cartOpportunity(client: Client | null, aov: number) {
  const carts = (client?.settings?.abandoned_carts as number | undefined) ?? 70000
  const recoveryRate = 0.1
  const potential = carts * aov
  const recoverable = potential * recoveryRate
  return { carts, aov, potential, recoverable, recoveryRate }
}

export interface SpendPacingInfo {
  weeklyBudget: number
  weekSpend: number
  usedPct: number
  changeWoW: string | null
  anomaly: string | null
  series: { date: string; value: number }[]
}

export function spendPacing(state: AppState, clientId: string | null): SpendPacingInfo | null {
  const kpis = kpisForClient(state, clientId)
  const spend = kpis.find((k) => k.name === 'Spend')
  if (!spend) return null
  const series = state.kpiSnapshots
    .filter((snap) => snap.kpi_id === spend.id && snap.client_id === clientId)
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
    .map((snap) => ({ date: snap.snapshot_date, value: snap.value }))
  const weeklyBudget = spend.target
  const weekSpend = spend.current
  const usedPct = weeklyBudget > 0 ? (weekSpend / weeklyBudget) * 100 : 0
  const changeWoW = spend.previous != null ? changePct(weekSpend, spend.previous) : null

  const changes: number[] = []
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].value
    if (prev > 0) changes.push(((series[i].value - prev) / prev) * 100)
  }

  let anomaly: string | null = null
  if (usedPct > 100) {
    anomaly = `Over budget — spend is ${usedPct.toFixed(0)}% of the ${fmtCurrency(weeklyBudget)} weekly budget.`
  } else if (changes.length > 0) {
    const last = changes[changes.length - 1]
    const baseline = changes.length > 1 ? changes.slice(0, -1).map(Math.abs) : []
    const avg = baseline.length ? baseline.reduce((a, b) => a + b, 0) / baseline.length : 0
    if (avg > 0 && Math.abs(last) > avg * 2.5 && Math.abs(last) > 8) {
      anomaly = `Spend ${last > 0 ? 'jumped' : 'dropped'} ${Math.abs(last).toFixed(0)}% week-over-week — check campaign delivery.`
    }
  }

  return { weeklyBudget, weekSpend, usedPct, changeWoW, anomaly, series }
}

export function buildBriefing(state: AppState, clientId: string | null): Briefing {
  const kpis = kpisForClient(state, clientId)
  const objective = activeObjective(state, clientId)
  const keyResults = state.keyResults.filter((kr) => kr.objective_id === objective?.id)
  const tasks = tasksForClient(state, clientId)
  const client = state.clients.find((c) => c.id === clientId) ?? null

  const revenue = kpis.find((k) => k.name === 'Revenue')
  const roas = kpis.find((k) => k.name === 'ROAS')
  const cac = kpis.find((k) => k.name === 'CAC')
  const orders = kpis.find((k) => k.name === 'Orders')
  const pacing = spendPacing(state, clientId)
  const aov = kpis.find((k) => k.name === 'AOV')?.current ?? 0

  const revenueChange = revenue?.previous != null ? changePct(revenue.current, revenue.previous) : null
  const revenueSentence = revenue
    ? `Revenue reached ${fmtCurrency(revenue.current)}${revenueChange ? ` (${revenueChange} week-over-week)` : ''} on ${orders ? `${Math.round(orders.current).toLocaleString()} orders` : 'strong order volume'}.`
    : ''
  const efficiencySentence = roas
    ? ` Advertising efficiency held at ${fmtRatio(roas.current)} blended ROAS${cac ? ` with CAC improving to ${cac.current.toFixed(2)} SAR` : ''} — every riyal of ad spend returned ${fmtRatio(roas.current)} riyals in revenue across channels.`
    : ''
  const pacingSentence = pacing
    ? ` Ad spend is pacing at ${pacing.usedPct.toFixed(0)}% of the ${fmtCurrency(pacing.weeklyBudget)} weekly budget${pacing.anomaly ? `, flagged: ${pacing.anomaly}` : ' with no abnormal swings.'}`
    : ''

  const atRisk = keyResults.filter((kr) => kr.status === 'at_risk' || kr.status === 'behind')
  const riskSentence = atRisk.length
    ? ` Execution risk sits with ${atRisk.map((kr) => `“${kr.title}”`).join(', ')} — ${atRisk.length} key result${atRisk.length > 1 ? 's are' : ' is'} at risk.`
    : ''

  const overdue = tasks.filter(isTaskOverdue)
  const blocked = tasks.filter((t) => t.status === 'blocked')
  const taskSentence = overdue.length || blocked.length
    ? ` ${overdue.length} task${overdue.length === 1 ? '' : 's'} overdue and ${blocked.length} blocked need attention.`
    : ''

  const opp = cartOpportunity(client, aov)
  const cartTask = tasks.find((t) => /abandoned/i.test(t.title))
  const cartSentence =
    opp.carts > 0
      ? ` The biggest untapped lever is cart recovery: ${opp.carts.toLocaleString()} abandoned carts represent ~${fmtCurrency(opp.potential)} of recoverable revenue${cartTask && !DONE_STATUSES.includes(cartTask.status) ? ', and the retargeting campaign is not live yet' : ''}.`
      : ''

  const summary = `${revenueSentence}${efficiencySentence}${pacingSentence}${riskSentence}${taskSentence}${cartSentence}`.trim()

  const highlights: string[] = []
  if (roas && roas.status === 'achieved') {
    highlights.push(`ROAS ${fmtRatio(roas.current)} vs ${roas.target} target — achieved`)
  }
  if (cac && cac.previous != null && cac.current < cac.previous) {
    highlights.push(`CAC improved to ${cac.current.toFixed(2)} SAR`)
  }
  if (pacing) {
    highlights.push(`Budget pacing at ${pacing.usedPct.toFixed(0)}% of ${fmtCurrency(pacing.weeklyBudget)}`)
  }
  if (atRisk.length) {
    highlights.push(`${atRisk.length} key result${atRisk.length > 1 ? 's' : ''} at risk`)
  }
  if (overdue.length) {
    highlights.push(`${overdue.length} task${overdue.length === 1 ? '' : 's'} overdue`)
  }
  if (opp.carts > 0) {
    highlights.push(`Cart recovery worth ~${fmtCurrency(opp.recoverable)} at 10% recovery — not launched`)
  }

  return { summary, highlights }
}

export function kpiSeriesFor(state: AppState, kpiId: string, clientId: string | null): { date: string; value: number }[] {
  return state.kpiSnapshots
    .filter((snap) => snap.kpi_id === kpiId && snap.client_id === clientId)
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
    .map((snap) => ({ date: snap.snapshot_date, value: snap.value }))
}
