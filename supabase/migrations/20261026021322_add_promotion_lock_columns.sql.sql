/*
# Add Promotion Lock Columns for 8-Day Minimum

1. Modified Tables
- `tasks`:
  - `promotion_started_at` (timestamptz, nullable): when the current promotion was applied.
    Used to enforce the strict 8-day minimum lock window for long-term boosts.
  - `promotion_locked_until` (timestamptz, nullable): the earliest timestamp at which the
    task owner may manually cancel the boost. For long-term boosts (duration_days > 7 or
    duration_days = 0 for unlimited), this is set to promotion_started_at + 8 days.

2. Important Notes
- These columns are informational and do not change existing RLS policies.
- The frontend reads `promotion_locked_until` to disable the "Cancel Boost" button until
  the 8-day lock period passes.
- No data is lost — columns default to NULL and existing tasks are unaffected.
*/

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS promotion_started_at timestamptz DEFAULT null;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS promotion_locked_until timestamptz DEFAULT null;