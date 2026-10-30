/*
# Login page lighting and glass controls

1. New columns on app_settings (all admin-editable through the existing admin update policy)
- `login_logo_opacity` (0-100, default 80): how strong the background logo is when the login Light toggle is on.
- `login_logo_blur` (0-20, default 2): depth-of-field blur on the background logo. Each step is half a pixel, so the maximum is 10px.
- `login_card_opacity` (0-100, default 25): how solid the glass login card background is.
- `login_card_blur` (0-40, default 24): frosted blur strength behind the glass login card, in pixels.

2. Public read function
- Replaces `get_public_logo_url` with `get_public_login_branding`, which returns the logo URL and the four values above as one JSON object.
- Returns nothing else from app_settings, so private values such as API keys stay hidden from visitors.

3. Security
- The function runs with owner rights, is read-only, and is granted to anonymous and signed-in users only.
- No table permissions change; admins still save these values through the existing settings update rule.
*/

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS login_logo_opacity integer NOT NULL DEFAULT 80;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS login_logo_blur integer NOT NULL DEFAULT 2;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS login_card_opacity integer NOT NULL DEFAULT 25;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS login_card_blur integer NOT NULL DEFAULT 24;

ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_login_logo_opacity_check;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_login_logo_opacity_check CHECK (login_logo_opacity BETWEEN 0 AND 100);
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_login_logo_blur_check;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_login_logo_blur_check CHECK (login_logo_blur BETWEEN 0 AND 20);
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_login_card_opacity_check;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_login_card_opacity_check CHECK (login_card_opacity BETWEEN 0 AND 100);
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_login_card_blur_check;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_login_card_blur_check CHECK (login_card_blur BETWEEN 0 AND 40);

DROP FUNCTION IF EXISTS public.get_public_logo_url();

CREATE OR REPLACE FUNCTION public.get_public_login_branding()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'logo_url', app_logo_url,
    'logo_opacity', login_logo_opacity,
    'logo_blur', login_logo_blur,
    'card_opacity', login_card_opacity,
    'card_blur', login_card_blur
  )
  FROM app_settings
  WHERE id = 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_login_branding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_login_branding() TO anon, authenticated;
