/*
# Fix branding RPC stale reads after admin upload

1. Problem
- get_public_login_branding() is declared STABLE, which lets Postgres return a snapshot-cached result from before a concurrent UPDATE committed.
- After an admin uploads a new background/logo and the frontend re-fetches via refreshLogo(), the RPC can return the old URL, overwriting the freshly-set context state.

2. Fix
- Recreate the function as VOLATILE so each call reads the current row state, bypassing snapshot caching.
- No column or policy changes.
*/

CREATE OR REPLACE FUNCTION public.get_public_login_branding()
RETURNS jsonb
LANGUAGE sql
VOLATILE SECURITY DEFINER
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
