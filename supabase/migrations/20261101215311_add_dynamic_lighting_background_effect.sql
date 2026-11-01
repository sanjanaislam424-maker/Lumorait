/*
# Dynamic lighting-based background: monochrome-off / vibrant-on

1. New column
- `login_background_off_desaturate` (integer 0-100, default 100):
  how monochrome the login background becomes when the overhead light
  is OFF. 0 = full color, 100 = fully grayscale/black-and-white.

2. Repurposed column
- `login_background_dim_level` previously meant "dim the background
  when the light is ON". It now means "how dark the background gets
  when the light is OFF". 0 = full brightness, 100 = fully blacked out.
  Default updated from 20 to 70 for a moody night look.
  The existing CHECK constraint (0-100) still applies.

3. Data update
- Set the current row's dim_level to 70 and off_desaturate to 100 so
  the login screen immediately shows the new moody-off / vibrant-on
  behavior without the admin needing to re-save.

4. RPC
- get_public_login_branding() recreated to also return
  `background_off_desaturate`. Kept VOLATILE + RETURNS jsonb.

5. Notes
- No columns dropped or renamed. No data lost. RLS/grants unchanged.
*/

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS login_background_off_desaturate integer NOT NULL DEFAULT 100;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_login_background_off_desaturate_check') THEN
    ALTER TABLE app_settings
      ADD CONSTRAINT app_settings_login_background_off_desaturate_check CHECK (login_background_off_desaturate BETWEEN 0 AND 100);
  END IF;
END $$;

ALTER TABLE app_settings
  ALTER COLUMN login_background_dim_level SET DEFAULT 70;

UPDATE app_settings
  SET login_background_dim_level = 70,
      login_background_off_desaturate = 100
  WHERE id = 1;

DROP FUNCTION IF EXISTS public.get_public_login_branding();

CREATE FUNCTION public.get_public_login_branding()
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT jsonb_build_object(
    'logo_url', app_logo_url,
    'login_background_url', login_background_url,
    'logo_opacity', login_logo_opacity,
    'logo_blur', login_logo_blur,
    'card_opacity', login_card_opacity,
    'card_blur', login_card_blur,
    'beam_enabled', login_beam_enabled,
    'beam_spread', login_beam_spread,
    'beam_opacity', login_beam_opacity,
    'beam_blur', login_beam_blur,
    'background_opacity', login_background_opacity,
    'background_blur', login_background_blur,
    'background_dim_level', login_background_dim_level,
    'background_off_desaturate', login_background_off_desaturate
  )
  FROM app_settings
  WHERE id = 1;
$function$;
