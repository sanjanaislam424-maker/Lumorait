/*
# Chat message daily limits + 7-day auto-deletion

1. New Tables
- `chat_daily_limits`
  - `user_id` (uuid, primary key): the user whose messages are counted
  - `day` (date, primary key): the UTC calendar day
  - `message_count` (int, default 0): number of user messages sent that day
  - `updated_at` (timestamptz): when the count last changed

2. New Functions
- `increment_chat_message_count(p_user_id uuid)`
  - SECURITY DEFINER: atomically increments the user's message count for the
    current UTC day, inserting a row if none exists. Returns the new count and
    the tier-based daily limit so the frontend can check both in one call.
- `get_chat_message_count(p_user_id uuid)`
  - SECURITY DEFINER: returns the current day's count and the daily limit for
    the user's tier, without incrementing.
- `cleanup_old_chat_sessions()`
  - SECURITY DEFINER: deletes chat_sessions older than 7 days. The CASCADE
    foreign key on chat_messages removes all messages automatically.

3. Security
- `chat_daily_limits`: RLS enabled, admin-only SELECT, service_role INSERT/UPDATE.
- Both increment and get functions are SECURITY DEFINER and callable by
  authenticated users only (EXECUTE revoked from PUBLIC/anon).
- The cleanup function is callable by the service_role (used by pg_cron).

4. Scheduled Job
- A pg_cron job runs `cleanup_old_chat_sessions()` every day at 03:00 UTC,
  permanently deleting chat sessions and their messages older than 7 days.

5. Notes
- Daily limits: Free = 25, Pro = 30, VIP = 50 messages/day.
- Only user messages are counted; AI/admin replies are not.
- The reset happens naturally at UTC midnight when a new day row is created.
*/

CREATE TABLE IF NOT EXISTS chat_daily_limits (
  user_id uuid NOT NULL,
  day date NOT NULL DEFAULT CURRENT_DATE,
  message_count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE chat_daily_limits ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON chat_daily_limits TO authenticated;
GRANT INSERT, UPDATE ON chat_daily_limits TO service_role;

DROP POLICY IF EXISTS "admin_select_chat_daily_limits" ON chat_daily_limits;
CREATE POLICY "admin_select_chat_daily_limits" ON chat_daily_limits FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE OR REPLACE FUNCTION increment_chat_message_count(p_user_id uuid)
RETURNS TABLE (new_count int, daily_limit int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_limit int;
  v_count int;
BEGIN
  SELECT membership_tier INTO v_tier FROM profiles WHERE id = p_user_id;
  v_limit := CASE v_tier
    WHEN 'pro' THEN 30
    WHEN 'vip' THEN 50
    ELSE 25
  END;

  INSERT INTO chat_daily_limits (user_id, day, message_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, day)
  DO UPDATE SET message_count = chat_daily_limits.message_count + 1, updated_at = now()
  RETURNING message_count INTO v_count;

  RETURN QUERY SELECT v_count, v_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION increment_chat_message_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION increment_chat_message_count(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION get_chat_message_count(p_user_id uuid)
RETURNS TABLE (current_count int, daily_limit int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_limit int;
  v_count int;
BEGIN
  SELECT membership_tier INTO v_tier FROM profiles WHERE id = p_user_id;
  v_limit := CASE v_tier
    WHEN 'pro' THEN 30
    WHEN 'vip' THEN 50
    ELSE 25
  END;

  SELECT message_count INTO v_count FROM chat_daily_limits WHERE user_id = p_user_id AND day = CURRENT_DATE;
  v_count := COALESCE(v_count, 0);

  RETURN QUERY SELECT v_count, v_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_chat_message_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_chat_message_count(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION cleanup_old_chat_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM chat_sessions WHERE created_at < now() - INTERVAL '7 days';
END;
$$;

REVOKE EXECUTE ON FUNCTION cleanup_old_chat_sessions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cleanup_old_chat_sessions() TO service_role;

SELECT cron.schedule(
  'cleanup-old-chat-sessions',
  '0 3 * * *',
  $$SELECT cleanup_old_chat_sessions()$$
);
