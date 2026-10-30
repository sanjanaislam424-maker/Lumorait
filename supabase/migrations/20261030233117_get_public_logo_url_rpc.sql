/*
# Public read of the app logo URL

1. What changes
- Adds `get_public_logo_url`, a read-only function that returns only the current app logo URL.

2. Why
- The login page is viewed by anonymous visitors, who could not read the settings row, so the logo never loaded there.
- The settings row also stores private values (such as API keys), so it is not opened to anonymous visitors.

3. Security
- The function runs with owner rights but returns a single text value, nothing else.
- It is granted to anonymous and signed-in users only; no table permissions change.
*/

CREATE OR REPLACE FUNCTION public.get_public_logo_url()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_logo_url FROM app_settings WHERE id = 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_logo_url() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_logo_url() TO anon, authenticated;
