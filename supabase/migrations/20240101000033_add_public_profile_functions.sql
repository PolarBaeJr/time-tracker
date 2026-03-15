-- Migration: Add helper functions for public profile Edge Function
-- These functions support aggregate statistics calculation for public profiles

-- =============================================================================
-- RPC FUNCTION: Get entry dates for streak calculation
-- =============================================================================

-- Returns unique dates (in user's timezone) when user has time entries
-- Used by public-profile Edge Function for streak calculation
-- Limited to last N days for performance

CREATE OR REPLACE FUNCTION get_entry_dates_for_streak(
    p_user_id uuid,
    p_days_limit integer DEFAULT 365
)
RETURNS TABLE(entry_date text)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT DISTINCT
        (start_at AT TIME ZONE COALESCE(
            (SELECT timezone FROM public.users WHERE id = p_user_id),
            'UTC'
        ))::date::text AS entry_date
    FROM public.time_entries
    WHERE user_id = p_user_id
      AND start_at >= (NOW() - (p_days_limit || ' days')::interval)
    ORDER BY entry_date DESC;
$$;

-- Grant execute to authenticated users and service role
GRANT EXECUTE ON FUNCTION get_entry_dates_for_streak(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_entry_dates_for_streak(uuid, integer) TO service_role;

COMMENT ON FUNCTION get_entry_dates_for_streak IS
    'Returns unique dates with time entries for streak calculation. Used by public-profile Edge Function.';

-- =============================================================================
-- RPC FUNCTION: Get public profile stats (alternative approach)
-- =============================================================================

-- Comprehensive stats function that can be called by Edge Function
-- Returns all stats in a single call for efficiency

CREATE OR REPLACE FUNCTION get_public_profile_stats(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_user_name text;
    v_user_timezone text;
    v_total_seconds bigint := 0;
    v_work_seconds bigint := 0;
    v_break_seconds bigint := 0;
    v_long_break_seconds bigint := 0;
    v_streak integer := 0;
    v_goals_count integer := 0;
    v_result jsonb;
BEGIN
    -- Validate slug format
    IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]{3,30}$' THEN
        RETURN jsonb_build_object('error', 'Invalid slug format');
    END IF;

    -- Get user with public profile enabled
    SELECT id, name, timezone
    INTO v_user_id, v_user_name, v_user_timezone
    FROM public.users
    WHERE public_profile_slug = p_slug
      AND public_profile_enabled = true;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Profile not found');
    END IF;

    -- Calculate total hours by entry type
    SELECT
        COALESCE(SUM(duration_seconds), 0),
        COALESCE(SUM(CASE WHEN entry_type = 'work' THEN duration_seconds ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN entry_type = 'break' THEN duration_seconds ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN entry_type = 'long_break' THEN duration_seconds ELSE 0 END), 0)
    INTO v_total_seconds, v_work_seconds, v_break_seconds, v_long_break_seconds
    FROM public.time_entries
    WHERE user_id = v_user_id;

    -- Calculate streak (consecutive days with entries)
    WITH entry_dates AS (
        SELECT DISTINCT (start_at AT TIME ZONE COALESCE(v_user_timezone, 'UTC'))::date AS entry_date
        FROM public.time_entries
        WHERE user_id = v_user_id
          AND start_at >= NOW() - INTERVAL '365 days'
    ),
    dated AS (
        SELECT
            entry_date,
            entry_date - ROW_NUMBER() OVER (ORDER BY entry_date)::integer AS grp
        FROM entry_dates
    ),
    streaks AS (
        SELECT grp, COUNT(*) AS streak_length, MAX(entry_date) AS last_date
        FROM dated
        GROUP BY grp
    )
    SELECT COALESCE(
        (SELECT streak_length
         FROM streaks
         WHERE last_date >= (CURRENT_DATE AT TIME ZONE COALESCE(v_user_timezone, 'UTC'))::date - 1
         ORDER BY streak_length DESC
         LIMIT 1),
        0
    )
    INTO v_streak;

    -- Count goals
    SELECT COUNT(*)
    INTO v_goals_count
    FROM public.monthly_goals
    WHERE user_id = v_user_id;

    -- Build result
    v_result := jsonb_build_object(
        'name', COALESCE(v_user_name, 'Anonymous'),
        'stats', jsonb_build_object(
            'total_hours', ROUND((v_total_seconds / 3600.0)::numeric, 1),
            'category_breakdown', jsonb_build_object(
                'work', ROUND((v_work_seconds / 3600.0)::numeric, 1),
                'break', ROUND((v_break_seconds / 3600.0)::numeric, 1),
                'long_break', ROUND((v_long_break_seconds / 3600.0)::numeric, 1)
            ),
            'current_streak', v_streak,
            'goals_completed', v_goals_count
        )
    );

    RETURN v_result;
END;
$$;

-- Grant execute to service role only (Edge Function uses service role)
GRANT EXECUTE ON FUNCTION get_public_profile_stats(text) TO service_role;

COMMENT ON FUNCTION get_public_profile_stats IS
    'Returns aggregate stats for a public profile. Called by public-profile Edge Function. No auth required but uses service role.';

-- =============================================================================
-- SECURITY NOTES
-- =============================================================================

/*
SECURITY CONSIDERATIONS:

1. SECURITY DEFINER: Both functions run with definer privileges (not caller)
   to allow reading data across RLS boundaries. This is safe because:
   - get_entry_dates_for_streak: Only returns dates, no sensitive data
   - get_public_profile_stats: Only returns aggregate stats, checks public_profile_enabled

2. INPUT VALIDATION: Slug format is validated with regex before querying

3. PUBLIC PROFILE CHECK: get_public_profile_stats verifies public_profile_enabled = true
   before returning any data

4. NO PII: Neither function returns email, individual entry details, or other PII

5. SERVICE ROLE: get_public_profile_stats is only granted to service_role,
   preventing direct calls from client-side code
*/
