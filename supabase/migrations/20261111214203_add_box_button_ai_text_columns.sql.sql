/*
# Add AI-generated Mystery Box button text columns

1. Purpose
- Store daily AI-generated funny texts for the two main Mystery Box action buttons.
- Button 1 ("টাস্ক পূরণ করে আরেকটি বক্স ফাটান") — P2P task option.
- Button 2 ("অ্যাড দেখে আরেকটি বক্স ফাটান") — rewarded video option.
- Texts rotate automatically at midnight alongside other daily AI content.

2. Modified table
- `daily_ai_ui_copy`
- Adds `box_btn_task_bn`, `box_btn_task_en`, `box_btn_ad_bn`, `box_btn_ad_en` (text).
- Existing columns remain untouched.

3. Data handling
- Existing rows receive sensible default values in both languages.

4. Security
- No access-control changes. Existing grants and RLS remain unchanged.
*/

ALTER TABLE public.daily_ai_ui_copy
  ADD COLUMN IF NOT EXISTS box_btn_task_bn text,
  ADD COLUMN IF NOT EXISTS box_btn_task_en text,
  ADD COLUMN IF NOT EXISTS box_btn_ad_bn text,
  ADD COLUMN IF NOT EXISTS box_btn_ad_en text;

UPDATE public.daily_ai_ui_copy
SET
  box_btn_task_bn = COALESCE(box_btn_task_bn, 'টাস্ক পূরণ করে আরেকটি বক্স ফাটান'),
  box_btn_task_en = COALESCE(box_btn_task_en, 'Blast another box by doing a task!'),
  box_btn_ad_bn = COALESCE(box_btn_ad_bn, 'অ্যাড দেখে আরেকটি বক্স ফাটান'),
  box_btn_ad_en = COALESCE(box_btn_ad_en, 'Blast another box by watching an ad!');