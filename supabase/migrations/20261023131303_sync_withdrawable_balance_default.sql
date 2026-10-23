-- Sync withdrawable_balance to cash_balance for any existing rows where it's null
UPDATE profiles
SET withdrawable_balance = COALESCE(withdrawable_balance, cash_balance, 0)
WHERE withdrawable_balance IS NULL;

-- Add a default so future inserts always have a value
ALTER TABLE profiles ALTER COLUMN withdrawable_balance SET DEFAULT 0;