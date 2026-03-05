-- Migration: Create monthly_goals table
-- Stores time tracking goals per month
-- Goals can be:
--   - Overall: Apply to total time across all categories (category_id IS NULL)
--   - Per-category: Apply to a specific category (category_id IS NOT NULL)
--
-- IMPORTANT: Uniqueness is enforced via PARTIAL UNIQUE INDEXES
-- because PostgreSQL allows multiple NULLs in a regular UNIQUE constraint

CREATE TABLE public.monthly_goals (
    -- Auto-generated UUID primary key
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Owner of this goal
    -- CRITICAL: DEFAULT auth.uid() ensures user_id is always server-derived
    user_id uuid NOT NULL DEFAULT auth.uid()
        REFERENCES public.users(id) ON DELETE CASCADE,

    -- Month for this goal (first day of month, e.g., '2024-03-01')
    -- Using date type for efficient storage and querying
    month date NOT NULL,

    -- Associated category (nullable)
    -- NULL = overall/total goal (applies to all time)
    -- NOT NULL = per-category goal (applies to specific category)
    category_id uuid
        REFERENCES public.categories(id) ON DELETE CASCADE,

    -- Target hours to achieve in this month
    -- Stored as numeric for precision (allows decimals like 40.5 hours)
    target_hours numeric NOT NULL
        CHECK (target_hours > 0)
);

-- PARTIAL UNIQUE INDEX for overall goals (category_id IS NULL)
-- Ensures only ONE overall goal per user per month
CREATE UNIQUE INDEX idx_monthly_goals_overall_unique
    ON public.monthly_goals (user_id, month)
    WHERE category_id IS NULL;

-- PARTIAL UNIQUE INDEX for per-category goals (category_id IS NOT NULL)
-- Ensures only ONE goal per category per user per month
CREATE UNIQUE INDEX idx_monthly_goals_category_unique
    ON public.monthly_goals (user_id, month, category_id)
    WHERE category_id IS NOT NULL;

-- Index for efficient lookups by user and month
CREATE INDEX idx_monthly_goals_user_month ON public.monthly_goals(user_id, month);

-- Comments for documentation
COMMENT ON TABLE public.monthly_goals IS 'Monthly time tracking goals (overall or per-category)';
COMMENT ON COLUMN public.monthly_goals.id IS 'Auto-generated UUID primary key';
COMMENT ON COLUMN public.monthly_goals.user_id IS 'Owner (server-set via auth.uid())';
COMMENT ON COLUMN public.monthly_goals.month IS 'Month for this goal (first day, e.g., 2024-03-01)';
COMMENT ON COLUMN public.monthly_goals.category_id IS 'Category for per-category goal (NULL for overall goal)';
COMMENT ON COLUMN public.monthly_goals.target_hours IS 'Target hours to achieve (must be > 0)';

-- Explain the partial unique index strategy
COMMENT ON INDEX idx_monthly_goals_overall_unique IS 'Ensures one overall goal (category_id IS NULL) per user per month';
COMMENT ON INDEX idx_monthly_goals_category_unique IS 'Ensures one goal per category per user per month';
