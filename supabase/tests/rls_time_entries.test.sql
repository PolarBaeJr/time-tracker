-- RLS Integration Tests for time_entries table
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
    DELETE FROM public.time_entries WHERE user_id IN (alice_id, bob_id);
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
-- TEST 1: User can read their own time entries
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    alice_category_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    entry_count int;
BEGIN
    -- Create a time entry for Alice (bypass RLS)
    SET LOCAL ROLE postgres;
    INSERT INTO public.time_entries (user_id, category_id, start_at, end_at, duration_seconds, notes)
    VALUES (
        alice_id, alice_category_id,
        now() - interval '2 hours', now() - interval '1 hour',
        3600, 'Alice test entry'
    );
    RESET ROLE;

    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice should be able to read her own time entries
    SELECT count(*) INTO entry_count
    FROM public.time_entries
    WHERE user_id = alice_id;

    IF entry_count < 1 THEN
        RAISE EXCEPTION 'TEST FAILED: User cannot read own time entries (found %)', entry_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: User can read own time entries';
END $$;

-- =============================================================================
-- TEST 2: User cannot read other user's time entries
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    bob_category_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    bob_entry_count int;
BEGIN
    -- Create a time entry for Bob (bypass RLS)
    SET LOCAL ROLE postgres;
    INSERT INTO public.time_entries (user_id, category_id, start_at, end_at, duration_seconds, notes)
    VALUES (
        bob_id, bob_category_id,
        now() - interval '3 hours', now() - interval '2 hours',
        3600, 'Bob test entry'
    );
    RESET ROLE;

    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice should NOT be able to read Bob's time entries
    SELECT count(*) INTO bob_entry_count
    FROM public.time_entries
    WHERE user_id = bob_id;

    IF bob_entry_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: User can read other user time entries (found %)', bob_entry_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: User cannot read other user time entries';
END $$;

-- =============================================================================
-- TEST 3: User cannot insert time entry with different user_id
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    alice_category_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
BEGIN
    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice tries to insert a time entry with Bob's user_id
    BEGIN
        INSERT INTO public.time_entries (user_id, category_id, start_at, end_at, duration_seconds)
        VALUES (bob_id, alice_category_id, now() - interval '1 hour', now(), 3600);

        RAISE EXCEPTION 'TEST FAILED: User was able to insert time entry with different user_id';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'TEST PASSED: User cannot insert time entry with different user_id';
        WHEN check_violation THEN
            RAISE NOTICE 'TEST PASSED: User cannot insert time entry with different user_id (check violation)';
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%row-level security%' THEN
                RAISE NOTICE 'TEST PASSED: User cannot insert time entry with different user_id (RLS violation)';
            ELSE
                RAISE;
            END IF;
    END;
END $$;

-- =============================================================================
-- TEST 4: User cannot update other user's time entry
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    bob_entry_id uuid;
    updated_count int;
BEGIN
    -- Get Bob's time entry ID (bypass RLS)
    SET LOCAL ROLE postgres;
    SELECT id INTO bob_entry_id FROM public.time_entries WHERE user_id = bob_id LIMIT 1;
    RESET ROLE;

    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice tries to update Bob's time entry
    UPDATE public.time_entries
    SET notes = 'Hacked by Alice'
    WHERE id = bob_entry_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    IF updated_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: User was able to update other user time entry';
    END IF;

    RAISE NOTICE 'TEST PASSED: User cannot update other user time entry';
END $$;

-- =============================================================================
-- TEST 5: Verify user_id is auto-set via auth.uid()
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    alice_category_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    inserted_user_id uuid;
    new_entry_id uuid;
BEGIN
    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Insert without specifying user_id (should use DEFAULT auth.uid())
    INSERT INTO public.time_entries (category_id, start_at, end_at, duration_seconds, notes)
    VALUES (alice_category_id, now() - interval '30 minutes', now(), 1800, 'Auto user_id test')
    RETURNING id, user_id INTO new_entry_id, inserted_user_id;

    IF inserted_user_id != alice_id THEN
        RAISE EXCEPTION 'TEST FAILED: user_id was not auto-set to auth.uid() (got %)', inserted_user_id;
    END IF;

    RAISE NOTICE 'TEST PASSED: user_id is auto-set via auth.uid()';

    -- Cleanup
    SET LOCAL ROLE postgres;
    DELETE FROM public.time_entries WHERE id = new_entry_id;
    RESET ROLE;
END $$;

-- =============================================================================
-- TEST 6: User cannot delete other user's time entry
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    bob_entry_id uuid;
    deleted_count int;
BEGIN
    -- Get Bob's time entry ID (bypass RLS)
    SET LOCAL ROLE postgres;
    SELECT id INTO bob_entry_id FROM public.time_entries WHERE user_id = bob_id LIMIT 1;
    RESET ROLE;

    -- Set auth context to Alice
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice tries to delete Bob's time entry
    DELETE FROM public.time_entries WHERE id = bob_entry_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    IF deleted_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: User was able to delete other user time entry';
    END IF;

    RAISE NOTICE 'TEST PASSED: User cannot delete other user time entry';
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
    DELETE FROM public.time_entries WHERE user_id IN (alice_id, bob_id);
    DELETE FROM public.categories WHERE user_id IN (alice_id, bob_id);
    DELETE FROM public.users WHERE id IN (alice_id, bob_id);
    DELETE FROM auth.users WHERE id IN (alice_id, bob_id);
    RESET ROLE;

    RAISE NOTICE 'Test cleanup complete';
END $$;
