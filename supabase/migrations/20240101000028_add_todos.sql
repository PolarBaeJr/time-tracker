-- Migration: Create todos table
-- Todos are task items users can track alongside their time entries
-- Supports priorities, due dates, categories, and ordering

-- =============================================================================
-- CREATE TODO PRIORITY ENUM
-- =============================================================================

CREATE TYPE todo_priority AS ENUM ('low', 'medium', 'high', 'urgent');

COMMENT ON TYPE todo_priority IS 'Priority levels for todo items';

-- =============================================================================
-- CREATE TODOS TABLE
-- =============================================================================

CREATE TABLE public.todos (
    -- Auto-generated UUID primary key
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Owner of this todo
    -- CRITICAL: DEFAULT auth.uid() ensures user_id is always server-derived
    user_id uuid NOT NULL DEFAULT auth.uid()
        REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Todo title (required, max 500 characters)
    title text NOT NULL
        CHECK (char_length(title) BETWEEN 1 AND 500),

    -- Optional content/notes (max 5000 characters)
    content text
        CHECK (content IS NULL OR char_length(content) <= 5000),

    -- Associated category (nullable)
    -- ON DELETE SET NULL preserves todos when category is deleted
    category_id uuid
        REFERENCES public.categories(id) ON DELETE SET NULL,

    -- Associated time entry (nullable)
    -- ON DELETE SET NULL preserves todos when time entry is deleted
    time_entry_id uuid
        REFERENCES public.time_entries(id) ON DELETE SET NULL,

    -- Completion status
    is_completed boolean NOT NULL DEFAULT false,

    -- Timestamp when marked complete (null if not completed)
    completed_at timestamptz,

    -- Optional due date (date only, no time component)
    due_date date,

    -- Priority level (defaults to medium)
    priority todo_priority NOT NULL DEFAULT 'medium',

    -- Position for ordering (non-negative integer)
    -- Lower values appear first; used for drag-and-drop reordering
    position integer NOT NULL DEFAULT 0
        CHECK (position >= 0),

    -- Timestamps for auditing
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Soft delete support
    deleted_at timestamptz
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Index on user_id for efficient filtering by owner
CREATE INDEX idx_todos_user_id ON public.todos(user_id);

-- Composite index on (user_id, is_completed) for filtering active/completed todos
CREATE INDEX idx_todos_user_completed ON public.todos(user_id, is_completed);

-- Composite index on (user_id, due_date) for due date queries
CREATE INDEX idx_todos_user_due_date ON public.todos(user_id, due_date);

-- Composite index on (user_id, deleted_at) for soft delete filtering
CREATE INDEX idx_todos_user_deleted ON public.todos(user_id, deleted_at);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- Users can manage their own todos (all operations)
CREATE POLICY "Users can manage own todos" ON public.todos
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "Users can manage own todos" ON public.todos IS
    'Users can only create, read, update, and delete their own todos';

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

CREATE TRIGGER trigger_todos_updated_at
    BEFORE UPDATE ON public.todos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE public.todos IS 'User todo items with priorities, due dates, and ordering';
COMMENT ON COLUMN public.todos.id IS 'Auto-generated UUID primary key';
COMMENT ON COLUMN public.todos.user_id IS 'Owner of this todo (server-set via auth.uid())';
COMMENT ON COLUMN public.todos.title IS 'Todo title (1-500 chars, required)';
COMMENT ON COLUMN public.todos.content IS 'Optional notes or description (max 5000 chars)';
COMMENT ON COLUMN public.todos.category_id IS 'Associated category (NULL if category deleted or no category)';
COMMENT ON COLUMN public.todos.time_entry_id IS 'Associated time entry (NULL if entry deleted or no entry)';
COMMENT ON COLUMN public.todos.is_completed IS 'Whether the todo has been completed';
COMMENT ON COLUMN public.todos.completed_at IS 'Timestamp when marked complete (NULL if not completed)';
COMMENT ON COLUMN public.todos.due_date IS 'Optional due date (date only, no time)';
COMMENT ON COLUMN public.todos.priority IS 'Priority level: low, medium, high, or urgent';
COMMENT ON COLUMN public.todos.position IS 'Order position for drag-and-drop (lower = earlier)';
COMMENT ON COLUMN public.todos.created_at IS 'When the todo was created';
COMMENT ON COLUMN public.todos.updated_at IS 'When the todo was last updated';
COMMENT ON COLUMN public.todos.deleted_at IS 'Soft delete timestamp (NULL if not deleted)';
