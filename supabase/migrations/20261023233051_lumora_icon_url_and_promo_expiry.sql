/*
# Add icon_url to task_categories and expires_at to promo_codes

## Summary
Adds an `icon_url` column to `task_categories` for custom category images/icons,
and an `expires_at` column to `promo_codes` for promo code expiry deadlines.

## Modified Tables

### task_categories
- `icon_url` (text, nullable): URL to a category icon image (e.g. Facebook logo)

### promo_codes
- `expires_at` (timestamptz, nullable): When the promo code expires
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_categories' AND column_name = 'icon_url'
  ) THEN
    ALTER TABLE task_categories ADD COLUMN icon_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promo_codes' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE promo_codes ADD COLUMN expires_at timestamptz;
  END IF;
END $$;
