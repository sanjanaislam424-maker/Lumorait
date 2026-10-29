/*
# Daily AI-generated UI copy cache

1. New Table
- `daily_ai_ui_copy`
  - `content_date` (date, primary key): the day this copy set is for
  - `tasks_header`, `loading_tasks`, `category_empty`, `your_tasks_first`,
    `video_tutorial_header`, `video_panel_subtitle`, `daily_tip`,
    `dashboard_alert`, `task_available`, `watch_tutorial` (text): AI-generated Banglish copy
  - `created_at` (timestamptz)

2. Security
- RLS enabled; SELECT granted to anon+authenticated (public read, it's just UI copy).
- INSERT/UPDATE only via service_role (edge function).
*/

CREATE TABLE IF NOT EXISTS daily_ai_ui_copy (
  content_date date PRIMARY KEY DEFAULT CURRENT_DATE,
  tasks_header text NOT NULL DEFAULT '',
  loading_tasks text NOT NULL DEFAULT '',
  category_empty text NOT NULL DEFAULT '',
  your_tasks_first text NOT NULL DEFAULT '',
  video_tutorial_header text NOT NULL DEFAULT '',
  video_panel_subtitle text NOT NULL DEFAULT '',
  daily_tip text NOT NULL DEFAULT '',
  dashboard_alert text NOT NULL DEFAULT '',
  task_available text NOT NULL DEFAULT '',
  watch_tutorial text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE daily_ai_ui_copy ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON daily_ai_ui_copy TO anon, authenticated;
GRANT INSERT, UPDATE ON daily_ai_ui_copy TO service_role;
