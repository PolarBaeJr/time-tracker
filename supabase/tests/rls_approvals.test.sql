-- RLS Integration Tests for Approval Workflow
-- Run with: supabase test db
-- Tests verify Row Level Security policies for approval_assignments and time entry approval

-- =============================================================================
-- TEST SETUP: Create test users, workspace, and approval assignments
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';  -- Workspace owner/admin
    bob_id uuid := '22222222-2222-2222-2222-222222222222';    -- Workspace admin (approver)
    carol_id uuid := '33333333-3333-3333-3333-333333333333';  -- Workspace member (submitter)
    dave_id uuid := '44444444-4444-4444-4444-444444444444';   -- Workspace member (different submitter)
    eve_id uuid := '55555555-5555-5555-5555-555555555555';    -- Non-workspace member
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    test_project_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
BEGIN
    -- Clean up any existing test data
    SET LOCAL ROLE postgres;
    DELETE FROM public.time_entries WHERE project_id = test_project_id;
    DELETE FROM public.approval_assignments WHERE workspace_id = test_workspace_id;
    DELETE FROM public.project_members WHERE project_id = test_project_id;
    DELETE FROM public.projects WHERE id = test_project_id;
    DELETE FROM public.workspace_members WHERE workspace_id = test_workspace_id;
    DELETE FROM public.workspaces WHERE id = test_workspace_id;
    DELETE FROM public.categories WHERE user_id IN (alice_id, bob_id, carol_id, dave_id, eve_id);
    DELETE FROM public.users WHERE id IN (alice_id, bob_id, carol_id, dave_id, eve_id);
    DELETE FROM auth.users WHERE id IN (alice_id, bob_id, carol_id, dave_id, eve_id);
    RESET ROLE;

    -- Create test users in auth.users
    INSERT INTO auth.users (
        id, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, instance_id, aud, role
    ) VALUES
        (alice_id, 'alice@test.local', crypt('password123', gen_salt('bf')),
         now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
        (bob_id, 'bob@test.local', crypt('password456', gen_salt('bf')),
         now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
        (carol_id, 'carol@test.local', crypt('password789', gen_salt('bf')),
         now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
        (dave_id, 'dave@test.local', crypt('passwordabc', gen_salt('bf')),
         now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
        (eve_id, 'eve@test.local', crypt('passworddef', gen_salt('bf')),
         now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

    -- Create corresponding public.users rows
    INSERT INTO public.users (id, email, name, timezone, week_start_day)
    VALUES
        (alice_id, 'alice@test.local', 'Alice Owner', 'America/New_York', 1),
        (bob_id, 'bob@test.local', 'Bob Approver', 'America/Los_Angeles', 0),
        (carol_id, 'carol@test.local', 'Carol Submitter', 'America/Chicago', 1),
        (dave_id, 'dave@test.local', 'Dave Submitter', 'America/Denver', 0),
        (eve_id, 'eve@test.local', 'Eve Outsider', 'America/Phoenix', 1);

    -- Create test workspace and members (bypass RLS)
    SET LOCAL ROLE postgres;
    INSERT INTO public.workspaces (id, name, slug, owner_id)
    VALUES (test_workspace_id, 'Test Workspace', 'test-workspace', alice_id);

    INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES
        (test_workspace_id, alice_id, 'owner'),
        (test_workspace_id, bob_id, 'admin'),
        (test_workspace_id, carol_id, 'member'),
        (test_workspace_id, dave_id, 'member');

    -- Create test project
    INSERT INTO public.projects (id, workspace_id, name, color, created_by)
    VALUES (test_project_id, test_workspace_id, 'Test Project', '#6366F1', alice_id);

    INSERT INTO public.project_members (project_id, user_id, role) VALUES
        (test_project_id, alice_id, 'owner'),
        (test_project_id, bob_id, 'admin'),
        (test_project_id, carol_id, 'member'),
        (test_project_id, dave_id, 'member');

    -- Create approval assignment: Bob approves Carol's entries
    INSERT INTO public.approval_assignments (workspace_id, member_user_id, approver_user_id, created_by)
    VALUES (test_workspace_id, carol_id, bob_id, alice_id);

    -- Create categories for time entries
    INSERT INTO public.categories (id, user_id, name, color, type) VALUES
        (gen_random_uuid(), carol_id, 'Carol Work', '#6366F1', 'work'),
        (gen_random_uuid(), dave_id, 'Dave Work', '#10B981', 'work');

    RESET ROLE;

    RAISE NOTICE 'Test setup complete: Alice(owner), Bob(approver), Carol(submitter→Bob), Dave(submitter, no approver), Eve(outsider)';
END $$;

-- =============================================================================
-- TEST 1: Workspace admin can create approval assignments
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    dave_id uuid := '44444444-4444-4444-4444-444444444444';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    new_assignment_id uuid;
BEGIN
    -- Set auth context to Alice (workspace owner/admin)
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice should be able to create an approval assignment for Dave
    INSERT INTO public.approval_assignments (workspace_id, member_user_id, approver_user_id, created_by)
    VALUES (test_workspace_id, dave_id, bob_id, alice_id)
    RETURNING id INTO new_assignment_id;

    IF new_assignment_id IS NULL THEN
        RAISE EXCEPTION 'TEST FAILED: Admin could not create approval assignment';
    END IF;

    -- Cleanup
    SET LOCAL ROLE postgres;
    DELETE FROM public.approval_assignments WHERE id = new_assignment_id;
    RESET ROLE;

    RAISE NOTICE 'TEST PASSED: Workspace admin can create approval assignments';
END $$;

-- =============================================================================
-- TEST 2: Workspace member cannot create approval assignments
-- =============================================================================

DO $$
DECLARE
    carol_id uuid := '33333333-3333-3333-3333-333333333333';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    dave_id uuid := '44444444-4444-4444-4444-444444444444';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
BEGIN
    -- Set auth context to Carol (workspace member, not admin)
    PERFORM set_config('request.jwt.claim.sub', carol_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', carol_id)::text, true);

    -- Carol should NOT be able to create an approval assignment
    BEGIN
        INSERT INTO public.approval_assignments (workspace_id, member_user_id, approver_user_id, created_by)
        VALUES (test_workspace_id, dave_id, bob_id, carol_id);

        RAISE EXCEPTION 'TEST FAILED: Member was able to create approval assignment';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'TEST PASSED: Workspace member cannot create approval assignments';
        WHEN check_violation THEN
            RAISE NOTICE 'TEST PASSED: Workspace member cannot create approval assignments (check violation)';
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%row-level security%' OR SQLERRM LIKE '%new row violates%' THEN
                RAISE NOTICE 'TEST PASSED: Workspace member cannot create approval assignments (RLS violation)';
            ELSE
                RAISE;
            END IF;
    END;
END $$;

-- =============================================================================
-- TEST 3: Workspace members can view approval assignments
-- =============================================================================

DO $$
DECLARE
    carol_id uuid := '33333333-3333-3333-3333-333333333333';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    assignment_count int;
BEGIN
    -- Set auth context to Carol (workspace member)
    PERFORM set_config('request.jwt.claim.sub', carol_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', carol_id)::text, true);

    -- Carol should be able to see approval assignments in her workspace
    SELECT count(*) INTO assignment_count
    FROM public.approval_assignments
    WHERE workspace_id = test_workspace_id;

    IF assignment_count < 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Workspace member cannot see approval assignments (found %)', assignment_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: Workspace members can view approval assignments';
END $$;

-- =============================================================================
-- TEST 4: Non-workspace member cannot view approval assignments
-- =============================================================================

DO $$
DECLARE
    eve_id uuid := '55555555-5555-5555-5555-555555555555';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    assignment_count int;
BEGIN
    -- Set auth context to Eve (not a workspace member)
    PERFORM set_config('request.jwt.claim.sub', eve_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', eve_id)::text, true);

    -- Eve should NOT be able to see approval assignments
    SELECT count(*) INTO assignment_count
    FROM public.approval_assignments
    WHERE workspace_id = test_workspace_id;

    IF assignment_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Non-member can see approval assignments (found %)', assignment_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: Non-workspace member cannot view approval assignments';
END $$;

-- =============================================================================
-- TEST 5: Self-approval is prevented by constraint
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    carol_id uuid := '33333333-3333-3333-3333-333333333333';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
BEGIN
    -- Set auth context to Alice (admin)
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Try to create a self-approval assignment (Carol approves Carol)
    BEGIN
        INSERT INTO public.approval_assignments (workspace_id, member_user_id, approver_user_id, created_by)
        VALUES (test_workspace_id, carol_id, carol_id, alice_id);

        RAISE EXCEPTION 'TEST FAILED: Self-approval assignment was allowed';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'TEST PASSED: Self-approval is prevented by constraint';
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%member_user_id%' OR SQLERRM LIKE '%approver_user_id%' OR SQLERRM LIKE '%check%' THEN
                RAISE NOTICE 'TEST PASSED: Self-approval is prevented by constraint';
            ELSE
                RAISE;
            END IF;
    END;
END $$;

-- =============================================================================
-- TEST 6: Approver can see submitted time entries
-- =============================================================================

DO $$
DECLARE
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    carol_id uuid := '33333333-3333-3333-3333-333333333333';
    test_project_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    carol_category_id uuid;
    test_entry_id uuid;
    entry_count int;
BEGIN
    -- Get Carol's category
    SET LOCAL ROLE postgres;
    SELECT id INTO carol_category_id FROM public.categories WHERE user_id = carol_id LIMIT 1;

    -- Create a submitted time entry for Carol with Bob as approver
    INSERT INTO public.time_entries (
        user_id, category_id, project_id, start_at, end_at, duration_seconds,
        approval_status, approver_id, submitted_at
    ) VALUES (
        carol_id, carol_category_id, test_project_id,
        now() - interval '2 hours', now() - interval '1 hour', 3600,
        'submitted', bob_id, now()
    )
    RETURNING id INTO test_entry_id;
    RESET ROLE;

    -- Set auth context to Bob (the approver)
    PERFORM set_config('request.jwt.claim.sub', bob_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', bob_id)::text, true);

    -- Bob should be able to see Carol's submitted entry
    SELECT count(*) INTO entry_count
    FROM public.time_entries
    WHERE id = test_entry_id;

    -- Cleanup
    SET LOCAL ROLE postgres;
    DELETE FROM public.time_entries WHERE id = test_entry_id;
    RESET ROLE;

    IF entry_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Approver cannot see submitted entries (found %)', entry_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: Approver can see submitted time entries';
END $$;

-- =============================================================================
-- TEST 7: Non-approver cannot see other user's submitted entries
-- =============================================================================

DO $$
DECLARE
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    carol_id uuid := '33333333-3333-3333-3333-333333333333';
    dave_id uuid := '44444444-4444-4444-4444-444444444444';
    test_project_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    carol_category_id uuid;
    test_entry_id uuid;
    entry_count int;
BEGIN
    -- Get Carol's category
    SET LOCAL ROLE postgres;
    SELECT id INTO carol_category_id FROM public.categories WHERE user_id = carol_id LIMIT 1;

    -- Create a submitted time entry for Carol with Bob as approver
    INSERT INTO public.time_entries (
        user_id, category_id, project_id, start_at, end_at, duration_seconds,
        approval_status, approver_id, submitted_at
    ) VALUES (
        carol_id, carol_category_id, test_project_id,
        now() - interval '3 hours', now() - interval '2 hours', 3600,
        'submitted', bob_id, now()
    )
    RETURNING id INTO test_entry_id;
    RESET ROLE;

    -- Set auth context to Dave (NOT the approver)
    PERFORM set_config('request.jwt.claim.sub', dave_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', dave_id)::text, true);

    -- Dave should NOT be able to see Carol's submitted entry
    SELECT count(*) INTO entry_count
    FROM public.time_entries
    WHERE id = test_entry_id;

    -- Cleanup
    SET LOCAL ROLE postgres;
    DELETE FROM public.time_entries WHERE id = test_entry_id;
    RESET ROLE;

    IF entry_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Non-approver can see other user entries (found %)', entry_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: Non-approver cannot see other user submitted entries';
END $$;

-- =============================================================================
-- TEST 8: Approver can update approval status
-- =============================================================================

DO $$
DECLARE
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    carol_id uuid := '33333333-3333-3333-3333-333333333333';
    test_project_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    carol_category_id uuid;
    test_entry_id uuid;
    updated_count int;
BEGIN
    -- Get Carol's category
    SET LOCAL ROLE postgres;
    SELECT id INTO carol_category_id FROM public.categories WHERE user_id = carol_id LIMIT 1;

    -- Create a submitted time entry for Carol with Bob as approver
    INSERT INTO public.time_entries (
        user_id, category_id, project_id, start_at, end_at, duration_seconds,
        approval_status, approver_id, submitted_at
    ) VALUES (
        carol_id, carol_category_id, test_project_id,
        now() - interval '4 hours', now() - interval '3 hours', 3600,
        'submitted', bob_id, now()
    )
    RETURNING id INTO test_entry_id;
    RESET ROLE;

    -- Set auth context to Bob (the approver)
    PERFORM set_config('request.jwt.claim.sub', bob_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', bob_id)::text, true);

    -- Bob should be able to approve the entry
    UPDATE public.time_entries
    SET approval_status = 'approved',
        approved_at = now(),
        approval_note = 'Looks good!'
    WHERE id = test_entry_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    -- Cleanup
    SET LOCAL ROLE postgres;
    DELETE FROM public.time_entries WHERE id = test_entry_id;
    RESET ROLE;

    IF updated_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Approver cannot update approval status (updated %)', updated_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: Approver can update approval status';
END $$;

-- =============================================================================
-- TEST 9: Entry owner can see their own submitted entry
-- =============================================================================

DO $$
DECLARE
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    carol_id uuid := '33333333-3333-3333-3333-333333333333';
    test_project_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    carol_category_id uuid;
    test_entry_id uuid;
    entry_count int;
BEGIN
    -- Get Carol's category
    SET LOCAL ROLE postgres;
    SELECT id INTO carol_category_id FROM public.categories WHERE user_id = carol_id LIMIT 1;

    -- Create a submitted time entry for Carol
    INSERT INTO public.time_entries (
        user_id, category_id, project_id, start_at, end_at, duration_seconds,
        approval_status, approver_id, submitted_at
    ) VALUES (
        carol_id, carol_category_id, test_project_id,
        now() - interval '5 hours', now() - interval '4 hours', 3600,
        'submitted', bob_id, now()
    )
    RETURNING id INTO test_entry_id;
    RESET ROLE;

    -- Set auth context to Carol (the entry owner)
    PERFORM set_config('request.jwt.claim.sub', carol_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', carol_id)::text, true);

    -- Carol should be able to see her own submitted entry
    SELECT count(*) INTO entry_count
    FROM public.time_entries
    WHERE id = test_entry_id;

    -- Cleanup
    SET LOCAL ROLE postgres;
    DELETE FROM public.time_entries WHERE id = test_entry_id;
    RESET ROLE;

    IF entry_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Entry owner cannot see own submitted entry (found %)', entry_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: Entry owner can see their own submitted entry';
END $$;

-- =============================================================================
-- TEST 10: Admin can delete approval assignments
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    dave_id uuid := '44444444-4444-4444-4444-444444444444';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    temp_assignment_id uuid;
    deleted_count int;
BEGIN
    -- Create a temporary assignment
    SET LOCAL ROLE postgres;
    INSERT INTO public.approval_assignments (workspace_id, member_user_id, approver_user_id, created_by)
    VALUES (test_workspace_id, dave_id, bob_id, alice_id)
    RETURNING id INTO temp_assignment_id;
    RESET ROLE;

    -- Set auth context to Alice (admin)
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice should be able to delete the assignment
    DELETE FROM public.approval_assignments WHERE id = temp_assignment_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    IF deleted_count != 1 THEN
        SET LOCAL ROLE postgres;
        DELETE FROM public.approval_assignments WHERE id = temp_assignment_id;
        RESET ROLE;
        RAISE EXCEPTION 'TEST FAILED: Admin cannot delete approval assignment (deleted %)', deleted_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: Admin can delete approval assignments';
END $$;

-- =============================================================================
-- TEST 11: Member cannot delete approval assignments
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    carol_id uuid := '33333333-3333-3333-3333-333333333333';
    dave_id uuid := '44444444-4444-4444-4444-444444444444';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    temp_assignment_id uuid;
    deleted_count int;
BEGIN
    -- Create a temporary assignment
    SET LOCAL ROLE postgres;
    INSERT INTO public.approval_assignments (workspace_id, member_user_id, approver_user_id, created_by)
    VALUES (test_workspace_id, dave_id, bob_id, alice_id)
    RETURNING id INTO temp_assignment_id;
    RESET ROLE;

    -- Set auth context to Carol (member, not admin)
    PERFORM set_config('request.jwt.claim.sub', carol_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', carol_id)::text, true);

    -- Carol should NOT be able to delete the assignment
    DELETE FROM public.approval_assignments WHERE id = temp_assignment_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Cleanup
    SET LOCAL ROLE postgres;
    DELETE FROM public.approval_assignments WHERE id = temp_assignment_id;
    RESET ROLE;

    IF deleted_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Member was able to delete approval assignment';
    END IF;

    RAISE NOTICE 'TEST PASSED: Member cannot delete approval assignments';
END $$;

-- =============================================================================
-- TEST CLEANUP
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    carol_id uuid := '33333333-3333-3333-3333-333333333333';
    dave_id uuid := '44444444-4444-4444-4444-444444444444';
    eve_id uuid := '55555555-5555-5555-5555-555555555555';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    test_project_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
BEGIN
    SET LOCAL ROLE postgres;
    DELETE FROM public.time_entries WHERE project_id = test_project_id;
    DELETE FROM public.approval_assignments WHERE workspace_id = test_workspace_id;
    DELETE FROM public.project_members WHERE project_id = test_project_id;
    DELETE FROM public.projects WHERE id = test_project_id;
    DELETE FROM public.workspace_members WHERE workspace_id = test_workspace_id;
    DELETE FROM public.workspaces WHERE id = test_workspace_id;
    DELETE FROM public.categories WHERE user_id IN (alice_id, bob_id, carol_id, dave_id, eve_id);
    DELETE FROM public.users WHERE id IN (alice_id, bob_id, carol_id, dave_id, eve_id);
    DELETE FROM auth.users WHERE id IN (alice_id, bob_id, carol_id, dave_id, eve_id);
    RESET ROLE;

    RAISE NOTICE 'Test cleanup complete';
END $$;
