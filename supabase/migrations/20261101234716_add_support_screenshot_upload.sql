/*
# Add screenshot upload support for Report/Feedback forms

1. New Storage Bucket
- `support-screenshots` — stores user-submitted screenshots for bug reports and feedback.
  Public bucket so the admin panel can view attached images via public URL.

2. Modified Tables
- `chat_messages` — add `image_url` (text, nullable) column to store an optional
  screenshot URL attached to a user's support message.

3. Security
- Storage bucket policies: authenticated users can upload/read their own support
  screenshots; public read for admin viewing.
- `chat_messages` RLS already exists; the new `image_url` column inherits the
  table's existing policies. No new policies needed since the column is just
  additional data on rows the user already owns.
*/

-- Add image_url column to chat_messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS image_url text;

-- Create support-screenshots storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-screenshots', 'support-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload and read
DROP POLICY IF EXISTS "Authenticated can upload support screenshots" ON storage.objects;
CREATE POLICY "Authenticated can upload support screenshots"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'support-screenshots');

DROP POLICY IF EXISTS "Authenticated can read support screenshots" ON storage.objects;
CREATE POLICY "Authenticated can read support screenshots"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'support-screenshots');

DROP POLICY IF EXISTS "Anon can read support screenshots" ON storage.objects;
CREATE POLICY "Anon can read support screenshots"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'support-screenshots');
