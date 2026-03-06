-- RLS Integration Tests for monthly_goals table
-- Run with: supabase test db
-- These tests verify Row Level Security policies work correctly

-- =============================================================================
-- TEST SETUP: Create test users and categories
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    alice_category_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    bob_category_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
BEGIN
    -- Clean up any existing test data
    DELETE FROM public.monthly_goals WHERE user_id IN (alice_id, bob_id);
    DELETE FROM public.categories WHERE user_id IN (alice_id, bob_id);
    DELETE FROM public.users WHERE id IN (alice_id, bob_id);
    DELETE FROM auth.users WHERE id IN (alice_id, bob_id);

    -- Create Alice in auth.users
    INSERT INTO auth.users (
        id, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, instance_id, aud, role
    ) VALUES (
        alice_id, 'alice@test.local', crypt('password123', gen_salt('bf')),
        now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
    );

    -- Create Bob in auth.users
    INSERT INTO auth.users (
        id, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, instance_id, aud, role
    ) VALUES (
        bob_id, 'bob@test.local', crypt('password456', gen_salt('bf')),
        now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
    );

    -- Create corresponding public.users rows
    INSERT INTO public.users (id, email, name, timezone, week_start_day)
    VALUES (alice_id, 'alice@test.local', 'Alice', 'America/New_York', 1);

    INSERT INTO public.users (id, email, name, timezone, week_start_day)
    VALUES (bob_id, 'bob@test.local', 'Bob', 'America/Los_Angeles', 0);

    -- Create categories for testing
    INSERT INTO public.categories (id, user_id, name, color, type)
    VALUES (alice_category_id, alice_id, 'Alice Work', '#6366F1', 'work');

    INSERT INTO public.categories (id, user_id, name, color, type)
    VALUES (bob_category_id, bob_id, 'Bob Work', '#EF4444', 'work');
END $$;

-- =============================================================================
-- TEST 1: User can read their own monthly goals
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    goal_count int;
BEGIN
    -- Create a monthly goal for Alice (bypass RLS)
    SET LOCAL ROLE postgres;
    INSERT INTO public.monthly_goals (user_id, month, target_hours)
    VALUES (alice_id, '2026-03-01'::date, 40.0);
    RESET ROLE;

    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice should be able to read her own monthly goals
    SELECT count(*) INTO goal_count
    FROM public.monthly_goals
    WHERE user_id = alice_id;

    IF goal_count < 1 THEN
        RAISE EXCEPTION 'TEST FAILED: User cannot read own monthly goals (found %)', goal_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: User can read own monthly goals';
END $$;

-- =============================================================================
-- TEST 2: User cannot read other user's monthly goals
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    bob_goal_count int;
BEGIN
    -- Create a monthly goal for Bob (bypass RLS)
    SET LOCAL ROLE postgres;
    INSERT INTO public.monthly_goals (user_id, month, target_hours)
    VALUES (bob_id, '2026-03-01'::date, 50.0);
    RESET ROLE;

    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice should NOT be able to read Bob's monthly goals
    SELECT count(*) INTO bob_goal_count
    FROM public.monthly_goals
    WHERE user_id = bob_id;

    IF bob_goal_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: User can read other user monthly goals (found %)', bob_goal_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: User cannot read other user monthly goals';
END $$;

-- =============================================================================
-- TEST 3: User cannot insert monthly goal with different user_id
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
BEGIN
    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice tries to insert a monthly goal with Bob's user_id
    BEGIN
        INSERT INTO public.monthly_goals (user_id, month, target_hours)
        VALUES (bob_id, '2026-04-01'::date, 30.0);

        RAISE EXCEPTION 'TEST FAILED: User was able to insert monthly goal with different user_id';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'TEST PASSED: User cannot insert monthly goal with different user_id';
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%row-level security%' THEN
                RAISE NOTICE 'TEST PASSED: User cannot insert monthly goal with different user_id (RLS violation)';
            ELSE
                RAISE;
            END IF;
    END;
END $$;

-- =============================================================================
-- TEST 4: User cannot update other user's monthly goal
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    bob_goal_id uuid;
    updated_count int;
BEGIN
    -- Get Bob's monthly goal ID (bypass RLS)
    SET LOCAL ROLE postgres;
    SELECT id INTO bob_goal_id FROM public.monthly_goals WHERE user_id = bob_id LIMIT 1;
    RESET ROLE;

    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice tries to update Bob's monthly goal
    UPDATE public.monthly_goals
    SET target_hours = 999.0
    WHERE id = bob_goal_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    IF updated_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: User was able to update other user monthly goal';
    END IF;

    RAISE NOTICE 'TEST PASSED: User cannot update other user monthly goal';
END $$;

-- =============================================================================
-- TEST 5: Verify user_id is auto-set via auth.uid()
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    inserted_user_id uuid;
    new_goal_id uuid;
BEGIN
    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Insert without specifying user_id (should use DEFAULT auth.uid())
    INSERT INTO public.monthly_goals (month, target_hours)
    VALUES ('2026-05-01'::date, 45.0)
    RETURNING id, user_id INTO new_goal_id, inserted_user_id;

    IF inserted_user_id != alice_id THEN
        RAISE EXCEPTION 'TEST FAILED: user_id was not auto-set to auth.uid() (got %)', inserted_user_id;
    END IF;

    RAISE NOTICE 'TEST PASSED: user_id is auto-set via auth.uid()';

    -- Cleanup
    SET LOCAL ROLE postgres;
    DELETE FROM public.monthly_goals WHERE id = new_goal_id;
    RESET ROLE;
END $$;

-- =============================================================================
-- TEST 6: User cannot delete other user's monthly goal
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    bob_goal_id uuid;
    deleted_count int;
BEGIN
    -- Get Bob's monthly goal ID (bypass RLS)
    SET LOCAL ROLE postgres;
    SELECT id INTO bob_goal_id FROM public.monthly_goals WHERE user_id = bob_id LIMIT 1;
    RESET ROLE;

    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice tries to delete Bob's monthly goal
    DELETE FROM public.monthly_goals WHERE id = bob_goal_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    IF deleted_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: User was able to delete other user monthly goal';
    END IF;

    RAISE NOTICE 'TEST PASSED: User cannot delete other user monthly goal';
END $$;

-- =============================================================================
-- TEST 7: Verify partial unique indexes work correctly
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    alice_category_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
BEGIN
    -- Clean up existing goals for Alice
    SET LOCAL ROLE postgres;
    DELETE FROM public.monthly_goals WHERE user_id = alice_id AND month = '2026-06-01'::date;
    RESET ROLE;

    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Test 7a: Create overall goal (category_id IS NULL)
    INSERT INTO public.monthly_goals (month, target_hours)
    VALUES ('2026-06-01'::date, 100.0);

    RAISE NOTICE 'TEST 7a PASSED: Can create overall goal (category_id IS NULL)';

    -- Test 7b: Create per-category goal
    INSERT INTO public.monthly_goals (month, category_id, target_hours)
    VALUES ('2026-06-01'::date, alice_category_id, 40.0);

    RAISE NOTICE 'TEST 7b PASSED: Can create per-category goal for same month';

    -- Test 7c: Try to create duplicate overall goal (should fail)
    BEGIN
        INSERT INTO public.monthly_goals (month, target_hours)
        VALUES ('2026-06-01'::date, 120.0);

        RAISE EXCEPTION 'TEST FAILED: User was able to create duplicate overall goal';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE 'TEST 7c PASSED: Cannot create duplicate overall goal';
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%unique%' OR SQLERRM LIKE '%duplicate%' THEN
                RAISE NOTICE 'TEST 7c PASSED: Cannot create duplicate overall goal';
            ELSE
                RAISE;
            END IF;
    END;

    -- Test 7d: Try to create duplicate per-category goal (should fail)
    BEGIN
        INSERT INTO public.monthly_goals (month, category_id, target_hours)
        VALUES ('2026-06-01'::date, alice_category_id, 50.0);

        RAISE EXCEPTION 'TEST FAILED: User was able to create duplicate per-category goal';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE 'TEST 7d PASSED: Cannot create duplicate per-category goal';
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%unique%' OR SQLERRM LIKE '%duplicate%' THEN
                RAISE NOTICE 'TEST 7d PASSED: Cannot create duplicate per-category goal';
            ELSE
                RAISE;
            END IF;
    END;

    -- Cleanup
    SET LOCAL ROLE postgres;
    DELETE FROM public.monthly_goals WHERE user_id = alice_id AND month = '2026-06-01'::date;
    RESET ROLE;
END $$;

-- =============================================================================
-- TEST 8: Verify set_monthly_goal RPC function works correctly
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    alice_category_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    result_record record;
    goal_count int;
BEGIN
    -- Clean up existing goals for Alice
    SET LOCAL ROLE postgres;
    DELETE FROM public.monthly_goals WHERE user_id = alice_id AND month = '2026-07-01'::date;
    RESET ROLE;

    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Test: Create overall goal via RPC
    SELECT * INTO result_record FROM set_monthly_goal(
        p_month := '2026-07-01'::date,
        p_target_hours := 80.0
    );

    IF result_record.target_hours != 80.0 THEN
        RAISE EXCEPTION 'TEST FAILED: RPC did not return correct target_hours';
    END IF;

    -- Verify goal exists
    SELECT count(*) INTO goal_count
    FROM public.monthly_goals
    WHERE user_id = alice_id AND month = '2026-07-01'::date AND category_id IS NULL;

    IF goal_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Overall goal was not created via RPC';
    END IF;

    RAISE NOTICE 'TEST 8a PASSED: set_monthly_goal RPC creates overall goal';

    -- Test: Update existing goal via RPC
    SELECT * INTO result_record FROM set_monthly_goal(
        p_month := '2026-07-01'::date,
        p_target_hours := 90.0
    );

    IF result_record.target_hours != 90.0 THEN
        RAISE EXCEPTION 'TEST FAILED: RPC did not update target_hours';
    END IF;

    RAISE NOTICE 'TEST 8b PASSED: set_monthly_goal RPC updates existing goal';

    -- Test: Create per-category goal via RPC
    SELECT * INTO result_record FROM set_monthly_goal(
        p_month := '2026-07-01'::date,
        p_target_hours := 30.0,
        p_category_id := alice_category_id
    );

    IF result_record.category_id != alice_category_id THEN
        RAISE EXCEPTION 'TEST FAILED: RPC did not set category_id correctly';
    END IF;

    RAISE NOTICE 'TEST 8c PASSED: set_monthly_goal RPC creates per-category goal';

    -- Cleanup
    SET LOCAL ROLE postgres;
    DELETE FROM public.monthly_goals WHERE user_id = alice_id AND month = '2026-07-01'::date;
    RESET ROLE;
END $$;

-- =============================================================================
-- TEST CLEANUP
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
BEGIN
    SET LOCAL ROLE postgres;
    DELETE FROM public.monthly_goals WHERE user_id IN (alice_id, bob_id);
    DELETE FROM public.categories WHERE user_id IN (alice_id, bob_id);
    DELETE FROM public.users WHERE id IN (alice_id, bob_id);
    DELETE FROM auth.users WHERE id IN (alice_id, bob_id);
    RESET ROLE;

    RAISE NOTICE 'Test cleanup complete';
END $$;
