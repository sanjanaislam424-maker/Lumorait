/*
# Add overhead light beam settings to login branding

1. Modified Tables
- `app_settings`
  - `login_beam_enabled` (boolean, default true): whether the cone of light shows when the login light is on.
  - `login_beam_spread` (integer, default 50, 0-100): how wide the cone opens at the bottom.
  - `login_beam_opacity` (integer, default 60, 0-100): brightness of the cone.

2. Functions
- `get_public_login_branding()` now also returns `beam_enabled`, `beam_spread`, `beam_opacity`.

3. Security
- No new tables. The function keeps its existing access rules (SECURITY DEFINER, read-only, only the public branding fields).

4. Notes
- Existing rows get the defaults automatically; no data is changed.
*/

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS login_beam_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS login_beam_spread integer NOT NULL DEFAULT 50;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS login_beam_opacity integer NOT NULL DEFAULT 60;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_login_beam_spread_check') THEN
    ALTER TABLE app_settings ADD CONSTRAINT app_settings_login_beam_spread_check CHECK (login_beam_spread BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_login_beam_opacity_check') THEN
    ALTER TABLE app_settings ADD CONSTRAINT app_settings_login_beam_opacity_check CHECK (login_beam_opacity BETWEEN 0 AND 100);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_public_login_branding()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT jsonb_build_object(
  'logo_url', app_logo_url,
  'logo_opacity', login_logo_opacity,
  'logo_blur', login_logo_blur,
  'card_opacity', login_card_opacity,
  'card_blur', login_card_blur,
  'beam_enabled', login_beam_enabled,
  'beam_spread', login_beam_spread,
  'beam_opacity', login_beam_opacity
)
FROM app_settings
WHERE id = 1;
$function$;
