/*
# Add blur setting for the radial light glow

1. Modified Tables
- `app_settings`
  - `login_beam_blur` (integer, default 40, 0-100): edge softness of the radial light glow around the bulb.

2. Functions
- `get_public_login_branding()` now also returns `beam_blur`.

3. Security
- No new tables. The function keeps its existing access rules (SECURITY DEFINER, read-only, only public branding fields).

4. Notes
- The existing beam columns keep their names. `login_beam_spread` now controls the glow radius and `login_beam_opacity` controls brightness.
- Existing rows get the default automatically; no data is changed.
*/

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS login_beam_blur integer NOT NULL DEFAULT 40;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_login_beam_blur_check') THEN
    ALTER TABLE app_settings ADD CONSTRAINT app_settings_login_beam_blur_check CHECK (login_beam_blur BETWEEN 0 AND 100);
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
  'beam_opacity', login_beam_opacity,
  'beam_blur', login_beam_blur
)
FROM app_settings
WHERE id = 1;
$function$;
