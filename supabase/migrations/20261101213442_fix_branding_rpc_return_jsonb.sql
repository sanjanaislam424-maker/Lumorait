/*
# Fix branding RPC return type (jsonb, not TABLE)

1. Problem
- The dim-level migration recreated get_public_login_branding() as
  RETURNS TABLE(...), which makes supabase-js return an ARRAY of rows.
- parseLoginBranding expects a single JSON object, so when it receives
  an array every field resolves to null/defaults — the login screen
  never shows the saved logo or background image.

2. Fix
- Recreate the function as RETURNS jsonb (single object), matching the
  shape parseLoginBranding expects, and include all 13 fields:
  logo_url, login_background_url, logo_opacity, logo_blur, card_opacity,
  card_blur, beam_enabled, beam_spread, beam_opacity, beam_blur,
  background_opacity, background_blur, background_dim_level.
- Keep it VOLATILE so each call reads the current row state (no stale
  snapshot cache after an admin upload).

3. Notes
- No column or policy changes. No data changes.
*/

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
    'background_dim_level', login_background_dim_level
  )
  FROM app_settings
  WHERE id = 1;
$function$;
