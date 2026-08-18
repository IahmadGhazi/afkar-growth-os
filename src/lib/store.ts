import { useSyncExternalStore } from 'react'
import type {
  Task,
  TaskStatus,
  TaskPriority,
  Department,
  Client,
  Profile,
  KpiDefinition,
  WeeklyObjective,
  KeyResult,
  Notification,
  Connection,
  SyncRun,
  DataSourceId,
} from '../types/database'
import type { AppState } from '../data/seed'
import { buildSeed } from '../data/seed'
import { todayISO } from './date'

const STORAGE_KEY = 'afkar-growth-os:v1'

type Listener = () => void

interface Store<T> {
  get: () => T
  set: (updater: (prev: T) => T) => void
  subscribe: (listener: Listener) => () => void
  reset: () => void
}

function createStore<T extends object>(seed: () => T, key: string): Store<T> {
  let state: T = load() ?? seed()

  function load(): T | null {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<T>
      const seeded = seed()
      const appSeed = seeded as unknown as AppState
      const appParsed = parsed as unknown as Partial<AppState>
      if (appParsed.version !== appSeed.version) {
        const seedClientById = new Map(appSeed.clients.map((client) => [client.id, client]))
        const clients = (appParsed.clients ?? appSeed.clients)
          .filter((client) => client.id === 'cli_afkar')
          .map((client) => ({
            ...client,
            settings: {
              ...(seedClientById.get(client.id)?.settings ?? {}),
              ...client.settings,
            },
          }))
        return {
          ...seeded,
          ...parsed,
          version: appSeed.version,
          organization: {
            ...appSeed.organization,
            ...appParsed.organization,
            settings: {
              ...appSeed.organization.settings,
              ...(appParsed.organization?.settings ?? {}),
            },
          },
          clients,
          currentClientId: clients[0]?.id ?? appSeed.currentClientId,
          kpiDefinitions: appSeed.kpiDefinitions,
          kpiTargets: appSeed.kpiTargets,
          kpiSnapshots: appSeed.kpiSnapshots,
          objectives: appSeed.objectives,
          keyResults: appSeed.keyResults,
          connections: mergeConnections(appSeed.connections, appParsed.connections ?? []),
        } as T
      }
      return { ...seeded, ...parsed }
    } catch {
      return null
    }
  }

  const listeners = new Set<Listener>()

  return {
    get: () => state,
    set: (updater) => {
      state = updater(state)
      try {
        localStorage.setItem(key, JSON.stringify(state))
      } catch {
        // storage unavailable (private mode) - keep in-memory only
      }
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    reset: () => {
      state = seed()
      try {
        localStorage.removeItem(key)
      } catch {
        // ignore
      }
      listeners.forEach((listener) => listener())
    },
  }
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

function mergeConnections(seed: Connection[], stored: Connection[]): Connection[] {
  const storedById = new Map(stored.map((connection) => [connection.id, connection]))
  return seed.map((connection) => {
    const existing = storedById.get(connection.id)
    if (!existing) return connection
    return { ...connection, ...existing, config: existing.config ?? connection.config }
  })
}

const store = createStore<AppState>(buildSeed, STORAGE_KEY)

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
    store.set((s) => ({ ...s, currentClientId: clientId }))
  },

  setCurrentUser(userId: string) {
    store.set((s) => ({ ...s, currentUserId: userId }))
  },

  addTask(input: TaskInput) {
    store.set((s) => {
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
      return { ...s, tasks: [...s.tasks, task] }
    })
  },

  updateTask(id: string, patch: Partial<Task>) {
    store.set((s) => ({
      ...s,
      tasks: s.tasks.map((task) =>
        task.id === id
          ? { ...task, ...patch, updated_at: new Date().toISOString() }
          : task,
      ),
    }))
  },

  moveTask(id: string, status: TaskStatus) {
    store.set((s) => {
      const now = new Date().toISOString()
      return {
        ...s,
        tasks: s.tasks.map((task) => {
          if (task.id !== id) return task
          return {
            ...task,
            status,
            started_at: task.started_at ?? (status === 'in_progress' ? now : task.started_at),
            completed_at: status === 'done' ? now : task.completed_at,
            updated_at: now,
          }
        }),
      }
    })
  },

  deleteTask(id: string) {
    store.set((s) => ({ ...s, tasks: s.tasks.filter((task) => task.id !== id) }))
  },

  addClient(input: ClientInput) {
    store.set((s) => {
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
      return { ...s, clients: [...s.clients, client] }
    })
  },

  addMember(input: MemberInput) {
    store.set((s) => {
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
      const assignment = {
        id: uid('ca'),
        user_id: profile.id,
        client_id: s.currentClientId ?? s.clients[0]?.id ?? null,
        created_at: new Date().toISOString(),
      }
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
    store.set((s) => ({
      ...s,
      organization: { ...s.organization, ...patch, updated_at: new Date().toISOString() },
    }))
  },

  addKpi(input: KpiInput) {
    store.set((s) => {
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
      const snapshot = {
        id: uid('snap'),
        kpi_id: definition.id,
        client_id: clientId,
        snapshot_date: todayISO(),
        value: input.target,
        source: 'manual',
        notes: null,
        created_at: new Date().toISOString(),
      }
      const target = {
        id: uid('target'),
        kpi_id: definition.id,
        client_id: clientId,
        period_start: todayISO(),
        period_end: todayISO(),
        target_value: input.target,
        created_at: new Date().toISOString(),
      }
      return {
        ...s,
        kpiDefinitions: [...s.kpiDefinitions, definition],
        kpiSnapshots: [...s.kpiSnapshots, snapshot],
        kpiTargets: [...s.kpiTargets, target],
      }
    })
  },

  setKpiValue(kpiId: string, value: number) {
    store.set((s) => {
      const clientId = s.currentClientId
      if (!clientId) return s
      const date = todayISO()
      const rest = s.kpiSnapshots.filter(
        (snap) => !(snap.kpi_id === kpiId && snap.client_id === clientId && snap.snapshot_date === date),
      )
      const snapshot = {
        id: uid('snap'),
        kpi_id: kpiId,
        client_id: clientId,
        snapshot_date: date,
        value,
        source: 'manual',
        notes: null,
        created_at: new Date().toISOString(),
      }
      return { ...s, kpiSnapshots: [...rest, snapshot] }
    })
  },

  setKpiValues(values: Record<string, number>, source: string = 'manual') {
    store.set((s) => {
      const clientId = s.currentClientId
      if (!clientId) return s
      const date = todayISO()
      let snapshots = s.kpiSnapshots
      for (const [kpiId, value] of Object.entries(values)) {
        const definition = s.kpiDefinitions.find((d) => d.id === kpiId)
        if (!definition || definition.client_id !== clientId) continue
        snapshots = snapshots.filter(
          (snap) => !(snap.kpi_id === kpiId && snap.client_id === clientId && snap.snapshot_date === date),
        )
        snapshots = [
          ...snapshots,
          {
            id: uid('snap'),
            kpi_id: kpiId,
            client_id: clientId,
            snapshot_date: date,
            value,
            source,
            notes: null,
            created_at: new Date().toISOString(),
          },
        ]
      }
      return { ...s, kpiSnapshots: snapshots }
    })
  },

  connectSource(source: DataSourceId, clientId: string | null, config?: Record<string, unknown>) {
    store.set((s) => {
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
      return {
        ...s,
        connections: [...s.connections.filter((c) => c.id !== source), connection],
      }
    })
  },

  disconnectSource(source: DataSourceId) {
    store.set((s) => ({
      ...s,
      connections: s.connections.map((connection) =>
        connection.id === source
          ? { ...connection, connected: false, updated_at: new Date().toISOString() }
          : connection,
      ),
    }))
  },

  syncSource(source: DataSourceId) {
    store.set((s) => {
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
    store.set((s) => {
      const run: SyncRun = {
        id: uid('sync'),
        source,
        status,
        row_count: rowCount,
        error,
        synced_at: new Date().toISOString(),
      }
      return { ...s, syncLog: [run, ...s.syncLog].slice(0, 30) }
    })
  },

  importKpiRows(
    source: 'excel' | 'google_sheets',
    rows: Array<{ name: string; value: number; date?: string }>,
    clientId: string | null,
    config?: Record<string, unknown>,
  ): number {
    const state = store.get()
    if (!clientId) return 0
    const byName = new Map(
      state.kpiDefinitions
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
    store.set((s) => {
      const now = new Date().toISOString()
      const run: SyncRun = {
        id: uid('sync'),
        source,
        status: 'success',
        row_count: matched,
        error: null,
        synced_at: now,
      }
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
    store.set((s) => ({
      ...s,
      connections: s.connections.map((connection) =>
        connection.id === source
          ? { ...connection, ...patch, updated_at: new Date().toISOString() }
          : connection,
      ),
    }))
  },

  updateClient(id: string, patch: Partial<Client>) {
    store.set((s) => ({
      ...s,
      clients: s.clients.map((client) =>
        client.id === id ? { ...client, ...patch, updated_at: new Date().toISOString() } : client,
      ),
    }))
  },

  updateMember(id: string, patch: Partial<Profile>) {
    store.set((s) => ({
      ...s,
      profiles: s.profiles.map((profile) =>
        profile.id === id ? { ...profile, ...patch, updated_at: new Date().toISOString() } : profile,
      ),
    }))
  },

  addObjective(input: ObjectiveInput) {
    store.set((s) => {
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
      return { ...s, objectives: [...s.objectives, objective] }
    })
  },

  updateKeyResult(id: string, patch: Partial<KeyResult>) {
    store.set((s) => ({
      ...s,
      keyResults: s.keyResults.map((kr) =>
        kr.id === id ? { ...kr, ...patch, updated_at: new Date().toISOString() } : kr,
      ),
    }))
  },

  markNotificationsRead() {
    store.set((s) => ({
      ...s,
      notifications: s.notifications.map((n: Notification) => ({ ...n, is_read: true })),
    }))
  },

  markNotificationRead(id: string) {
    store.set((s) => ({
      ...s,
      notifications: s.notifications.map((n: Notification) =>
        n.id === id ? { ...n, is_read: true } : n,
      ),
    }))
  },

  resetAll() {
    store.reset()
  },
}

export function useAppState() {
  return useSyncExternalStore(store.subscribe, store.get)
}

export function useApp() {
  return { state: useAppState(), actions }
}
