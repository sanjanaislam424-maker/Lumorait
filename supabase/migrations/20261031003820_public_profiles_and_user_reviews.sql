/*
# Public profiles and Good/Bad user reviews

1. Summary
- Adds optional contact details to each profile, controlled by a visibility switch.
- Adds a reviews table where a task partner can leave a Good or Bad review with a comment after a task is approved.
- Adds a function that returns a public profile: bio, level, badges, rating counts, and contact details only when the owner chose to share them.

2. Modified Tables
- `profiles`
  - `contact_email` (text, optional): contact email the user chooses to publish. Separate from the sign-in email, which is never exposed.
  - `address` (text, optional): postal address the user chooses to publish.
  - `share_contact_info` (boolean, default false): when false, phone, email, and address are hidden from public profiles.

3. New Tables
- `user_reviews`
  - `id` (uuid, primary key)
  - `reviewer_id` (uuid, defaults to the signed-in user): who wrote the review
  - `reviewee_id` (uuid): the person being reviewed
  - `submission_id` (uuid, the approved task submission the review is about)
  - `review_type` (text): 'good' or 'bad'
  - `comment` (text, 1 to 1000 characters)
  - `created_at` (timestamp)
  - One review per reviewer per submission.

4. Security
- Row level security is enabled on `user_reviews`.
- Anyone signed in can read reviews (reviews are public by design).
- A review can only be inserted by the reviewer, about someone else, and only for an approved submission where the reviewer and reviewee were the task creator and the doer.
- No update or delete for users. Admins can moderate through the existing admin tools later.
- `get_public_profile` is read-only, runs with owner rights, and is callable by signed-in users only.

5. Notes
- Existing profile rows get share_contact_info = false, so nothing becomes public without the owner's choice.
- Phone numbers already sit in the profiles table, which signed-in users can read today. Hiding them from direct table reads is a separate change.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS share_contact_info boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS user_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES task_submissions(id) ON DELETE CASCADE,
  review_type text NOT NULL CHECK (review_type IN ('good', 'bad')),
  comment text NOT NULL CHECK (char_length(btrim(comment)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_reviews_not_self CHECK (reviewer_id <> reviewee_id),
  CONSTRAINT user_reviews_one_per_submission UNIQUE (reviewer_id, submission_id)
);

CREATE INDEX IF NOT EXISTS user_reviews_reviewee_idx ON user_reviews (reviewee_id, created_at DESC);

ALTER TABLE user_reviews ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON user_reviews TO authenticated;

DROP POLICY IF EXISTS "select_user_reviews" ON user_reviews;
CREATE POLICY "select_user_reviews" ON user_reviews FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_review_after_task" ON user_reviews;
CREATE POLICY "insert_review_after_task" ON user_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM task_submissions s
      JOIN tasks t ON t.id = s.task_id
      WHERE s.id = user_reviews.submission_id
        AND s.status = 'approved'
        AND (
          (s.doer_id = auth.uid() AND t.creator_id = user_reviews.reviewee_id)
          OR (t.creator_id = auth.uid() AND s.doer_id = user_reviews.reviewee_id)
        )
    )
  );

CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'avatar_url', p.avatar_url,
    'bio', p.bio,
    'level', p.level,
    'xp_points', p.xp_points,
    'total_tasks_completed', p.total_tasks_completed,
    'avg_rating', p.avg_rating,
    'good_reviews', (SELECT count(*) FROM user_reviews r WHERE r.reviewee_id = p.id AND r.review_type = 'good'),
    'bad_reviews', (SELECT count(*) FROM user_reviews r WHERE r.reviewee_id = p.id AND r.review_type = 'bad'),
    'badges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', b.label, 'icon', b.icon, 'tier', b.tier) ORDER BY b.threshold_tasks)
      FROM user_badges ub
      JOIN badges b ON b.id = ub.badge_id
      WHERE ub.user_id = p.id
    ), '[]'::jsonb),
    'contact', CASE WHEN p.share_contact_info
      THEN jsonb_build_object('phone', p.phone, 'email', p.contact_email, 'address', p.address)
      ELSE NULL END
  )
  FROM profiles p
  WHERE p.id = p_user_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;
