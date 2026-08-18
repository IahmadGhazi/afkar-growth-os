import type {
  AppState,
} from '../data/seed'
import type {
  Client,
  Connection,
  DataSourceId,
  KpiDefinition,
  KpiSnapshot,
  Profile,
  Task,
  TaskStatus,
  WeeklyObjective,
} from '../types/database'
import { isPast, parseDate, todayISO } from './date'

export const DONE_STATUSES: TaskStatus[] = ['done', 'approved']
export const ACTIVE_STATUSES: TaskStatus[] = ['backlog', 'planned', 'in_progress', 'review', 'blocked']

export function currentClient(state: AppState): Client | null {
  return state.clients.find((client) => client.id === state.currentClientId) ?? null
}

export function currentUser(state: AppState): Profile | null {
  return state.profiles.find((profile) => profile.id === state.currentUserId) ?? null
}

export function getConnection(state: AppState, source: DataSourceId): Connection | null {
  return (state.connections ?? []).find((connection) => connection.id === source) ?? null
}

export function nameById(state: AppState, userId: string | null | undefined): string {
  if (!userId) return 'Unassigned'
  return state.profiles.find((profile) => profile.id === userId)?.full_name ?? 'Unknown'
}

export function isTaskOverdue(task: Task): boolean {
  return !DONE_STATUSES.includes(task.status) && isPast(task.due_date)
}

export function isTaskDueToday(task: Task): boolean {
  if (DONE_STATUSES.includes(task.status)) return false
  return task.due_date === todayISO()
}

export function isTaskThisWeek(task: Task, weekStart: string, weekEnd: string): boolean {
  if (DONE_STATUSES.includes(task.status)) return false
  const due = parseDate(task.due_date)
  if (!due) return false
  const start = parseDate(weekStart)
  const end = parseDate(weekEnd)
  if (!start || !end) return false
  return due >= start && due <= end
}

export function tasksForClient(state: AppState, clientId: string | null): Task[] {
  if (!clientId) return []
  return state.tasks.filter((task) => task.client_id === clientId)
}

export function tasksForUser(state: AppState, userId: string | null): Task[] {
  if (!userId) return []
  return state.tasks.filter((task) => task.assignee_id === userId)
}

export function activeObjective(state: AppState, clientId: string | null): WeeklyObjective | null {
  if (!clientId) return null
  const active = state.objectives
    .filter((objective) => objective.client_id === clientId && objective.status === 'active')
    .sort((a, b) => b.week_start.localeCompare(a.week_start))
  return active[0] ?? null
}

export type KpiWithValue = KpiDefinition & {
  current: number
  previous: number | null
  target: number
  progress: number
  status: 'achieved' | 'on_track' | 'at_risk' | 'behind'
}

function latestSnapshots(snapshots: KpiSnapshot[], kpiId: string): KpiSnapshot[] {
  return snapshots
    .filter((snap) => snap.kpi_id === kpiId)
    .sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date))
}

export function kpiValueFor(state: AppState, kpiId: string): number {
  const latest = latestSnapshots(state.kpiSnapshots, kpiId)[0]
  return latest?.value ?? 0
}

export function kpisForClient(state: AppState, clientId: string | null): KpiWithValue[] {
  if (!clientId) return []
  const definitions = state.kpiDefinitions.filter((kpi) => kpi.client_id === clientId)
  return definitions.map((definition) => {
    const snaps = latestSnapshots(state.kpiSnapshots, definition.id)
    const current = snaps[0]?.value ?? 0
    const previous = snaps[1]?.value ?? null
    const targetRow = state.kpiTargets
      .filter((target) => target.kpi_id === definition.id)
      .sort((a, b) => b.period_start.localeCompare(a.period_start))[0]
    const targetValue = targetRow?.target_value ?? (current || 1)

    const progress =
      definition.direction === 'higher_better'
        ? Math.min(100, (current / targetValue) * 100)
        : Math.min(100, (targetValue / (current || 1)) * 100)

    let status: KpiWithValue['status'] = 'on_track'
    if (definition.direction === 'higher_better') {
      if (current >= targetValue) status = 'achieved'
      else if (current >= targetValue * 0.85) status = 'on_track'
      else if (current >= targetValue * 0.7) status = 'at_risk'
      else status = 'behind'
    } else {
      if (current <= targetValue) status = 'achieved'
      else if (current <= targetValue * 1.15) status = 'on_track'
      else if (current <= targetValue * 1.3) status = 'at_risk'
      else status = 'behind'
    }

    return { ...definition, current, previous, target: targetValue, progress, status }
  })
}

export const DEPARTMENT_LABELS: Record<string, string> = {
  seo: 'SEO',
  media: 'Media',
  social: 'Social',
  design: 'Design',
  product_research: 'Product Research',
  management: 'Management',
}

export function departmentLabel(department: string | null | undefined): string {
  if (!department) return 'General'
  return DEPARTMENT_LABELS[department] ?? department
}

export function roleLabel(role: Profile['role']): string {
  const labels: Record<Profile['role'], string> = {
    super_admin: 'Super Admin',
    account_manager: 'Account Manager',
    owner: 'Owner',
    seo: 'SEO Specialist',
    media_buyer: 'Media Buyer',
    social_media: 'Social Media',
    designer: 'Designer',
    product_research: 'Product Researcher',
    viewer: 'Viewer',
  }
  return labels[role]
}

export function teamMemberStats(state: AppState, profile: Profile) {
  const tasks = tasksForUser(state, profile.id)
  const overdue = tasks.filter(isTaskOverdue).length
  const completedToday = tasks.filter(
    (task) => DONE_STATUSES.includes(task.status) && task.completed_at?.slice(0, 10) === todayISO(),
  ).length
  const active = tasks.filter((task) => ACTIVE_STATUSES.includes(task.status)).length
  return { active, completedToday, overdue, total: tasks.length }
}

export function changePct(current: number, previous: number | null): string | null {
  if (previous == null || previous === 0) return null
  const delta = ((current - previous) / previous) * 100
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${delta.toFixed(0)}%`
}

export interface PlatformResult {
  platform: string
  source: DataSourceId
  spend: number
  sales: number
  roas: number
}

export const PLATFORM_RESULTS: PlatformResult[] = [
  { platform: 'Salla', source: 'salla', spend: 0, sales: 0, roas: 0 },
  { platform: 'Snapchat', source: 'snap_ads', spend: 0, sales: 0, roas: 0 },
  { platform: 'TikTok', source: 'tiktok_ads', spend: 0, sales: 0, roas: 0 },
  { platform: 'Google Ads', source: 'google_ads', spend: 0, sales: 0, roas: 0 },
]

const PLATFORM_KPI_SUFFIXES = [' Spend', ' Sales']

export function isPlatformKpi(name: string): boolean {
  return PLATFORM_RESULTS.some((row) =>
    PLATFORM_KPI_SUFFIXES.some((suffix) => name === `${row.platform}${suffix}`),
  )
}

export function platformResults(state: AppState, clientId: string | null) {
  const kpis = kpisForClient(state, clientId)
  const rows = PLATFORM_RESULTS.map((row) => {
    const spend = kpis.find((kpi) => kpi.name === `${row.platform} Spend`)?.current ?? 0
    const sales = kpis.find((kpi) => kpi.name === `${row.platform} Sales`)?.current ?? 0
    return {
      platform: row.platform,
      source: row.source,
      spend,
      sales,
      roas: spend > 0 ? sales / spend : 0,
    }
  })
  const totalSpend = rows.reduce((sum, row) => sum + row.spend, 0)
  const totalSales = rows.reduce((sum, row) => sum + row.sales, 0)
  return { rows, totalSpend, totalSales, totalRoas: totalSpend > 0 ? totalSales / totalSpend : 0 }
}
