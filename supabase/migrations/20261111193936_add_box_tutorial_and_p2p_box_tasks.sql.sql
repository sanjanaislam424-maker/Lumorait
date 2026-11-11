/*
# Mystery Box tutorial link and P2P box tasks with dual-sided rewards

1. Modified Tables
- `app_settings`: new column `box_tutorial_url` (text, nullable) — the YouTube tutorial
  link admins set in the Mystery Box settings. Users read it to open the in-app player.
- `profiles`: new column `box_slots` (integer, NOT NULL, default 0) — extra Mystery Box
  slots a user has banked. Publishing or completing a box task grants +1 here.

2. New Functions (both SECURITY DEFINER, search_path pinned, authenticated only)
- `publish_box_task(p_title text, p_description text, p_platform text, p_target_url text, p_cost_coins int)`
  - Validates the title/platform and cost (>= 0), checks the caller's profile for enough
    spendable coins (lumora_coins + bonus_coins), deducts them, inserts a P2P task
    (`is_admin_task = false`, `status = 'open'`, `slots = 1`), inserts a spend transaction,
    and grants the creator +1 box slot. Atomic: if anything fails, everything rolls back.
  - Returns table with (new box_slots balance, new lumora_coins balance, task id).
- `complete_box_task(p_task_id uuid, p_notes text, p_proof_urls text[])`
  - Atomically claims the ONE available completion slot: re-checks the task is an open
    non-admin box task with 0 filled, marks it closed immediately (status='closed',
    filled=1) so a second submission can never win, then inserts an approved submission
    and grants the completer +1 box slot plus the task's reward coins. Atomic, race-safe.
  - Returns table with (new box_slots balance, new lumora_coins balance).

3. Security
- RLS is unchanged on existing tables. Both functions verify auth.uid() and never trust
  client-passed user ids. EXECUTE granted to authenticated only; revoked from anon/PUBLIC.
- The completer may not complete their own task; the publisher must have real balance.

4. Notes
- The single-completion rule is enforced in the DB: the UPDATE ... WHERE filled = 0
  claim pattern guarantees exactly one completer even under concurrent requests.
- Safe to re-run (idempotent column adds and DROP/CREATE function).
*/

ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS box_tutorial_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS box_slots integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.publish_box_task(
  p_title text,
  p_description text,
  p_platform text,
  p_target_url text,
  p_cost_coins integer
) RETURNS TABLE (box_slots integer, lumora_coins integer, task_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_spendable integer;
  v_new_slots integer;
  v_new_coins integer;
  v_task uuid;
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

  p_target_url := NULLIF(trim(coalesce(p_target_url, '')), '');
  IF p_target_url IS NOT NULL AND length(p_target_url) > 500 THEN
    RAISE EXCEPTION 'invalid_url';
  END IF;

  IF p_cost_coins IS NULL OR p_cost_coins < 0 OR p_cost_coins > 100000 THEN
    RAISE EXCEPTION 'invalid_cost';
  END IF;

  SELECT (p.lumora_coins + p.bonus_coins)
    INTO v_spendable
    FROM profiles p
   WHERE p.id = v_user
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found'; END IF;

  IF v_spendable < p_cost_coins THEN
    RAISE EXCEPTION 'insufficient_coins';
  END IF;

  UPDATE profiles
     SET lumora_coins = lumora_coins - p_cost_coins,
         box_slots = box_slots + 1
   WHERE id = v_user
   RETURNING box_slots, lumora_coins INTO v_new_slots, v_new_coins;

  INSERT INTO tasks (creator_id, platform, title, description, target_url, reward_coins, cost_coins, is_admin_task, status, slots, filled)
  VALUES (v_user, p_platform, p_title, p_description, p_target_url, GREATEST(1, cost_coins), p_cost_coins, false, 'open', 1, 0)
  RETURNING id INTO v_task;

  IF p_cost_coins > 0 THEN
    INSERT INTO transactions (user_id, type, amount, status, note)
    VALUES (v_user, 'box_task_spend', p_cost_coins, 'completed',
            'Mystery Box task published: ' || p_title);
  END IF;

  RETURN QUERY SELECT v_new_slots, v_new_coins, v_task;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_box_task(
  p_task_id uuid,
  p_notes text,
  p_proof_urls text[]
) RETURNS TABLE (box_slots integer, lumora_coins integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_reward integer;
  v_new_slots integer;
  v_new_coins integer;
  v_claimed boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  p_notes := coalesce(p_notes, '');
  IF length(p_notes) > 1000 THEN RAISE EXCEPTION 'invalid_notes'; END IF;

  SELECT t.reward_coins
    INTO v_reward
    FROM tasks t
   WHERE t.id = p_task_id
     AND t.is_admin_task = false
     AND t.status = 'open'
     AND t.filled = 0
     AND t.creator_id <> v_user
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'task_unavailable'; END IF;

  UPDATE tasks
     SET status = 'closed', filled = 1
   WHERE id = p_task_id
     AND filled = 0
     AND status = 'open'
   RETURNING true INTO v_claimed;

  IF v_claimed IS NOT TRUE THEN
    RAISE EXCEPTION 'task_unavailable';
  END IF;

  UPDATE profiles
     SET box_slots = box_slots + 1
   WHERE id = v_user
   RETURNING box_slots, lumora_coins INTO v_new_slots, v_new_coins;

  IF v_reward > 0 THEN
    UPDATE profiles
       SET lumora_coins = lumora_coins + v_reward
     WHERE id = v_user;
    v_new_coins := v_new_coins + v_reward;
    INSERT INTO transactions (user_id, type, amount, status, note)
    VALUES (v_user, 'box_task_reward', v_reward, 'completed',
            'Mystery Box task completed: ' || p_task_id::text);
  END IF;

  INSERT INTO task_submissions (task_id, doer_id, proof_urls, notes, status, reviewed_at)
  VALUES (p_task_id, v_user, coalesce(p_proof_urls, '{}'), p_notes, 'approved', now());

  RETURN QUERY SELECT v_new_slots, v_new_coins;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.publish_box_task(text, text, text, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_box_task(uuid, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_box_task(text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_box_task(uuid, text, text[]) TO authenticated;