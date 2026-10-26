/*
# Tier-Based Task Promotion Pricing (Free / Pro / VIP)

Evolves promotion_tiers from flat {duration_days, coin_cost, label}
to tier-aware {duration_days, label, free_cost, pro_cost, vip_cost}.

Adds promotion_tier column to tasks so we can show which tier badge
("free" | "pro" | "vip") was used when boosting.
*/

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS promotion_tier text DEFAULT null;

-- Reshape promotion_tiers to tier-based pricing if still in old flat format.
-- Old: [{"duration_days":1,"coin_cost":50,"label":"1 Day"}, ...]
-- New: [{"duration_days":1,"label":"1 Day","free_cost":50,"pro_cost":40,"vip_cost":25}, ...]
UPDATE app_settings
SET promotion_tiers = '[
  {"duration_days":1,"label":"1 Day","free_cost":50,"pro_cost":40,"vip_cost":25},
  {"duration_days":3,"label":"3 Days","free_cost":120,"pro_cost":95,"vip_cost":60},
  {"duration_days":7,"label":"7 Days","free_cost":250,"pro_cost":200,"vip_cost":150},
  {"duration_days":0,"label":"Unlimited","free_cost":500,"pro_cost":400,"vip_cost":300}
]'::jsonb
WHERE id = 1;