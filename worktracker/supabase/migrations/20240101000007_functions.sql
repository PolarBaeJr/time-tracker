-- Migration: Database Functions and Triggers
-- Contains trigger functions, user creation handler, and timer RPC function

-- =============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================================================

-- Generic trigger function to update the updated_at timestamp
-- Applied to tables that have an updated_at column
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_updated_at() IS
    'Trigger function to automatically set updated_at to current timestamp on UPDATE';

-- Apply trigger to users table
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Apply trigger to time_entries table
CREATE TRIGGER trigger_time_entries_updated_at
    BEFORE UPDATE ON public.time_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- HANDLE NEW USER FUNCTION
-- =============================================================================

-- Function to create a public.users record when a new auth.users record is created
-- SECURITY DEFINER: Runs with the privileges of the function owner (postgres)
-- SET search_path: CRITICAL security measure to prevent search_path injection attacks
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    INSERT INTO public.users (id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'name'
    );
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION handle_new_user() IS
    'Creates a public.users record when a new auth.users record is created via OAuth';

-- Trigger on auth.users to create public.users record
-- Note: This requires the function to have SECURITY DEFINER since auth schema
-- is not directly accessible to regular users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- STOP TIMER AND CREATE ENTRY FUNCTION
-- =============================================================================

-- Atomically stops the active timer and creates a time entry
-- This ensures data consistency - timer is always converted to an entry
-- SECURITY DEFINER is NOT used here - runs as the calling user
-- which means RLS policies apply normally
CREATE OR REPLACE FUNCTION stop_timer_and_create_entry(p_notes text DEFAULT NULL)
RETURNS public.time_entries
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_timer public.active_timers;
    v_entry public.time_entries;
    v_end_time timestamptz;
    v_duration_seconds integer;
BEGIN
    -- Get the current timestamp for consistency
    v_end_time := now();

    -- Get the active timer for the current user
    -- RLS ensures we only see our own timer
    SELECT * INTO v_timer
    FROM public.active_timers
    WHERE user_id = auth.uid()
    FOR UPDATE;  -- Lock the row to prevent race conditions

    -- Check if timer exists
    IF v_timer IS NULL THEN
        RAISE EXCEPTION 'No active timer found for current user';
    END IF;

    -- Calculate duration in seconds
    v_duration_seconds := EXTRACT(EPOCH FROM (v_end_time - v_timer.started_at))::integer;

    -- Ensure duration is positive (should always be, but defensive check)
    IF v_duration_seconds < 0 THEN
        v_duration_seconds := 0;
    END IF;

    -- Insert the time entry
    INSERT INTO public.time_entries (
        user_id,
        category_id,
        start_at,
        end_at,
        duration_seconds,
        notes
    ) VALUES (
        auth.uid(),  -- Use auth.uid() explicitly for clarity
        v_timer.category_id,
        v_timer.started_at,
        v_end_time,
        v_duration_seconds,
        p_notes
    )
    RETURNING * INTO v_entry;

    -- Delete the active timer
    DELETE FROM public.active_timers
    WHERE id = v_timer.id;

    -- Return the created time entry
    RETURN v_entry;
END;
$$;

COMMENT ON FUNCTION stop_timer_and_create_entry(text) IS
    'Atomically stops the active timer and creates a time entry. Returns the new time entry.';

-- =============================================================================
-- SET GOAL FUNCTION (handles partial unique index complexity)
-- =============================================================================

-- Function to set a monthly goal, handling the partial unique index complexity
-- This performs an upsert that works correctly with nullable category_id
CREATE OR REPLACE FUNCTION set_monthly_goal(
    p_month date,
    p_target_hours numeric,
    p_category_id uuid DEFAULT NULL
)
RETURNS public.monthly_goals
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_goal public.monthly_goals;
BEGIN
    -- Validate inputs
    IF p_target_hours <= 0 THEN
        RAISE EXCEPTION 'target_hours must be greater than 0';
    END IF;

    -- Handle overall goal (category_id IS NULL)
    IF p_category_id IS NULL THEN
        -- Try to find existing overall goal for this month
        SELECT * INTO v_goal
        FROM public.monthly_goals
        WHERE user_id = auth.uid()
          AND month = p_month
          AND category_id IS NULL
        FOR UPDATE;

        IF v_goal IS NULL THEN
            -- Insert new overall goal
            INSERT INTO public.monthly_goals (user_id, month, category_id, target_hours)
            VALUES (auth.uid(), p_month, NULL, p_target_hours)
            RETURNING * INTO v_goal;
        ELSE
            -- Update existing overall goal
            UPDATE public.monthly_goals
            SET target_hours = p_target_hours
            WHERE id = v_goal.id
            RETURNING * INTO v_goal;
        END IF;
    ELSE
        -- Handle per-category goal (category_id IS NOT NULL)
        -- Try to find existing goal for this category and month
        SELECT * INTO v_goal
        FROM public.monthly_goals
        WHERE user_id = auth.uid()
          AND month = p_month
          AND category_id = p_category_id
        FOR UPDATE;

        IF v_goal IS NULL THEN
            -- Insert new per-category goal
            INSERT INTO public.monthly_goals (user_id, month, category_id, target_hours)
            VALUES (auth.uid(), p_month, p_category_id, p_target_hours)
            RETURNING * INTO v_goal;
        ELSE
            -- Update existing per-category goal
            UPDATE public.monthly_goals
            SET target_hours = p_target_hours
            WHERE id = v_goal.id
            RETURNING * INTO v_goal;
        END IF;
    END IF;

    RETURN v_goal;
END;
$$;

COMMENT ON FUNCTION set_monthly_goal(date, numeric, uuid) IS
    'Sets a monthly goal (insert or update). Pass NULL for category_id for overall goals.';

-- =============================================================================
-- SECURITY NOTES
-- =============================================================================

/*
SECURITY CONSIDERATIONS:

1. handle_new_user():
   - Uses SECURITY DEFINER because it needs to insert into public.users
     based on auth.users trigger, which requires elevated privileges
   - SET search_path = public, auth prevents search_path injection attacks
   - Only triggered by Supabase Auth, not directly callable by users

2. stop_timer_and_create_entry():
   - Does NOT use SECURITY DEFINER - runs as calling user
   - RLS policies apply normally to all operations
   - Uses auth.uid() to ensure user can only stop their own timer
   - FOR UPDATE lock prevents race conditions

3. set_monthly_goal():
   - Does NOT use SECURITY DEFINER - runs as calling user
   - RLS policies apply normally
   - Handles the complexity of partial unique indexes
   - Uses FOR UPDATE to prevent race conditions

4. update_updated_at():
   - Simple trigger function, no security concerns
   - Runs in the context of the UPDATE operation
*/
