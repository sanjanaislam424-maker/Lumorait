/*
# Public profile details, privacy toggles, skills, socials and portfolio

1. Summary
- Lets users publish a mobile number, social/platform links, skill tags and a portfolio of pinned work.
- Adds separate visibility switches so the mobile number and email can be kept private.
- The public profile function now returns only fields the owner chose to show. The sign-in phone number is never returned.

2. Modified Tables
- `profiles`
  - `contact_phone` (text, optional): mobile number the user chooses to publish. Separate from the sign-in phone.
  - `show_phone` (boolean, default false): publish `contact_phone` on the public profile.
  - `show_email` (boolean, default false): publish `contact_email` on the public profile.
  - `share_contact_info` (boolean, existing): now controls only the published address.
  - `social_links` (jsonb, default {}): map of platform key to link (facebook, instagram, youtube, tiktok, whatsapp, website). Must be a JSON object.
  - `skills` (text array, default {}): up to 12 skill tags.

3. New Tables
- `profile_portfolio_items`
  - `id`, `user_id` (defaults to the signed-in user), `title` (1 to 80 chars), `url` (http or https link, max 500 chars), `description` (optional, max 300 chars), `pinned` (boolean), `created_at`.
  - Up to 12 items per user, and up to 3 pinned items per user.

4. Security
- Row level security is enabled on `profile_portfolio_items`.
- Signed-in users can read all portfolio items (the showcase is public to members).
- Only the owner can insert, update, or delete their items. Limits are enforced in the policy checks.
- `get_public_profile` is replaced. It stays read-only, runs with owner rights, and is callable by signed-in users only.

5. Notes
- Existing profile rows get show_phone = false and show_email = false, so nothing new becomes public without the owner's choice.
- Direct reads of the profiles table by signed-in users are unchanged. Hiding phone numbers from those reads is a separate change.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS show_phone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_social_links_is_object') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_social_links_is_object CHECK (jsonb_typeof(social_links) = 'object');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_skills_max_12') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_skills_max_12 CHECK (cardinality(skills) <= 12);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS profile_portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
  url text NOT NULL CHECK (url ~* '^https?://' AND char_length(url) <= 500),
  description text CHECK (description IS NULL OR char_length(description) <= 300),
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_portfolio_items_user_idx ON profile_portfolio_items (user_id, pinned DESC, created_at DESC);

ALTER TABLE profile_portfolio_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON profile_portfolio_items TO authenticated;

DROP POLICY IF EXISTS "select_portfolio_items" ON profile_portfolio_items;
CREATE POLICY "select_portfolio_items" ON profile_portfolio_items FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_portfolio_items" ON profile_portfolio_items;
CREATE POLICY "insert_own_portfolio_items" ON profile_portfolio_items FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (SELECT count(*) FROM profile_portfolio_items x WHERE x.user_id = auth.uid()) < 12
    AND (NOT pinned OR (SELECT count(*) FROM profile_portfolio_items x WHERE x.user_id = auth.uid() AND x.pinned) < 3)
  );

DROP POLICY IF EXISTS "update_own_portfolio_items" ON profile_portfolio_items;
CREATE POLICY "update_own_portfolio_items" ON profile_portfolio_items FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (NOT pinned OR (SELECT count(*) FROM profile_portfolio_items x WHERE x.user_id = auth.uid() AND x.pinned AND x.id <> profile_portfolio_items.id) < 3)
  );

DROP POLICY IF EXISTS "delete_own_portfolio_items" ON profile_portfolio_items;
CREATE POLICY "delete_own_portfolio_items" ON profile_portfolio_items FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

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
    'skills', to_jsonb(p.skills),
    'social_links', p.social_links,
    'good_reviews', (SELECT count(*) FROM user_reviews r WHERE r.reviewee_id = p.id AND r.review_type = 'good'),
    'bad_reviews', (SELECT count(*) FROM user_reviews r WHERE r.reviewee_id = p.id AND r.review_type = 'bad'),
    'badges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', b.label, 'icon', b.icon, 'tier', b.tier) ORDER BY b.threshold_tasks)
      FROM user_badges ub
      JOIN badges b ON b.id = ub.badge_id
      WHERE ub.user_id = p.id
    ), '[]'::jsonb),
    'contact', jsonb_build_object(
      'phone', CASE WHEN p.show_phone THEN p.contact_phone ELSE NULL END,
      'email', CASE WHEN p.show_email THEN p.contact_email ELSE NULL END,
      'address', CASE WHEN p.share_contact_info THEN p.address ELSE NULL END
    )
  )
  FROM profiles p
  WHERE p.id = p_user_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;
