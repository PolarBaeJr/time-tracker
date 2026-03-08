-- Auto-purge soft-deleted time entries older than 30 days
-- Call via: SELECT purge_old_soft_deleted_entries();
-- Or invoke from client: supabase.rpc('purge_old_soft_deleted_entries')

CREATE OR REPLACE FUNCTION purge_old_soft_deleted_entries()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM time_entries
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - interval '30 days';
$$;
