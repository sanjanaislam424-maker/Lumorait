/*
# Add personal payment fields to transactions

1. Modified Tables
- `transactions` — adds columns needed for manual personal deposit/withdraw verification:
  - `sender_number` (text, nullable): the phone number the user sent money FROM (deposit verification)
  - `trx_id` (text, nullable): the mobile banking transaction ID the user enters (deposit verification)
  - `receiver_number` (text, nullable): the wallet number the user wants money sent TO (withdrawal)
  - `personal_admin_number` (text, nullable): the personal admin number the user was shown and told to send to (deposit audit trail)
  - `withdraw_promo_code` (text, nullable): optional withdrawal promo/discount code submitted
  - `deposit_promo_code` already exists and is reused for deposits
2. app_settings — adds columns for the per-method personal admin numbers:
  - `admin_bkash_number` (text, nullable)
  - `admin_nagad_number` (text, nullable)
  - `admin_rocket_number` (text, nullable)
3. Security
- No new tables. Existing transactions RLS already scoped to authenticated owners.
- app_settings already readable by authenticated; no new grants needed for new columns on an existing table.
4. Notes
- All new columns are nullable so existing rows and callers keep working.
- Safe to re-run: each ADD COLUMN is guarded by IF NOT EXISTS via DO block.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='sender_number') THEN
    ALTER TABLE transactions ADD COLUMN sender_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='trx_id') THEN
    ALTER TABLE transactions ADD COLUMN trx_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='receiver_number') THEN
    ALTER TABLE transactions ADD COLUMN receiver_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='personal_admin_number') THEN
    ALTER TABLE transactions ADD COLUMN personal_admin_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='withdraw_promo_code') THEN
    ALTER TABLE transactions ADD COLUMN withdraw_promo_code text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_settings' AND column_name='admin_bkash_number') THEN
    ALTER TABLE app_settings ADD COLUMN admin_bkash_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_settings' AND column_name='admin_nagad_number') THEN
    ALTER TABLE app_settings ADD COLUMN admin_nagad_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_settings' AND column_name='admin_rocket_number') THEN
    ALTER TABLE app_settings ADD COLUMN admin_rocket_number text;
  END IF;
END $$;
