-- RLS Integration Tests for active_timers table
-- Run with: supabase test db
-- These tests verify Row Level Security policies work correctly

-- =============================================================================
-- TEST SETUP: Create test users
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
BEGIN
    -- Clean up any existing test data
    DELETE FROM public.active_timers WHERE user_id IN (alice_id, bob_id);
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
END $$;

-- =============================================================================
-- TEST 1: User can read their own active timer
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    timer_count int;
BEGIN
    -- Create an active timer for Alice (bypass RLS)
    SET LOCAL ROLE postgres;
    INSERT INTO public.active_timers (user_id, started_at, running)
    VALUES (alice_id, now() - interval '30 minutes', true);
    RESET ROLE;

    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice should be able to read her own active timer
    SELECT count(*) INTO timer_count
    FROM public.active_timers
    WHERE user_id = alice_id;

    IF timer_count < 1 THEN
        RAISE EXCEPTION 'TEST FAILED: User cannot read own active timer (found %)', timer_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: User can read own active timer';
END $$;

-- =============================================================================
-- TEST 2: User cannot read other user's active timer
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    bob_timer_count int;
BEGIN
    -- Create an active timer for Bob (bypass RLS)
    SET LOCAL ROLE postgres;
    INSERT INTO public.active_timers (user_id, started_at, running)
    VALUES (bob_id, now() - interval '15 minutes', true);
    RESET ROLE;

    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice should NOT be able to read Bob's active timer
    SELECT count(*) INTO bob_timer_count
    FROM public.active_timers
    WHERE user_id = bob_id;

    IF bob_timer_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: User can read other user active timer (found %)', bob_timer_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: User cannot read other user active timer';
END $$;

-- =============================================================================
-- TEST 3: User cannot insert active timer with different user_id
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
BEGIN
    -- First, clean up Bob's existing timer to avoid unique constraint
    SET LOCAL ROLE postgres;
    DELETE FROM public.active_timers WHERE user_id = bob_id;
    RESET ROLE;

    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice tries to insert an active timer with Bob's user_id
    BEGIN
        INSERT INTO public.active_timers (user_id, started_at, running)
        VALUES (bob_id, now(), true);

        RAISE EXCEPTION 'TEST FAILED: User was able to insert active timer with different user_id';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'TEST PASSED: User cannot insert active timer with different user_id';
        WHEN unique_violation THEN
            RAISE NOTICE 'TEST PASSED: User cannot insert active timer with different user_id (blocked)';
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%row-level security%' THEN
                RAISE NOTICE 'TEST PASSED: User cannot insert active timer with different user_id (RLS violation)';
            ELSE
                RAISE;
            END IF;
    END;
END $$;

-- =============================================================================
-- TEST 4: User cannot update other user's active timer
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    bob_timer_id uuid;
    updated_count int;
BEGIN
    -- Recreate Bob's timer (bypass RLS)
    SET LOCAL ROLE postgres;
    DELETE FROM public.active_timers WHERE user_id = bob_id;
    INSERT INTO public.active_timers (user_id, started_at, running)
    VALUES (bob_id, now() - interval '10 minutes', true)
    RETURNING id INTO bob_timer_id;
    RESET ROLE;

    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice tries to update Bob's active timer
    UPDATE public.active_timers
    SET running = false
    WHERE id = bob_timer_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    IF updated_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: User was able to update other user active timer';
    END IF;

    RAISE NOTICE 'TEST PASSED: User cannot update other user active timer';
END $$;

-- =============================================================================
-- TEST 5: Verify user_id is auto-set via auth.uid()
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    inserted_user_id uuid;
    new_timer_id uuid;
BEGIN
    -- Clean up Alice's existing timer to avoid unique constraint
    SET LOCAL ROLE postgres;
    DELETE FROM public.active_timers WHERE user_id = alice_id;
    RESET ROLE;

    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Insert without specifying user_id (should use DEFAULT auth.uid())
    INSERT INTO public.active_timers (started_at, running)
    VALUES (now(), true)
    RETURNING id, user_id INTO new_timer_id, inserted_user_id;

    IF inserted_user_id != alice_id THEN
        RAISE EXCEPTION 'TEST FAILED: user_id was not auto-set to auth.uid() (got %)', inserted_user_id;
    END IF;

    RAISE NOTICE 'TEST PASSED: user_id is auto-set via auth.uid()';
END $$;

-- =============================================================================
-- TEST 6: User cannot delete other user's active timer
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    bob_timer_id uuid;
    deleted_count int;
BEGIN
    -- Get Bob's timer ID (bypass RLS)
    SET LOCAL ROLE postgres;
    SELECT id INTO bob_timer_id FROM public.active_timers WHERE user_id = bob_id LIMIT 1;
    RESET ROLE;

    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice tries to delete Bob's active timer
    DELETE FROM public.active_timers WHERE id = bob_timer_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    IF deleted_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: User was able to delete other user active timer';
    END IF;

    RAISE NOTICE 'TEST PASSED: User cannot delete other user active timer';
END $$;

-- =============================================================================
-- TEST 7: Verify UNIQUE constraint on user_id (one timer per user)
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
BEGIN
    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Try to insert a second timer for Alice (should fail due to UNIQUE constraint)
    BEGIN
        INSERT INTO public.active_timers (started_at, running)
        VALUES (now(), true);

        RAISE EXCEPTION 'TEST FAILED: User was able to create multiple active timers';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE 'TEST PASSED: UNIQUE constraint prevents multiple timers per user';
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%unique%' OR SQLERRM LIKE '%duplicate%' THEN
                RAISE NOTICE 'TEST PASSED: UNIQUE constraint prevents multiple timers per user';
            ELSE
                RAISE;
            END IF;
    END;
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
    DELETE FROM public.active_timers WHERE user_id IN (alice_id, bob_id);
    DELETE FROM public.categories WHERE user_id IN (alice_id, bob_id);
    DELETE FROM public.users WHERE id IN (alice_id, bob_id);
    DELETE FROM auth.users WHERE id IN (alice_id, bob_id);
    RESET ROLE;

    RAISE NOTICE 'Test cleanup complete';
END $$;
