/*
# Create support_reports table for Bug Reports & Feedback

1. New Tables
- `support_reports` — stores user-submitted bug reports and feedback.
  - id (uuid PK)
  - user_id (uuid, FK profiles, defaults to auth.uid())
  - type (text: 'bug' | 'feedback')
  - subject (text, optional)
  - description (text)
  - image_url (text, nullable — screenshot URL)
  - status (text: 'pending' | 'resolved', default 'pending')
  - admin_note (text, nullable)
  - created_at (timestamptz, default now())
  - updated_at (timestamptz, default now())

2. Security
- Enable RLS on support_reports.
- Grant SELECT, INSERT, UPDATE to authenticated.
- Users can SELECT/INSERT their own reports.
- Admins (role = 'admin') can SELECT and UPDATE all reports.
- Index on created_at for ordering.
*/

CREATE TABLE IF NOT EXISTS support_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('bug', 'feedback')),
  subject text,
  description text NOT NULL,
  image_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  admin_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_reports_created_at ON support_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_reports_user_id ON support_reports (user_id);
CREATE INDEX IF NOT EXISTS idx_support_reports_status ON support_reports (status);

ALTER TABLE support_reports ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON support_reports TO authenticated;

DROP POLICY IF EXISTS "select_own_reports" ON support_reports;
CREATE POLICY "select_own_reports"
  ON support_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "insert_own_reports" ON support_reports;
CREATE POLICY "insert_own_reports"
  ON support_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_reports" ON support_reports;
CREATE POLICY "update_own_reports"
  ON support_reports FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can update status/notes on all reports
DROP POLICY IF EXISTS "admin_update_reports" ON support_reports;
CREATE POLICY "admin_update_reports"
  ON support_reports FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
