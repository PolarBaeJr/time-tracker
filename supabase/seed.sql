-- Development seed data for local Supabase usage.
-- Categories are intentionally NOT pre-seeded.
-- Sample rows are marked as removable in their notes field.
--
-- This file only inserts sample data for the two dev emails used by
-- scripts/seed-dev.ts. Create those auth users first with the seed script,
-- or create matching users manually in local Supabase before running this SQL.

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.users
        WHERE email IN ('dev.alice@worktracker.local', 'dev.bob@worktracker.local')
    ) THEN
        RAISE NOTICE
            'No development users found. Run `npm run seed:dev` or create local auth users first, then rerun supabase/seed.sql.';
    END IF;
END;
$$;

INSERT INTO public.time_entries (
    id,
    user_id,
    category_id,
    start_at,
    end_at,
    duration_seconds,
    notes
)
SELECT
    '8d0db8bb-5c23-43be-b25f-a3f194d4d001',
    u.id,
    NULL,
    date_trunc('day', now()) - interval '3 days' + interval '16 hours',
    date_trunc('day', now()) - interval '3 days' + interval '18 hours 30 minutes',
    9000,
    '[Seed - removable] Focus block for timer/history testing'
FROM public.users AS u
WHERE u.email = 'dev.alice@worktracker.local'
ON CONFLICT (id) DO UPDATE
SET
    user_id = EXCLUDED.user_id,
    category_id = EXCLUDED.category_id,
    start_at = EXCLUDED.start_at,
    end_at = EXCLUDED.end_at,
    duration_seconds = EXCLUDED.duration_seconds,
    notes = EXCLUDED.notes;

INSERT INTO public.time_entries (
    id,
    user_id,
    category_id,
    start_at,
    end_at,
    duration_seconds,
    notes
)
SELECT
    '8d0db8bb-5c23-43be-b25f-a3f194d4d002',
    u.id,
    NULL,
    date_trunc('day', now()) - interval '1 day' + interval '20 hours 15 minutes',
    date_trunc('day', now()) - interval '1 day' + interval '21 hours',
    2700,
    '[Seed - removable] Short review session'
FROM public.users AS u
WHERE u.email = 'dev.alice@worktracker.local'
ON CONFLICT (id) DO UPDATE
SET
    user_id = EXCLUDED.user_id,
    category_id = EXCLUDED.category_id,
    start_at = EXCLUDED.start_at,
    end_at = EXCLUDED.end_at,
    duration_seconds = EXCLUDED.duration_seconds,
    notes = EXCLUDED.notes;

INSERT INTO public.time_entries (
    id,
    user_id,
    category_id,
    start_at,
    end_at,
    duration_seconds,
    notes
)
SELECT
    '8d0db8bb-5c23-43be-b25f-a3f194d4d003',
    u.id,
    NULL,
    date_trunc('day', now()) - interval '4 days' + interval '14 hours',
    date_trunc('day', now()) - interval '4 days' + interval '15 hours 45 minutes',
    6300,
    '[Seed - removable] Planning session for analytics smoke testing'
FROM public.users AS u
WHERE u.email = 'dev.bob@worktracker.local'
ON CONFLICT (id) DO UPDATE
SET
    user_id = EXCLUDED.user_id,
    category_id = EXCLUDED.category_id,
    start_at = EXCLUDED.start_at,
    end_at = EXCLUDED.end_at,
    duration_seconds = EXCLUDED.duration_seconds,
    notes = EXCLUDED.notes;

INSERT INTO public.monthly_goals (
    id,
    user_id,
    month,
    category_id,
    target_hours
)
SELECT
    'c44d675a-a61e-4f3f-9d36-d6bc93394001',
    u.id,
    date_trunc('month', now())::date,
    NULL,
    40
FROM public.users AS u
WHERE u.email = 'dev.alice@worktracker.local'
ON CONFLICT (id) DO UPDATE
SET
    user_id = EXCLUDED.user_id,
    month = EXCLUDED.month,
    category_id = EXCLUDED.category_id,
    target_hours = EXCLUDED.target_hours;

INSERT INTO public.monthly_goals (
    id,
    user_id,
    month,
    category_id,
    target_hours
)
SELECT
    'c44d675a-a61e-4f3f-9d36-d6bc93394002',
    u.id,
    date_trunc('month', now())::date,
    NULL,
    12.5
FROM public.users AS u
WHERE u.email = 'dev.bob@worktracker.local'
ON CONFLICT (id) DO UPDATE
SET
    user_id = EXCLUDED.user_id,
    month = EXCLUDED.month,
    category_id = EXCLUDED.category_id,
    target_hours = EXCLUDED.target_hours;

COMMIT;
