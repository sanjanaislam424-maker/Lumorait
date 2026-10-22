/*
# Add admin permissions and super admin flag to profiles

1. Modified Tables
- `profiles` — adds two columns for granular admin access control:
  - `admin_permissions` (jsonb, default '{}'::jsonb): stores which admin modules a staff member can access.
    Keys: manage_deposits, manage_withdrawals, moderate_tasks, verify_kyc, manage_promo_codes, balance_adjustments, system_settings.
    A value of true means the module is accessible; absent/false means hidden.
  - `is_super_admin` (boolean, default false): the primary owner account. Super admins bypass permission checks — all modules are visible and locked on.
2. Security
- No new tables. Existing profiles RLS already scoped to authenticated owners.
- No new grants needed — new columns on an existing table are covered by existing grants.
3. Notes
- Both columns are nullable/defaulted so existing rows and callers keep working.
- Safe to re-run: each ADD COLUMN is guarded by IF NOT EXISTS via DO block.
- The first admin account (or any account you designate) can be set to is_super_admin=true via SQL or the admin UI.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='admin_permissions') THEN
    ALTER TABLE profiles ADD COLUMN admin_permissions jsonb DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_super_admin') THEN
    ALTER TABLE profiles ADD COLUMN is_super_admin boolean DEFAULT false;
  END IF;
END $$;
