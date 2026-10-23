/*
# Add admin UPDATE policy on profiles table

## Problem
When an admin rejects a withdrawal, the refund logic tries to update the *user's* profile
(cash_balance, withdrawable_balance). But the only UPDATE policy on `profiles` is
`update_own_profile` with `USING (auth.uid() = id)`, which blocks admins from updating
any row other than their own. The refund silently does nothing.

## Fix
Add a new UPDATE policy `update_admin_profiles` that allows any authenticated admin
(role = 'admin') to update any profile row. This is the same pattern already used on
`transactions` (`update_admin_tx`) and `app_settings` (`update_admin_settings`).

## Security
- The policy checks `profiles.role = 'admin'` via a subquery on the caller's own profile,
  matching the existing admin policy pattern used across all other tables.
- Non-admin users are unaffected — they still fall through to `update_own_profile`.
- No new grants needed: `authenticated` already has UPDATE on `profiles`.
- The existing `update_own_profile` policy is kept as-is; this is purely additive.
*/

DROP POLICY IF EXISTS "update_admin_profiles" ON profiles;

CREATE POLICY "update_admin_profiles"
ON profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);