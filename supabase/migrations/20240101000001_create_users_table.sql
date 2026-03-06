-- Migration: Create users table
-- This table stores user profiles, linked to Supabase Auth users
-- The id is a foreign key to auth.users, ensuring cascade delete when auth user is removed

CREATE TABLE public.users (
    -- Primary key references the Supabase Auth user
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- User's email from OAuth provider (NOT NULL for data integrity)
    email text NOT NULL,

    -- Display name from OAuth profile (nullable, user may not have set one)
    name text,

    -- IANA timezone identifier for date/time calculations
    -- Default to UTC, user can change in settings
    timezone text NOT NULL DEFAULT 'UTC',

    -- Day of week to start weeks on (0=Sunday, 1=Monday, ..., 6=Saturday)
    -- Default to Monday (1), which is common for work tracking
    week_start_day integer NOT NULL DEFAULT 1
        CHECK (week_start_day >= 0 AND week_start_day <= 6),

    -- Timestamps for auditing
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index on email for lookups
-- Note: Email should be unique per auth.users, so this index helps with queries
CREATE INDEX idx_users_email ON public.users(email);

-- Comment on table and columns for documentation
COMMENT ON TABLE public.users IS 'User profiles linked to Supabase Auth users';
COMMENT ON COLUMN public.users.id IS 'UUID from auth.users, used as primary key';
COMMENT ON COLUMN public.users.email IS 'Email address from OAuth provider';
COMMENT ON COLUMN public.users.name IS 'Display name from OAuth profile';
COMMENT ON COLUMN public.users.timezone IS 'IANA timezone identifier (e.g., America/New_York)';
COMMENT ON COLUMN public.users.week_start_day IS 'Day to start week on: 0=Sunday through 6=Saturday';
