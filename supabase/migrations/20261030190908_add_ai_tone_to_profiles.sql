/*
# Add AI Tone preference to profiles

1. New Columns
- `profiles.ai_tone` (text, default 'buddy') — stores the user's preferred AI persona/tone.
  Valid values: 'buddy' (Chill Best Friend), 'mentor' (Professional Mentor), 'coach' (Witty Coach).
  Defaults to 'buddy' for all existing users.

2. Security
- The column is user-updatable via the existing `update_own_profile` UPDATE policy on `profiles`.
- No new RLS policies needed — the existing profile update policy already covers all columns.
- No new grants needed — `authenticated` already has UPDATE on `profiles`.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_tone text NOT NULL DEFAULT 'buddy';
