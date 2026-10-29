/*
# Daily Gemini API usage log for charting

1. New Tables
- `gemini_daily_usage`
  - `day` (date, primary key): the calendar day (UTC) the requests were made
  - `total_tokens` (bigint, default 0): cumulative tokens consumed that day
  - `prompt_tokens` (bigint, default 0): input tokens that day
  - `output_tokens` (bigint, default 0): output tokens that day
  - `request_count` (bigint, default 0): number of completed requests that day

2. Security
- Enable RLS on `gemini_daily_usage`.
- Grant SELECT to `authenticated` (restricted by admin-only policy).
- Grant INSERT, UPDATE to `service_role` (used by the ai-chat edge function).
- Admin-only SELECT policy: a signed-in user must have role 'admin' in profiles.

3. Notes
- The ai-chat edge function calls an atomic increment RPC after each completed
  stream, upserting a row for the current UTC day. This table is what the admin
  chart queries to show the last 7 days of token consumption.
*/

CREATE TABLE IF NOT EXISTS gemini_daily_usage (
  day date PRIMARY KEY DEFAULT CURRENT_DATE,
  total_tokens bigint NOT NULL DEFAULT 0,
  prompt_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  request_count bigint NOT NULL DEFAULT 0
);

ALTER TABLE gemini_daily_usage ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON gemini_daily_usage TO authenticated;
GRANT INSERT, UPDATE ON gemini_daily_usage TO service_role;

DROP POLICY IF EXISTS "admin_select_gemini_daily_usage" ON gemini_daily_usage;
CREATE POLICY "admin_select_gemini_daily_usage" ON gemini_daily_usage FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE OR REPLACE FUNCTION increment_gemini_daily_usage(
  p_prompt bigint,
  p_output bigint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO gemini_daily_usage (day, total_tokens, prompt_tokens, output_tokens, request_count)
  VALUES (CURRENT_DATE, p_prompt + p_output, p_prompt, p_output, 1)
  ON CONFLICT (day)
  DO UPDATE SET
    total_tokens = gemini_daily_usage.total_tokens + p_prompt + p_output,
    prompt_tokens = gemini_daily_usage.prompt_tokens + p_prompt,
    output_tokens = gemini_daily_usage.output_tokens + p_output,
    request_count = gemini_daily_usage.request_count + 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION increment_gemini_daily_usage(bigint, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION increment_gemini_daily_usage(bigint, bigint) TO service_role;
