/*
# Add app logo URL and storage bucket for branding & category icons

1. Schema changes
- `app_settings` gains `app_logo_url` (text, nullable) — URL of the uploaded global app logo. Used across navbar, sidebar, header, auth screen, footer.
- `task_categories` already has `icon_url` (text). No change needed there.

2. Storage
- Creates public bucket `branding` for app-level assets (logo, category icons).
- Storage policies allow authenticated users to READ (public) and authenticated admins to WRITE (upload/overwrite/delete) objects in `branding` bucket.

3. Security
- `app_settings` is a single-row settings table. Existing policies already govern access; we only add a column, no new RLS needed.
- Storage policies use `auth.uid()` for write access (any authenticated user can upload, consistent with the app's existing admin-bypass dev mode). Read is public so the logo renders for unauthenticated users on the auth screen.
- Note: Storage RLS uses `storage.objects` table. We grant SELECT to `anon, authenticated` (public reads) and INSERT/UPDATE/DELETE to `authenticated` (writes).
*/

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS app_logo_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for branding bucket
DROP POLICY IF EXISTS "branding_public_read" ON storage.objects;
CREATE POLICY "branding_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'branding');

-- Authenticated users can upload to branding bucket
DROP POLICY IF EXISTS "branding_auth_insert" ON storage.objects;
CREATE POLICY "branding_auth_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'branding');

-- Authenticated users can update/replace objects in branding bucket
DROP POLICY IF EXISTS "branding_auth_update" ON storage.objects;
CREATE POLICY "branding_auth_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'branding')
WITH CHECK (bucket_id = 'branding');

-- Authenticated users can delete objects in branding bucket
DROP POLICY IF EXISTS "branding_auth_delete" ON storage.objects;
CREATE POLICY "branding_auth_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'branding');