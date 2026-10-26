/*
# Add video_tutorial_url to task_categories

1. Schema changes
- `task_categories` gains `video_tutorial_url` (text, nullable) — a URL (YouTube embed link, direct video URL, etc.) that admins can set per category. When set, users see a "How to Complete Tasks" video tutorial at the top of that category's task page.

2. Security
- No new RLS needed. Existing policies on task_categories already allow authenticated users to SELECT and admins to UPDATE. Adding a nullable column does not change the access model.
*/

ALTER TABLE task_categories ADD COLUMN IF NOT EXISTS video_tutorial_url text;