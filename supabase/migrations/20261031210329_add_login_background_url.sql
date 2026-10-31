/*
# Add login background image support

1. Schema changes
- Add `login_background_url` (text, nullable) to `app_settings` to store the URL of an admin-uploaded login background image. No data is lost; existing rows get NULL.
2. RPC changes
- Replace `get_public_login_branding()` so it also returns `login_background_url` in the JSON payload, letting the login screen render the admin-selected background.
3. Security
- The function remains SECURITY DEFINER STABLE with a fixed search_path so the anon-key frontend can read branding without bypassing RLS on app_settings.
- No new policies or grants are needed: the function already has EXECUTE for the anon/authenticated roles and the column is read-only through this RPC.
*/

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS login_background_url text;

CREATE OR REPLACE FUNCTION public.get_public_login_branding()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
  'beam_blur', login_beam_blur
)
FROM app_settings
WHERE id = 1;
$function$;
