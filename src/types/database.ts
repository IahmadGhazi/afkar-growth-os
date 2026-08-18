// Database types for AFKAR Growth OS
// Generated from schema - keep in sync with supabase/migrations

export type UserRole = 
  | 'super_admin' 
  | 'account_manager' 
  | 'owner' 
  | 'seo' 
  | 'media_buyer' 
  | 'social_media' 
  | 'designer' 
  | 'product_research' 
  | 'viewer'

export type TaskStatus = 
  | 'backlog' 
  | 'planned' 
  | 'in_progress' 
  | 'review' 
  | 'approved' 
  | 'done' 
  | 'blocked'

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low'

export type Department = 
  | 'seo' 
  | 'media' 
  | 'social' 
  | 'design' 
  | 'product_research' 
  | 'management'

export interface Organization {
  id: string
  name: string
  slug: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  organization_id: string
  name: string
  slug: string
  domain: string | null
  status: 'active' | 'paused' | 'archived'
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  organization_id: string | null
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ClientAssignment {
  id: string
  user_id: string
  client_id: string
  created_at: string
}

export interface Task {
  id: string
  client_id: string
  playbook_instance_id: string | null
  title: string
  description: string | null
  brief: string | null
  expected_output: string | null
  success_criteria: string | null
  status: TaskStatus
  priority: TaskPriority
  assignee_id: string | null
  reviewer_id: string | null
  created_by: string | null
  department: Department | null
  due_date: string | null
  started_at: string | null
  completed_at: string | null
  result: string | null
  blocked_reason: string | null
  created_at: string
  updated_at: string
}

export interface WeeklyObjective {
  id: string
  client_id: string
  title: string
  description: string | null
  week_start: string
  week_end: string
  status: 'active' | 'completed' | 'cancelled'
  progress_pct: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface KeyResult {
  id: string
  objective_id: string
  client_id: string
  title: string
  metric_name: string | null
  metric_target: number | null
  metric_current: number | null
  metric_unit: string | null
  status: 'on_track' | 'at_risk' | 'behind' | 'achieved' | 'missed'
  created_at: string
  updated_at: string
}

export interface KpiDefinition {
  id: string
  client_id: string
  name: string
  department: Department | null
  unit: 'currency' | 'percentage' | 'count' | 'ratio' | null
  direction: 'higher_better' | 'lower_better' | 'target' | null
  source: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface KpiSnapshot {
  id: string
  kpi_id: string
  client_id: string
  snapshot_date: string
  value: number
  source: string | null
  notes: string | null
  created_at: string
}

export interface KpiTarget {
  id: string
  kpi_id: string
  client_id: string
  period_start: string
  period_end: string
  target_value: number
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  client_id: string | null
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export interface ActivityLog {
  id: string
  user_id: string | null
  client_id: string | null
  entity_type: string
  entity_id: string
  action: string
  details: Record<string, unknown> | null
  created_at: string
}

export interface ChatMessage {
  id: string
  client_id: string
  author_id: string
  body: string
  created_at: string
}

export type DataSourceId =
  | 'salla'
  | 'google_ads'
  | 'tiktok_ads'
  | 'snap_ads'
  | 'excel'
  | 'google_sheets'
  | 'manual'

export interface Connection {
  id: DataSourceId
  client_id: string | null
  connected: boolean
  last_sync_at: string | null
  sync_error: string | null
  config: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface SyncRun {
  id: string
  source: string
  status: 'success' | 'error'
  row_count: number
  error: string | null
  synced_at: string
}
