/*
# Account deletion holding period, rating-based levels, and task-completed XP

1. New Columns on `profiles`
- `deletion_requested_at` (timestamptz, nullable) — when the user requested account deletion. Null = no deletion pending. Set on deletion request; cleared if user cancels within the 30-day holding period.
- `avg_rating` (numeric, default 0) — average of all doer_rating values from approved task_submissions. Drives the account Level.
- `total_tasks_completed` (integer, default 0) — count of approved task_submissions. Drives XP progress.

2. Level Calculation
- Level is now determined by avg_rating, not by claiming XP rewards:
  - avg_rating >= 4.0 → Level 5
  - avg_rating >= 3.0 → Level 4
  - avg_rating >= 2.0 → Level 3
  - avg_rating >= 1.0 → Level 2
  - else → Level 1
- XP points still accumulate from completed tasks and fill the XP bar for bonus coin rewards.
- The claim-level-reward flow still works: when XP bar is full and level_reward_claimed < level, user claims bonus coins.

3. Backfill
- Populate total_tasks_completed and avg_rating from existing task_submissions data.
- Recalculate level for all existing profiles based on the new avg_rating formula.

4. Security
- No new tables. RLS already enabled on profiles; existing policies cover the new columns.
- No policy changes needed — the existing UPDATE policy allows users to update their own row including the new columns.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avg_rating numeric DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_tasks_completed integer DEFAULT 0;

-- Backfill total_tasks_completed from approved submissions
UPDATE profiles p
SET total_tasks_completed = COALESCE(
  (SELECT COUNT(*) FROM task_submissions WHERE doer_id = p.id AND status = 'approved'),
  0
);

-- Backfill avg_rating from approved submissions with non-null doer_rating
UPDATE profiles p
SET avg_rating = COALESCE(
  (SELECT AVG(doer_rating) FROM task_submissions WHERE doer_id = p.id AND status = 'approved' AND doer_rating IS NOT NULL),
  0
);

-- Recalculate level from avg_rating
UPDATE profiles SET level = CASE
  WHEN avg_rating >= 4 THEN 5
  WHEN avg_rating >= 3 THEN 4
  WHEN avg_rating >= 2 THEN 3
  WHEN avg_rating >= 1 THEN 2
  ELSE 1
END;
