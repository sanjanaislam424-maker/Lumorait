/*
# Add login background dim-level setting

1. New column on app_settings
- `login_background_dim_level` (integer, 0-100, default 20): how much the
  admin-uploaded login background darkens when the overhead light turns ON.
  0 = no dimming (full brightness in both states); 100 = fully blacked out
  when the light is on. Independent from `login_background_opacity`, which
  controls the base visibility of the image in both states.

2. Public branding RPC
- `get_public_login_branding()` is dropped and recreated to also return
  `background_dim_level` so the unauthenticated login screen can read it.

3. Notes
- This migration only adds a column and re-creates the read-only RPC.
  No existing data is changed. RLS and grants on app_settings are unchanged
  (the table already has admin-only write and public read via the RPC).
*/

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS login_background_dim_level integer NOT NULL DEFAULT 20;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_login_background_dim_level_check') THEN
    ALTER TABLE app_settings
      ADD CONSTRAINT app_settings_login_background_dim_level_check CHECK (login_background_dim_level BETWEEN 0 AND 100);
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
  background_blur integer,
  background_dim_level integer
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
    login_background_blur,
    login_background_dim_level
  FROM app_settings
  WHERE id = 1;
$$;
