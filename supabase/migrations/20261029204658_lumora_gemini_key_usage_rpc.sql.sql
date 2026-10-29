/*
# Atomic increment for Gemini key usage tracking

1. New Functions
- `increment_gemini_key_usage(p_key text, p_prompt bigint, p_output bigint)`
  - SECURITY DEFINER function that atomically inserts or updates a row in
    `gemini_key_usage`, incrementing request_count, prompt_tokens, and
    output_tokens by the given amounts and setting last_used_at to now.
  - Called by the ai-chat edge function after each completed AI stream.

2. Security
- The function is SECURITY DEFINER so it can write to `gemini_key_usage`
  (which only allows service_role writes via RLS).
- EXECUTE is revoked from PUBLIC and anon so only authenticated/service_role
  callers can invoke it.

3. Notes
- Uses INSERT ... ON CONFLICT DO UPDATE for an atomic upsert-increment.
- No transaction control statements (Bolt wraps migrations in a transaction).
*/

CREATE OR REPLACE FUNCTION increment_gemini_key_usage(
  p_key text,
  p_prompt bigint,
  p_output bigint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO gemini_key_usage (key_value, request_count, prompt_tokens, output_tokens, last_used_at)
  VALUES (p_key, 1, p_prompt, p_output, now())
  ON CONFLICT (key_value)
  DO UPDATE SET
    request_count = gemini_key_usage.request_count + 1,
    prompt_tokens = gemini_key_usage.prompt_tokens + p_prompt,
    output_tokens = gemini_key_usage.output_tokens + p_output,
    last_used_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION increment_gemini_key_usage(text, bigint, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION increment_gemini_key_usage(text, bigint, bigint) TO service_role;
