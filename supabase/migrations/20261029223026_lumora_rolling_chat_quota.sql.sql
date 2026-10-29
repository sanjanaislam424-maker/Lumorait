/*
# Rolling 24-hour per-message quota tracking

Replaces the old daily-reset counter with per-message timestamp logging.
Each user message creates a row; messages older than 24 hours are automatically
ignored when counting the active quota, and cleaned up by a cron job.

1. New Table
- `chat_message_log`
  - `id` (uuid, primary key): unique per message
  - `user_id` (uuid): the user who sent the message
  - `sent_at` (timestamptz): when the message was sent
  - `expires_at` (timestamptz): sent_at + 24 hours (for fast cleanup)

2. New Functions
- `record_chat_message(p_user_id uuid)`
  - SECURITY DEFINER: inserts a new log row, then counts how many messages
    are still active (sent within the last 24 hours). Returns the active
    count, the tier-based limit, the remaining quota, and the expiry time
    of the oldest active message (for the countdown timer).
- `get_chat_quota(p_user_id uuid)`
  - SECURITY DEFINER: returns current active count, limit, remaining, and
    the earliest message expiry — without inserting a new row.
- `cleanup_expired_chat_messages()`
  - SECURITY DEFINER: deletes log rows older than 24 hours.

3. Security
- RLS enabled; admin-only SELECT; service_role INSERT/DELETE.
- Both user-facing functions are SECURITY DEFINER, callable by authenticated only.

4. Scheduled Job
- pg_cron runs cleanup every hour to remove expired rows.

5. Tier limits: Free = 25, Pro = 30, VIP = 50.
*/

CREATE TABLE IF NOT EXISTS chat_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

ALTER TABLE chat_message_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON chat_message_log TO authenticated;
GRANT INSERT, DELETE ON chat_message_log TO service_role;

DROP POLICY IF EXISTS "admin_select_chat_message_log" ON chat_message_log;
CREATE POLICY "admin_select_chat_message_log" ON chat_message_log FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_chat_message_log_user_expires ON chat_message_log (user_id, expires_at);

CREATE OR REPLACE FUNCTION record_chat_message(p_user_id uuid)
RETURNS TABLE (active_count int, daily_limit int, remaining int, next_restore timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_limit int;
  v_count int;
  v_next timestamptz;
BEGIN
  SELECT membership_tier INTO v_tier FROM profiles WHERE id = p_user_id;
  v_limit := CASE v_tier
    WHEN 'pro' THEN 30
    WHEN 'vip' THEN 50
    ELSE 25
  END;

  INSERT INTO chat_message_log (user_id) VALUES (p_user_id);

  SELECT count(*), min(sent_at)
  INTO v_count, v_next
  FROM chat_message_log
  WHERE user_id = p_user_id AND sent_at > now() - INTERVAL '24 hours';

  RETURN QUERY SELECT v_count, v_limit, GREATEST(v_limit - v_count, 0), v_next + INTERVAL '24 hours';
END;
$$;

REVOKE EXECUTE ON FUNCTION record_chat_message(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_chat_message(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION get_chat_quota(p_user_id uuid)
RETURNS TABLE (active_count int, daily_limit int, remaining int, next_restore timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_limit int;
  v_count int;
  v_next timestamptz;
BEGIN
  SELECT membership_tier INTO v_tier FROM profiles WHERE id = p_user_id;
  v_limit := CASE v_tier
    WHEN 'pro' THEN 30
    WHEN 'vip' THEN 50
    ELSE 25
  END;

  SELECT count(*), min(sent_at)
  INTO v_count, v_next
  FROM chat_message_log
  WHERE user_id = p_user_id AND sent_at > now() - INTERVAL '24 hours';

  RETURN QUERY SELECT v_count, v_limit, GREATEST(v_limit - v_count, 0), COALESCE(v_next + INTERVAL '24 hours', NULL);
END;
$$;

REVOKE EXECUTE ON FUNCTION get_chat_quota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_chat_quota(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION cleanup_expired_chat_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM chat_message_log WHERE sent_at < now() - INTERVAL '24 hours';
END;
$$;

REVOKE EXECUTE ON FUNCTION cleanup_expired_chat_messages() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cleanup_expired_chat_messages() TO service_role;

SELECT cron.schedule(
  'cleanup-expired-chat-messages',
  '0 * * * *',
  $$SELECT cleanup_expired_chat_messages()$$
);
