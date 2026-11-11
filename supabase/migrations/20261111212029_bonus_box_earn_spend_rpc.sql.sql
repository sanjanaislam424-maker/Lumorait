-- Single persistent Bonus Mystery Box pool in profiles.box_slots.
-- earn_bonus_box: server-authoritative +1 for the calling user (ads, admin tasks, etc.)
-- spend_bonus_box: server-authoritative -1, only if the user has one to spend.

CREATE OR REPLACE FUNCTION public.earn_bonus_box(p_source text DEFAULT 'ad')
RETURNS TABLE (out_box_slots integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_slots integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  p_source := coalesce(trim(p_source), 'ad');
  IF length(p_source) > 40 THEN p_source := substr(p_source, 1, 40); END IF;

  UPDATE profiles SET box_slots = profiles.box_slots + 1
   WHERE id = v_user
   RETURNING box_slots INTO v_slots;

  INSERT INTO transactions (user_id, type, amount, status, note)
  VALUES (v_user, 'bonus', 0, 'completed', 'Bonus Mystery Box earned: ' || p_source);

  RETURN QUERY SELECT v_slots;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.earn_bonus_box(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.earn_bonus_box(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.spend_bonus_box()
RETURNS TABLE (out_box_slots integer, out_ok boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_slots integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT box_slots INTO v_slots FROM profiles WHERE id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found'; END IF;
  IF v_slots <= 0 THEN
    RETURN QUERY SELECT v_slots, false;
    RETURN;
  END IF;

  UPDATE profiles SET box_slots = profiles.box_slots - 1
   WHERE id = v_user
   RETURNING box_slots INTO v_slots;

  RETURN QUERY SELECT v_slots, true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.spend_bonus_box() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_bonus_box() TO authenticated;