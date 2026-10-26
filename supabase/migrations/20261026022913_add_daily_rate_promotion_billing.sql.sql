/*
# Add Daily-Rate Billing for Long-Term Promotions

1. Modified Tables
- `tasks`:
  - `promotion_daily_rate` (integer, nullable): the fixed daily coin deduction
    rate that the system/admin configured at the time the long-term boost was
    applied. The daily-charge edge function reads this value and deducts the
    exact preset amount each day. Users cannot change it.
  - `promotion_end_at` (timestamptz, nullable): the optional end date/time the
    user chose when setting up a long-term boost. If set, the promotion
    automatically stops when this time is reached. If null, the promotion runs
    indefinitely until manually canceled (after the 8-day lock period).
  - `promotion_last_charged_at` (timestamptz, nullable): tracks the last time a
    daily charge was applied so the scheduled edge function can charge at most
    once per 24-hour window.

2. Updated app_settings
- `promotion_tiers` JSONB is extended with optional `daily_rate` and
  `daily_rate_after_lock` integer fields per tier. These are admin-configured
  and represent the fixed per-day coin cost for long-term boosts (initial
  8-day period and from day 9 onward respectively). Short-term tiers leave
  these null since they use the existing upfront cost model.

3. Important Notes
- No data is lost — all new columns default to NULL.
- Existing short-term promotions continue using the upfront cost model
  (promotion_coins charged once at apply time).
- Long-term promotions (duration_days > 7 or 0/unlimited) now use the daily
  rate model: no upfront charge; instead the daily-charge edge function
  deducts `promotion_daily_rate` each day until promotion_end_at (if set) or
  until manually canceled.
*/

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS promotion_daily_rate integer DEFAULT null;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS promotion_end_at timestamptz DEFAULT null;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS promotion_last_charged_at timestamptz DEFAULT null;

-- Backfill promotion_tiers with daily_rate fields for the long-term (unlimited) tier.
UPDATE app_settings
SET promotion_tiers = '[
  {"duration_days":1,"label":"1 Day","free_cost":50,"pro_cost":40,"vip_cost":25},
  {"duration_days":3,"label":"3 Days","free_cost":120,"pro_cost":95,"vip_cost":60},
  {"duration_days":7,"label":"7 Days","free_cost":250,"pro_cost":200,"vip_cost":150},
  {"duration_days":0,"label":"More than 7 days","free_cost":0,"pro_cost":0,"vip_cost":0,"daily_rate":10,"daily_rate_after_lock":8}
]'::jsonb
WHERE id = 1;