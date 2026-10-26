/*
# Schedule Daily Promotion Charge Edge Function via pg_cron

1. Purpose
- Schedules the `process-promotion-charges` edge function to run once per day
  at 00:05 UTC. This function deducts the fixed daily coin rate from each
  active long-term promotion and auto-stops promotions whose end date has passed.

2. Requirements
- Requires the `pg_cron` and `pg_net` extensions (enabled below if not present).

3. Important Notes
- The cron job calls the edge function via HTTP using pg_net's http_get.
- Runs daily so every active long-term boost is charged exactly once per 24h.
- If a charge was already applied within the last 24h, the function skips it.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $job$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-promotion-charges-daily'
  ) THEN
    PERFORM cron.schedule(
      'process-promotion-charges-daily',
      '5 0 * * *',
      $cmd$SELECT net.http_get(
        url := 'https://72223063.supabase.co/functions/v1/process-promotion-charges',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
          'Content-Type', 'application/json'
        )
      );$cmd$
    );
  END IF;
END
$job$;