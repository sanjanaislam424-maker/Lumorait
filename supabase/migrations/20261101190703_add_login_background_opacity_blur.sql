/*
# Add login background opacity and blur settings

1. New columns on app_settings
- `login_background_opacity` (integer, 0-100, default 100): how visible the admin-uploaded
  login background image is. Applies in both the light-on and light-off states so the
  background stays persistent and never reverts to the global app logo.
- `login_background_blur` (integer, 0-20, default 0): depth-of-field blur on the login
  background image. Each step is half a pixel, matching the existing logo blur convention.

2. Public branding RPC
- `get_public_login_branding()` is dropped and recreated to also return `background_opacity`
  and `background_blur` so the unauthenticated login screen can read them.

3. Notes
- This migration only adds columns and re-creates the read-only RPC. No data is changed
  and the global `app_logo_url` column is untouched. RLS and grants on app_settings are
  unchanged (the table already has admin-only write and public read via the RPC).
*/

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS login_background_opacity integer NOT NULL DEFAULT 100;

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS login_background_blur integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_login_background_opacity_check') THEN
    ALTER TABLE app_settings
      ADD CONSTRAINT app_settings_login_background_opacity_check CHECK (login_background_opacity BETWEEN 0 AND 100);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_login_background_blur_check') THEN
    ALTER TABLE app_settings
      ADD CONSTRAINT app_settings_login_background_blur_check CHECK (login_background_blur BETWEEN 0 AND 20);
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.get_public_login_branding();

CREATE FUNCTION public.get_public_login_branding()
RETURNS TABLE (
  logo_url text,
  login_background_url text,
  logo_opacity integer,
  logo_blur integer,
  card_opacity integer,
  card_blur integer,
  beam_enabled boolean,
  beam_spread integer,
  beam_opacity integer,
  beam_blur integer,
  background_opacity integer,
  background_blur integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    app_logo_url,
    login_background_url,
    login_logo_opacity,
    login_logo_blur,
    login_card_opacity,
    login_card_blur,
    login_beam_enabled,
    login_beam_spread,
    login_beam_opacity,
    login_beam_blur,
    login_background_opacity,
    login_background_blur
  FROM app_settings
  WHERE id = 1;
$$;
