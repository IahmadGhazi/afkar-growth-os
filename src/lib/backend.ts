import { supabase, hasSupabaseEnv } from './supabase'
import type {
  ActivityLog,
  Campaign,
  CampaignMetric,
  ChatMessage,
  Client,
  ClientAssignment,
  Connection,
  KpiDefinition,
  KpiSnapshot,
  KpiTarget,
  Notification,
  Organization,
  ProductCandidate,
  Profile,
  SyncRun,
  Task,
  TaskComment,
  WeeklyObjective,
  KeyResult,
  ClientReportNote,
  SallaCustomer,
  SallaOrder,
  SallaProduct,
  SallaReview,
} from '../types/database'

export const backendAvailable = hasSupabaseEnv && supabase != null

function table(name: string) {
  return supabase!.from(name)
}

async function selectAll<T>(name: string, orderCol = 'created_at', limit?: number): Promise<T[]> {
  if (!backendAvailable) return []
  // Newest rows win: order DESC then reverse so callers keep oldest-first
  // contracts while caps trim the ancient tail.
  let q = table(name).select('*').order(orderCol, { ascending: false })
  if (limit) q = q.limit(limit)
  const { data, error } = await q
  if (error) throw new Error(`${name}: ${error.message}`)
  return ((data ?? []) as T[]).reverse()
}

async function selectAllSafe<T>(name: string, orderCol = 'created_at', limit?: number): Promise<T[]> {
  try {
    return await selectAll<T>(name, orderCol, limit)
  } catch (err) {
    console.warn(`backend: skipping ${name}: ${(err as Error).message}`)
    return []
  }
}

async function upsert(name: string, rows: unknown | unknown[]) {
  if (!backendAvailable) return
  const { error } = await table(name).upsert(Array.isArray(rows) ? rows : [rows])
  if (error) throw new Error(`${name}: ${error.message}`)
}

async function remove(name: string, id: string) {
  if (!backendAvailable) return
  const { error } = await table(name).delete().eq('id', id)
  if (error) throw new Error(`${name}: ${error.message}`)
}

async function updateById(name: string, id: string, patch: Record<string, unknown>) {
  if (!backendAvailable) return
  const { error } = await table(name).update(patch).eq('id', id)
  if (error) throw new Error(`${name}: ${error.message}`)
}

export const backend = {
  available: backendAvailable,

  async loadAll() {
    // Unbounded tables get sane caps — the newest rows win. This keeps the
    // 25s refresh loop fast and Supabase free-tier egress sane as data grows.
    const [organization, clients, profiles, clientAssignments, tasks, objectives, keyResults, kpiDefinitions, kpiTargets, kpiSnapshots, connections, syncLog, notifications, activity, messages, reportNotes, products, campaigns, campaignMetrics, taskComments, sallaCustomers, sallaOrders, sallaProducts, sallaReviews, shipments, orderSlas, orderTimeline, abandonedCarts] =
      await Promise.all([
        selectAllSafe<Organization>('organizations'),
        selectAllSafe<Client>('clients'),
        selectAllSafe<Profile>('profiles'),
        selectAllSafe<ClientAssignment>('client_assignments'),
        selectAllSafe<Task>('tasks'),
        selectAllSafe<WeeklyObjective>('weekly_objectives'),
        selectAllSafe<KeyResult>('key_results'),
        selectAllSafe<KpiDefinition>('kpi_definitions'),
        selectAllSafe<KpiTarget>('kpi_targets'),
        selectAllSafe<KpiSnapshot>('kpi_snapshots'),
        selectAllSafe<Connection>('connections'),
        selectAllSafe<SyncRun>('sync_runs', 'synced_at'),
        selectAllSafe<Notification>('notifications', 'created_at', 200),
        selectAllSafe<ActivityLog>('activity_logs', 'created_at', 100),
        selectAllSafe<ChatMessage>('messages', 'created_at', 400),
        selectAllSafe<ClientReportNote>('client_reports', 'week_start'),
        selectAllSafe<ProductCandidate>('product_candidates'),
        selectAllSafe<Campaign>('campaigns'),
        selectAllSafe<CampaignMetric>('campaign_metrics', 'date'),
        selectAllSafe<TaskComment>('task_comments', 'created_at', 500),
        selectAllSafe<SallaCustomer>('customers', 'total_spent', 800),
        selectAllSafe<SallaOrder>('orders', 'date_created', 800),
        selectAllSafe<SallaProduct>('store_products', 'synced_at', 600),
        selectAllSafe<SallaReview>('reviews', 'created_at', 300),
        selectAllSafe<any>('shipments', 'created_at', 400),
        selectAllSafe<any>('order_sla', 'updated_at', 500),
        selectAllSafe<any>('order_timeline', 'event_time', 400),
        selectAllSafe<any>('abandoned_carts', 'created_at', 400),
      ])
    return {
      organization: organization[0] ?? null,
      clients,
      profiles,
      clientAssignments,
      tasks,
      objectives,
      keyResults,
      kpiDefinitions,
      kpiTargets,
      kpiSnapshots,
      connections,
      syncLog,
      notifications,
      activity,
      messages,
      reportNotes,
      products,
      campaigns,
      campaignMetrics,
      taskComments,
      sallaCustomers,
      sallaOrders,
      sallaProducts,
      sallaReviews,
      shipments,
      orderSlas,
      orderTimeline,
      abandonedCarts,
    }
  },

  insertOrganization: (row: Organization) => upsert('organizations', row),
  upsertOrganization: (row: Organization) => upsert('organizations', row),
  updateOrganization: (id: string, patch: Record<string, unknown>) => updateById('organizations', id, patch),

  insertClient: (row: Client) => upsert('clients', row),
  updateClient: (id: string, patch: Record<string, unknown>) => updateById('clients', id, patch),

  insertProfile: (row: Profile) => upsert('profiles', row),
  updateProfile: (id: string, patch: Record<string, unknown>) => updateById('profiles', id, patch),
  insertAssignment: (row: ClientAssignment) => upsert('client_assignments', row),

  insertTask: (row: Task) => upsert('tasks', row),
  updateTask: (id: string, patch: Record<string, unknown>) => updateById('tasks', id, patch),
  deleteTask: (id: string) => remove('tasks', id),

  insertObjective: (row: WeeklyObjective) => upsert('weekly_objectives', row),
  updateObjective: (id: string, patch: Record<string, unknown>) => updateById('weekly_objectives', id, patch),

  insertKeyResult: (row: KeyResult) => upsert('key_results', row),
  updateKeyResult: (id: string, patch: Record<string, unknown>) => updateById('key_results', id, patch),

  insertKpiDefinition: (row: KpiDefinition) => upsert('kpi_definitions', row),
  updateKpiDefinition: (id: string, patch: Record<string, unknown>) => updateById('kpi_definitions', id, patch),

  insertSnapshot: (row: KpiSnapshot) => upsert('kpi_snapshots', row),
  deleteSnapshots: (ids: string[]) => {
    if (!backendAvailable || ids.length === 0) return Promise.resolve()
    return supabase!.from('kpi_snapshots').delete().in('id', ids)
  },

  insertTarget: (row: KpiTarget) => upsert('kpi_targets', row),

  upsertConnection: (row: Connection) => upsert('connections', row),

  insertSyncRun: (row: SyncRun) => upsert('sync_runs', row),

  insertNotification: (row: Notification) => upsert('notifications', row),
  updateNotification: (id: string, patch: Record<string, unknown>) => updateById('notifications', id, patch),
  updateNotifications: (patch: Record<string, unknown>) => {
    if (!backendAvailable) return Promise.resolve()
    return supabase!.from('notifications').update(patch).neq('id', '') as unknown as Promise<{ error: Error | null }>
  },

  insertActivity: (row: ActivityLog) => upsert('activity_logs', row),

  insertMessage: (row: ChatMessage) => upsert('messages', row),

  insertProduct: (row: ProductCandidate) => upsert('product_candidates', row),
  updateProduct: (id: string, patch: Record<string, unknown>) => updateById('product_candidates', id, patch),
  deleteProduct: (id: string) => remove('product_candidates', id),

  insertCampaign: (row: Campaign) => upsert('campaigns', row),
  updateCampaign: (id: string, patch: Record<string, unknown>) => updateById('campaigns', id, patch),
  deleteCampaign: (id: string) => remove('campaigns', id),

  insertMetric: (row: CampaignMetric) => upsert('campaign_metrics', row),

  insertComment: (row: TaskComment) => upsert('task_comments', row),

  insertReportNote: (row: ClientReportNote) => upsert('client_reports', row),

  patchMessage: (id: string, patch: Record<string, unknown>) => updateById('messages', id, patch),
  deleteMessage: (id: string) => remove('messages', id),

  upsertCustomer: (row: Record<string, unknown>) => upsert('customers', row),
  upsertOrder: (row: Record<string, unknown>) => upsert('orders', row),
  upsertStoreProduct: (row: Record<string, unknown>) => upsert('store_products', row),
  upsertReview: (row: Record<string, unknown>) => upsert('reviews', row),
}
