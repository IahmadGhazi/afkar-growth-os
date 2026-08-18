import type {
  ActivityLog,
  ChatMessage,
  Client,
  ClientAssignment,
  Connection,
  KpiDefinition,
  KpiSnapshot,
  KpiTarget,
  Notification,
  Organization,
  Profile,
  SyncRun,
  Task,
  WeeklyObjective,
  KeyResult,
} from '../types/database'

export interface AppState {
  version: number
  organization: Organization
  clients: Client[]
  profiles: Profile[]
  clientAssignments: ClientAssignment[]
  tasks: Task[]
  objectives: WeeklyObjective[]
  keyResults: KeyResult[]
  kpiDefinitions: KpiDefinition[]
  kpiTargets: KpiTarget[]
  kpiSnapshots: KpiSnapshot[]
  connections: Connection[]
  syncLog: SyncRun[]
  notifications: Notification[]
  activity: ActivityLog[]
  messages: ChatMessage[]
  currentUserId: string | null
  currentClientId: string | null
}
