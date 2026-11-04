/*
# Schedule daily-ai-content edge function at midnight + unique constraint

1. Purpose
- Schedules the `daily-ai-content` edge function to run automatically every day
  at 00:00 UTC (midnight) via pg_cron + pg_net.
- This forces the daily content (funny quotes, tips) to refresh at midnight
  regardless of whether any user visits the app.

2. Schema Changes
- Add unique constraint on `daily_ai_content.content_date` so upsert works
  correctly and race conditions don't create duplicate rows.

3. Cron Schedule
- Job name: 'daily-ai-content-midnight'
- Schedule: '0 0 * * *' (every day at midnight UTC)
- Calls the edge function via HTTP GET with service role auth.
*/

-- Unique constraint for upsert support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_ai_content_content_date_key'
  ) THEN
    ALTER TABLE daily_ai_content ADD CONSTRAINT daily_ai_content_content_date_key UNIQUE (content_date);
  END IF;
END
$$;

-- Schedule the daily AI content generation at midnight
DO $job$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'daily-ai-content-midnight'
  ) THEN
    PERFORM cron.schedule(
      'daily-ai-content-midnight',
      '0 0 * * *',
      $cmd$SELECT net.http_get(
        url := 'https://72223063.supabase.co/functions/v1/daily-ai-content',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
          'Content-Type', 'application/json'
        )
      );$cmd$
    );
  END IF;
END
$job$;
