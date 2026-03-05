-- Migration: Row Level Security (RLS) Policies
-- Enables RLS on all tables and creates policies for data isolation
-- Each user can only access their own data

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_timers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- USERS TABLE POLICIES
-- Note: For users table, auth.uid() = id (the user's own row)
-- =============================================================================

-- Users can view their own profile
CREATE POLICY users_select_own ON public.users
    FOR SELECT
    USING (auth.uid() = id);

COMMENT ON POLICY users_select_own ON public.users IS
    'Users can only read their own profile';

-- Users can insert their own profile (for initial creation)
-- Note: The handle_new_user trigger typically creates the row, but this allows
-- direct insertion if needed (id must match auth.uid())
CREATE POLICY users_insert_own ON public.users
    FOR INSERT
    WITH CHECK (auth.uid() = id);

COMMENT ON POLICY users_insert_own ON public.users IS
    'Users can only insert their own profile (id must match auth.uid())';

-- Users can update their own profile
-- Note: They cannot change their id or email (immutable from auth)
CREATE POLICY users_update_own ON public.users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

COMMENT ON POLICY users_update_own ON public.users IS
    'Users can only update their own profile';

-- No DELETE policy for users - deletion cascades from auth.users

-- =============================================================================
-- CATEGORIES TABLE POLICIES
-- =============================================================================

-- Users can view their own categories
CREATE POLICY categories_select_own ON public.categories
    FOR SELECT
    USING (auth.uid() = user_id);

COMMENT ON POLICY categories_select_own ON public.categories IS
    'Users can only read their own categories';

-- Users can insert categories (user_id is auto-set via DEFAULT auth.uid())
-- WITH CHECK ensures the inserted user_id matches the authenticated user
CREATE POLICY categories_insert_own ON public.categories
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY categories_insert_own ON public.categories IS
    'Users can only insert categories for themselves (user_id = auth.uid())';

-- Users can update their own categories
-- Cannot change user_id (enforced by WITH CHECK)
CREATE POLICY categories_update_own ON public.categories
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY categories_update_own ON public.categories IS
    'Users can only update their own categories (cannot change user_id)';

-- Users can delete their own categories
CREATE POLICY categories_delete_own ON public.categories
    FOR DELETE
    USING (auth.uid() = user_id);

COMMENT ON POLICY categories_delete_own ON public.categories IS
    'Users can only delete their own categories';

-- =============================================================================
-- TIME_ENTRIES TABLE POLICIES
-- =============================================================================

-- Users can view their own time entries
CREATE POLICY time_entries_select_own ON public.time_entries
    FOR SELECT
    USING (auth.uid() = user_id);

COMMENT ON POLICY time_entries_select_own ON public.time_entries IS
    'Users can only read their own time entries';

-- Users can insert time entries (user_id is auto-set via DEFAULT auth.uid())
CREATE POLICY time_entries_insert_own ON public.time_entries
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY time_entries_insert_own ON public.time_entries IS
    'Users can only insert time entries for themselves';

-- Users can update their own time entries
-- Cannot change user_id (enforced by WITH CHECK)
CREATE POLICY time_entries_update_own ON public.time_entries
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY time_entries_update_own ON public.time_entries IS
    'Users can only update their own time entries (cannot change user_id)';

-- Users can delete their own time entries
CREATE POLICY time_entries_delete_own ON public.time_entries
    FOR DELETE
    USING (auth.uid() = user_id);

COMMENT ON POLICY time_entries_delete_own ON public.time_entries IS
    'Users can only delete their own time entries';

-- =============================================================================
-- ACTIVE_TIMERS TABLE POLICIES
-- =============================================================================

-- Users can view their own active timer
CREATE POLICY active_timers_select_own ON public.active_timers
    FOR SELECT
    USING (auth.uid() = user_id);

COMMENT ON POLICY active_timers_select_own ON public.active_timers IS
    'Users can only read their own active timer';

-- Users can insert their own active timer (user_id is auto-set)
-- Note: UNIQUE constraint on user_id ensures only one timer per user
CREATE POLICY active_timers_insert_own ON public.active_timers
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY active_timers_insert_own ON public.active_timers IS
    'Users can only insert their own active timer';

-- Users can update their own active timer
-- Cannot change user_id or started_at (enforced by application logic)
CREATE POLICY active_timers_update_own ON public.active_timers
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY active_timers_update_own ON public.active_timers IS
    'Users can only update their own active timer (cannot change user_id)';

-- Users can delete their own active timer (when stopping)
CREATE POLICY active_timers_delete_own ON public.active_timers
    FOR DELETE
    USING (auth.uid() = user_id);

COMMENT ON POLICY active_timers_delete_own ON public.active_timers IS
    'Users can only delete their own active timer';

-- =============================================================================
-- MONTHLY_GOALS TABLE POLICIES
-- =============================================================================

-- Users can view their own monthly goals
CREATE POLICY monthly_goals_select_own ON public.monthly_goals
    FOR SELECT
    USING (auth.uid() = user_id);

COMMENT ON POLICY monthly_goals_select_own ON public.monthly_goals IS
    'Users can only read their own monthly goals';

-- Users can insert their own monthly goals
CREATE POLICY monthly_goals_insert_own ON public.monthly_goals
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY monthly_goals_insert_own ON public.monthly_goals IS
    'Users can only insert monthly goals for themselves';

-- Users can update their own monthly goals
-- Cannot change user_id (enforced by WITH CHECK)
CREATE POLICY monthly_goals_update_own ON public.monthly_goals
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY monthly_goals_update_own ON public.monthly_goals IS
    'Users can only update their own monthly goals (cannot change user_id)';

-- Users can delete their own monthly goals
CREATE POLICY monthly_goals_delete_own ON public.monthly_goals
    FOR DELETE
    USING (auth.uid() = user_id);

COMMENT ON POLICY monthly_goals_delete_own ON public.monthly_goals IS
    'Users can only delete their own monthly goals';

-- =============================================================================
-- SECURITY NOTES
-- =============================================================================

/*
IMPORTANT SECURITY PROPERTIES:

1. DATA ISOLATION: Each user can only access rows where:
   - users: id = auth.uid() (their own profile)
   - other tables: user_id = auth.uid() (their own data)

2. IMMUTABLE user_id: The WITH CHECK clause on UPDATE policies ensures
   users cannot change the user_id column to another user's ID.

3. SERVER-SET user_id: Combined with DEFAULT auth.uid() on tables,
   clients cannot insert rows with a different user_id.

4. REALTIME SECURITY: RLS policies apply to Supabase Realtime subscriptions,
   ensuring users only receive updates for their own data.

5. NO BYPASS: These policies have no special bypass for admin users.
   Admin operations should use service_role key which bypasses RLS.
*/
