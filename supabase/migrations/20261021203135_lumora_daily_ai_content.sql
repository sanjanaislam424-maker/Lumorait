/*
# Daily AI Content Table for Weather Header Carousel

## Purpose
Stores AI-generated daily content (1 funny quote + 1 serious growth tip) shown in the
WeatherHeader carousel. Content is generated once per 24 hours by an edge function and
cached here so all users see the same fresh content each day.

## New Tables
- `daily_ai_content`
  - `id` (uuid, primary key)
  - `content_date` (date, unique) — the day this content belongs to
  - `funny_bn` (text) — Bengali funny quote
  - `funny_en` (text) — English funny quote
  - `tip_bn` (text) — Bengali serious growth tip
  - `tip_en` (text) — English serious growth tip
  - `created_at` (timestamptz)

## Security
- RLS enabled.
- Read access for anon + authenticated (content is shared/public for all users).
- Write access for anon + authenticated (edge function uses service role key, but
  anon inserts are also allowed for robustness).
*/

CREATE TABLE IF NOT EXISTS daily_ai_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_date date UNIQUE NOT NULL DEFAULT CURRENT_DATE,
  funny_bn text NOT NULL DEFAULT '',
  funny_en text NOT NULL DEFAULT '',
  tip_bn text NOT NULL DEFAULT '',
  tip_en text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE daily_ai_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_daily_ai_content" ON daily_ai_content;
CREATE POLICY "read_daily_ai_content"
ON daily_ai_content FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "insert_daily_ai_content" ON daily_ai_content;
CREATE POLICY "insert_daily_ai_content"
ON daily_ai_content FOR INSERT
TO anon, authenticated
WITH CHECK (true);
