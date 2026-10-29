-- Add updated_at column to daily_ai_content for cache invalidation on regenerate
ALTER TABLE daily_ai_content ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add updated_at column to daily_ai_ui_copy for cache invalidation on regenerate
ALTER TABLE daily_ai_ui_copy ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add UPDATE policy to daily_ai_content so the edge function (service role) can update rows
-- (service_role bypasses RLS, but let's be explicit for completeness)
DROP POLICY IF EXISTS "update_daily_ai_content" ON daily_ai_content;
CREATE POLICY "update_daily_ai_content"
ON daily_ai_content FOR UPDATE
TO anon, authenticated
USING (true) WITH CHECK (true);

-- Add UPDATE policy to daily_ai_ui_copy
DROP POLICY IF EXISTS "update_daily_ai_ui_copy" ON daily_ai_ui_copy;
CREATE POLICY "update_daily_ai_ui_copy"
ON daily_ai_ui_copy FOR UPDATE
TO anon, authenticated
USING (true) WITH CHECK (true);