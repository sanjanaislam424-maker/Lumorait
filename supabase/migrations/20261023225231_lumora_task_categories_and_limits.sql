/*
# Add task categories table and task reward limits

## Summary
This migration creates a `task_categories` table for dynamic task category management
and adds `min_task_reward` and `max_task_reward` columns to `app_settings` so admins
can configure the minimum and maximum reward coins allowed per task.

## New Tables

### task_categories
- `id` (uuid, primary key)
- `name` (text, unique, not null): The category name (e.g. "facebook", "youtube")
- `label` (text, not null): Display label (e.g. "Facebook", "YouTube")
- `icon` (text, default 'other'): Icon key for the platform
- `is_active` (boolean, default true): Whether the category is available for task creation
- `sort_order` (integer, default 0): Display ordering
- `created_at` (timestamptz, default now())
- `created_by` (uuid, nullable): Admin who created the category

## Modified Tables

### app_settings
- `min_task_reward` (integer, default 10): Minimum reward coins per task
- `max_task_reward` (integer, default 10000): Maximum reward coins per task

## Security
- task_categories: RLS enabled, CRUD for authenticated users
- Seed default categories matching existing hardcoded platforms
*/

-- Create task_categories table
CREATE TABLE IF NOT EXISTS task_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  label text NOT NULL,
  icon text NOT NULL DEFAULT 'other',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON task_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON task_categories TO authenticated;

DROP POLICY IF EXISTS "select_task_categories" ON task_categories;
CREATE POLICY "select_task_categories" ON task_categories FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_task_categories" ON task_categories;
CREATE POLICY "insert_task_categories" ON task_categories FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_task_categories" ON task_categories;
CREATE POLICY "update_task_categories" ON task_categories FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_task_categories" ON task_categories;
CREATE POLICY "delete_task_categories" ON task_categories FOR DELETE
  TO authenticated USING (true);

-- Seed default categories
INSERT INTO task_categories (name, label, icon, sort_order) VALUES
  ('facebook', 'Facebook', 'facebook', 1),
  ('instagram', 'Instagram', 'instagram', 2),
  ('youtube', 'YouTube', 'youtube', 3),
  ('app_review', 'App Review', 'app_review', 4),
  ('tiktok', 'TikTok', 'tiktok', 5),
  ('other', 'Other', 'other', 6)
ON CONFLICT (name) DO NOTHING;

-- Add min/max task reward to app_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'min_task_reward'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN min_task_reward integer NOT NULL DEFAULT 10;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'max_task_reward'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN max_task_reward integer NOT NULL DEFAULT 10000;
  END IF;
END $$;
