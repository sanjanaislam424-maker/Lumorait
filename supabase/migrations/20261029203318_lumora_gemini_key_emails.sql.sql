/*
# Gemini key account emails (admin only)

1. New Tables
- `gemini_key_emails`
  - `key_value` (text, primary key): the Gemini API key the email belongs to
  - `email` (text, not null): the Google account the key was generated from
  - `created_at` (timestamptz): when the entry was saved

2. Security
- Enable RLS on `gemini_key_emails`.
- Grant SELECT, INSERT, UPDATE, DELETE to `authenticated` only.
- Every policy requires the signed-in user to have the admin role in `profiles`, so regular users cannot read or change these emails.

3. Notes
- The table is separate from `app_settings` because that table is readable by all signed-in users.
- The AI chat function does not use this table; it only labels keys in the admin panel.
*/

CREATE TABLE IF NOT EXISTS gemini_key_emails (
  key_value text PRIMARY KEY,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gemini_key_emails ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON gemini_key_emails TO authenticated;

DROP POLICY IF EXISTS "admin_select_gemini_key_emails" ON gemini_key_emails;
CREATE POLICY "admin_select_gemini_key_emails" ON gemini_key_emails FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "admin_insert_gemini_key_emails" ON gemini_key_emails;
CREATE POLICY "admin_insert_gemini_key_emails" ON gemini_key_emails FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "admin_update_gemini_key_emails" ON gemini_key_emails;
CREATE POLICY "admin_update_gemini_key_emails" ON gemini_key_emails FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "admin_delete_gemini_key_emails" ON gemini_key_emails;
CREATE POLICY "admin_delete_gemini_key_emails" ON gemini_key_emails FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
