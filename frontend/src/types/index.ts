export interface User {
  id: string
  email: string
  role: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  plan: string
  logo_url?: string
  timezone?: string
  role?: string
  settings?: Record<string, any>
  monthly_message_limit: number
  messages_sent_this_month: number
  monthlyMessageLimit?: number
  messagesSentThisMonth?: number
}

export interface Device {
  id: string
  name: string
  phone_number?: string
  status: 'disconnected' | 'connecting' | 'connected' | 'banned' | 'warming' | 'paused' | 'deleted'
  health_score: number
  ban_probability: number
  qr_code?: string
  daily_limit: number
  messages_sent_today: number
  last_active?: string
  last_reset_at?: string
  paused_at?: string
  warmup_started?: string
  warmup_day: number
  warmup_target_day: number
  session_key_version?: string
  proxy_url?: string
  webhook_url?: string
  browser_string?: string
  notes?: string
  is_warmup_active: boolean
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  phone: string
  name?: string
  email?: string
  status: 'active' | 'opted_out' | 'invalid' | 'blocked'
  wa_status?: string
  wa_status_confidence: number
  intent_score: number
  last_contacted?: string
  last_replied?: string
  conversation_count: number
  reply_count: number
  tags: string[]
  custom_fields: Record<string, any>
  source?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface ContactList {
  id: string
  name: string
  description?: string
  type: 'static' | 'dynamic' | 'imported'
  contact_count: number
  filter_rules: Record<string, any>
  tags: string[]
  color: string
  created_at: string
  updated_at: string
}

export interface MessageTemplate {
  id: string
  name: string
  category: 'marketing' | 'transactional' | 'support' | 'reminder' | 'otp' | 'other'
  language: string
  type: 'text' | 'image' | 'video' | 'document'
  header?: string
  body: string
  footer?: string
  variables: string[]
  tags: string[]
  status: 'draft' | 'active' | 'archived'
  is_ai_generated: boolean
  use_count: number
  created_at: string
  updated_at: string
}

export interface Campaign {
  id: string
  name: string
  description?: string
  type: 'bulk' | 'sequence' | 'ab_test' | 'trigger'
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped'
  template_id?: string
  template_b_id?: string
  device_ids: string[]
  contact_list_ids: string[]
  contact_ids: string[]
  total_contacts: number
  sent_count: number
  delivered_count: number
  read_count: number
  replied_count: number
  failed_count: number
  opted_out_count: number
  scheduled_at?: string
  started_at?: string
  completed_at?: string
  send_window_start: string
  send_window_end: string
  min_delay_seconds: number
  max_delay_seconds: number
  ab_split_pct: number
  ab_winner_variant?: string
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  device_id: string
  contact_id: string
  contact?: Contact
  contacts?: Contact
  device?: Device
  whatsapp_devices?: Device
  status: 'open' | 'resolved' | 'pending' | 'archived'
  assigned_to?: string
  unread_count: number
  last_message_at?: string
  last_message_preview?: string
  sla_deadline?: string
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  campaign_id?: string
  device_id?: string
  contact_id?: string
  conversation_id?: string
  direction: 'outbound' | 'inbound'
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'reaction'
  content?: string
  media_url?: string
  media_mime_type?: string
  wa_message_id?: string
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'blocked'
  error_code?: string
  error_message?: string
  sent_at?: string
  delivered_at?: string
  read_at?: string
  created_at: string
}

export interface AutoReplyRule {
  id: string
  name: string
  trigger_type: 'keyword' | 'first_message' | 'outside_hours' | 'any_message'
  match_type: 'contains' | 'exact' | 'starts_with' | 'regex'
  keywords: string[]
  response_type: 'text' | 'template' | 'ai_powered'
  response_message?: string
  template_id?: string
  ai_system_prompt?: string
  cooldown_minutes: number
  priority: number
  is_active: boolean
  trigger_count: number
  created_at: string
  updated_at: string
}

export interface Flow {
  id: string
  name: string
  description?: string
  status: 'draft' | 'active' | 'paused' | 'archived'
  enrolled_count: number
  completed_count: number
  conversion_rate: number
  trigger_type: 'manual' | 'campaign_completion' | 'tag_added' | 'api'
  created_at: string
  updated_at: string
}

export interface FlowStep {
  id: string
  flow_id: string
  step_order: number
  name: string
  delay_hours: number
  type: 'message' | 'condition' | 'wait' | 'action'
  template_id?: string
  ai_prompt?: string
  condition_rules: Record<string, any>
  created_at: string
}

export interface AnalyticsSummary {
  totals: {
    sent: number
    delivered: number
    read: number
    campaigns: number
  }
  volumeByDay: Array<{
    date: string
    sent: number
    delivered: number
    read: number
  }>
  devicePerformance: Array<{
    id: string
    name: string
    sent: number
    delivered: number
    read: number
  }>
  campaigns: Array<{
    id: string
    name: string
    sent: number
    delivered: number
    read: number
    replied: number
    failed: number
    status: string
  }>
}
