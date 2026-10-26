/*
# Two-Phase Coin Slabs: Remove daily_rate, keep daily_rate_after_lock

1. Updated app_settings
- promotion_tiers JSONB: the long-term tier no longer has a `daily_rate` field.
  Phase 1 rate is automatically derived from the 1-day tier cost at apply time
  (stored in tasks.promotion_daily_rate). Only `daily_rate_after_lock` remains
  as the admin-configured Phase 2 rate.

2. Important Notes
- No data loss — only the JSONB tier config is refreshed.
- Existing active promotions keep their stored promotion_daily_rate (captured
  at apply time from the 1-day tier cost) and continue being charged correctly.
*/

UPDATE app_settings
SET promotion_tiers = '[
  {"duration_days":1,"label":"1 Day","free_cost":50,"pro_cost":40,"vip_cost":25},
  {"duration_days":3,"label":"3 Days","free_cost":120,"pro_cost":95,"vip_cost":60},
  {"duration_days":7,"label":"7 Days","free_cost":250,"pro_cost":200,"vip_cost":150},
  {"duration_days":0,"label":"More than 7 days","free_cost":0,"pro_cost":0,"vip_cost":0,"daily_rate_after_lock":8}
]'::jsonb
WHERE id = 1;