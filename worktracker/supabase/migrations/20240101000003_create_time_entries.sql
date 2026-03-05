-- Migration: Create time_entries table
-- Time entries represent completed work sessions with start/end times and duration
-- Created when timer is stopped or via manual entry

CREATE TABLE public.time_entries (
    -- Auto-generated UUID primary key
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Owner of this entry
    -- CRITICAL: DEFAULT auth.uid() ensures user_id is always server-derived
    user_id uuid NOT NULL DEFAULT auth.uid()
        REFERENCES public.users(id) ON DELETE CASCADE,

    -- Associated category (nullable)
    -- ON DELETE SET NULL preserves entries when category is deleted
    -- This is intentional: we want to keep time tracking history even if
    -- the user deletes the category. Entries become "uncategorized".
    category_id uuid
        REFERENCES public.categories(id) ON DELETE SET NULL,

    -- Start timestamp of the work session (required)
    start_at timestamptz NOT NULL,

    -- End timestamp of the work session (nullable for edge cases)
    -- Usually set when entry is created from timer stop
    end_at timestamptz,

    -- Duration in seconds (non-negative integer)
    -- Stored explicitly rather than computed for query performance
    -- and to handle edge cases where end_at might be adjusted
    duration_seconds integer NOT NULL
        CHECK (duration_seconds >= 0),

    -- Optional notes/description (max 1000 characters)
    notes text
        CHECK (notes IS NULL OR char_length(notes) <= 1000),

    -- Timestamps for auditing
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index on (user_id, start_at) for date range queries
-- Most common query pattern: "show entries for user X between dates Y and Z"
CREATE INDEX idx_time_entries_user_start ON public.time_entries(user_id, start_at DESC);

-- Index on (user_id, category_id) for category-filtered queries
-- Common query: "show entries for user X in category Y"
CREATE INDEX idx_time_entries_user_category ON public.time_entries(user_id, category_id);

-- Index on (user_id, created_at) for pagination
-- Cursor-based pagination uses created_at for stable ordering
CREATE INDEX idx_time_entries_user_created ON public.time_entries(user_id, created_at DESC);

-- Comments for documentation
COMMENT ON TABLE public.time_entries IS 'Completed time tracking entries with duration';
COMMENT ON COLUMN public.time_entries.id IS 'Auto-generated UUID primary key';
COMMENT ON COLUMN public.time_entries.user_id IS 'Owner of this entry (server-set via auth.uid())';
COMMENT ON COLUMN public.time_entries.category_id IS 'Associated category (NULL if category deleted or no category)';
COMMENT ON COLUMN public.time_entries.start_at IS 'When the work session started';
COMMENT ON COLUMN public.time_entries.end_at IS 'When the work session ended';
COMMENT ON COLUMN public.time_entries.duration_seconds IS 'Duration in seconds (stored for query performance)';
COMMENT ON COLUMN public.time_entries.notes IS 'Optional description (max 1000 chars)';
