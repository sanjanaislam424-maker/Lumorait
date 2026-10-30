/*
# Review task submissions with ratings, XP and rating-based levels

1. What changes
- Adds a `review_task_submission` function that admins call to approve or reject a task submission.
- Approving stores the admin's 1-5 star rating for the doer, awards XP, increases the doer's completed task count, recomputes the doer's average rating, and sets their level from that average.

2. Level rule (from average rating of approved submissions)
- 4 or higher = Level 5
- 3 or higher = Level 4
- 2 or higher = Level 3
- 1 or higher = Level 2
- Below 1 (including no ratings yet) = Level 1

3. XP rule
- Approval awards XP equal to the task reward (doubled for admin tasks, matching the coin payout).

4. Security
- The function runs with elevated rights but first checks that the caller is an admin or super admin.
- Execute permission is revoked from public and anonymous users and granted only to signed-in users; non-admins get an error.
- No table permissions change.

5. Notes
- Coin payouts stay in the app as before; this function only handles status, rating, XP and level.
- Submissions can only be reviewed once (pending or challenged).
*/

CREATE OR REPLACE FUNCTION public.review_task_submission(
  p_submission_id uuid,
  p_status text,
  p_rating integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub task_submissions%ROWTYPE;
  v_task tasks%ROWTYPE;
  v_avg numeric;
  v_level integer;
  v_xp integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND (role = 'admin' OR is_super_admin = true)
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  IF p_status = 'approved' AND (p_rating IS NULL OR p_rating < 1 OR p_rating > 5) THEN
    RAISE EXCEPTION 'rating must be between 1 and 5';
  END IF;

  SELECT * INTO v_sub FROM task_submissions WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'submission not found';
  END IF;
  IF v_sub.status NOT IN ('pending', 'challenged') THEN
    RAISE EXCEPTION 'submission already reviewed';
  END IF;

  UPDATE task_submissions
  SET status = p_status,
      reviewed_at = now(),
      doer_rating = CASE WHEN p_status = 'approved' THEN p_rating ELSE doer_rating END
  WHERE id = v_sub.id;

  IF p_status = 'approved' THEN
    SELECT * INTO v_task FROM tasks WHERE id = v_sub.task_id;
    v_xp := COALESCE(v_task.reward_coins, 0) * CASE WHEN v_task.is_admin_task THEN 2 ELSE 1 END;

    SELECT COALESCE(AVG(doer_rating), 0) INTO v_avg
    FROM task_submissions
    WHERE doer_id = v_sub.doer_id AND status = 'approved' AND doer_rating IS NOT NULL;

    v_level := CASE
      WHEN v_avg >= 4 THEN 5
      WHEN v_avg >= 3 THEN 4
      WHEN v_avg >= 2 THEN 3
      WHEN v_avg >= 1 THEN 2
      ELSE 1
    END;

    UPDATE profiles
    SET avg_rating = v_avg,
        level = v_level,
        xp_points = COALESCE(xp_points, 0) + v_xp,
        total_tasks_completed = COALESCE(total_tasks_completed, 0) + 1
    WHERE id = v_sub.doer_id;
  END IF;

  RETURN jsonb_build_object('status', p_status, 'xp_awarded', COALESCE(v_xp, 0), 'level', v_level);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_task_submission(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_task_submission(uuid, text, integer) TO authenticated;
