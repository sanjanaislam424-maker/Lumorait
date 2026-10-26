/*
# Advanced Task Promotion & Boost System

1. Schema changes to `tasks`:
- `is_promoted` (boolean, default false) — whether this task is boosted/pinned
- `promotion_coins` (integer, default 0) — extra coins paid for promotion (non-distributable, platform boost)
- `promotion_expires_at` (timestamptz, nullable) — when promotion ends; null = unlimited duration
- `daily_slot_limit` (integer, nullable) — max workers per day; null = no daily cap
- `promotion_weight` (integer, default 0) — computed weight for sorting (higher = more prominent)

2. Schema changes to `app_settings`:
- `promotion_tiers` (jsonb, default []) — admin-configured array of {duration_days, coin_cost, label} for promotion pricing
  Example: [{"duration_days":1,"coin_cost":50,"label":"1 Day"},{"duration_days":3,"coin_cost":120,"label":"3 Days"},{"duration_days":7,"coin_cost":250,"label":"7 Days"},{"duration_days":0,"coin_cost":500,"label":"Unlimited"}]

3. Security:
- No new RLS needed. Existing task policies already allow authenticated users to INSERT/UPDATE their own tasks and SELECT all tasks. app_settings is already accessible.
- Adding nullable/defaulted columns does not change the access model.
*/

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_promoted boolean DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS promotion_coins integer DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS promotion_expires_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS daily_slot_limit integer;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS promotion_weight integer DEFAULT 0;

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS promotion_tiers jsonb DEFAULT '[]'::jsonb;

-- Seed default promotion tiers if empty
UPDATE app_settings
SET promotion_tiers = '[{"duration_days":1,"coin_cost":50,"label":"1 Day"},{"duration_days":3,"coin_cost":120,"label":"3 Days"},{"duration_days":7,"coin_cost":250,"label":"7 Days"},{"duration_days":0,"coin_cost":500,"label":"Unlimited"}]'::jsonb
WHERE id = 1 AND (promotion_tiers IS NULL OR promotion_tiers = '[]'::jsonb);