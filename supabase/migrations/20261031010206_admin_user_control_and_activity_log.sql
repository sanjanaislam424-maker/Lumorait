/*
# Admin user control, activity log, and privileged-column guard

## Plain-English summary
Adds the server-side rules that let platform admins look at and manage any user account. Every admin action is checked inside the database, not just hidden in the admin screen.

## 1. New functions
- is_platform_admin(): true only for a signed-in, non-banned user whose role is admin.
- admin_list_users(): searchable, filterable, paginated user directory including sign-in email and last sign-in time.
- admin_update_user_profile(): edits display name, phone, bio, contact email, contact phone, and address.
- admin_set_user_balances(): sets coin and cash balances, records each change as a transaction with a required reason.
- admin_set_user_role(): switches a user between user and admin. Admins cannot demote themselves.
- admin_set_user_banned(): bans or unbans an account. Admins cannot ban themselves.
- admin_update_task(): edits a task's title, description, target link, reward, and slot count.
- admin_delete_task(): deletes a task only when it has no submissions, to protect user work.
- admin_update_portfolio_item(): edits any portfolio item, keeping the 3-pinned limit.
- admin_delete_portfolio_item(): removes any portfolio item.

## 2. New table
- user_activity_log: one row per event (signup, login, profile update, account change, transaction or transfer, task submission). Clients can only read it, and only admins can read it.

## 3. Triggers
- Signup, profile update, account change (role, ban, verified, super-admin), login (sign-in time changes), transaction, and task submission events are written to the activity log automatically.
- A guard on the profile table blocks regular users from changing role, super-admin, admin permissions, banned, or verified flags. Admin changes and system changes are unaffected.

## 4. Security
- Every admin function checks is_platform_admin() first, then runs as its owner.
- All admin functions are revoked from the public and anonymous roles and granted to signed-in users only.
- Trigger functions are not callable by clients.
- The activity log has row-level security on, select only for admins, and no insert/update/delete grant for clients.

## Important notes
1. Coin, cash, and withdrawable balances are still writable by their owner through the normal app. Locking them requires moving the app's own coin updates (check-ins, spins, tasks, wallet) into server functions, which is a separate change.
2. Activity events start from this migration. Past events are not backfilled.
3. Deleting a task that has submissions is refused on purpose.
*/

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND NOT coalesce(banned, false)
  );
$$;

REVOKE EXECUTE ON FUNCTION is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated;

CREATE TABLE IF NOT EXISTS user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid,
  kind text NOT NULL,
  summary text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_activity_log_user_created_idx ON user_activity_log (user_id, created_at DESC);

ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON user_activity_log TO authenticated;

DROP POLICY IF EXISTS "admin_select_activity_log" ON user_activity_log;
CREATE POLICY "admin_select_activity_log" ON user_activity_log FOR SELECT
TO authenticated
USING (is_platform_admin());

CREATE OR REPLACE FUNCTION guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_platform_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role
      OR NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin
      OR NEW.admin_permissions IS DISTINCT FROM OLD.admin_permissions
      OR NEW.banned IS DISTINCT FROM OLD.banned
      OR NEW.kyc_verified IS DISTINCT FROM OLD.kyc_verified THEN
      RAISE EXCEPTION 'Account privileges can only be changed by an administrator';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_privileged_columns ON profiles;
CREATE TRIGGER profiles_guard_privileged_columns
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION guard_profile_privileged_columns();

CREATE OR REPLACE FUNCTION log_profile_signup_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_activity_log (user_id, actor_id, kind, summary)
  VALUES (NEW.id, auth.uid(), 'signup', 'Account created');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_log_signup ON profiles;
CREATE TRIGGER profiles_log_signup
AFTER INSERT ON profiles
FOR EACH ROW EXECUTE FUNCTION log_profile_signup_activity();

CREATE OR REPLACE FUNCTION log_profile_update_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.full_name IS DISTINCT FROM OLD.full_name
    OR NEW.phone IS DISTINCT FROM OLD.phone
    OR NEW.bio IS DISTINCT FROM OLD.bio
    OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url
    OR NEW.contact_email IS DISTINCT FROM OLD.contact_email
    OR NEW.contact_phone IS DISTINCT FROM OLD.contact_phone
    OR NEW.address IS DISTINCT FROM OLD.address
    OR NEW.skills IS DISTINCT FROM OLD.skills
    OR NEW.social_links IS DISTINCT FROM OLD.social_links THEN
    INSERT INTO user_activity_log (user_id, actor_id, kind, summary)
    VALUES (NEW.id, auth.uid(), 'profile_update', 'Profile details updated');
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
    OR NEW.banned IS DISTINCT FROM OLD.banned
    OR NEW.kyc_verified IS DISTINCT FROM OLD.kyc_verified
    OR NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
    INSERT INTO user_activity_log (user_id, actor_id, kind, summary, details)
    VALUES (
      NEW.id,
      auth.uid(),
      'account_change',
      format('Role: %s, banned: %s, verified: %s', NEW.role, NEW.banned, NEW.kyc_verified),
      jsonb_build_object(
        'role', NEW.role,
        'banned', NEW.banned,
        'kyc_verified', NEW.kyc_verified,
        'is_super_admin', NEW.is_super_admin
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_log_update ON profiles;
CREATE TRIGGER profiles_log_update
AFTER UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION log_profile_update_activity();

CREATE OR REPLACE FUNCTION log_transaction_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_activity_log (user_id, actor_id, kind, summary, details)
  VALUES (
    NEW.user_id,
    auth.uid(),
    CASE WHEN NEW.type ILIKE '%transfer%' THEN 'transfer' ELSE 'transaction' END,
    format('%s: %s (%s)', NEW.type, NEW.amount, NEW.status),
    jsonb_build_object(
      'transaction_id', NEW.id,
      'type', NEW.type,
      'amount', NEW.amount,
      'status', NEW.status,
      'method', NEW.method,
      'note', NEW.note
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_log_activity ON transactions;
CREATE TRIGGER transactions_log_activity
AFTER INSERT ON transactions
FOR EACH ROW EXECUTE FUNCTION log_transaction_activity();

CREATE OR REPLACE FUNCTION log_task_submission_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_activity_log (user_id, actor_id, kind, summary, details)
  VALUES (
    NEW.doer_id,
    auth.uid(),
    'task_submission',
    'Submitted a task',
    jsonb_build_object('submission_id', NEW.id, 'task_id', NEW.task_id, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_submissions_log_activity ON task_submissions;
CREATE TRIGGER task_submissions_log_activity
AFTER INSERT ON task_submissions
FOR EACH ROW EXECUTE FUNCTION log_task_submission_activity();

CREATE OR REPLACE FUNCTION log_login_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_activity_log (user_id, kind, summary)
  VALUES (NEW.id, 'login', 'Signed in');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auth_users_log_login ON auth.users;
CREATE TRIGGER auth_users_log_login
AFTER UPDATE OF last_sign_in_at ON auth.users
FOR EACH ROW
WHEN (NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at)
EXECUTE FUNCTION log_login_activity();

CREATE OR REPLACE FUNCTION admin_list_users(
  p_search text DEFAULT '',
  p_filter text DEFAULT 'all',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_pattern text := '%' || lower(coalesce(p_search, '')) || '%';
  v_total integer;
  v_rows jsonb;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  p_limit := least(greatest(coalesce(p_limit, 50), 1), 200);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  WITH base AS (
    SELECT p.*, u.email, u.last_sign_in_at
    FROM profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE (
      lower(coalesce(p.full_name, '')) LIKE v_pattern
      OR lower(coalesce(p.phone, '')) LIKE v_pattern
      OR lower(coalesce(u.email, '')) LIKE v_pattern
      OR p.id::text LIKE v_pattern
    )
    AND CASE coalesce(p_filter, 'all')
      WHEN 'banned' THEN coalesce(p.banned, false)
      WHEN 'admin' THEN p.role = 'admin'
      WHEN 'kyc_verified' THEN coalesce(p.kyc_verified, false)
      WHEN 'kyc_pending' THEN NOT coalesce(p.kyc_verified, false)
      WHEN 'low_balance' THEN p.lumora_coins < 50
      ELSE true
    END
  )
  SELECT count(*) INTO v_total FROM base;

  SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.created_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT * FROM base
    ORDER BY created_at DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset
  ) b;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION admin_update_user_profile(p_user_id uuid, p_patch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE profiles SET
    full_name = CASE WHEN p_patch ? 'full_name' THEN left(nullif(trim(p_patch->>'full_name'), ''), 120) ELSE full_name END,
    phone = CASE WHEN p_patch ? 'phone' THEN left(nullif(trim(p_patch->>'phone'), ''), 30) ELSE phone END,
    bio = CASE WHEN p_patch ? 'bio' THEN left(coalesce(p_patch->>'bio', ''), 280) ELSE bio END,
    contact_email = CASE WHEN p_patch ? 'contact_email' THEN left(nullif(trim(p_patch->>'contact_email'), ''), 120) ELSE contact_email END,
    contact_phone = CASE WHEN p_patch ? 'contact_phone' THEN left(nullif(trim(p_patch->>'contact_phone'), ''), 30) ELSE contact_phone END,
    address = CASE WHEN p_patch ? 'address' THEN left(nullif(trim(p_patch->>'address'), ''), 300) ELSE address END
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION admin_set_user_balances(
  p_user_id uuid,
  p_lumora_coins integer,
  p_withdrawable_coins integer,
  p_bonus_coins integer,
  p_cash_balance numeric,
  p_withdrawable_balance numeric,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old profiles%ROWTYPE;
  v_reason text := left(trim(coalesce(p_reason, '')), 200);
  v_coin_delta integer;
  v_cash_delta numeric;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF length(v_reason) < 3 THEN
    RAISE EXCEPTION 'A reason of at least 3 characters is required';
  END IF;
  IF p_lumora_coins < 0 OR p_withdrawable_coins < 0 OR p_bonus_coins < 0
    OR p_cash_balance < 0 OR p_withdrawable_balance < 0 THEN
    RAISE EXCEPTION 'Balances cannot be negative';
  END IF;
  IF p_lumora_coins > 100000000 OR p_withdrawable_coins > 100000000 OR p_bonus_coins > 100000000
    OR p_cash_balance > 100000000 OR p_withdrawable_balance > 100000000 THEN
    RAISE EXCEPTION 'Balance is too large';
  END IF;

  SELECT * INTO v_old FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  UPDATE profiles SET
    lumora_coins = p_lumora_coins,
    withdrawable_coins = p_withdrawable_coins,
    bonus_coins = p_bonus_coins,
    cash_balance = p_cash_balance,
    withdrawable_balance = p_withdrawable_balance
  WHERE id = p_user_id;

  v_coin_delta := p_lumora_coins - coalesce(v_old.lumora_coins, 0);
  IF v_coin_delta <> 0 THEN
    INSERT INTO transactions (user_id, type, amount, status, note)
    VALUES (p_user_id, 'admin_adjust', v_coin_delta, 'completed',
      format('Admin adjustment: coins %s%s. Reason: %s', CASE WHEN v_coin_delta > 0 THEN '+' ELSE '' END, v_coin_delta, v_reason));
  END IF;

  v_cash_delta := p_cash_balance - coalesce(v_old.cash_balance, 0);
  IF v_cash_delta <> 0 THEN
    INSERT INTO transactions (user_id, type, amount, status, note)
    VALUES (p_user_id, 'admin_adjust', round(v_cash_delta)::integer, 'completed',
      format('Admin adjustment: cash balance changed by %s BDT. Reason: %s', v_cash_delta, v_reason));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION admin_set_user_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_role NOT IN ('user', 'admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  IF p_user_id = auth.uid() AND p_role <> 'admin' THEN
    RAISE EXCEPTION 'You cannot remove your own admin role';
  END IF;

  UPDATE profiles SET role = p_role WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION admin_set_user_banned(p_user_id uuid, p_banned boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_user_id = auth.uid() AND p_banned THEN
    RAISE EXCEPTION 'You cannot ban your own account';
  END IF;

  UPDATE profiles SET banned = p_banned WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION admin_update_task(p_task_id uuid, p_patch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task tasks%ROWTYPE;
  v_title text;
  v_url text;
  v_reward integer;
  v_slots integer;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  v_title := CASE WHEN p_patch ? 'title' THEN left(trim(coalesce(p_patch->>'title', '')), 120) ELSE v_task.title END;
  IF length(v_title) < 1 THEN
    RAISE EXCEPTION 'Title is required';
  END IF;

  v_url := CASE WHEN p_patch ? 'target_url' THEN nullif(trim(coalesce(p_patch->>'target_url', '')), '') ELSE v_task.target_url END;
  IF v_url IS NOT NULL AND v_url !~* '^https?://' THEN
    RAISE EXCEPTION 'Target link must start with http:// or https://';
  END IF;

  v_reward := CASE WHEN p_patch ? 'reward_coins' THEN (p_patch->>'reward_coins')::integer ELSE v_task.reward_coins END;
  IF v_reward < 0 OR v_reward > 100000 THEN
    RAISE EXCEPTION 'Reward must be between 0 and 100000';
  END IF;

  v_slots := CASE WHEN p_patch ? 'slots' THEN (p_patch->>'slots')::integer ELSE v_task.slots END;
  IF v_slots < greatest(v_task.filled, 1) OR v_slots > 1000 THEN
    RAISE EXCEPTION 'Slots must be at least the number already filled and at most 1000';
  END IF;

  UPDATE tasks SET
    title = v_title,
    description = CASE WHEN p_patch ? 'description' THEN left(coalesce(p_patch->>'description', ''), 2000) ELSE description END,
    target_url = v_url,
    reward_coins = v_reward,
    slots = v_slots
  WHERE id = p_task_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_task(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF EXISTS (SELECT 1 FROM task_submissions WHERE task_id = p_task_id) THEN
    RAISE EXCEPTION 'This task has submissions and cannot be deleted';
  END IF;

  DELETE FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION admin_update_portfolio_item(p_item_id uuid, p_patch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item profile_portfolio_items%ROWTYPE;
  v_title text;
  v_url text;
  v_pinned boolean;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_item FROM profile_portfolio_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portfolio item not found';
  END IF;

  v_title := CASE WHEN p_patch ? 'title' THEN left(trim(coalesce(p_patch->>'title', '')), 80) ELSE v_item.title END;
  IF length(v_title) < 1 THEN
    RAISE EXCEPTION 'Title is required';
  END IF;

  v_url := CASE WHEN p_patch ? 'url' THEN left(trim(coalesce(p_patch->>'url', '')), 500) ELSE v_item.url END;
  IF v_url !~* '^https?://' THEN
    RAISE EXCEPTION 'Link must start with http:// or https://';
  END IF;

  v_pinned := CASE WHEN p_patch ? 'pinned' THEN (p_patch->>'pinned')::boolean ELSE v_item.pinned END;
  IF v_pinned AND NOT v_item.pinned AND (
    SELECT count(*) FROM profile_portfolio_items
    WHERE user_id = v_item.user_id AND pinned AND id <> p_item_id
  ) >= 3 THEN
    RAISE EXCEPTION 'A user can pin at most 3 portfolio items';
  END IF;

  UPDATE profile_portfolio_items SET
    title = v_title,
    url = v_url,
    description = CASE WHEN p_patch ? 'description' THEN left(nullif(trim(coalesce(p_patch->>'description', '')), ''), 300) ELSE description END,
    pinned = v_pinned
  WHERE id = p_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_portfolio_item(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM profile_portfolio_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portfolio item not found';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_list_users(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_update_user_profile(uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_set_user_balances(uuid, integer, integer, integer, numeric, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_set_user_role(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_set_user_banned(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_update_task(uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_delete_task(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_update_portfolio_item(uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_delete_portfolio_item(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION guard_profile_privileged_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION log_profile_signup_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION log_profile_update_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION log_transaction_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION log_task_submission_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION log_login_activity() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION admin_list_users(text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_user_profile(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_user_balances(uuid, integer, integer, integer, numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_user_banned(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_task(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_portfolio_item(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_portfolio_item(uuid) TO authenticated;
