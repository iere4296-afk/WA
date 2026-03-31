-- Phase 1 alignment — safe to run on DBs that already applied older 001–005.
-- Adds: contact_merge_log, wa_sessions, billing columns, RLS, updated increment_billing_usage.

-- ─── billing_usage: spec columns (no-op if already present) ─────────────────
ALTER TABLE billing_usage ADD COLUMN IF NOT EXISTS contacts_imported INTEGER DEFAULT 0;
ALTER TABLE billing_usage ADD COLUMN IF NOT EXISTS api_calls INTEGER DEFAULT 0;

-- ─── contact_merge_log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_merge_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  original_phone TEXT NOT NULL,
  merged_data JSONB DEFAULT '{}',
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_merge_log_org ON contact_merge_log(org_id, created_at DESC);

-- ─── wa_sessions (canonical Baileys key/value; complements legacy wa_session_keys) ─
CREATE TABLE IF NOT EXISTS wa_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES whatsapp_devices(id) ON DELETE CASCADE,
  session_key TEXT NOT NULL,
  session_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_id, session_key)
);

CREATE INDEX IF NOT EXISTS idx_wa_sessions_device ON wa_sessions(device_id);

DROP TRIGGER IF EXISTS trg_wa_sessions_updated ON wa_sessions;
CREATE TRIGGER trg_wa_sessions_updated
  BEFORE UPDATE ON wa_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ─── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE contact_merge_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_merge_log_all" ON contact_merge_log;
CREATE POLICY "contact_merge_log_all" ON contact_merge_log FOR ALL
  USING (org_id IN (SELECT user_org_ids()));

DROP POLICY IF EXISTS "wa_sessions_all" ON wa_sessions;
CREATE POLICY "wa_sessions_all" ON wa_sessions FOR ALL
  USING (device_id IN (SELECT id FROM whatsapp_devices WHERE org_id IN (SELECT user_org_ids())));

-- ─── increment_billing_usage (match 003_functions.sql) ──────────────────────
CREATE OR REPLACE FUNCTION increment_billing_usage(org_id UUID, field TEXT)
RETURNS void AS $$
DECLARE
  period_start_val TIMESTAMPTZ := date_trunc('month', NOW());
  period_end_val TIMESTAMPTZ := date_trunc('month', NOW()) + INTERVAL '1 month';
BEGIN
  INSERT INTO billing_usage (org_id, period_start, period_end)
  VALUES (org_id, period_start_val, period_end_val)
  ON CONFLICT (org_id, period_start) DO NOTHING;

  IF field = 'messages_sent' THEN
    UPDATE billing_usage
    SET messages_sent = messages_sent + 1, updated_at = NOW()
    WHERE billing_usage.org_id = increment_billing_usage.org_id
    AND billing_usage.period_start = period_start_val;
  ELSIF field = 'ai_calls' THEN
    UPDATE billing_usage
    SET ai_calls = ai_calls + 1, updated_at = NOW()
    WHERE billing_usage.org_id = increment_billing_usage.org_id
    AND billing_usage.period_start = period_start_val;
  ELSIF field = 'contacts_imported' THEN
    UPDATE billing_usage
    SET contacts_imported = contacts_imported + 1, updated_at = NOW()
    WHERE billing_usage.org_id = increment_billing_usage.org_id
    AND billing_usage.period_start = period_start_val;
  ELSIF field = 'api_calls' THEN
    UPDATE billing_usage
    SET api_calls = api_calls + 1, updated_at = NOW()
    WHERE billing_usage.org_id = increment_billing_usage.org_id
    AND billing_usage.period_start = period_start_val;
  ELSIF field = 'contacts_stored' THEN
    UPDATE billing_usage
    SET contacts_stored = contacts_stored + 1, updated_at = NOW()
    WHERE billing_usage.org_id = increment_billing_usage.org_id
    AND billing_usage.period_start = period_start_val;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
