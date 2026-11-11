/*
# P2P task proof submission + creator approval flow

1. Purpose
- Replace the instant-complete P2P box task flow with a two-step approval flow:
  1. Completer submits proof (up to 3 screenshot URLs) — task moves to in_progress, no reward yet.
  2. Creator approves — both creator and completer receive +1 Bonus Mystery Box.
- Creator can also reject, which reopens the task for others.
- Completer earns NO coins from the task itself; only the +1 bonus box on approval.

2. New/modified RPC functions
- `submit_box_task_proof(p_task_id, p_proof_urls, p_notes)` — marks the task in_progress,
  inserts a task_submissions row with status 'pending'. Blocks self-completion and
  already-filled tasks. Returns the submission id.
- `approve_box_task_submission(p_submission_id)` — callable only by the task creator.
  Sets submission status 'approved', closes the task, grants +1 box_slots to BOTH
  creator and completer, logs transactions. Returns ok + new slot counts.
- `reject_box_task_submission(p_submission_id)` — callable only by the task creator.
  Sets submission status 'rejected', reopens the task (status 'open', filled 0) so
  others can attempt it.

3. Security
- All three functions are SECURITY DEFINER (they write to profiles.box_slots and
  transactions across users, which the calling role cannot do directly).
- EXECUTE revoked from PUBLIC/anon; granted to authenticated only.
- No new tables or columns. Uses existing tasks, task_submissions, profiles, transactions.
*/

-- Drop old complete_box_task (instant-complete) — replaced by the approval flow.
DROP FUNCTION IF EXISTS public.complete_box_task(uuid, text, text[]);

CREATE OR REPLACE FUNCTION public.submit_box_task_proof(
  p_task_id uuid,
  p_proof_urls text[],
  p_notes text DEFAULT ''
) RETURNS TABLE (out_submission_id uuid, out_ok boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_creator uuid;
  v_task_status text;
  v_filled integer;
  v_sub uuid;
  v_proofs text[];
  v_notes text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  v_proofs := array_remove(coalesce(p_proof_urls, '{}'), '');
  IF array_length(v_proofs, 1) IS NULL OR array_length(v_proofs, 1) < 1 THEN
    RAISE EXCEPTION 'proof_required';
  END IF;
  IF array_length(v_proofs, 1) > 3 THEN
    v_proofs := v_proofs[1:3];
  END IF;

  v_notes := coalesce(p_notes, '');
  IF length(v_notes) > 1000 THEN RAISE EXCEPTION 'invalid_notes'; END IF;

  SELECT t.creator_id, t.status, t.filled
    INTO v_creator, v_task_status, v_filled
    FROM tasks AS t
   WHERE t.id = p_task_id
     AND t.is_admin_task = false
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'task_unavailable'; END IF;
  IF v_creator = v_user THEN RAISE EXCEPTION 'cannot_complete_own_task'; END IF;
  IF v_task_status <> 'open' OR v_filled <> 0 THEN RAISE EXCEPTION 'task_unavailable'; END IF;

  UPDATE tasks SET status = 'in_progress', filled = 1 WHERE id = p_task_id;

  INSERT INTO task_submissions (task_id, doer_id, proof_urls, notes, status)
  VALUES (p_task_id, v_user, v_proofs, v_notes, 'pending')
  RETURNING id INTO v_sub;

  RETURN QUERY SELECT v_sub, true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_box_task_proof(uuid, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_box_task_proof(uuid, text[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_box_task_submission(
  p_submission_id uuid
) RETURNS TABLE (out_creator_slots integer, out_completer_slots integer, out_ok boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_task_id uuid;
  v_doer uuid;
  v_sub_status text;
  v_task_status text;
  v_creator_slots integer;
  v_completer_slots integer;
  v_title text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT s.task_id, s.doer_id, s.status
    INTO v_task_id, v_doer, v_sub_status
    FROM task_submissions AS s
   WHERE s.id = p_submission_id
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'submission_not_found'; END IF;
  IF v_sub_status <> 'pending' THEN RAISE EXCEPTION 'submission_already_reviewed'; END IF;

  -- Only the task creator may approve
  IF NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = v_task_id AND t.creator_id = v_user) THEN
    RAISE EXCEPTION 'not_task_creator';
  END IF;

  SELECT t.status, t.title INTO v_task_status, v_title FROM tasks t WHERE t.id = v_task_id FOR UPDATE;
  IF v_task_status NOT IN ('in_progress') THEN RAISE EXCEPTION 'task_not_in_progress'; END IF;

  -- Approve submission
  UPDATE task_submissions SET status = 'approved', reviewed_at = now() WHERE id = p_submission_id;

  -- Close the task
  UPDATE tasks SET status = 'closed', filled = 1 WHERE id = v_task_id;

  -- Creator: +1 bonus box
  UPDATE profiles SET box_slots = profiles.box_slots + 1
   WHERE id = v_user
   RETURNING box_slots INTO v_creator_slots;

  INSERT INTO transactions (user_id, type, amount, status, note)
  VALUES (v_user, 'bonus', 0, 'completed',
          'Bonus Mystery Box earned — your task was approved: ' || v_title);

  -- Completer: +1 bonus box (NO coins)
  UPDATE profiles SET box_slots = profiles.box_slots + 1
   WHERE id = v_doer
   RETURNING box_slots INTO v_completer_slots;

  INSERT INTO transactions (user_id, type, amount, status, note)
  VALUES (v_doer, 'bonus', 0, 'completed',
          'Bonus Mystery Box earned — task submission approved: ' || v_title);

  RETURN QUERY SELECT v_creator_slots, v_completer_slots, true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_box_task_submission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_box_task_submission(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_box_task_submission(
  p_submission_id uuid
) RETURNS TABLE (out_ok boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_task_id uuid;
  v_sub_status text;
  v_task_status text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT s.task_id, s.status
    INTO v_task_id, v_sub_status
    FROM task_submissions AS s
   WHERE s.id = p_submission_id
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'submission_not_found'; END IF;
  IF v_sub_status <> 'pending' THEN RAISE EXCEPTION 'submission_already_reviewed'; END IF;

  IF NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = v_task_id AND t.creator_id = v_user) THEN
    RAISE EXCEPTION 'not_task_creator';
  END IF;

  SELECT t.status INTO v_task_status FROM tasks t WHERE t.id = v_task_id FOR UPDATE;

  -- Reject submission
  UPDATE task_submissions SET status = 'rejected', reviewed_at = now() WHERE id = p_submission_id;

  -- Reopen the task so others can attempt it (only if it was in_progress)
  IF v_task_status = 'in_progress' THEN
    UPDATE tasks SET status = 'open', filled = 0 WHERE id = v_task_id;
  END IF;

  RETURN QUERY SELECT true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_box_task_submission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_box_task_submission(uuid) TO authenticated;