/*
# Add withdrawable_balance (BDT) to profiles

1. Modified Tables
- `profiles` — adds `withdrawable_balance` (numeric, default 0): BDT amount available for withdrawal.
  Funded by coin-to-cash conversions and deposits. The withdrawal form checks this instead of
  withdrawable_coins so converted cash is immediately withdrawable.
2. Security
- No new tables. Existing profiles RLS covers the new column.
3. Notes
- Safe to re-run: guarded by IF NOT EXISTS.
- Existing rows get 0, which is correct (no converted cash yet).
- A backfill seeds withdrawable_balance from existing cash_balance so users with deposits
  don't lose access to their funds.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='withdrawable_balance') THEN
    ALTER TABLE profiles ADD COLUMN withdrawable_balance numeric DEFAULT 0;
  END IF;
END $$;

-- Backfill: set withdrawable_balance = cash_balance for existing users who haven't converted yet
UPDATE profiles SET withdrawable_balance = cash_balance WHERE withdrawable_balance = 0 AND cash_balance > 0;
