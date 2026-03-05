-- Migration: Create categories table
-- Categories are user-defined labels for organizing time entries
-- No pre-seeded categories - users create their own from scratch

CREATE TABLE public.categories (
    -- Auto-generated UUID primary key
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Owner of this category
    -- CRITICAL: DEFAULT auth.uid() ensures user_id is always server-derived
    -- Client cannot override this value
    user_id uuid NOT NULL DEFAULT auth.uid()
        REFERENCES public.users(id) ON DELETE CASCADE,

    -- Category name (required, 1-100 characters)
    name text NOT NULL
        CHECK (char_length(name) BETWEEN 1 AND 100),

    -- Hex color for visual identification (e.g., #6366F1)
    -- Validated with regex to ensure proper format
    color text NOT NULL
        CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),

    -- User-defined category type/classification (1-50 characters)
    -- Examples: 'work', 'hobby', 'class', 'exercise', or any custom value
    -- This allows users to group categories by type
    type text NOT NULL
        CHECK (char_length(type) BETWEEN 1 AND 50),

    -- Timestamp for auditing
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Index on user_id for efficient filtering by owner
-- Most queries will filter by user_id (via RLS or explicit WHERE)
CREATE INDEX idx_categories_user_id ON public.categories(user_id);

-- Index on (user_id, name) for unique name check per user
-- Note: Not a unique constraint because we want case-insensitive uniqueness
-- which should be enforced in application code
CREATE INDEX idx_categories_user_name ON public.categories(user_id, name);

-- Comments for documentation
COMMENT ON TABLE public.categories IS 'User-defined categories for organizing time entries';
COMMENT ON COLUMN public.categories.id IS 'Auto-generated UUID primary key';
COMMENT ON COLUMN public.categories.user_id IS 'Owner of this category (server-set via auth.uid())';
COMMENT ON COLUMN public.categories.name IS 'Category display name (1-100 chars)';
COMMENT ON COLUMN public.categories.color IS 'Hex color code for visual identification (e.g., #6366F1)';
COMMENT ON COLUMN public.categories.type IS 'User-defined type/classification (e.g., work, hobby, class)';
