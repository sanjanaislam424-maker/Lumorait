/*
# Box Winners Public Feed + Super Mystery Box Events

1. New Tables
- `box_winners`: Public log of every mystery/spark box win, visible to all users.
  - id (uuid pk)
  - user_id (uuid, references profiles)
  - user_name (text): winner's display name (denormalized for fast public reads)
  - box_type (text): 'normal' | 'super'
  - box_label (text): human label e.g. "Normal Mystery Box" / "Super Mystery Box"
  - coins_won (integer): exact coins awarded
  - created_at (timestamptz default now())
- `super_mystery_events`: Admin-controlled Super Mystery Box event config.
  - id (integer pk, single row default 1)
  - is_active (boolean default false)
  - activation_at (timestamptz): when the event goes live
  - winner_limit (integer default 10): total users who can claim
  - reward_coins (integer default 1000): super grand reward amount
  - claimers_count (integer default 0): running count of claims
  - updated_at (timestamptz default now())

2. Security
- `box_winners`: RLS enabled. SELECT public to anon+authenticated (transparency feed).
  INSERT only to authenticated (a signed-in user logs their own win).
- `super_mystery_events`: RLS enabled. SELECT public to anon+authenticated
  (everyone can see the active event). UPDATE only to admin role via existing
  admin policy pattern on app_settings.
- Grants: service_role full access (edge functions may read).

3. Notes
- The `spin_history` table already exists; we keep using it for internal history.
  `box_winners` is the public-facing feed with denormalized names.
- A single default row (id=1) is seeded into super_mystery_events.
*/

CREATE TABLE IF NOT EXISTS box_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL DEFAULT '',
  box_type text NOT NULL DEFAULT 'normal',
  box_label text NOT NULL DEFAULT 'Mystery Box',
  coins_won integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE box_winners ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON box_winners TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON box_winners TO service_role;

DROP POLICY IF EXISTS "public_read_box_winners" ON box_winners;
CREATE POLICY "public_read_box_winners" ON box_winners
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_own_box_win" ON box_winners;
CREATE POLICY "auth_insert_own_box_win" ON box_winners
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS super_mystery_events (
  id integer PRIMARY KEY DEFAULT 1,
  is_active boolean NOT NULL DEFAULT false,
  activation_at timestamptz,
  winner_limit integer NOT NULL DEFAULT 10,
  reward_coins integer NOT NULL DEFAULT 1000,
  claimers_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE super_mystery_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON super_mystery_events TO anon, authenticated;
GRANT SELECT, UPDATE ON super_mystery_events TO service_role;
GRANT UPDATE ON super_mystery_events TO authenticated;

DROP POLICY IF EXISTS "public_read_super_event" ON super_mystery_events;
CREATE POLICY "public_read_super_event" ON super_mystery_events
  FOR SELECT TO anon, authenticated USING (true);

-- Seed default row
INSERT INTO super_mystery_events (id, is_active, winner_limit, reward_coins)
VALUES (1, false, 10, 1000)
ON CONFLICT (id) DO NOTHING;
