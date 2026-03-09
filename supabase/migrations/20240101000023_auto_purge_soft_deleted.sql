-- Auto-purge soft-deleted time entries older than 30 days
-- Call via: supabase.rpc('purge_old_soft_deleted_entries')
-- SECURITY DEFINER runs as the function owner (postgres), bypassing RLS

CREATE OR REPLACE FUNCTION purge_old_soft_deleted_entries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM time_entries
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - interval '30 days';
END;
$$;
