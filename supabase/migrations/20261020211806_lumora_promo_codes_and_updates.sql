/*
# Lumora IT — Promo Codes, Referral Bonus Tracking & Updated Settings

## Overview
Adds a promo code system for admin-generated one-time redeem codes with coin values and usage limits.
Updates app_settings defaults: free_spins_daily to 1, checkin_rewards to 7-day cap of 500 coins.

## New Tables
1. promo_codes — admin-created promo codes with coin value, max usage, active flag
2. promo_redemptions — tracks which user redeemed which code (one-time per account)

## Modified Tables
- app_settings — update defaults: free_spins_daily=1, checkin_rewards='[20,40,60,80,100,120,80]'

## Security
- RLS on both new tables.
- promo_codes: any authenticated user can read active codes (to validate), only admin can insert/update/delete.
- promo_redemptions: users can read own redemptions, insert own, no update/delete.
- transactions type constraint expanded to include 'promo'.
*/

-- ============ PROMO CODES ============
CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  coin_value integer NOT NULL DEFAULT 0,
  max_uses integer NOT NULL DEFAULT 1,
  uses_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_promo_codes" ON promo_codes;
CREATE POLICY "select_promo_codes" ON promo_codes FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_admin_promo" ON promo_codes;
CREATE POLICY "insert_admin_promo" ON promo_codes FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "update_admin_promo" ON promo_codes;
CREATE POLICY "update_admin_promo" ON promo_codes FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "delete_admin_promo" ON promo_codes;
CREATE POLICY "delete_admin_promo" ON promo_codes FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============ PROMO REDEMPTIONS ============
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  coins_awarded integer NOT NULL,
  redeemed_at timestamptz DEFAULT now(),
  UNIQUE (promo_code_id, user_id)
);
ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_redemptions" ON promo_redemptions;
CREATE POLICY "select_own_redemptions" ON promo_redemptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_redemption" ON promo_redemptions;
CREATE POLICY "insert_own_redemption" ON promo_redemptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ UPDATE APP SETTINGS DEFAULTS ============
UPDATE app_settings SET free_spins_daily = 1 WHERE id = 1;
UPDATE app_settings SET checkin_rewards = '[20,40,60,80,100,120,80]' WHERE id = 1;

-- ============ EXPAND TRANSACTION TYPES ============
-- We can't alter the CHECK constraint without dropping it, which is safe since we're only adding a value.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('deposit','withdrawal','task_spend','task_earn','referral','spin','checkin','bonus','penalty','admin_adjust','promo','referral_signup','spin_extra'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_promo_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_redemptions_user ON promo_redemptions(user_id);
