/*
# Fix P2P box task publishing + mandatory link + photo uploads

1. Bug fix
- The previous publish_box_task INSERT referenced `cost_coins` (undeclared) instead of
  `p_cost_coins`, so every call threw. Fixed here.

2. Modified Tables
- `tasks`: new column `photo_urls` (text[], NOT NULL, default '{}') — up to 3 image
  URLs the creator attaches as visual references.

3. Updated Functions
- `publish_box_task` now:
  - Accepts `p_target_url` as MANDATORY — rejects empty / non-URL values with
    'invalid_url' instead of silently nulling them.
  - Accepts `p_photo_urls text[]` — stores up to 3 URLs (extra entries are truncated).
  - Inserts the photo_urls array and uses `p_cost_coins` in the INSERT.
- `complete_box_task` unchanged (already correct).

4. Security
- No new grants or policies. EXECUTE stays authenticated-only.
- The tasks INSERT runs as the definer (SECURITY DEFINER) but the caller's auth.uid()
  is trusted because the function set it as creator_id explicitly.
*/

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.publish_box_task(
  p_title text,
  p_description text,
  p_platform text,
  p_target_url text,
  p_cost_coins integer,
  p_photo_urls text[] DEFAULT '{}'
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

  -- MANDATORY target URL: must be a valid http(s) URL
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

  -- Cap photos at 3 entries, drop empties
  v_photos := array_remove(coalesce(p_photo_urls, '{}'), '');
  IF array_length(v_photos, 1) > 3 THEN
    v_photos := v_photos[1:3];
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