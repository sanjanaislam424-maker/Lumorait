/*
# Admin user list: clearer filters, stable paging, distinct access error

1. Changed functions
- `admin_list_users(p_search, p_filter, p_limit, p_offset)` is replaced with the same signature.
- Each filter is now an explicit boolean predicate (all, banned, admin, kyc_verified, kyc_pending, low_balance).
- Results are sorted by created_at descending with id as a tie-breaker, so paging is stable across requests.
- Limit is clamped to 1..200 and offset to 0 or more.

2. Security
- Access is still enforced by `is_platform_admin()`.
- A denied caller now receives SQLSTATE 42501 (insufficient privilege) instead of the default P0001, so the app can show an "no admin access" message distinct from real failures.
- Grants are unchanged: EXECUTE for authenticated only; PUBLIC and anon have no access.

3. Notes
- No data is changed. Only the read function is replaced.
*/

CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search text DEFAULT ''::text,
  p_filter text DEFAULT 'all'::text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_pattern text := '%' || lower(coalesce(p_search, '')) || '%';
  v_filter text := coalesce(nullif(p_filter, ''), 'all');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total integer;
  v_rows jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Admin access is required to view users' USING ERRCODE = '42501';
  END IF;

  WITH base AS (
    SELECT p.*, u.email, u.last_sign_in_at
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE (
      lower(coalesce(p.full_name, '')) LIKE v_pattern
      OR lower(coalesce(p.phone, '')) LIKE v_pattern
      OR lower(coalesce(u.email, '')) LIKE v_pattern
      OR p.id::text LIKE v_pattern
    )
    AND (
      v_filter = 'all'
      OR (v_filter = 'banned' AND coalesce(p.banned, false))
      OR (v_filter = 'admin' AND p.role = 'admin')
      OR (v_filter = 'kyc_verified' AND coalesce(p.kyc_verified, false))
      OR (v_filter = 'kyc_pending' AND NOT coalesce(p.kyc_verified, false))
      OR (v_filter = 'low_balance' AND coalesce(p.lumora_coins, 0) < 50)
    )
  )
  SELECT count(*) INTO v_total FROM base;

  SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.created_at DESC NULLS LAST, b.id DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT * FROM base
    ORDER BY created_at DESC NULLS LAST, id DESC
    LIMIT v_limit OFFSET v_offset
  ) b;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$function$;
