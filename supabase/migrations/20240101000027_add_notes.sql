-- Migration: Create notes table
-- Notes are user-created content that can optionally be linked to categories or time entries
-- Supports soft delete and pinning for organization

-- =============================================================================
-- CREATE NOTES TABLE
-- =============================================================================

CREATE TABLE public.notes (
    -- Auto-generated UUID primary key
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Owner of this note
    -- CRITICAL: DEFAULT auth.uid() ensures user_id is always server-derived
    -- Client cannot override this value
    user_id uuid NOT NULL DEFAULT auth.uid()
        REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Note title (required, max 200 characters)
    title text NOT NULL
        CHECK (char_length(title) BETWEEN 1 AND 200),

    -- Note content/body (optional, max 10000 characters)
    content text
        CHECK (content IS NULL OR char_length(content) <= 10000),

    -- Associated category (optional)
    -- ON DELETE SET NULL preserves notes when category is deleted
    category_id uuid
        REFERENCES public.categories(id) ON DELETE SET NULL,

    -- Associated time entry (optional)
    -- ON DELETE SET NULL preserves notes when time entry is deleted
    time_entry_id uuid
        REFERENCES public.time_entries(id) ON DELETE SET NULL,

    -- Whether this note is pinned (shown at top of list)
    pinned boolean NOT NULL DEFAULT false,

    -- Timestamps for auditing
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Soft delete timestamp (NULL = not deleted)
    deleted_at timestamptz DEFAULT NULL
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Index on user_id for efficient filtering by owner
-- Most queries will filter by user_id (via RLS or explicit WHERE)
CREATE INDEX idx_notes_user_id ON public.notes(user_id);

-- Composite index on (user_id, deleted_at) for efficient soft delete filtering
-- Common query: "show non-deleted notes for user X"
CREATE INDEX idx_notes_user_deleted ON public.notes(user_id, deleted_at);

-- Index on (user_id, pinned) for efficient pinned notes queries
CREATE INDEX idx_notes_user_pinned ON public.notes(user_id, pinned) WHERE pinned = true;

-- Index on (user_id, category_id) for category-filtered queries
CREATE INDEX idx_notes_user_category ON public.notes(user_id, category_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Single policy for all operations (SELECT, INSERT, UPDATE, DELETE)
-- Users can only access their own notes
CREATE POLICY "Users can manage own notes" ON public.notes
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "Users can manage own notes" ON public.notes IS
    'Users can only access (select, insert, update, delete) their own notes';

-- =============================================================================
-- TRIGGER FOR UPDATED_AT
-- =============================================================================

-- Apply existing update_updated_at trigger function to notes table
CREATE TRIGGER trigger_notes_updated_at
    BEFORE UPDATE ON public.notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE public.notes IS 'User-created notes that can be linked to categories or time entries';
COMMENT ON COLUMN public.notes.id IS 'Auto-generated UUID primary key';
COMMENT ON COLUMN public.notes.user_id IS 'Owner of this note (server-set via auth.uid())';
COMMENT ON COLUMN public.notes.title IS 'Note title (required, 1-200 chars)';
COMMENT ON COLUMN public.notes.content IS 'Note content/body (optional, max 10000 chars)';
COMMENT ON COLUMN public.notes.category_id IS 'Associated category (NULL if none or category deleted)';
COMMENT ON COLUMN public.notes.time_entry_id IS 'Associated time entry (NULL if none or entry deleted)';
COMMENT ON COLUMN public.notes.pinned IS 'Whether this note is pinned to the top of the list';
COMMENT ON COLUMN public.notes.created_at IS 'When this note was created';
COMMENT ON COLUMN public.notes.updated_at IS 'When this note was last updated';
COMMENT ON COLUMN public.notes.deleted_at IS 'Soft delete timestamp (NULL = not deleted)';

-- =============================================================================
-- SECURITY NOTES
-- =============================================================================

/*
SECURITY CONSIDERATIONS:

1. DATA ISOLATION: RLS policy ensures users can only access notes where user_id = auth.uid()

2. IMMUTABLE user_id: WITH CHECK clause on the policy ensures users cannot change
   the user_id column to another user's ID

3. SERVER-SET user_id: DEFAULT auth.uid() ensures clients cannot insert notes
   with a different user_id

4. INPUT VALIDATION: CHECK constraints enforce:
   - title: 1-200 characters (required)
   - content: max 10000 characters (optional)

5. SOFT DELETE: deleted_at column allows recovery of accidentally deleted notes
   Client-side filtering should exclude records where deleted_at IS NOT NULL
*/
