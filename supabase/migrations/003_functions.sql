-- Increment campaign sent count (atomic)
CREATE OR REPLACE FUNCTION increment_campaign_sent(campaign_id UUID)
RETURNS void AS $$
  UPDATE campaigns
  SET sent_count = sent_count + 1, updated_at = NOW()
  WHERE id = campaign_id;
$$ LANGUAGE SQL;

-- Increment campaign failed count
CREATE OR REPLACE FUNCTION increment_campaign_failed(campaign_id UUID)
RETURNS void AS $$
  UPDATE campaigns
  SET failed_count = failed_count + 1, updated_at = NOW()
  WHERE id = campaign_id;
$$ LANGUAGE SQL;

-- Increment unread count for conversation
CREATE OR REPLACE FUNCTION increment_unread(conversation_id UUID)
RETURNS void AS $$
  UPDATE conversations
  SET unread_count = unread_count + 1, updated_at = NOW()
  WHERE id = conversation_id;
$$ LANGUAGE SQL;

-- Increment billing usage (field: messages_sent | ai_calls | contacts_imported | api_calls | contacts_stored)
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

-- BUG FIX 2: Increment reply count for a contact (atomic, called from inboxHandler)
CREATE OR REPLACE FUNCTION increment_reply_count(contact_id UUID)
RETURNS void AS $$
  UPDATE contacts
  SET reply_count = reply_count + 1,
      last_replied = NOW(),
      updated_at = NOW()
  WHERE id = contact_id;
$$ LANGUAGE SQL;

-- BUG FIX B9: Increment flow enrolled count
CREATE OR REPLACE FUNCTION increment_flow_enrolled(flow_id UUID, count INT DEFAULT 1)
RETURNS void AS $$
  UPDATE flows
  SET enrolled_count = enrolled_count + count,
      updated_at = NOW()
  WHERE id = flow_id;
$$ LANGUAGE SQL;

-- BUG FIX C1: Update message status (for delivery receipts)
CREATE OR REPLACE FUNCTION update_message_status(
  wa_message_id_param TEXT,
  new_status TEXT,
  campaign_id_param UUID DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  ts TIMESTAMPTZ := NOW();
BEGIN
  UPDATE messages
  SET status = new_status,
      delivered_at = CASE WHEN new_status = 'delivered' THEN ts ELSE delivered_at END,
      read_at = CASE WHEN new_status = 'read' THEN ts ELSE read_at END
  WHERE wa_message_id = wa_message_id_param;

  IF campaign_id_param IS NOT NULL AND new_status = 'delivered' THEN
    UPDATE campaigns SET delivered_count = delivered_count + 1 WHERE id = campaign_id_param;
  END IF;
  IF campaign_id_param IS NOT NULL AND new_status = 'read' THEN
    UPDATE campaigns SET read_count = read_count + 1 WHERE id = campaign_id_param;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Reset daily counts (run via pg_cron at midnight UTC)
SELECT cron.schedule('reset-daily-counts', '0 0 * * *', $$
  UPDATE whatsapp_devices
  SET messages_sent_today = 0,
      last_reset_at = NOW()
  WHERE messages_sent_today > 0;
$$);

-- Decay wa_status_confidence (run daily)
SELECT cron.schedule('decay-wa-confidence', '0 1 * * *', $$
  UPDATE contacts
  SET wa_status_confidence = GREATEST(0, wa_status_confidence - 1)
  WHERE wa_status_confidence > 0
  AND wa_status_checked_at < NOW() - INTERVAL '1 day';
$$);

-- Campaign completion check (run every 5 minutes)
SELECT cron.schedule('check-campaign-completion', '*/5 * * * *', $$
  UPDATE campaigns
  SET status = 'completed', completed_at = NOW()
  WHERE status = 'running'
  AND sent_count + failed_count >= total_contacts
  AND total_contacts > 0;
$$);

-- Resume paused devices after 4 hours (cron fallback when BullMQ unavailable)
SELECT cron.schedule('resume-paused-devices', '*/5 * * * *', $$
  UPDATE whatsapp_devices
  SET status = 'connected',
      updated_at = NOW(),
      settings = settings - 'resume_at'
  WHERE status = 'paused'
  AND settings->>'resume_at' IS NOT NULL
  AND (settings->>'resume_at')::TIMESTAMPTZ <= NOW();
$$);

-- ═══════════════════════════════════════════════════════════════
-- get_campaign_stats - Returns live stats for a campaign
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_campaign_stats(campaign_id UUID)
RETURNS TABLE (
  sent_count INTEGER,
  delivered_count INTEGER,
  read_count INTEGER,
  failed_count INTEGER,
  total_contacts INTEGER,
  delivery_rate FLOAT,
  read_rate FLOAT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.sent_count,
    c.delivered_count,
    c.read_count,
    c.failed_count,
    c.total_contacts,
    CASE WHEN c.sent_count > 0 THEN (c.delivered_count::FLOAT / c.sent_count) ELSE 0 END,
    CASE WHEN c.sent_count > 0 THEN (c.read_count::FLOAT / c.sent_count) ELSE 0 END,
    c.status
  FROM campaigns c
  WHERE c.id = campaign_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ═══════════════════════════════════════════════════════════════
-- compute_health_score - Calculate device health score (simplified)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION compute_health_score(device_id UUID)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 100;
  delivery_rate FLOAT;
  message_count INTEGER;
  failed_count INTEGER;
BEGIN
  -- Get device stats from last 7 days
  SELECT
    CASE WHEN COUNT(*) > 0 THEN SUM(CASE WHEN status IN ('delivered','read') THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 ELSE 100 END,
    COUNT(*),
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)
  INTO delivery_rate, message_count, failed_count
  FROM messages
  WHERE device_id = compute_health_score.device_id
  AND created_at > NOW() - INTERVAL '7 days';

  -- Deduct points for issues
  score := score - GREATEST(0, LEAST(100, (100 - COALESCE(delivery_rate, 100))::INT / 2));
  score := score - GREATEST(0, LEAST(20, COALESCE(failed_count, 0)::INT / 5));

  RETURN GREATEST(0, LEAST(100, score));
END;
$$ LANGUAGE plpgsql STABLE;

-- ═══════════════════════════════════════════════════════════════
-- get_conversation_summary - Get recently active conversations
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_conversation_summary(org_id UUID, limit_count INT DEFAULT 10)
RETURNS TABLE (
  id UUID,
  device_id UUID,
  contact_id UUID,
  last_message_preview TEXT,
  unread_count INTEGER,
  last_message_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.device_id,
    c.contact_id,
    c.last_message_preview,
    c.unread_count,
    c.last_message_at
  FROM conversations c
  WHERE c.org_id = get_conversation_summary.org_id
  ORDER BY c.last_message_at DESC NULLS LAST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;
