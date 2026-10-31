/*
# Permanent user activity log, new event types, and filtered admin query

1. Permanence
- The link from the activity log to user accounts is removed, so deleting or purging an account no longer deletes its history.
- A trigger blocks UPDATE, DELETE and TRUNCATE on the log for every role, including the app and admins.
- Direct access is reduced: authenticated users keep read access only through the admin policy, and anon loses all access.

2. New event types
- `checkin`: a row is logged each time a daily check-in is saved.
- `password_change`: a row is logged whenever a user's stored password changes, with the exact timestamp.

3. New admin query
- `admin_list_user_activity(p_user_id, p_from, p_to, p_kinds, p_limit, p_offset)` returns a page of events plus the total count.
- Optional date range (from/to) and optional list of event kinds.
- Limit is clamped to 1..200. Only admins can call it (SQLSTATE 42501 otherwise).

4. Security
- All logging trigger functions remain SECURITY DEFINER and are not callable by app roles.
- The new query is granted to authenticated only and checks is_platform_admin().

5. Notes
- Existing log rows are kept as they are. No data is removed or rewritten.
*/

ALTER TABLE user_activity_log DROP CONSTRAINT IF EXISTS user_activity_log_user_id_fkey;

REVOKE ALL ON user_activity_log FROM anon, authenticated;
GRANT SELECT ON user_activity_log TO authenticated;

CREATE INDEX IF NOT EXISTS user_activity_log_kind_idx ON user_activity_log (user_id, kind, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_user_activity_log_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'The user activity log is permanent and cannot be changed or deleted' USING ERRCODE = '42501';
END;
$$;

REVOKE EXECUTE ON FUNCTION prevent_user_activity_log_changes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS user_activity_log_no_row_changes ON user_activity_log;
CREATE TRIGGER user_activity_log_no_row_changes
  BEFORE UPDATE OR DELETE ON user_activity_log
  FOR EACH ROW EXECUTE FUNCTION prevent_user_activity_log_changes();

DROP TRIGGER IF EXISTS user_activity_log_no_truncate ON user_activity_log;
CREATE TRIGGER user_activity_log_no_truncate
  BEFORE TRUNCATE ON user_activity_log
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_user_activity_log_changes();

CREATE OR REPLACE FUNCTION log_checkin_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_activity_log (user_id, actor_id, kind, summary, details)
  VALUES (
    NEW.user_id,
    NEW.user_id,
    'checkin',
    'Daily check-in: day ' || NEW.day_number,
    jsonb_build_object('day_number', NEW.day_number, 'reward', NEW.reward)
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION log_checkin_activity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS check_ins_log_activity ON check_ins;
CREATE TRIGGER check_ins_log_activity
  AFTER INSERT ON check_ins
  FOR EACH ROW EXECUTE FUNCTION log_checkin_activity();

CREATE OR REPLACE FUNCTION log_password_change_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
    INSERT INTO user_activity_log (user_id, kind, summary)
    VALUES (NEW.id, 'password_change', 'Password changed');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION log_password_change_activity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auth_users_log_password_change ON auth.users;
CREATE TRIGGER auth_users_log_password_change
  AFTER UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW EXECUTE FUNCTION log_password_change_activity();

CREATE OR REPLACE FUNCTION admin_list_user_activity(
  p_user_id uuid,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_kinds text[] DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total integer;
  v_rows jsonb;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Admin access is required to view activity' USING ERRCODE = '42501';
  END IF;

  WITH base AS (
    SELECT l.id, l.kind, l.summary, l.actor_id, l.details, l.created_at
    FROM user_activity_log l
    WHERE l.user_id = p_user_id
      AND (p_from IS NULL OR l.created_at >= p_from)
      AND (p_to IS NULL OR l.created_at < p_to)
      AND (p_kinds IS NULL OR cardinality(p_kinds) = 0 OR l.kind = ANY(p_kinds))
  )
  SELECT
    (SELECT count(*)::integer FROM base),
    coalesce(
      (SELECT jsonb_agg(to_jsonb(b) ORDER BY b.created_at DESC, b.id DESC)
       FROM (
         SELECT * FROM base
         ORDER BY created_at DESC, id DESC
         LIMIT v_limit OFFSET v_offset
       ) b),
      '[]'::jsonb
    )
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_list_user_activity(uuid, timestamptz, timestamptz, text[], integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_list_user_activity(uuid, timestamptz, timestamptz, text[], integer, integer) TO authenticated;
