/*
# Add bilingual AI UI copy columns

1. Purpose
- Store every daily task prompt and banner in two synchronized language versions.
- Preserve the existing columns so no prior content is deleted.

2. Modified table
- `daily_ai_ui_copy`
- Adds `_bn` columns for pure Bengali script values.
- Adds `_en` columns for professional English values.
- Existing single-language columns remain untouched for compatibility.

3. Data handling
- Existing rows receive clean Bengali and English seed values.
- Future regeneration writes both language versions together.

4. Security
- No access-control changes are made.
- Existing table grants and row-level security remain unchanged.
*/

ALTER TABLE public.daily_ai_ui_copy
  ADD COLUMN IF NOT EXISTS tasks_header_bn text,
  ADD COLUMN IF NOT EXISTS tasks_header_en text,
  ADD COLUMN IF NOT EXISTS loading_tasks_bn text,
  ADD COLUMN IF NOT EXISTS loading_tasks_en text,
  ADD COLUMN IF NOT EXISTS category_empty_bn text,
  ADD COLUMN IF NOT EXISTS category_empty_en text,
  ADD COLUMN IF NOT EXISTS your_tasks_first_bn text,
  ADD COLUMN IF NOT EXISTS your_tasks_first_en text,
  ADD COLUMN IF NOT EXISTS video_tutorial_header_bn text,
  ADD COLUMN IF NOT EXISTS video_tutorial_header_en text,
  ADD COLUMN IF NOT EXISTS video_panel_subtitle_bn text,
  ADD COLUMN IF NOT EXISTS video_panel_subtitle_en text,
  ADD COLUMN IF NOT EXISTS daily_tip_bn text,
  ADD COLUMN IF NOT EXISTS daily_tip_en text,
  ADD COLUMN IF NOT EXISTS dashboard_alert_bn text,
  ADD COLUMN IF NOT EXISTS dashboard_alert_en text,
  ADD COLUMN IF NOT EXISTS task_available_bn text,
  ADD COLUMN IF NOT EXISTS task_available_en text,
  ADD COLUMN IF NOT EXISTS watch_tutorial_bn text,
  ADD COLUMN IF NOT EXISTS watch_tutorial_en text;

UPDATE public.daily_ai_ui_copy
SET
  tasks_header_bn = COALESCE(tasks_header_bn, 'কাজের তালিকা প্রস্তুত আছে, এবার একটু পরিশ্রম করলে উপার্জনও হবে।'),
  tasks_header_en = COALESCE(tasks_header_en, 'Your task list is ready; a little effort can turn it into real earnings.'),
  loading_tasks_bn = COALESCE(loading_tasks_bn, 'কাজগুলো আসছে, একটু অপেক্ষা করুন; ধৈর্যও এক ধরনের দক্ষতা।'),
  loading_tasks_en = COALESCE(loading_tasks_en, 'Your tasks are loading; patience is a useful skill too.'),
  category_empty_bn = COALESCE(category_empty_bn, 'এই বিভাগে এখন কোনো কাজ নেই; অন্য বিভাগটি দেখে নিন।'),
  category_empty_en = COALESCE(category_empty_en, 'There are no tasks in this category right now; try another one.'),
  your_tasks_first_bn = COALESCE(your_tasks_first_bn, 'আপনার কাজগুলো সবার আগে দেখানো হচ্ছে, যাতে সুযোগ হাতছাড়া না হয়।'),
  your_tasks_first_en = COALESCE(your_tasks_first_en, 'Your tasks appear first so you never miss an opportunity.'),
  video_tutorial_header_bn = COALESCE(video_tutorial_header_bn, 'কাজ শুরু করার আগে ছোট টিউটোরিয়ালটি দেখে নিন।'),
  video_tutorial_header_en = COALESCE(video_tutorial_header_en, 'Watch the short tutorial before you start the task.'),
  video_panel_subtitle_bn = COALESCE(video_panel_subtitle_bn, 'দুই মিনিটের নির্দেশনা আপনার কাজটি সঠিকভাবে শেষ করতে সাহায্য করবে।'),
  video_panel_subtitle_en = COALESCE(video_panel_subtitle_en, 'A two-minute guide can help you complete the task correctly.'),
  daily_tip_bn = COALESCE(daily_tip_bn, 'প্রতিদিন নির্দিষ্ট সময়ে মানসম্মত পোস্ট করুন; অনিয়মিত প্রচারে অ্যালগরিদমও বিভ্রান্ত হয়।'),
  daily_tip_en = COALESCE(daily_tip_en, 'Post quality content consistently; irregular promotion confuses the algorithm too.'),
  dashboard_alert_bn = COALESCE(dashboard_alert_bn, 'আজকের চেক-ইনটি সম্পন্ন করুন, কারণ ছোট অভ্যাসই বড় ফল তৈরি করে।'),
  dashboard_alert_en = COALESCE(dashboard_alert_en, 'Complete today’s check-in because small habits create meaningful results.'),
  task_available_bn = COALESCE(task_available_bn, 'আপনার জন্য নতুন কাজ অপেক্ষা করছে; সুযোগটি কাজে লাগান।'),
  task_available_en = COALESCE(task_available_en, 'A new task is waiting for you; make the opportunity count.'),
  watch_tutorial_bn = COALESCE(watch_tutorial_bn, 'টিউটোরিয়ালটি দেখে কাজটি আরও আত্মবিশ্বাসের সঙ্গে শুরু করুন।'),
  watch_tutorial_en = COALESCE(watch_tutorial_en, 'Watch the tutorial and start the task with confidence.');