-- ═══════════════════════════════════════════════════════════════
-- WA Intelligence Platform - Complete Database Setup
-- ═══════════════════════════════════════════════════════════════

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ═══════════════════════════════════════════════════════════════
-- users table (auth users profile)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner','admin','operator','member','viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- organizations (multi-tenant root)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS organizations (
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
CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member'
    CHECK (role IN ('owner','admin','operator','member','viewer')),
  invited_by UUID REFERENCES auth.users(id),
  invite_token TEXT,
  invite_expires_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- ═══════════════════════════════════════════════════════════════
-- whatsapp_devices
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS whatsapp_devices (
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
CREATE TABLE IF NOT EXISTS contacts (
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
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- campaigns
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  device_ids UUID[] NOT NULL,
  template_body TEXT NOT NULL,
  template_media_url TEXT,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','running','paused','completed','stopped','failed')),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_contacts INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  min_delay_seconds INTEGER DEFAULT 30,
  max_delay_seconds INTEGER DEFAULT 120,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- messages
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  device_id UUID REFERENCES whatsapp_devices(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  direction TEXT DEFAULT 'outbound'
    CHECK (direction IN ('inbound','outbound')),
  content TEXT NOT NULL,
  media_url TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','queued','sent','delivered','read','failed','blocked')),
  external_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- conversations
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  device_id UUID REFERENCES whatsapp_devices(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'open'
    CHECK (status IN ('open','resolved','closed')),
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER DEFAULT 0,
  sla_deadline TIMESTAMPTZ,
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- Create indexes for performance
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_devices_org_id ON whatsapp_devices(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org_id ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_org_id ON campaigns(org_id);
CREATE INDEX IF NOT EXISTS idx_messages_org_id ON messages(org_id);
CREATE INDEX IF NOT EXISTS idx_conversations_org_id ON conversations(org_id);

-- ═══════════════════════════════════════════════════════════════
-- Setup initial user and organization
-- ═══════════════════════════════════════════════════════════════
INSERT INTO organizations (
  id,
  name,
  slug,
  plan,
  owner_id,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'WA Intelligence Organization',
  'wa-intelligence-org',
  'free',
  (SELECT id FROM auth.users WHERE email = 'iere3703@gmail.com'),
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Create user profile
INSERT INTO users (
  id,
  email,
  role,
  created_at,
  updated_at
) VALUES (
  (SELECT id FROM auth.users WHERE email = 'iere3703@gmail.com'),
  'iere3703@gmail.com',
  'owner',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  updated_at = NOW();

-- Add user to organization as owner
INSERT INTO org_members (
  id,
  org_id,
  user_id,
  role,
  joined_at,
  created_at,
  updated_at
) SELECT 
  gen_random_uuid(),
  o.id,
  u.id,
  'owner',
  NOW(),
  NOW(),
  NOW()
FROM organizations o, users u 
WHERE o.slug = 'wa-intelligence-org' 
  AND u.email = 'iere3703@gmail.com'
ON CONFLICT (org_id, user_id) DO UPDATE SET
  role = EXCLUDED.role,
  updated_at = NOW();
