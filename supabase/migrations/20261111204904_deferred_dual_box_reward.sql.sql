/*
# Deferred dual mystery box reward

New flow:
- publish_box_task: deducts coins, inserts the task, but NO longer grants +1 box slot.
- complete_box_task: completer gets +1 box slot AND the task creator also gets
  +1 box slot (deferred dual reward). Both changes hit their profile rows, which
  stream to each client via the existing profiles realtime subscription.

Also adds `tasks` to the supabase_realtime publication so a creator's open task
list and the "your task was completed" toast fire live.
*/

CREATE OR REPLACE FUNCTION public.publish_box_task(
  p_title text,
  p_description text,
  p_platform text,
  p_target_url text,
  p_cost_coins integer,
  p_photo_urls text[] DEFAULT '{}'
) RETURNS TABLE (out_box_slots integer, out_lumora_coins integer, out_task_id uuid)
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
  v_url text;
  v_photos text[];
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

  -- Coins only: NO instant box slot reward anymore (deferred to completion)
  UPDATE profiles AS p
     SET lumora_coins = p.lumora_coins - p_cost_coins
   WHERE p.id = v_user
   RETURNING p.box_slots, p.lumora_coins INTO v_new_slots, v_new_coins;

  INSERT INTO tasks (creator_id, platform, title, description, target_url, reward_coins, cost_coins, is_admin_task, status, slots, filled, photo_urls)
  VALUES (v_user, p_platform, p_title, p_description, v_url, GREATEST(1, p_cost_coins), p_cost_coins, false, 'open', 1, 0, v_photos)
  RETURNING id INTO v_task;

  IF p_cost_coins > 0 THEN
    INSERT INTO transactions (user_id, type, amount, status, note)
    VALUES (v_user, 'box_task_spend', p_cost_coins, 'completed',
            'Mystery Box task published: ' || p_title);
  END IF;

  RETURN QUERY SELECT v_new_slots, v_new_coins, v_task;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.publish_box_task(text, text, text, text, integer, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_box_task(text, text, text, text, integer, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_box_task(
  p_task_id uuid,
  p_notes text,
  p_proof_urls text[]
) RETURNS TABLE (out_box_slots integer, out_lumora_coins integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_creator uuid;
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

  SELECT t.reward_coins, t.creator_id
    INTO v_reward, v_creator
    FROM tasks AS t
   WHERE t.id = p_task_id
     AND t.is_admin_task = false
     AND t.status = 'open'
     AND t.filled = 0
     AND t.creator_id <> v_user
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'task_unavailable'; END IF;

  UPDATE tasks AS t
     SET status = 'closed', filled = 1
   WHERE t.id = p_task_id
     AND t.filled = 0
     AND t.status = 'open'
   RETURNING true INTO v_claimed;

  IF v_claimed IS NOT TRUE THEN
    RAISE EXCEPTION 'task_unavailable';
  END IF;

  -- Completer: +1 box slot
  UPDATE profiles AS p
     SET box_slots = p.box_slots + 1
   WHERE p.id = v_user
   RETURNING p.box_slots, p.lumora_coins INTO v_new_slots, v_new_coins;

  IF v_reward > 0 THEN
    UPDATE profiles AS p
       SET lumora_coins = p.lumora_coins + v_reward
     WHERE p.id = v_user;
    v_new_coins := v_new_coins + v_reward;
    INSERT INTO transactions (user_id, type, amount, status, note)
    VALUES (v_user, 'box_task_reward', v_reward, 'completed',
            'Mystery Box task completed: ' || p_task_id::text);
  END IF;

  -- Creator: deferred +1 box slot (fires their realtime profile update too)
  UPDATE profiles AS p
     SET box_slots = p.box_slots + 1
   WHERE p.id = v_creator;

  INSERT INTO transactions (user_id, type, amount, status, note)
  VALUES (v_creator, 'bonus', 0, 'completed',
          'Bonus Mystery Box slot earned — your task was completed: ' || p_task_id::text);

  INSERT INTO task_submissions (task_id, doer_id, proof_urls, notes, status, reviewed_at)
  VALUES (p_task_id, v_user, coalesce(p_proof_urls, '{}'), p_notes, 'approved', now());

  RETURN QUERY SELECT v_new_slots, v_new_coins;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_box_task(uuid, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_box_task(uuid, text, text[]) TO authenticated;

-- Stream task updates so creators see live "task completed" toasts
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;