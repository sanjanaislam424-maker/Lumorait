/*
# Add Mystery Box unlock toggles

1. Modified Tables
- `app_settings`: two new boolean columns controlling which unlock options appear
  in the user-facing Mystery Box limit popup:
  - `box_unlock_task_enabled` (boolean, default true) — show "complete a task to earn +1 box" option
  - `box_unlock_video_enabled` (boolean, default true) — show "watch a video to earn +1 box" option

2. Security
- No new grants or policies needed: the existing `select_settings` policy lets all
  authenticated users read app_settings, and `update_admin_settings` restricts
  updates to admins, which matches the requirement (admin controls the toggles,
  users read them to show/hide unlock buttons).

3. Notes
- Idempotent conditional column additions; safe to re-run.
- Both default to ON so current behavior is unchanged until an admin changes it.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'box_unlock_task_enabled') THEN
    ALTER TABLE public.app_settings ADD COLUMN box_unlock_task_enabled boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'box_unlock_video_enabled') THEN
    ALTER TABLE public.app_settings ADD COLUMN box_unlock_video_enabled boolean NOT NULL DEFAULT true;
  END IF;
END $$;
