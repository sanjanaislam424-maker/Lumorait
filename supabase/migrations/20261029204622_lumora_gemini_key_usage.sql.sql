/*
# Gemini key usage tracking (admin only)

1. New Tables
- `gemini_key_usage`
  - `key_value` (text, primary key): the Gemini API key usage was recorded for
  - `request_count` (bigint, default 0): number of completed AI requests
  - `prompt_tokens` (bigint, default 0): cumulative input tokens consumed
  - `output_tokens` (bigint, default 0): cumulative output tokens consumed
  - `last_used_at` (timestamptz): when the key was last used

2. Security
- Enable RLS on `gemini_key_usage`.
- Grant SELECT to `authenticated` (restricted by admin-only policy).
- Grant INSERT, UPDATE to `service_role` (used by the ai-chat edge function).
- All policies require the signed-in user to have the admin role in `profiles`.

3. Notes
- The ai-chat edge function upserts token counts after each completed stream using the service role, which bypasses RLS.
- Regular users cannot read this table; only admins can.
*/

CREATE TABLE IF NOT EXISTS gemini_key_usage (
  key_value text PRIMARY KEY,
  request_count bigint NOT NULL DEFAULT 0,
  prompt_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  last_used_at timestamptz
);

ALTER TABLE gemini_key_usage ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON gemini_key_usage TO authenticated;
GRANT INSERT, UPDATE ON gemini_key_usage TO service_role;

DROP POLICY IF EXISTS "admin_select_gemini_key_usage" ON gemini_key_usage;
CREATE POLICY "admin_select_gemini_key_usage" ON gemini_key_usage FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
