/*
# Fix admin_list_users CTE scope

1. Changed functions
- `admin_list_users` is replaced again with the same signature.
- The filtered base set and the paged rows are now computed in one statement. The previous version referenced a CTE from a separate statement, which made the function fail on every call.

2. Security
- Still gated by `is_platform_admin()`, which raises SQLSTATE 42501 for non-admin callers.
- Grants are unchanged: EXECUTE for authenticated only.

3. Notes
- No data is changed.
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
  SELECT
    (SELECT count(*)::integer FROM base),
    coalesce(
      (SELECT jsonb_agg(to_jsonb(b) ORDER BY b.created_at DESC NULLS LAST, b.id DESC)
       FROM (
         SELECT * FROM base
         ORDER BY created_at DESC NULLS LAST, id DESC
         LIMIT v_limit OFFSET v_offset
       ) b),
      '[]'::jsonb
    )
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$function$;
