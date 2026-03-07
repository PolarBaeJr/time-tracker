-- Migration: Add Pomodoro timer support and entry types
-- Adds entry_type to time_entries for work/break/long_break tracking
-- Adds pomodoro fields to active_timers for phase management

-- Add entry_type to time_entries to distinguish work vs break entries
ALTER TABLE public.time_entries
    ADD COLUMN entry_type text NOT NULL DEFAULT 'work'
        CHECK (entry_type IN ('work', 'break', 'long_break'));

-- Add index for filtering by entry type
CREATE INDEX idx_time_entries_user_type ON public.time_entries(user_id, entry_type);

-- Add pomodoro fields to active_timers
-- timer_mode: 'normal' (classic stopwatch) or 'pomodoro' (timed phases)
ALTER TABLE public.active_timers
    ADD COLUMN timer_mode text NOT NULL DEFAULT 'normal'
        CHECK (timer_mode IN ('normal', 'pomodoro'));

-- Current phase in pomodoro mode
ALTER TABLE public.active_timers
    ADD COLUMN pomodoro_phase text NOT NULL DEFAULT 'work'
        CHECK (pomodoro_phase IN ('work', 'break', 'long_break'));

-- Duration target in seconds for the current phase (e.g., 1500 for 25min work)
ALTER TABLE public.active_timers
    ADD COLUMN phase_duration_seconds integer
        CHECK (phase_duration_seconds IS NULL OR phase_duration_seconds > 0);

-- How many work phases completed in the current cycle (resets after long break)
ALTER TABLE public.active_timers
    ADD COLUMN pomodoros_completed integer NOT NULL DEFAULT 0
        CHECK (pomodoros_completed >= 0);

-- Update the stop_timer_and_create_entry function to include entry_type
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
    v_entry_type text;
BEGIN
    v_end_time := now();

    SELECT * INTO v_timer
    FROM public.active_timers
    WHERE user_id = auth.uid()
    FOR UPDATE;

    IF v_timer IS NULL THEN
        RAISE EXCEPTION 'No active timer found for current user';
    END IF;

    v_duration_seconds := EXTRACT(EPOCH FROM (v_end_time - v_timer.started_at))::integer;

    IF v_duration_seconds < 0 THEN
        v_duration_seconds := 0;
    END IF;

    -- Map pomodoro phase to entry type
    IF v_timer.timer_mode = 'pomodoro' THEN
        v_entry_type := v_timer.pomodoro_phase;
    ELSE
        v_entry_type := 'work';
    END IF;

    INSERT INTO public.time_entries (
        user_id,
        category_id,
        start_at,
        end_at,
        duration_seconds,
        notes,
        entry_type
    ) VALUES (
        auth.uid(),
        v_timer.category_id,
        v_timer.started_at,
        v_end_time,
        v_duration_seconds,
        p_notes,
        v_entry_type
    )
    RETURNING * INTO v_entry;

    DELETE FROM public.active_timers
    WHERE id = v_timer.id;

    RETURN v_entry;
END;
$$;

COMMENT ON COLUMN public.time_entries.entry_type IS 'Type of entry: work, break, or long_break';
COMMENT ON COLUMN public.active_timers.timer_mode IS 'Timer mode: normal (stopwatch) or pomodoro';
COMMENT ON COLUMN public.active_timers.pomodoro_phase IS 'Current pomodoro phase: work, break, or long_break';
COMMENT ON COLUMN public.active_timers.phase_duration_seconds IS 'Target duration for current phase in seconds';
COMMENT ON COLUMN public.active_timers.pomodoros_completed IS 'Work phases completed in current pomodoro cycle';
