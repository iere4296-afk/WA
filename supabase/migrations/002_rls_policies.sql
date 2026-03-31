-- Enable RLS on ALL tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_reply_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_session_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE baileys_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_merge_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_sessions ENABLE ROW LEVEL SECURITY;

-- Helper function: get org IDs for current user
CREATE OR REPLACE FUNCTION user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Org policy: owner or member can see
CREATE POLICY "org_select" ON organizations FOR SELECT
  USING (id IN (SELECT user_org_ids()));

CREATE POLICY "org_update" ON organizations FOR UPDATE
  USING (owner_id = auth.uid());

-- org_members: members of same org
CREATE POLICY "members_select" ON org_members FOR SELECT
  USING (org_id IN (SELECT user_org_ids()));

-- All data tables: same org_id pattern
CREATE POLICY "devices_all" ON whatsapp_devices FOR ALL
  USING (org_id IN (SELECT user_org_ids()));

CREATE POLICY "contacts_all" ON contacts FOR ALL
  USING (org_id IN (SELECT user_org_ids()));

CREATE POLICY "contact_lists_all" ON contact_lists FOR ALL
  USING (org_id IN (SELECT user_org_ids()));

CREATE POLICY "contact_list_members_all" ON contact_list_members FOR ALL
  USING (list_id IN (SELECT id FROM contact_lists WHERE org_id IN (SELECT user_org_ids())));

CREATE POLICY "templates_all" ON message_templates FOR ALL
  USING (org_id IN (SELECT user_org_ids()));

CREATE POLICY "campaigns_all" ON campaigns FOR ALL
  USING (org_id IN (SELECT user_org_ids()));

CREATE POLICY "messages_all" ON messages FOR ALL
  USING (org_id IN (SELECT user_org_ids()));

CREATE POLICY "conversations_all" ON conversations FOR ALL
  USING (org_id IN (SELECT user_org_ids()));

CREATE POLICY "autoreply_all" ON auto_reply_rules FOR ALL
  USING (org_id IN (SELECT user_org_ids()));

CREATE POLICY "flows_all" ON flows FOR ALL
  USING (org_id IN (SELECT user_org_ids()));

CREATE POLICY "flow_steps_all" ON flow_steps FOR ALL
  USING (org_id IN (SELECT user_org_ids()));

CREATE POLICY "flow_enrollments_all" ON flow_enrollments FOR ALL
  USING (org_id IN (SELECT user_org_ids()));

CREATE POLICY "health_events_all" ON health_events FOR ALL
  USING (org_id IN (SELECT user_org_ids()));

CREATE POLICY "billing_select" ON billing_usage FOR SELECT
  USING (org_id IN (SELECT user_org_ids()));

CREATE POLICY "audit_select" ON audit_logs FOR SELECT
  USING (org_id IN (SELECT user_org_ids()));

CREATE POLICY "login_history_select" ON login_history FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "ai_log_all" ON ai_generation_log FOR ALL
  USING (org_id IN (SELECT user_org_ids()));

CREATE POLICY "wa_session_keys_all" ON wa_session_keys FOR ALL
  USING (device_id IN (SELECT id FROM whatsapp_devices WHERE org_id IN (SELECT user_org_ids())));

CREATE POLICY "api_keys_select" ON api_keys FOR SELECT
  USING (org_id IN (SELECT user_org_ids()) AND revoked_at IS NULL);

CREATE POLICY "api_keys_insert_update_delete" ON api_keys FOR ALL
  USING (org_id IN (SELECT user_org_ids()) AND created_by = auth.uid());

CREATE POLICY "webhook_endpoints_all" ON webhook_endpoints FOR ALL
  USING (org_id IN (SELECT user_org_ids()));

CREATE POLICY "baileys_sessions_all" ON baileys_sessions FOR ALL
  USING (device_id IN (SELECT id FROM whatsapp_devices WHERE org_id IN (SELECT user_org_ids())));

CREATE POLICY "contact_merge_log_all" ON contact_merge_log FOR ALL
  USING (org_id IN (SELECT user_org_ids()));

CREATE POLICY "wa_sessions_all" ON wa_sessions FOR ALL
  USING (device_id IN (SELECT id FROM whatsapp_devices WHERE org_id IN (SELECT user_org_ids())));
