-- Migration: Add soft delete support for time entries
-- Adds deleted_at column and updates RLS SELECT policy to filter deleted entries

ALTER TABLE time_entries ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- Drop existing SELECT policy and recreate with soft delete filter
DROP POLICY IF EXISTS time_entries_select_own ON public.time_entries;

CREATE POLICY time_entries_select_own ON public.time_entries
    FOR SELECT
    USING (auth.uid() = user_id AND deleted_at IS NULL);

COMMENT ON POLICY time_entries_select_own ON public.time_entries IS
    'Users can only read their own non-deleted time entries';

-- Update policy must allow restoring (updating deleted_at back to NULL)
-- so it should not filter on deleted_at
DROP POLICY IF EXISTS time_entries_update_own ON public.time_entries;

CREATE POLICY time_entries_update_own ON public.time_entries
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY time_entries_update_own ON public.time_entries IS
    'Users can only update their own time entries (includes restore from soft delete)';
