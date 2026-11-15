/*
# Add configurable minimum coin floor for Mystery Box (P2P) tasks

1. Modified tables
- `app_settings`: new column `min_box_task_reward` (integer, not null, default 5).
  Admin-configurable minimum coin reward a user must set when publishing a
  Mystery Box / P2P task. The existing `min_task_reward` column continues to
  control the minimum reward for Main Tasks.

2. Modified functions
- `publish_box_task`: recreated (drop + create, same signature and OUT
  columns) so it rejects tasks whose reward is below the
  `min_box_task_reward` value in `app_settings`, raising a
  `reward_below_minimum` exception the app shows as a friendly message.
  Validation reads the setting at publish time, so admin changes apply
  immediately.

3. Security
- No RLS changes. Function stays SECURITY DEFINER; EXECUTE revoked from
  PUBLIC/anon and granted to authenticated (same effective access as before).

4. Notes
- Idempotent: DROP FUNCTION IF EXISTS before CREATE.
- Existing published tasks are untouched; only new publishes are checked.
*/

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS min_box_task_reward integer NOT NULL DEFAULT 5;

DROP FUNCTION IF EXISTS publish_box_task(text, text, text, text, integer, text[]);

CREATE FUNCTION publish_box_task(
  p_title text,
  p_description text,
  p_platform text,
  p_target_url text,
  p_cost_coins integer,
  p_photo_urls text[] DEFAULT '{}',
  OUT out_box_slots integer,
  OUT out_lumora_coins integer,
  OUT out_task_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
v_user uuid := auth.uid();
v_spendable integer;
v_url text;
v_photos text[];
v_min_reward integer;
BEGIN
IF v_user IS NULL THEN
RAISE EXCEPTION 'not_authenticated';
END IF;

p_title := trim(coalesce(p_title, ''));
IF length(p_title) < 3 OR length(p_title) > 120 THEN
RAISE EXCEPTION 'invalid_title';
END IF;

p_platform := trim(coalesce(p_platform, 'other'));
IF p_platform = '' THEN p_platform := 'other'; END IF;

p_description := coalesce(p_description, '');
IF length(p_description) > 1000 THEN
RAISE EXCEPTION 'invalid_description';
END IF;

v_url := trim(coalesce(p_target_url, ''));
IF v_url = '' THEN
RAISE EXCEPTION 'missing_url';
END IF;
IF v_url NOT LIKE 'http://%' AND v_url NOT LIKE 'https://%' THEN
RAISE EXCEPTION 'invalid_url';
END IF;
IF length(v_url) > 500 THEN
RAISE EXCEPTION 'invalid_url';
END IF;

IF p_cost_coins IS NULL OR p_cost_coins < 0 OR p_cost_coins > 100000 THEN
RAISE EXCEPTION 'invalid_cost';
END IF;

SELECT (s.min_box_task_reward)::integer
INTO v_min_reward
FROM app_settings AS s
WHERE s.id = 1;

IF v_min_reward IS NOT NULL AND p_cost_coins < v_min_reward THEN
RAISE EXCEPTION 'reward_below_minimum';
END IF;

v_photos := array_remove(coalesce(p_photo_urls, '{}'), '');
IF array_length(v_photos, 1) > 3 THEN
v_photos := v_photos[1:3];
END IF;

SELECT (p.lumora_coins + p.bonus_coins)
INTO v_spendable
FROM profiles AS p
WHERE p.id = v_user
FOR UPDATE;

IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found'; END IF;

IF v_spendable < p_cost_coins THEN
RAISE EXCEPTION 'insufficient_coins';
END IF;

UPDATE profiles AS p
SET lumora_coins = p.lumora_coins - p_cost_coins
WHERE p.id = v_user
RETURNING p.box_slots, p.lumora_coins INTO out_box_slots, out_lumora_coins;

INSERT INTO tasks (creator_id, platform, title, description, target_url, reward_coins, cost_coins, is_admin_task, status, slots, filled, photo_urls)
VALUES (v_user, p_platform, p_title, p_description, v_url, GREATEST(1, p_cost_coins), p_cost_coins, false, 'open', 1, 0, v_photos)
RETURNING id INTO out_task_id;

IF p_cost_coins > 0 THEN
INSERT INTO transactions (user_id, type, amount, status, note)
VALUES (v_user, 'box_task_spend', p_cost_coins, 'completed',
'Mystery Box task published: ' || p_title);
END IF;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION publish_box_task(text, text, text, text, integer, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION publish_box_task(text, text, text, text, integer, text[]) TO authenticated;