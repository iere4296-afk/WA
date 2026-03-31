import type {
  AnalyticsSummary,
  AutoReplyRule,
  Campaign,
  Contact,
  ContactList,
  Conversation,
  Device,
  Flow,
  FlowStep,
  Message,
  MessageTemplate,
  Organization,
  User,
} from './index'

export interface ApiErrorResponse {
  error: string
  code?: string
  details?: unknown
}

export interface ApiResponse<T> {
  data: T
}

export interface CursorMeta {
  nextCursor: string | null
  previousCursor?: string | null
  hasMore: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: CursorMeta
}

export interface MutationSuccess {
  success: boolean
}

export interface AuthSessionPayload {
  user: User | null
  org: Organization | null
  orgs?: Organization[]
}

export type LoginResponse = ApiResponse<AuthSessionPayload>
export type MeResponse = ApiResponse<AuthSessionPayload>
export type LogoutResponse = ApiResponse<MutationSuccess>
export type RefreshResponse = ApiResponse<{ refreshed: boolean }>

export interface SetupStatusPayload {
  supabase: boolean
  redis: boolean
  ai: boolean
  stripe: boolean
  timestamp: string
  aiStatus?: {
    provider: 'groq' | 'openai' | 'none'
    modelFast: string
    modelSmart: string
    modelQuality: string
    groqReady: boolean
    openaiReady: boolean
  }
  version?: string
}

export type SetupStatusResponse = ApiResponse<SetupStatusPayload>

export interface AIGateDetail {
  gate: number
  passed: boolean
  reason?: string
}

export interface AIVariantResult {
  content: string
  gatesPassed: number
  gatesFailed: string[]
  gateDetails: AIGateDetail[]
  isUsable: boolean
}

export type AIStudioStatusResponse = ApiResponse<{
  ai: {
    groq: {
      configured: boolean
      connected: boolean
      model: string
      latencyMs: number
      error?: string
    }
    openai: {
      configured: boolean
      model?: string
    }
    activeProvider: 'groq' | 'openai' | 'handlebars'
  }
}>

export type AIStudioGenerateResponse = ApiResponse<{
  variants: AIVariantResult[]
  provider: 'groq' | 'openai' | 'handlebars'
  modelUsed: string
  totalTokens: number
}>

export interface DeviceHealthBreakdown {
  score: number
  rulesPassed: number
  rulesTotal: number
  breakdown: Array<{
    category?: string
    rule: string
    passed: boolean
    detail: string
  }>
}

export interface DeviceHealthEvent {
  id: string
  event_type: string
  severity: 'info' | 'warning' | 'critical'
  details: Record<string, unknown>
  created_at: string
}

export interface DeviceWarmupScheduleEntry {
  day: number
  target: number
  current: boolean
}

export interface HealthResponse {
  status: string
  version: string
  environment: string
  services: {
    ai: boolean
    queue: boolean
    stripe: boolean
  }
}

export type DevicesResponse = PaginatedResponse<Device>
export type DeviceResponse = ApiResponse<Device & {
  healthBreakdown?: DeviceHealthBreakdown | null
  recentHealthEvents?: DeviceHealthEvent[]
}>
export type DeviceQrResponse = ApiResponse<{
  id: string
  qrCode: string | null
  status: Device['status']
  updatedAt: string
}>
export type DeviceCreateResponse = ApiResponse<Device>
export type DeviceUpdateResponse = ApiResponse<Device>
export type DeviceDeleteResponse = ApiResponse<MutationSuccess>
export type DeviceConnectResponse = ApiResponse<{ status: 'connecting' }>
export type DeviceDisconnectResponse = ApiResponse<{ status: 'disconnected' }>

export type ContactsResponse = PaginatedResponse<Contact>
export type ContactResponse = ApiResponse<Contact>
export type ContactListsResponse = ApiResponse<ContactList[]>
export type ContactListResponse = ApiResponse<ContactList>
export type ContactDeleteResponse = ApiResponse<MutationSuccess>
export type ContactBulkDeleteResponse = ApiResponse<{ deleted: number }>
export type ContactImportResponse = ApiResponse<{
  success?: boolean
  imported: number
  skipped: number
  errors: string[]
  total?: number
  preview?: Array<Record<string, string | undefined>>
  rows?: Array<Record<string, string | undefined>>
  contacts?: Contact[]
  phoneColumn?: string
  nameColumn?: string
  emailColumn?: string
}>

export type CampaignsResponse = PaginatedResponse<Campaign>
export type CampaignResponse = ApiResponse<Campaign>
export type CampaignDeleteResponse = ApiResponse<MutationSuccess>
export type CampaignLaunchResponse = ApiResponse<{
  launched: boolean
  status?: Campaign['status']
  totalContacts: number
  jobId?: string
}>
export type CampaignActionResponse = ApiResponse<Campaign>
export type CampaignMessagesResponse = PaginatedResponse<Message>

export type ConversationsResponse = PaginatedResponse<Conversation>
export type ConversationResponse = ApiResponse<Conversation>
export type ThreadMessagesResponse = PaginatedResponse<Message>
export type SendMessageResponse = ApiResponse<Message>

export type TemplatesResponse = PaginatedResponse<MessageTemplate>
export type TemplateResponse = ApiResponse<MessageTemplate>
export type TemplateDeleteResponse = ApiResponse<MutationSuccess>
export type TemplateGenerateResponse = ApiResponse<{
  name: string
  body: string
  variables: string[]
  gatesPassed: number
  gatesFailed: string[]
  modelUsed: string
  template: Partial<MessageTemplate>
  gates: Array<{
    name: string
    passed: boolean
    reason?: string
  }>
}>

export type AutoReplyRulesResponse = ApiResponse<AutoReplyRule[]>
export type AutoReplyRuleResponse = ApiResponse<AutoReplyRule>

export type FlowsResponse = PaginatedResponse<Flow>
export type FlowResponse = ApiResponse<Flow>
export type FlowStepsResponse = ApiResponse<FlowStep[]>

export interface AnalyticsOverviewPayload {
  activeDevices: number
  connectedDevices: number
  totalMessages: number
  totalContacts: number
  activeCampaigns: number
  messagesSent: number
  delivered: number
  read: number
  replied: number
  aiCallsThisMonth: number
}

export type AnalyticsOverviewResponse = ApiResponse<AnalyticsOverviewPayload>
export type AnalyticsSummaryResponse = ApiResponse<AnalyticsSummary>
export type AnalyticsVolumeResponse = ApiResponse<Array<{
  date: string
  sent: number
  delivered: number
  read: number
}>>
export type AnalyticsFunnelResponse = ApiResponse<{
  sent: number
  delivered: number
  read: number
  replied: number
}>
export type AnalyticsDevicePerformanceResponse = ApiResponse<Array<{
  id: string
  name: string
  status: Device['status']
  health_score: number
  ban_probability: number
  messages_sent_today: number
  daily_limit: number
  sent: number
  delivered: number
  read: number
}>>

export type AnalyticsCampaignComparisonResponse = ApiResponse<Array<{
  id: string
  name: string
  status: Campaign['status']
  sent_count: number
  delivered_count: number
  read_count: number
  replied_count: number
  failed_count: number
  total_contacts: number
  created_at: string
}>>

export interface AntiBanRuleResult {
  category?: string
  rule: string
  passed: boolean
  detail: string
}

export interface AntiBanDeviceScore {
  id: string
  name: string
  status: Device['status']
  health_score: number
  ban_probability: number
  messages_sent_today: number
  daily_limit: number
  score: number
  rulesPassed: number
  rulesTotal: number
  breakdown: AntiBanRuleResult[]
  banProbability: number
  riskLevel: 'low' | 'medium' | 'high'
  optOuts24h: number
  sentToday: number
  banSignals24h: number
  topFactors: string[]
}

export type AntiBanScoresResponse = ApiResponse<{
  devices: AntiBanDeviceScore[]
  overallHealth: number
}>

export type AntiBanDeviceResponse = ApiResponse<AntiBanDeviceScore>

export type HealthEventsResponse = ApiResponse<Array<{
  id: string
  org_id: string
  device_id: string
  event_type: string
  severity: 'info' | 'warning' | 'critical'
  details: Record<string, unknown>
  created_at: string
  whatsapp_devices?: {
    name?: string | null
  } | null
}>>

export interface HealthRuleResult {
  id: string
  name: string
  weight: number
  passed: boolean
  detail?: string
}

export interface HealthScorePayload {
  deviceId: string
  score: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  rules: HealthRuleResult[]
}

export type HealthScoreResponse = ApiResponse<HealthScorePayload>
export type BanPredictionResponse = ApiResponse<{
  probability: number
  riskLevel: 'low' | 'medium' | 'high'
  topFactors: string[]
}>

export type TeamMembersResponse = ApiResponse<Array<{
  id: string
  user_id?: string | null
  email: string | null
  name?: string | null
  role: 'owner' | 'admin' | 'operator' | 'member' | 'viewer'
  pending?: boolean
  joined_at?: string
  invite_expires_at?: string | null
}>>

export type BillingUsageResponse = ApiResponse<{
  usage: {
    messages_sent: number
    ai_calls: number
    contacts_stored: number
    media_uploaded_mb: number
  }
  org: Organization | null
  limits: {
    id: string
    name: string
    monthlyMessages: number
    aiCalls: number
    contacts: number
  }
}>

export type ApiKeysResponse = ApiResponse<Array<{
  id: string
  name: string
  prefix?: string
  masked: string
  createdAt?: string
  value?: string
}>>

export type WebhooksResponse = ApiResponse<Array<{
  id: string
  url: string
  events: string[]
  active: boolean
  createdAt?: string
  secret?: string
}>>
