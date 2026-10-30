ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bio text DEFAULT '',
  ADD COLUMN IF NOT EXISTS level integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS xp_points integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notify_tasks boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_payments boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_promo boolean DEFAULT true;