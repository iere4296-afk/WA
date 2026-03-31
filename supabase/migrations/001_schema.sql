-- ═══════════════════════════════════════════════════════════════
-- WA Intelligence Platform - Database Schema
-- ═══════════════════════════════════════════════════════════════

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ═══════════════════════════════════════════════════════════════
-- organizations (multi-tenant root)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free'
    CHECK (plan IN ('free','starter','growth','scale','enterprise')),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  logo_url TEXT,
  custom_domain TEXT,
  timezone TEXT DEFAULT 'UTC',
  monthly_message_limit INTEGER DEFAULT 1000,
  messages_sent_this_month INTEGER DEFAULT 0,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- org_members
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member'
    CHECK (role IN ('owner','admin','operator','member','viewer')),
  invited_by UUID REFERENCES auth.users(id),
  invite_token TEXT,
  invite_expires_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- ═══════════════════════════════════════════════════════════════
-- whatsapp_devices
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE whatsapp_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_number TEXT,
  status TEXT DEFAULT 'disconnected'
    CHECK (status IN ('disconnected','connecting','connected','banned','warming','paused','deleted')),
  health_score INTEGER DEFAULT 100
    CHECK (health_score >= 0 AND health_score <= 100),
  ban_probability FLOAT DEFAULT 0.0,
  qr_code TEXT,
  session_data TEXT,
  session_key_version TEXT DEFAULT 'v1',
  daily_limit INTEGER DEFAULT 200,
  messages_sent_today INTEGER DEFAULT 0,
  last_active TIMESTAMPTZ,
  last_reset_at TIMESTAMPTZ,
  warmup_started TIMESTAMPTZ,
  warmup_day INTEGER DEFAULT 0,
  warmup_target_day INTEGER DEFAULT 30,
  proxy_url TEXT,
  webhook_url TEXT,
  browser_string TEXT,
  notes TEXT,
  is_warmup_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- contacts
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active','opted_out','invalid','blocked')),
  wa_status TEXT,
  wa_status_confidence INTEGER DEFAULT 100,
  wa_status_checked_at TIMESTAMPTZ,
  intent_score INTEGER DEFAULT 50
    CHECK (intent_score >= 0 AND intent_score <= 100),
  last_contacted TIMESTAMPTZ,
  last_replied TIMESTAMPTZ,
  conversation_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  source TEXT,
  notes TEXT,
  embedding vector(1536),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, phone)
);

-- ═══════════════════════════════════════════════════════════════
-- contact_lists
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE contact_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'static'
    CHECK (type IN ('static','dynamic','imported')),
  contact_count INTEGER DEFAULT 0,
  filter_rules JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  color TEXT DEFAULT '#10b981',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contact_list_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID REFERENCES contact_lists(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(list_id, contact_id)
);

-- ═══════════════════════════════════════════════════════════════
-- message_templates
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'marketing'
    CHECK (category IN ('marketing','transactional','support','reminder','otp','other')),
  language TEXT DEFAULT 'EN',
  header TEXT,
  body TEXT NOT NULL,
  footer TEXT,
  variables TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','active','archived')),
  is_ai_generated BOOLEAN DEFAULT false,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- campaigns
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'bulk'
    CHECK (type IN ('bulk','sequence','ab_test','trigger')),
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','running','paused','completed','failed','stopped')),
  template_id UUID REFERENCES message_templates(id),
  template_b_id UUID REFERENCES message_templates(id),
  device_ids UUID[] DEFAULT '{}',
  contact_list_ids UUID[] DEFAULT '{}',
  contact_ids UUID[] DEFAULT '{}',
  total_contacts INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  opted_out_count INTEGER DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  send_window_start TIME DEFAULT '09:00',
  send_window_end TIME DEFAULT '20:00',
  min_delay_seconds INTEGER DEFAULT 30,
  max_delay_seconds INTEGER DEFAULT 120,
  variable_data JSONB DEFAULT '{}',
  ab_split_pct INTEGER DEFAULT 50,
  ab_winner_variant TEXT,
  settings JSONB DEFAULT '{}',
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- messages
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  device_id UUID REFERENCES whatsapp_devices(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID,
  direction TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
  type TEXT DEFAULT 'text'
    CHECK (type IN ('text','image','video','audio','document','sticker','reaction')),
  content TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  wa_message_id TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','queued','sent','delivered','read','failed','blocked')),
  error_code TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- conversations
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  device_id UUID REFERENCES whatsapp_devices(id),
  contact_id UUID REFERENCES contacts(id),
  status TEXT DEFAULT 'open'
    CHECK (status IN ('open','resolved','pending','archived')),
  assigned_to UUID REFERENCES auth.users(id),
  unread_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  sla_deadline TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, device_id, contact_id)
);

-- ═══════════════════════════════════════════════════════════════
-- auto_reply_rules
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE auto_reply_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN ('keyword','first_message','outside_hours','any_message')),
  match_type TEXT DEFAULT 'contains'
    CHECK (match_type IN ('contains','exact','starts_with','regex')),
  keywords TEXT[] DEFAULT '{}',
  response_type TEXT DEFAULT 'text'
    CHECK (response_type IN ('text','template','ai_powered')),
  response_message TEXT,
  template_id UUID REFERENCES message_templates(id),
  ai_system_prompt TEXT,
  cooldown_minutes INTEGER DEFAULT 60,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- flows
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','active','paused','archived')),
  enrolled_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  conversion_rate FLOAT DEFAULT 0,
  trigger_type TEXT DEFAULT 'manual'
    CHECK (trigger_type IN ('manual','campaign_completion','tag_added','api')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE flow_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID REFERENCES flows(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  delay_hours INTEGER DEFAULT 24,
  type TEXT DEFAULT 'message'
    CHECK (type IN ('message','condition','wait','action')),
  template_id UUID REFERENCES message_templates(id),
  ai_prompt TEXT,
  condition_rules JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE flow_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID REFERENCES flows(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active','completed','stopped','failed')),
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  next_step_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(flow_id, contact_id)
);

-- ═══════════════════════════════════════════════════════════════
-- health_events
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE health_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  device_id UUID REFERENCES whatsapp_devices(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT DEFAULT 'info'
    CHECK (severity IN ('info','warning','critical')),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- billing_usage
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE billing_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  messages_sent INTEGER DEFAULT 0,
  ai_calls INTEGER DEFAULT 0,
  contacts_imported INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  contacts_stored INTEGER DEFAULT 0,
  media_uploaded_mb FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, period_start)
);

-- ═══════════════════════════════════════════════════════════════
-- audit_logs
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  before_state JSONB,
  after_state JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- login_history
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE login_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ip_address INET,
  country_code TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- ai_generation_log
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE ai_generation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  model_used TEXT,
  prompt TEXT,
  output TEXT,
  gates_passed INTEGER DEFAULT 0,
  gates_failed TEXT[] DEFAULT '{}',
  attempts INTEGER DEFAULT 1,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- wa_session_keys (for encrypted Baileys sessions)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE wa_session_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID REFERENCES whatsapp_devices(id) ON DELETE CASCADE,
  key_name TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_id, key_name)
);

-- ═══════════════════════════════════════════════════════════════
-- api_keys (for programmatic access)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  rate_limit INTEGER DEFAULT 1000,
  ip_whitelist TEXT[] DEFAULT '{}',
  permissions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- webhook_endpoints (for outbound webhooks)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  secret_key TEXT NOT NULL,
  retry_attempts INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 60,
  failed_attempts INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- baileys_sessions (for storing WhatsApp session data)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE baileys_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID REFERENCES whatsapp_devices(id) ON DELETE CASCADE,
  creds TEXT NOT NULL,
  keys JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- contact_merge_log (import duplicate / merge audit trail)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE contact_merge_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  original_phone TEXT NOT NULL,
  merged_data JSONB DEFAULT '{}',
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- wa_sessions (canonical Baileys auth key/value store — spec)
-- Legacy: wa_session_keys may still exist for older deployments; prefer this table for new code.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE wa_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES whatsapp_devices(id) ON DELETE CASCADE,
  session_key TEXT NOT NULL,
  session_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_id, session_key)
);

-- ═══════════════════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX idx_messages_org_created ON messages(org_id, created_at DESC);
CREATE INDEX idx_messages_campaign ON messages(campaign_id);
CREATE INDEX idx_messages_device ON messages(device_id);
CREATE INDEX idx_messages_contact ON messages(contact_id);
CREATE INDEX idx_conversations_org ON conversations(org_id, last_message_at DESC);
CREATE INDEX idx_contacts_org_phone ON contacts(org_id, phone);
CREATE INDEX idx_contacts_status ON contacts(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_embedding ON contacts USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_campaigns_org_status ON campaigns(org_id, status);
CREATE INDEX idx_devices_org_status ON whatsapp_devices(org_id, status);
CREATE INDEX idx_audit_logs_org ON audit_logs(org_id, created_at DESC);
CREATE INDEX idx_api_keys_org ON api_keys(org_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_webhook_endpoints_org ON webhook_endpoints(org_id) WHERE is_active = true;
CREATE INDEX idx_baileys_sessions_device ON baileys_sessions(device_id);
CREATE INDEX idx_wa_sessions_device ON wa_sessions(device_id);
CREATE INDEX idx_contact_merge_log_org ON contact_merge_log(org_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- Updated_at triggers
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_devices_updated BEFORE UPDATE ON whatsapp_devices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON message_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_wa_sessions_updated BEFORE UPDATE ON wa_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
