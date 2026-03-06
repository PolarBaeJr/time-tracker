-- RLS Integration Tests for categories table
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
-- TEST 1: User can read their own categories
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    category_id uuid;
    category_count int;
BEGIN
    -- Alice creates a category (bypassing RLS temporarily to insert)
    SET LOCAL ROLE postgres;
    INSERT INTO public.categories (id, user_id, name, color, type)
    VALUES (gen_random_uuid(), alice_id, 'Work', '#6366F1', 'work')
    RETURNING id INTO category_id;
    RESET ROLE;

    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice should be able to read her own categories
    SELECT count(*) INTO category_count
    FROM public.categories
    WHERE user_id = alice_id;

    IF category_count < 1 THEN
        RAISE EXCEPTION 'TEST FAILED: User cannot read own categories (found %)', category_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: User can read own categories';
END $$;

-- =============================================================================
-- TEST 2: User cannot read other user's categories
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    bob_category_count int;
BEGIN
    -- Create a category for Bob (bypassing RLS)
    SET LOCAL ROLE postgres;
    INSERT INTO public.categories (user_id, name, color, type)
    VALUES (bob_id, 'Gaming', '#EF4444', 'hobby');
    RESET ROLE;

    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice should NOT be able to read Bob's categories
    SELECT count(*) INTO bob_category_count
    FROM public.categories
    WHERE user_id = bob_id;

    IF bob_category_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: User can read other user categories (found %)', bob_category_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: User cannot read other user categories';
END $$;

-- =============================================================================
-- TEST 3: User cannot insert with different user_id
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
BEGIN
    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice tries to insert a category with Bob's user_id
    BEGIN
        INSERT INTO public.categories (user_id, name, color, type)
        VALUES (bob_id, 'Malicious', '#000000', 'evil');

        RAISE EXCEPTION 'TEST FAILED: User was able to insert with different user_id';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'TEST PASSED: User cannot insert with different user_id';
        WHEN check_violation THEN
            RAISE NOTICE 'TEST PASSED: User cannot insert with different user_id (check violation)';
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%row-level security%' THEN
                RAISE NOTICE 'TEST PASSED: User cannot insert with different user_id (RLS violation)';
            ELSE
                RAISE;
            END IF;
    END;
END $$;

-- =============================================================================
-- TEST 4: User cannot update other user's category
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    bob_category_id uuid;
    updated_count int;
BEGIN
    -- Get Bob's category ID (bypass RLS)
    SET LOCAL ROLE postgres;
    SELECT id INTO bob_category_id FROM public.categories WHERE user_id = bob_id LIMIT 1;
    RESET ROLE;

    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice tries to update Bob's category
    UPDATE public.categories
    SET name = 'Hacked'
    WHERE id = bob_category_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    IF updated_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: User was able to update other user category';
    END IF;

    RAISE NOTICE 'TEST PASSED: User cannot update other user category';
END $$;

-- =============================================================================
-- TEST 5: Verify user_id is auto-set via auth.uid()
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    inserted_user_id uuid;
    new_category_id uuid;
BEGIN
    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Insert without specifying user_id (should use DEFAULT auth.uid())
    INSERT INTO public.categories (name, color, type)
    VALUES ('Auto Category', '#22D3EE', 'auto')
    RETURNING id, user_id INTO new_category_id, inserted_user_id;

    IF inserted_user_id != alice_id THEN
        RAISE EXCEPTION 'TEST FAILED: user_id was not auto-set to auth.uid() (got %)', inserted_user_id;
    END IF;

    RAISE NOTICE 'TEST PASSED: user_id is auto-set via auth.uid()';

    -- Cleanup
    SET LOCAL ROLE postgres;
    DELETE FROM public.categories WHERE id = new_category_id;
    RESET ROLE;
END $$;

-- =============================================================================
-- TEST 6: User cannot delete other user's category
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    bob_category_id uuid;
    deleted_count int;
BEGIN
    -- Get Bob's category ID (bypass RLS)
    SET LOCAL ROLE postgres;
    SELECT id INTO bob_category_id FROM public.categories WHERE user_id = bob_id LIMIT 1;
    RESET ROLE;

    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice tries to delete Bob's category
    DELETE FROM public.categories WHERE id = bob_category_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    IF deleted_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: User was able to delete other user category';
    END IF;

    RAISE NOTICE 'TEST PASSED: User cannot delete other user category';
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
    DELETE FROM public.categories WHERE user_id IN (alice_id, bob_id);
    DELETE FROM public.users WHERE id IN (alice_id, bob_id);
    DELETE FROM auth.users WHERE id IN (alice_id, bob_id);
    RESET ROLE;

    RAISE NOTICE 'Test cleanup complete';
END $$;
