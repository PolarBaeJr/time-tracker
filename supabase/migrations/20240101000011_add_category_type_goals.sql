-- Migration: Add category_type column to monthly_goals
-- Goals can now be:
--   - Overall: category_id IS NULL AND category_type IS NULL
--   - Per-category: category_id IS NOT NULL AND category_type IS NULL
--   - Per-type: category_id IS NULL AND category_type IS NOT NULL

-- Add category_type column
ALTER TABLE public.monthly_goals ADD COLUMN category_type text;

-- Drop existing overall unique index and recreate with category_type IS NULL condition
DROP INDEX IF EXISTS idx_monthly_goals_overall_unique;
CREATE UNIQUE INDEX idx_monthly_goals_overall_unique
    ON public.monthly_goals (user_id, month)
    WHERE category_id IS NULL AND category_type IS NULL;

-- Create unique index for type goals
CREATE UNIQUE INDEX idx_monthly_goals_type_unique
    ON public.monthly_goals (user_id, month, category_type)
    WHERE category_type IS NOT NULL;

-- Add CHECK constraint ensuring mutual exclusion:
-- A goal has either both null (overall), only category_id set, or only category_type set
ALTER TABLE public.monthly_goals ADD CONSTRAINT chk_goal_kind CHECK (
    (category_id IS NULL AND category_type IS NULL) OR
    (category_id IS NOT NULL AND category_type IS NULL) OR
    (category_id IS NULL AND category_type IS NOT NULL)
);

COMMENT ON COLUMN public.monthly_goals.category_type IS 'Category type for per-type goal (NULL for overall or per-category goal)';
COMMENT ON INDEX idx_monthly_goals_type_unique IS 'Ensures one goal per category type per user per month';
