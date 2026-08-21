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
  products: ProductCandidate[]
  campaigns: Campaign[]
  campaignMetrics: CampaignMetric[]
  taskComments: TaskComment[]
  currentUserId: string | null
  currentClientId: string | null
  /** False until the first backend bootstrap resolves; the shell shows a
      boot skeleton instead of a lying "empty workspace". */
  ready: boolean
}