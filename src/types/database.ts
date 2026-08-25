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
  /** Supabase Auth user this profile belongs to (linked by email on signup). */
  auth_user_id?: string | null
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
  /** emoji -> array of author ids who reacted with it */
  reactions?: Record<string, string[]> | null
  edited_at?: string | null
  created_at: string
}

export interface ClientReportNote {
  id: string
  client_id: string
  week_start: string
  week_end: string
  exec_summary: string | null
  what_worked: string | null
  what_didnt: string | null
  next_week: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PlatformAccount {
  id: string
  client_id: string
  platform: 'google_ads' | 'tiktok_ads' | 'snap_ads' | 'salla'
  account_id: string
  label: string | null
  created_at: string
}

export interface SallaCustomer {
  id: string
  client_id: string
  salla_id: number | null
  first_name: string | null
  last_name: string | null
  mobile: string | null
  mobile_code: string | null
  email: string | null
  gender: string | null
  city: string | null
  country: string | null
  avatar_url: string | null
  total_orders: number
  total_spent: number
  loyalty_points: number
  first_order_date: string | null
  last_order_date: string | null
  tags: string[] | null
  groups: string[] | null
  is_active: boolean
  synced_at: string
}

export interface SallaOrder {
  id: string
  client_id: string
  salla_id: number | null
  /** Merchant-facing order number shown in the Salla dashboard (custom numbering). */
  reference?: string | null
  customer_id: string | null
  status: string
  payment_method: string | null
  selling_channel: string | null
  total_amount: number
  shipping_cost: number
  tax_amount: number
  currency: string
  items_count: number
  items: Array<{ name?: string; quantity?: number; amount?: number | null }> | null
  date_created: string | null
  date_completed: string | null
  synced_at: string
}

export interface SallaProduct {
  id: string
  client_id: string
  salla_id: number | null
  name: string
  sku: string | null
  price: number | null
  sale_price: number | null
  status: 'active' | 'hidden' | 'out_of_stock'
  category: string | null
  image_url: string | null
  quantity: number
  views: number
  sales_count: number
  rating_avg: number | null
  reviews_count: number
  synced_at: string
}

export interface SallaReview {
  id: string
  client_id: string
  salla_id: number | null
  type: 'product' | 'shipping' | 'store' | 'blog' | 'ask'
  rating: number | null
  content: string | null
  customer_name: string | null
  product_name: string | null
  order_reference: string | null
  is_published: boolean
  likes_count: number
  images: string[] | null
  created_at: string
}

export interface SallaShipment {
  id: string
  client_id: string
  order_id: string | null
  salla_shipment_id: number | null
  status: string
  shipping_company: string | null
  tracking_number: string | null
  shipment_date: string | null
  created_at: string
  updated_at: string
}

export interface OrderSla {
  id: string
  order_id: string
  client_id: string
  sla_state: 'normal' | 'at_risk' | 'delayed' | 'resolved'
  created_at: string
  updated_at: string
}

export interface OrderTimelineEvent {
  id: string
  order_id: string
  client_id: string
  event: string
  details: Record<string, unknown> | null
  event_time: string
}

export interface AbandonedCart {
  id: string
  client_id: string
  salla_cart_id: number | null
  customer_id: string | null
  status: string
  cart_total: number
  items: Array<{ name?: string; quantity?: number; amount?: number | null }> | null
  checkout_url?: string | null
  customer_name?: string | null
  customer_mobile?: string | null
  customer_email?: string | null
  coupon_code?: string | null
  age_minutes?: number | null
  last_contacted_at?: string | null
  created_at: string
  updated_at: string
}

export interface IntegrationToken {
  id: string
  client_id: string
  platform: 'salla' | 'google_ads' | 'tiktok_ads' | 'snap_ads'
  access_token: string
  refresh_token: string
  expires_at: string
  store_id: string | null
  store_name: string | null
  merchant_id: number | null
  scope: string | null
  created_at: string
  updated_at: string
}

export type ProductStatus =
  | 'discovered'
  | 'filtered'
  | 'validating'
  | 'shortlisted'
  | 'testing'
  | 'winner'
  | 'scaled'
  | 'killed'

export type CampaignPlatform = 'google_ads' | 'tiktok_ads' | 'snap_ads' | 'salla' | 'other'

export interface Campaign {
  id: string
  client_id: string
  name: string
  platform: CampaignPlatform
  status: 'planned' | 'active' | 'paused' | 'completed' | 'archived'
  budget: number | null
  objective: string | null
  start_date: string | null
  end_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** One row per campaign per day — the media buyer's daily log. */
export interface CampaignMetric {
  id: string
  campaign_id: string
  client_id: string
  date: string
  impressions: number
  clicks: number
  spend: number
  purchases: number
  revenue: number
  notes: string | null
  created_at: string
}

export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  content: string
  created_at: string
}

/** The research funnel: many discovered, few win. Scores are 0-10 per
    dimension; score_total is the mean of the ones the researcher filled. */
export interface ProductCandidate {
  id: string
  client_id: string
  name: string
  category: string | null
  source_url: string | null
  competitor: string | null
  estimated_price: number | null
  demand_evidence: string | null
  notes: string | null
  score_demand: number | null
  score_competition: number | null
  score_margin: number | null
  score_creative: number | null
  score_brand_fit: number | null
  /** Linked live product in the Salla store (manual or auto-matched). */
  store_product_id?: string | null
  score_trend: number | null
  status: ProductStatus
  decision_notes: string | null
  researcher_id: string | null
  created_at: string
  updated_at: string
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
