-- Migration: Create active_timers table
-- Stores the currently running timer for each user
-- Each user can have at most ONE active timer (enforced by unique constraint)
-- Timer is deleted when stopped, creating a time_entry

CREATE TABLE public.active_timers (
    -- Auto-generated UUID primary key
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Owner of this timer
    -- CRITICAL: DEFAULT auth.uid() ensures user_id is always server-derived
    -- UNIQUE constraint ensures only one active timer per user
    user_id uuid NOT NULL DEFAULT auth.uid()
        REFERENCES public.users(id) ON DELETE CASCADE
        UNIQUE,

    -- Associated category (nullable - user can start timer without category)
    category_id uuid
        REFERENCES public.categories(id) ON DELETE SET NULL,

    -- When the timer was started
    -- CRITICAL: DEFAULT now() ensures server-side timestamp
    -- Client should NOT send started_at - it's always server-set
    -- This prevents clock skew issues and timestamp manipulation
    started_at timestamptz NOT NULL DEFAULT now(),

    -- Whether the timer is currently running
    -- Currently always true for active timers, but kept for future pause support
    running boolean NOT NULL DEFAULT true
);

-- Note: No additional index needed on user_id because UNIQUE constraint creates one

-- Comments for documentation
COMMENT ON TABLE public.active_timers IS 'Currently running timer for each user (max one per user)';
COMMENT ON COLUMN public.active_timers.id IS 'Auto-generated UUID primary key';
COMMENT ON COLUMN public.active_timers.user_id IS 'Owner (server-set via auth.uid(), unique per user)';
COMMENT ON COLUMN public.active_timers.category_id IS 'Associated category (nullable)';
COMMENT ON COLUMN public.active_timers.started_at IS 'Server-set timestamp when timer started (DEFAULT now())';
COMMENT ON COLUMN public.active_timers.running IS 'Whether timer is running (always true for now)';
