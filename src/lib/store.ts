import { useSyncExternalStore } from 'react'
import type {
  Task,
  TaskStatus,
  TaskPriority,
  Department,
  Client,
  Profile,
  ClientAssignment,
  KpiDefinition,
  KpiSnapshot,
  KpiTarget,
  WeeklyObjective,
  KeyResult,
  Notification,
  Connection,
  SyncRun,
  DataSourceId,
  ChatMessage,
  ProductCandidate,
  ProductStatus,
  Campaign,
  CampaignMetric,
  CampaignPlatform,
  TaskComment,
  ClientReportNote,
} from '../types/database'
import type { AppState } from '../data/seed'
import { todayISO } from './date'
import { DONE_STATUSES } from './selectors'
import { backend as rawBackend } from './backend'
import { supabase } from './supabase'
import { toast } from './toast'
import { markPush, markRealtimeDown, markRealtimeUp, markSyncFail, markSyncOk } from './live'

type Listener = () => void

function emptyState(): AppState {
  const now = new Date().toISOString()
  return {
    version: 6,
    organization: {
      id: '',
      name: 'AFKAR Growth',
      slug: 'afkar-growth',
      settings: {},
      created_at: now,
      updated_at: now,
    },
    clients: [],
    profiles: [],
    clientAssignments: [],
    tasks: [],
    objectives: [],
    keyResults: [],
    kpiDefinitions: [],
    kpiTargets: [],
    kpiSnapshots: [],
    connections: [],
    syncLog: [],
    notifications: [],
    activity: [],
    messages: [],
    products: [],
    campaigns: [],
    campaignMetrics: [],
    taskComments: [],
    reportNotes: [],
    sallaCustomers: [],
    sallaOrders: [],
    sallaProducts: [],
    sallaReviews: [],
    shipments: [],
    orderSlas: [],
    orderTimeline: [],
    abandonedCarts: [],
    currentUserId: null,
    currentClientId: null,
    ready: false,
  }
}

let state: AppState = emptyState()
let bootstrapped = false
let refreshing = false
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<Listener>()

function notify() {
  listeners.forEach((listener) => listener())
}

function set(updater: (prev: AppState) => AppState) {
  state = updater(state)
  notify()
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

/** Notifications engine helper: builds a row for the bell. */
function makeNotification(
  id: string,
  userId: string,
  clientId: string,
  type: string,
  title: string,
  body: string | null,
  link: string | null,
): Notification {
  return {
    id,
    user_id: userId,
    client_id: clientId,
    type,
    title,
    body,
    link,
    is_read: false,
    created_at: new Date().toISOString(),
  }
}

/** THE TRUST LAYER. Every backend write goes through this proxy: a rejected
    promise is announced (toast), logged, and the store re-syncs from the
    server so the optimistic UI never keeps a lie on screen. */
function writeFailure(err: unknown) {
  console.error('Write failed:', err)
  toast.error(
    `Saved on this device only — it did not reach the database${
      err instanceof Error ? ` (${err.message})` : ''
    }. Reloading the truth.`,
  )
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => refreshFromServer(), 900)
}

const backend = new Proxy(rawBackend, {
  get(target, prop) {
    const value = Reflect.get(target, prop)
    if (typeof value !== 'function') return value
    return (...args: unknown[]) => {
      const out = (value as (...a: unknown[]) => unknown)(...args)
      if (out && typeof (out as Promise<unknown>).catch === 'function') {
        return (out as Promise<unknown>).catch((err: unknown) => {
          writeFailure(err)
          throw err
        })
      }
      return out
    }
  },
})

/** Re-pull server truth (used after failures and for future live sync). */
/** Re-pull server truth (used after failures, sync, and manual refresh). */
export async function refreshFromServer() {
  if (refreshing || !rawBackend.available) return
  refreshing = true
  try {
    const data = await rawBackend.loadAll()
    markSyncOk()
    set((s) => ({
      ...s,
      organization: data.organization ?? s.organization,
      clients: data.clients,
      profiles: data.profiles,
      clientAssignments: data.clientAssignments,
      tasks: data.tasks,
      objectives: data.objectives,
      keyResults: data.keyResults,
      kpiDefinitions: data.kpiDefinitions,
      kpiTargets: data.kpiTargets,
      kpiSnapshots: data.kpiSnapshots,
      connections: data.connections,
      syncLog: data.syncLog,
      notifications: data.notifications,
      activity: data.activity,
      messages: data.messages,
      products: data.products,
      campaigns: data.campaigns,
      campaignMetrics: data.campaignMetrics,
      taskComments: data.taskComments,
      reportNotes: data.reportNotes,
      sallaCustomers: data.sallaCustomers,
      sallaOrders: data.sallaOrders,
      sallaProducts: data.sallaProducts,
      sallaReviews: data.sallaReviews,
      shipments: data.shipments,
      orderSlas: data.orderSlas,
      orderTimeline: data.orderTimeline,
      abandonedCarts: data.abandonedCarts,
    }))
    sweepOverdue()
  } catch (err) {
    console.error('Refresh failed:', err)
    markSyncFail(err)
  } finally {
    refreshing = false
  }
}

async function bootstrap() {
  if (bootstrapped) return
  bootstrapped = true
  try {
    if (!backend.available) {
      set((s) => ({ ...s, organization: emptyState().organization, ready: true }))
      return
    }
    // Who is signed in? The profile linked to this auth user becomes the
    // current user; self-heal the link when the trigger has not run yet.
    const { data: userData } = await supabase!.auth.getUser()
    const authUser = userData?.user ?? null
    const data = await backend.loadAll()
    set((s) => {
      const next = {
        ...s,
        organization: data.organization ?? s.organization,
        clients: data.clients,
        profiles: data.profiles,
        clientAssignments: data.clientAssignments,
        tasks: data.tasks,
        objectives: data.objectives,
        keyResults: data.keyResults,
        kpiDefinitions: data.kpiDefinitions,
        kpiTargets: data.kpiTargets,
        kpiSnapshots: data.kpiSnapshots,
        connections: data.connections,
        syncLog: data.syncLog,
        notifications: data.notifications,
        activity: data.activity,
        messages: data.messages,
        products: data.products,
        campaigns: data.campaigns,
        campaignMetrics: data.campaignMetrics,
        taskComments: data.taskComments,
        reportNotes: data.reportNotes,
        sallaCustomers: data.sallaCustomers,
        sallaOrders: data.sallaOrders,
        sallaProducts: data.sallaProducts,
        sallaReviews: data.sallaReviews,
        shipments: data.shipments,
        orderSlas: data.orderSlas,
        orderTimeline: data.orderTimeline,
        abandonedCarts: data.abandonedCarts,
      }
      let currentUserId: string | null = null
      if (authUser) {
        const mine =
          next.profiles.find((p) => p.auth_user_id === authUser.id) ??
          next.profiles.find(
            (p) => p.email.toLowerCase() === (authUser.email ?? '').toLowerCase(),
          )
        currentUserId = mine?.id ?? null
        // Self-heal: write the link the trigger would have made.
        if (mine && !mine.auth_user_id) {
          backend.updateProfile(mine.id, { auth_user_id: authUser.id }).catch(() => undefined)
        }
      }
      const client = next.clients[0] ?? null
      return {
        ...next,
        currentUserId,
        currentClientId: client?.id ?? null,
      }
    })
  } catch (err) {
    console.error('bootstrap failed', err)
    toast.error('Could not load your workspace. Check the connection and reload.')
  } finally {
    bootstrapped = true
    set((s) => ({ ...s, ready: true }))
    sweepOverdue()
  }
}

export type TaskInput = {
  title: string
  description?: string
  department: Department | null
  priority: TaskPriority
  assigneeId: string | null
  reviewerId?: string | null
  dueDate: string | null
  status?: TaskStatus
}

export type ClientInput = {
  name: string
  domain: string
}

export type MemberInput = {
  fullName: string
  email: string
  role: Profile['role']
}

export type KpiInput = {
  name: string
  department: Department | null
  unit: KpiDefinition['unit']
  direction: KpiDefinition['direction']
  target: number
}

export type ObjectiveInput = {
  title: string
  description: string
  weekStart: string
  weekEnd: string
}

export const actions = {
  switchClient(clientId: string) {
    set((s) => ({ ...s, currentClientId: clientId }))
  },

  setCurrentUser(userId: string) {
    set((s) => ({ ...s, currentUserId: userId }))
  },

  addTask(input: TaskInput) {
    set((s) => {
      const clientId = s.currentClientId
      if (!clientId) return s
      const task: Task = {
        id: uid('task'),
        client_id: clientId,
        playbook_instance_id: null,
        title: input.title,
        description: input.description ?? null,
        brief: null,
        expected_output: null,
        success_criteria: null,
        status: input.status ?? 'backlog',
        priority: input.priority,
        assignee_id: input.assigneeId,
        reviewer_id: input.reviewerId ?? s.currentUserId,
        created_by: s.currentUserId,
        department: input.department,
        due_date: input.dueDate,
        started_at: null,
        completed_at: null,
        result: null,
        blocked_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      backend.insertTask(task).catch(() => undefined)
      // Notifications engine: the assignee hears about it immediately.
      if (input.assigneeId && input.assigneeId !== s.currentUserId) {
        const n = makeNotification(uid('ntf'), input.assigneeId, clientId, 'task_assigned', `New task: ${input.title}`, input.dueDate ? `Due ${input.dueDate}` : null, '/my-work')
        backend.insertNotification(n).catch(() => undefined)
        return { ...s, tasks: [...s.tasks, task], notifications: [n, ...s.notifications] }
      }
      return { ...s, tasks: [...s.tasks, task] }
    })
  },

  updateTask(id: string, patch: Partial<Task>) {
    set((s) => ({
      ...s,
      tasks: s.tasks.map((task) =>
        task.id === id
          ? { ...task, ...patch, updated_at: new Date().toISOString() }
          : task,
      ),
    }))
    backend
      .updateTask(id, { ...patch, updated_at: new Date().toISOString() })
      .catch((err) => console.error(err))
  },

  moveTask(id: string, status: TaskStatus) {
    set((s) => {
      const now = new Date().toISOString()
      const task = s.tasks.find((t) => t.id === id)
      let newNotifications: Notification[] | null = null
      if (task) {
        // Notifications engine: the right person hears about each transition.
        const actor = s.currentUserId
        const targets: Array<{ userId: string | null; type: string; title: string; link: string }> = []
        if (status === 'review' && task.reviewer_id && task.reviewer_id !== actor)
          targets.push({ userId: task.reviewer_id, type: 'task_review', title: `Review requested: ${task.title}`, link: '/tasks' })
        if (status === 'done' && task.created_by && task.created_by !== actor)
          targets.push({ userId: task.created_by, type: 'task_done', title: `Completed: ${task.title}`, link: '/tasks' })
        if (targets.length > 0) {
          newNotifications = targets
            .filter((t): t is { userId: string; type: string; title: string; link: string } => !!t.userId)
            .map((t) =>
              makeNotification(uid('ntf'), t.userId, task.client_id, t.type, t.title, null, t.link),
            )
          if (newNotifications.length > 0)
            newNotifications.forEach((n) => backend.insertNotification(n).catch(() => undefined))
          else newNotifications = null
        }
        backend
          .updateTask(id, {
            status,
            started_at: task.started_at ?? (status === 'in_progress' ? now : task.started_at),
            completed_at: status === 'done' ? now : task.completed_at,
            updated_at: now,
          })
          .catch(() => undefined)
      }
      const nextState: AppState = {
        ...s,
        tasks: s.tasks.map((t) =>
          t.id !== id
            ? t
            : {
                ...t,
                status,
                started_at: t.started_at ?? (status === 'in_progress' ? now : t.started_at),
                completed_at: status === 'done' ? now : t.completed_at,
                updated_at: now,
              },
        ),
      }
      return newNotifications
        ? { ...nextState, notifications: [...newNotifications, ...nextState.notifications] }
        : nextState
    })
  },

  deleteTask(id: string) {
    set((s) => ({ ...s, tasks: s.tasks.filter((task) => task.id !== id) }))
    backend.deleteTask(id).catch((err) => console.error(err))
  },

  addClient(input: ClientInput) {
    set((s) => {
      const client: Client = {
        id: uid('cli'),
        organization_id: s.organization.id,
        name: input.name,
        slug: input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        domain: input.domain || null,
        status: 'active',
        settings: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      backend.insertClient(client).catch((err) => console.error(err))
      return { ...s, clients: [...s.clients, client] }
    })
  },

  addMember(input: MemberInput) {
    set((s) => {
      const profile: Profile = {
        id: uid('usr'),
        organization_id: s.organization.id,
        email: input.email,
        full_name: input.fullName,
        avatar_url: null,
        role: input.role,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const assignment: ClientAssignment = {
        id: uid('ca'),
        user_id: profile.id,
        client_id: s.currentClientId ?? s.clients[0]?.id ?? null,
        created_at: new Date().toISOString(),
      }
      backend.insertProfile(profile).catch((err) => console.error(err))
      if (assignment.client_id) backend.insertAssignment(assignment).catch((err) => console.error(err))
      return {
        ...s,
        profiles: [...s.profiles, profile],
        clientAssignments: assignment.client_id
          ? [...s.clientAssignments, assignment]
          : s.clientAssignments,
      }
    })
  },

  updateOrganization(patch: Partial<{ name: string; slug: string; settings: Record<string, unknown> }>) {
    set((s) => ({
      ...s,
      organization: { ...s.organization, ...patch, updated_at: new Date().toISOString() },
    }))
    backend
      .updateOrganization(state.organization.id, { ...patch, updated_at: new Date().toISOString() })
      .catch((err) => console.error(err))
  },

  addKpi(input: KpiInput) {
    set((s) => {
      const clientId = s.currentClientId
      if (!clientId) return s
      const definition: KpiDefinition = {
        id: uid('kpi'),
        client_id: clientId,
        name: input.name,
        department: input.department,
        unit: input.unit,
        direction: input.direction,
        source: 'manual',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const snapshot: KpiSnapshot = {
        id: uid('snap'),
        kpi_id: definition.id,
        client_id: clientId,
        snapshot_date: todayISO(),
        value: input.target,
        source: 'manual',
        notes: null,
        created_at: new Date().toISOString(),
      }
      const target: KpiTarget = {
        id: uid('target'),
        kpi_id: definition.id,
        client_id: clientId,
        period_start: todayISO(),
        period_end: todayISO(),
        target_value: input.target,
        created_at: new Date().toISOString(),
      }
      backend.insertKpiDefinition(definition).catch((err) => console.error(err))
      backend.insertSnapshot(snapshot).catch((err) => console.error(err))
      backend.insertTarget(target).catch((err) => console.error(err))
      return {
        ...s,
        kpiDefinitions: [...s.kpiDefinitions, definition],
        kpiSnapshots: [...s.kpiSnapshots, snapshot],
        kpiTargets: [...s.kpiTargets, target],
      }
    })
  },

  updateKpiName(kpiId: string, name: string) {
    set((s) => ({
      ...s,
      kpiDefinitions: s.kpiDefinitions.map((d) =>
        d.id === kpiId ? { ...d, name, updated_at: new Date().toISOString() } : d,
      ),
    }))
    backend
      .updateKpiDefinition(kpiId, { name, updated_at: new Date().toISOString() })
      .catch((err) => console.error(err))
  },

  setKpiValue(kpiId: string, value: number) {
    set((s) => {
      const clientId = s.currentClientId
      if (!clientId) return s
      const date = todayISO()
      const rest = s.kpiSnapshots.filter(
        (snap) => !(snap.kpi_id === kpiId && snap.client_id === clientId && snap.snapshot_date === date),
      )
      // Deterministic id: one row per KPI per day, re-saving overwrites.
      const snapshot: KpiSnapshot = {
        id: `snap_${kpiId}_${date}`,
        kpi_id: kpiId,
        client_id: clientId,
        snapshot_date: date,
        value,
        source: 'manual',
        notes: null,
        created_at: new Date().toISOString(),
      }
      backend.insertSnapshot(snapshot).catch(() => undefined)
      return { ...s, kpiSnapshots: [...rest, snapshot] }
    })
  },

  setKpiValues(values: Record<string, number>, source: string = 'manual') {
    set((s) => {
      const clientId = s.currentClientId
      if (!clientId) return s
      const date = todayISO()
      let snapshots = s.kpiSnapshots
      const created: KpiSnapshot[] = []
      for (const [kpiId, value] of Object.entries(values)) {
        const definition = s.kpiDefinitions.find((d) => d.id === kpiId)
        if (!definition || definition.client_id !== clientId) continue
        snapshots = snapshots.filter(
          (snap) => !(snap.kpi_id === kpiId && snap.client_id === clientId && snap.snapshot_date === date),
        )
        const snapshot: KpiSnapshot = {
          id: `snap_${kpiId}_${date}`,
          kpi_id: kpiId,
          client_id: clientId,
          snapshot_date: date,
          value,
          source,
          notes: null,
          created_at: new Date().toISOString(),
        }
        snapshots = [...snapshots, snapshot]
        created.push(snapshot)
      }
      created.forEach((snapshot) => backend.insertSnapshot(snapshot).catch(() => undefined))
      return { ...s, kpiSnapshots: snapshots }
    })
  },

  connectSource(source: DataSourceId, clientId: string | null, config?: Record<string, unknown>) {
    set((s) => {
      const now = new Date().toISOString()
      const existing = s.connections.find((connection) => connection.id === source)
      const connection: Connection = existing
        ? {
            ...existing,
            client_id: clientId,
            connected: true,
            sync_error: null,
            config: { ...(existing.config ?? {}), ...(config ?? {}) },
            updated_at: now,
          }
        : {
            id: source,
            client_id: clientId,
            connected: true,
            last_sync_at: null,
            sync_error: null,
            config: config ?? null,
            created_at: now,
            updated_at: now,
          }
      backend.upsertConnection(connection).catch((err) => console.error(err))
      return {
        ...s,
        connections: [...s.connections.filter((c) => c.id !== source), connection],
      }
    })
  },

  disconnectSource(source: DataSourceId) {
    set((s) => {
      const connection = s.connections.find((c) => c.id === source)
      const updated = connection
        ? { ...connection, connected: false, updated_at: new Date().toISOString() }
        : null
      if (updated) backend.upsertConnection(updated).catch((err) => console.error(err))
      return {
        ...s,
        connections: s.connections.map((connection) =>
          connection.id === source
            ? { ...connection, connected: false, updated_at: new Date().toISOString() }
            : connection,
        ),
      }
    })
  },

  syncSource(source: DataSourceId) {
    set((s) => {
      const now = new Date().toISOString()
      const rowCount = s.kpiDefinitions.filter(
        (definition) => definition.source === source && definition.client_id === s.currentClientId,
      ).length
      const run: SyncRun = {
        id: uid('sync'),
        source,
        status: 'success',
        row_count: rowCount,
        error: null,
        synced_at: now,
      }
      const connection = s.connections.find((c) => c.id === source)
      const updated = connection
        ? { ...connection, connected: true, last_sync_at: now, sync_error: null, updated_at: now }
        : null
      backend.insertSyncRun(run).catch((err) => console.error(err))
      if (updated) backend.upsertConnection(updated).catch((err) => console.error(err))
      return {
        ...s,
        syncLog: [run, ...s.syncLog].slice(0, 30),
        connections: s.connections.map((connection) =>
          connection.id === source
            ? { ...connection, connected: true, last_sync_at: now, sync_error: null, updated_at: now }
            : connection,
        ),
      }
    })
  },

  logSyncRun(source: string, status: SyncRun['status'], rowCount: number, error: string | null) {
    set((s) => {
      const run: SyncRun = {
        id: uid('sync'),
        source,
        status,
        row_count: rowCount,
        error,
        synced_at: new Date().toISOString(),
      }
      backend.insertSyncRun(run).catch((err) => console.error(err))
      return { ...s, syncLog: [run, ...s.syncLog].slice(0, 30) }
    })
  },

  importKpiRows(
    source: 'excel' | 'google_sheets',
    rows: Array<{ name: string; value: number; date?: string }>,
    clientId: string | null,
    config?: Record<string, unknown>,
  ): number {
    const current = state
    if (!clientId) return 0
    const byName = new Map(
      current.kpiDefinitions
        .filter((d) => d.client_id === clientId && d.is_active)
        .map((d) => [d.name.toLowerCase(), d.id]),
    )
    const values: Record<string, number> = {}
    let matched = 0
    for (const row of rows) {
      const kpiId = byName.get(row.name.trim().toLowerCase())
      if (!kpiId) continue
      values[kpiId] = row.value
      matched++
    }
    if (matched === 0) {
      actions.logSyncRun(source, 'error', 0, 'No KPI names matched the sheet rows')
      return 0
    }
    actions.setKpiValues(values, source)
    set((s) => {
      const now = new Date().toISOString()
      const run: SyncRun = {
        id: uid('sync'),
        source,
        status: 'success',
        row_count: matched,
        error: null,
        synced_at: now,
      }
      const connection = s.connections.find((c) => c.id === source)
      const updated = connection
        ? {
            ...connection,
            connected: true,
            last_sync_at: now,
            sync_error: null,
            config: { ...(connection.config ?? {}), ...(config ?? {}) },
            updated_at: now,
          }
        : null
      backend.insertSyncRun(run).catch((err) => console.error(err))
      if (updated) backend.upsertConnection(updated).catch((err) => console.error(err))
      return {
        ...s,
        syncLog: [run, ...s.syncLog].slice(0, 30),
        connections: s.connections.map((connection) =>
          connection.id === source
            ? {
                ...connection,
                connected: true,
                last_sync_at: now,
                sync_error: null,
                config: { ...(connection.config ?? {}), ...(config ?? {}) },
                updated_at: now,
              }
            : connection,
        ),
      }
    })
    return matched
  },

  updateConnection(source: DataSourceId, patch: Partial<Connection>) {
    set((s) => ({
      ...s,
      connections: s.connections.map((connection) =>
        connection.id === source
          ? { ...connection, ...patch, updated_at: new Date().toISOString() }
          : connection,
      ),
    }))
    backend
      .upsertConnection({ ...state.connections.find((c) => c.id === source)!, ...patch, id: source, updated_at: new Date().toISOString() } as Connection)
      .catch((err) => console.error(err))
  },

  updateClient(id: string, patch: Partial<Client>) {
    set((s) => ({
      ...s,
      clients: s.clients.map((client) =>
        client.id === id ? { ...client, ...patch, updated_at: new Date().toISOString() } : client,
      ),
    }))
    backend.updateClient(id, { ...patch, updated_at: new Date().toISOString() }).catch((err) => console.error(err))
  },

  updateMember(id: string, patch: Partial<Profile>) {
    set((s) => ({
      ...s,
      profiles: s.profiles.map((profile) =>
        profile.id === id ? { ...profile, ...patch, updated_at: new Date().toISOString() } : profile,
      ),
    }))
    backend.updateProfile(id, { ...patch, updated_at: new Date().toISOString() }).catch((err) => console.error(err))
  },

  addObjective(input: ObjectiveInput) {
    set((s) => {
      const clientId = s.currentClientId
      if (!clientId) return s
      const objective: WeeklyObjective = {
        id: uid('obj'),
        client_id: clientId,
        title: input.title,
        description: input.description || null,
        week_start: input.weekStart,
        week_end: input.weekEnd,
        status: 'active',
        progress_pct: 0,
        created_by: s.currentUserId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      backend.insertObjective(objective).catch((err) => console.error(err))
      return { ...s, objectives: [...s.objectives, objective] }
    })
  },

  updateKeyResult(id: string, patch: Partial<KeyResult>) {
    set((s) => ({
      ...s,
      keyResults: s.keyResults.map((kr) =>
        kr.id === id ? { ...kr, ...patch, updated_at: new Date().toISOString() } : kr,
      ),
    }))
    backend.updateKeyResult(id, { ...patch, updated_at: new Date().toISOString() }).catch((err) => console.error(err))
  },

  markNotificationsRead() {
    set((s) => ({
      ...s,
      notifications: s.notifications.map((n: Notification) => ({ ...n, is_read: true })),
    }))
    backend.updateNotifications({ is_read: true }).catch((err) => console.error(err))
  },

  markNotificationRead(id: string) {
    set((s) => ({
      ...s,
      notifications: s.notifications.map((n: Notification) =>
        n.id === id ? { ...n, is_read: true } : n,
      ),
    }))
    backend.updateNotification(id, { is_read: true }).catch((err) => console.error(err))
  },

  sendMessage(body: string) {
    set((s) => {
      const clientId = s.currentClientId
      const authorId = s.currentUserId
      if (!clientId || !authorId || !body.trim()) return s
      const message: ChatMessage = {
        id: uid('msg'),
        client_id: clientId,
        author_id: authorId,
        body: body.trim(),
        created_at: new Date().toISOString(),
      }
      backend.insertMessage(message).catch(() => undefined)
      // INSTANT DELIVERY: broadcast to all connected devices immediately.
      if (chatChannel) {
        chatChannel.send({
          type: 'broadcast',
          event: 'new-message',
          payload: message as unknown as Record<string, unknown>,
        })
      }
      return { ...s, messages: [...s.messages, message] }
    })
  },

  addProduct(input: {
    name: string
    category: string | null
    sourceUrl: string | null
    competitor: string | null
    estimatedPrice: number | null
    demandEvidence: string | null
    notes: string | null
    scores: Partial<Record<'demand' | 'competition' | 'margin' | 'creative' | 'brandFit' | 'trend', number | null>>
  }) {
    set((s) => {
      const clientId = s.currentClientId
      if (!clientId) return s
      const product: ProductCandidate = {
        id: uid('prod'),
        client_id: clientId,
        name: input.name,
        category: input.category,
        source_url: input.sourceUrl,
        competitor: input.competitor,
        estimated_price: input.estimatedPrice,
        demand_evidence: input.demandEvidence,
        notes: input.notes,
        score_demand: input.scores.demand ?? null,
        score_competition: input.scores.competition ?? null,
        score_margin: input.scores.margin ?? null,
        score_creative: input.scores.creative ?? null,
        score_brand_fit: input.scores.brandFit ?? null,
        score_trend: input.scores.trend ?? null,
        status: 'discovered',
        decision_notes: null,
        researcher_id: s.currentUserId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      backend.insertProduct(product).catch(() => undefined)
      return { ...s, products: [...s.products, product] }
    })
    toast.success('Candidate added to the funnel.')
  },

  updateProduct(id: string, patch: Partial<ProductCandidate>) {
    set((s) => ({
      ...s,
      products: s.products.map((p) =>
        p.id === id ? { ...p, ...patch, updated_at: new Date().toISOString() } : p,
      ),
    }))
    backend
      .updateProduct(id, { ...patch, updated_at: new Date().toISOString() })
      .catch(() => undefined)
  },

  moveProduct(id: string, status: ProductStatus) {
    actions.updateProduct(id, { status })
  },

  deleteProduct(id: string) {
    set((s) => ({ ...s, products: s.products.filter((p) => p.id !== id) }))
    backend.deleteProduct(id).catch(() => undefined)
  },

  addCampaign(input: {
    name: string
    platform: CampaignPlatform
    budget: number | null
    objective: string | null
    startDate: string | null
  }) {
    set((s) => {
      const clientId = s.currentClientId
      if (!clientId) return s
      const campaign: Campaign = {
        id: uid('camp'),
        client_id: clientId,
        name: input.name,
        platform: input.platform,
        status: 'planned',
        budget: input.budget,
        objective: input.objective,
        start_date: input.startDate,
        end_date: null,
        created_by: s.currentUserId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      backend.insertCampaign(campaign).catch(() => undefined)
      return { ...s, campaigns: [...s.campaigns, campaign] }
    })
    toast.success('Campaign created.')
  },

  updateCampaign(id: string, patch: Partial<Campaign>) {
    set((s) => ({
      ...s,
      campaigns: s.campaigns.map((c) =>
        c.id === id ? { ...c, ...patch, updated_at: new Date().toISOString() } : c,
      ),
    }))
    backend.updateCampaign(id, { ...patch, updated_at: new Date().toISOString() }).catch(() => undefined)
  },

  deleteCampaign(id: string) {
    set((s) => ({
      ...s,
      campaigns: s.campaigns.filter((c) => c.id !== id),
      campaignMetrics: s.campaignMetrics.filter((m) => m.campaign_id !== id),
    }))
    backend.deleteCampaign(id).catch(() => undefined)
  },

  /** The media buyer's daily log. Deterministic id = one row per campaign
      per day; re-saving today's numbers overwrites instead of duplicating. */
  logMetric(input: {
    campaignId: string
    date: string
    impressions: number
    clicks: number
    spend: number
    purchases: number
    revenue: number
    notes?: string | null
  }) {
    set((s) => {
      const clientId = s.currentClientId
      if (!clientId) return s
      const metric: CampaignMetric = {
        id: `cm_${input.campaignId}_${input.date}`,
        campaign_id: input.campaignId,
        client_id: clientId,
        date: input.date,
        impressions: input.impressions,
        clicks: input.clicks,
        spend: input.spend,
        purchases: input.purchases,
        revenue: input.revenue,
        notes: input.notes ?? null,
        created_at: new Date().toISOString(),
      }
      backend.insertMetric(metric).catch(() => undefined)
      const rest = s.campaignMetrics.filter((m) => m.id !== metric.id)
      const campaignMetrics = [...rest, metric]

      // ---- AUTO-FEED: roll the day's numbers into per-platform KPIs.
      // Ad-attributed only: store Revenue (organic Salla sales) untouched,
      // and blended kpi_spend stays human-owned so ROAS never explodes
      // from a single day of campaign data.
      const byPlatform = new Map<CampaignPlatform, { spend: number; sales: number }>()
      for (const m of campaignMetrics) {
        if (m.client_id !== clientId || m.date !== input.date) continue
        const plat = s.campaigns.find((c) => c.id === m.campaign_id)?.platform
        if (!plat || plat === 'salla' || plat === 'other') continue
        const cur = byPlatform.get(plat) ?? { spend: 0, sales: 0 }
        cur.spend += m.spend
        cur.sales += m.revenue
        byPlatform.set(plat, cur)
      }
      const PLATFORM_KPI: Record<string, [string, string]> = {
        snap_ads: ['kpi_snap_spend', 'kpi_snap_sales'],
        google_ads: ['kpi_google_spend', 'kpi_google_sales'],
        tiktok_ads: ['kpi_tiktok_spend', 'kpi_tiktok_sales'],
      }
      // NOTE: we deliberately do NOT feed the blended kpi_spend here -
      // that number is the business's weekly marketing budget, owned by
      // the human. Campaign feeds only touch per-platform actuals, so
      // derived ROAS (Sales/Spend) never explodes from a single day.

      const feeds: Array<{ kpiId: string; value: number }> = []
      for (const [plat, agg] of byPlatform) {
        const ids = PLATFORM_KPI[plat]
        if (ids) {
          feeds.push({ kpiId: ids[0], value: agg.spend })
          feeds.push({ kpiId: ids[1], value: agg.sales })
        }
      }
      const feedKpis = new Set(feeds.map((f) => f.kpiId))
      let kpiSnapshots = s.kpiSnapshots.filter(
        (snap) =>
          !(
            snap.client_id === clientId &&
            snap.snapshot_date === input.date &&
            feedKpis.has(snap.kpi_id)
          ),
      )
      for (const f of feeds) {
        const snap: KpiSnapshot = {
          id: `snap_${f.kpiId}_${input.date}`,
          kpi_id: f.kpiId,
          client_id: clientId,
          snapshot_date: input.date,
          value: Math.round(f.value * 100) / 100,
          source: `campaign:${input.campaignId}`,
          notes: null,
          created_at: new Date().toISOString(),
        }
        kpiSnapshots = [...kpiSnapshots, snap]
        backend.insertSnapshot(snap).catch(() => undefined)
      }
      return { ...s, campaignMetrics, kpiSnapshots }
    })
    toast.success('Numbers logged. KPIs updated.')
  },

  addComment(taskId: string, content: string) {
    set((s) => {
      const authorId = s.currentUserId
      if (!authorId || !content.trim()) return s
      const comment: TaskComment = {
        id: uid('tcm'),
        task_id: taskId,
        user_id: authorId,
        content: content.trim(),
        created_at: new Date().toISOString(),
      }
      backend.insertComment(comment).catch(() => undefined)
      return { ...s, taskComments: [...s.taskComments, comment] }
    })
  },

  /** Upsert the human narrative layer for one report week. */
  saveReportNote(input: {
    weekStart: string
    weekEnd: string
    execSummary?: string | null
    whatWorked?: string | null
    whatDidnt?: string | null
    nextWeek?: string | null
  }) {
    set((s) => {
      const clientId = s.currentClientId
      if (!clientId) return s
      const existing = s.reportNotes.find(
        (r) => r.client_id === clientId && r.week_start === input.weekStart,
      )
      const row: ClientReportNote = {
        id: existing?.id ?? uid('rep'),
        client_id: clientId,
        week_start: input.weekStart,
        week_end: input.weekEnd,
        exec_summary: input.execSummary ?? null,
        what_worked: input.whatWorked ?? null,
        what_didnt: input.whatDidnt ?? null,
        next_week: input.nextWeek ?? null,
        created_by: s.currentUserId,
        created_at: existing?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      backend.insertReportNote(row).catch(() => undefined)
      return {
        ...s,
        reportNotes: [...s.reportNotes.filter((r) => r.id !== row.id), row],
      }
    })
    toast.success('Report notes saved.')
  },

  clearReportNote(weekStart: string) {
    set((s) => ({
      ...s,
      reportNotes: s.reportNotes.filter((r) => !(r.client_id === s.currentClientId && r.week_start === weekStart)),
    }))
  },

  /** Slack-style emoji reaction toggle. */
  toggleReaction(messageId: string, emoji: string) {
    set((s) => {
      const me = s.currentUserId
      if (!me) return s
      const messages = s.messages.map((m) => {
        if (m.id !== messageId) return m
        const reactions = { ...(m.reactions ?? {}) }
        const list = reactions[emoji] ?? []
        reactions[emoji] = list.includes(me) ? list.filter((u) => u !== me) : [...list, me]
        if (reactions[emoji].length === 0) delete reactions[emoji]
        return { ...m, reactions }
      })
      const updated = messages.find((m) => m.id === messageId)
      if (updated) backend.patchMessage(messageId, { reactions: updated.reactions ?? {} }).catch(() => undefined)
      return { ...s, messages }
    })
  },

  editMessage(messageId: string, body: string) {
    set((s) => ({
      ...s,
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, body: body.trim(), edited_at: new Date().toISOString() } : m,
      ),
    }))
    backend.patchMessage(messageId, { body: body.trim(), edited_at: new Date().toISOString() }).catch(() => undefined)
  },

  deleteMessage(messageId: string) {
    set((s) => ({ ...s, messages: s.messages.filter((m) => m.id !== messageId) }))
    backend.deleteMessage(messageId).catch(() => undefined)
  },

  resetAll() {
    set(() => emptyState())
  },
}

export function useAppState() {
  return useSyncExternalStore(subscribe, getState)
}

export function useApp() {
  return { state: useAppState(), actions }
}

function subscribe(cb: Listener) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getState() {
  return state
}

/** OVERDUE SWEEP: any task past due and not done/blocked pings its assignee
    once. Idempotent - the dedupe key (assignee+title) means re-runs and
    realtime refreshes never duplicate a bell. */
function sweepOverdue() {
  set((s) => {
    const clientId = s.currentClientId
    const actor = s.currentUserId
    if (!clientId || !actor) return s
    const today = todayISO()
    const seen = new Set(
      s.notifications.filter((n) => n.type === 'task_overdue').map((n) => `${n.user_id}:${n.title}`),
    )
    const fresh: Notification[] = []
    for (const t of s.tasks) {
      if (!t.assignee_id || !t.due_date || t.due_date >= today) continue
      if (DONE_STATUSES.includes(t.status) || t.status === 'blocked') continue
      const key = `${t.assignee_id}:${t.title}`
      if (seen.has(key)) continue
      fresh.push(
        makeNotification(uid('ntf'), t.assignee_id, clientId, 'task_overdue', `Overdue: ${t.title}`, `Was due ${t.due_date}`, '/my-work'),
      )
      seen.add(key)
    }
    if (fresh.length === 0) return s
    fresh.forEach((n) => backend.insertNotification(n).catch(() => undefined))
    return { ...s, notifications: [...fresh, ...s.notifications] }
  })
}

export function initStore() {
  bootstrap()
  startLiveSync()
}

/** Sign-out: wipe to a clean signed-out state so a stale workspace never
    lingers on screen; the next sign-in re-bootstraps from scratch. */
export function resetForSignOut() {
  bootstrapped = false
  state = { ...emptyState(), ready: true }
  notify()
}

let liveSyncStarted = false
let liveChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null
let chatChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null

let typingUsers: Array<{ name: string; role: string }> = []

/** Broadcast a typing indicator to other team members. */
export function broadcastTyping(userName: string, userRole: string) {
  if (!liveChannel || !supabase) return
  liveChannel.send({
    type: 'broadcast',
    event: 'typing',
    payload: { name: userName, role: userRole, at: Date.now() },
  })
}

export function subscribeTyping(cb: (users: Array<{ name: string; role: string }>) => void) {
  if (!liveChannel) return () => {}
  liveChannel.on('broadcast', { event: 'typing' }, (payload: { payload?: { name?: string; role?: string } }) => {
    const p = payload.payload
    if (!p?.name) return
    const idx = typingUsers.findIndex((u) => u.name === p.name)
    if (idx >= 0) typingUsers.splice(idx, 1)
    typingUsers.push({ name: p.name, role: p.role ?? '' })
    cb([...typingUsers])
    setTimeout(() => {
      typingUsers = typingUsers.filter((u) => u.name !== p.name)
      cb([...typingUsers])
    }, 3000)
  })
  return () => {}
}

/** LIVE SYNC. Supabase Realtime pushes INSERT/UPDATE/DELETE on the tables
    in the supabase_realtime publication; we debounce one server re-pull so
    every open device converges without a manual refresh. If the publication
    is not set up yet (schema not re-run) this simply never fires - graceful. */
function startLiveSync() {
  if (!supabase || liveSyncStarted) return
  liveSyncStarted = true

  // Dedicated chat channel: instant message delivery via broadcast.
  chatChannel = supabase.channel('afkar-chat')
  chatChannel.on('broadcast', { event: 'new-message' }, (payload) => {
    const msg = payload.payload as unknown as ChatMessage
    if (!msg?.id) return
    set((s) => {
      // Deduplicate: skip if already present (from postgres_changes refresh)
      if (s.messages.some((m) => m.id === msg.id)) return s
      return { ...s, messages: [...s.messages, msg] }
    })
  })
  chatChannel.subscribe()

  liveChannel = supabase.channel('afkar-live-sync', {
    config: { broadcast: { self: false } },
  })
  liveChannel.on('broadcast', { event: 'typing' }, () => {
    window.dispatchEvent(new CustomEvent('afkar-typing', {
      detail: { at: Date.now() },
    }))
  })
  // Webhook push-signal: Salla events announce themselves → near-instant refresh
  liveChannel.on('broadcast', { event: 'salla-sync' }, () => {
    markPush()
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => refreshFromServer(), 60)
  })
  for (const table of ['messages', 'tasks', 'product_candidates', 'kpi_snapshots', 'task_comments', 'campaigns', 'campaign_metrics', 'orders', 'customers', 'store_products', 'reviews']) {
    liveChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      () => {
        markPush()
        if (refreshTimer) clearTimeout(refreshTimer)
        refreshTimer = setTimeout(() => refreshFromServer(), 120)
      },
    )
  }
  liveChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') markRealtimeUp()
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      markRealtimeDown(`Realtime ${String(status).toLowerCase()} — retrying via polling`)
      // attempt one rejoin after a beat
      setTimeout(() => { try { liveChannel?.subscribe() } catch { /* noop */ } }, 5000)
    }
  })

  // ── Safety-net poll: refresh store data every 25s while the tab is visible.
  // Realtime handles instant push once the publication is enabled; this
  // guarantees freshness (webhook → DB → UI) even if realtime is blocked.
  // Pauses after 20 min of no interaction to save quota.
  let lastActivity = Date.now()
  const bump = () => { lastActivity = Date.now() }
  window.addEventListener('keydown', bump, { passive: true })
  window.addEventListener('pointerdown', bump, { passive: true })
  window.addEventListener('wheel', bump, { passive: true })
  if (!pollTimer) {
    pollTimer = setInterval(() => {
      if (document.hidden) return
      if (Date.now() - lastActivity > 20 * 60_000) return
      void refreshFromServer()
    }, 25_000)
  }
}
