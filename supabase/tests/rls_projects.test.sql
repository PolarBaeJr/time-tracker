-- RLS Integration Tests for Projects and Project Members Tables
-- Run with: supabase test db
-- Tests verify Row Level Security policies for projects and project_members

-- =============================================================================
-- TEST SETUP: Create test users, workspace, and projects
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';  -- Workspace owner
    bob_id uuid := '22222222-2222-2222-2222-222222222222';    -- Workspace admin, project creator
    carol_id uuid := '33333333-3333-3333-3333-333333333333';  -- Workspace member, project member
    dave_id uuid := '44444444-4444-4444-4444-444444444444';   -- Workspace member, not in project
    eve_id uuid := '55555555-5555-5555-5555-555555555555';    -- Non-workspace member
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    test_project_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
BEGIN
    -- Clean up any existing test data
    SET LOCAL ROLE postgres;
    DELETE FROM public.time_entries WHERE project_id = test_project_id;
    DELETE FROM public.project_members WHERE project_id = test_project_id;
    DELETE FROM public.projects WHERE id = test_project_id;
    DELETE FROM public.workspace_members WHERE workspace_id = test_workspace_id;
    DELETE FROM public.workspaces WHERE id = test_workspace_id;
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
        (bob_id, 'bob@test.local', 'Bob Admin', 'America/Los_Angeles', 0),
        (carol_id, 'carol@test.local', 'Carol Member', 'America/Chicago', 1),
        (dave_id, 'dave@test.local', 'Dave Member', 'America/Denver', 0),
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
    -- Eve is NOT a workspace member

    -- Create test project
    INSERT INTO public.projects (id, workspace_id, name, color, created_by)
    VALUES (test_project_id, test_workspace_id, 'Test Project', '#6366F1', bob_id);

    -- Add project members
    INSERT INTO public.project_members (project_id, user_id, role) VALUES
        (test_project_id, bob_id, 'owner'),  -- Project creator
        (test_project_id, carol_id, 'member');
    -- Dave is workspace member but NOT project member

    RESET ROLE;

    RAISE NOTICE 'Test setup complete: Alice(ws owner), Bob(ws admin/project creator), Carol(project member), Dave(ws member only), Eve(outsider)';
END $$;

-- =============================================================================
-- TEST 1: Project member can see project
-- =============================================================================

DO $$
DECLARE
    carol_id uuid := '33333333-3333-3333-3333-333333333333';
    test_project_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    project_count int;
BEGIN
    -- Set auth context to Carol (project member)
    PERFORM set_config('request.jwt.claim.sub', carol_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', carol_id)::text, true);

    -- Carol should be able to see the project
    SELECT count(*) INTO project_count
    FROM public.projects
    WHERE id = test_project_id;

    IF project_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Project member cannot see project (found %)', project_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: Project member can see project';
END $$;

-- =============================================================================
-- TEST 2: Workspace admin can see project (even if not project member)
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    test_project_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    project_count int;
BEGIN
    -- Set auth context to Alice (workspace owner, not project member)
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice (workspace admin) should be able to see the project
    SELECT count(*) INTO project_count
    FROM public.projects
    WHERE id = test_project_id;

    IF project_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Workspace admin cannot see project (found %)', project_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: Workspace admin can see project';
END $$;

-- =============================================================================
-- TEST 3: Workspace member (non-project member) cannot see project
-- =============================================================================

DO $$
DECLARE
    dave_id uuid := '44444444-4444-4444-4444-444444444444';
    test_project_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    project_count int;
BEGIN
    -- Set auth context to Dave (workspace member, not project member, not admin)
    PERFORM set_config('request.jwt.claim.sub', dave_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', dave_id)::text, true);

    -- Dave should NOT be able to see the project (not a project member and not admin)
    SELECT count(*) INTO project_count
    FROM public.projects
    WHERE id = test_project_id;

    IF project_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Non-project member can see project (found %)', project_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: Workspace member (non-project member) cannot see project';
END $$;

-- =============================================================================
-- TEST 4: Non-workspace member cannot see project
-- =============================================================================

DO $$
DECLARE
    eve_id uuid := '55555555-5555-5555-5555-555555555555';
    test_project_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    project_count int;
BEGIN
    -- Set auth context to Eve (not a workspace member)
    PERFORM set_config('request.jwt.claim.sub', eve_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', eve_id)::text, true);

    -- Eve should NOT be able to see the project
    SELECT count(*) INTO project_count
    FROM public.projects
    WHERE id = test_project_id;

    IF project_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Non-workspace member can see project (found %)', project_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: Non-workspace member cannot see project';
END $$;

-- =============================================================================
-- TEST 5: Project creator can update project
-- =============================================================================

DO $$
DECLARE
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    test_project_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    updated_count int;
BEGIN
    -- Set auth context to Bob (project creator)
    PERFORM set_config('request.jwt.claim.sub', bob_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', bob_id)::text, true);

    -- Bob should be able to update the project
    UPDATE public.projects
    SET name = 'Updated Project Name'
    WHERE id = test_project_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    IF updated_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Project creator cannot update project (updated %)', updated_count;
    END IF;

    -- Revert change
    SET LOCAL ROLE postgres;
    UPDATE public.projects SET name = 'Test Project' WHERE id = test_project_id;
    RESET ROLE;

    RAISE NOTICE 'TEST PASSED: Project creator can update project';
END $$;

-- =============================================================================
-- TEST 6: Workspace admin can update project
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    test_project_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    updated_count int;
BEGIN
    -- Set auth context to Alice (workspace owner)
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice (workspace admin) should be able to update the project
    UPDATE public.projects
    SET name = 'Admin Updated Name'
    WHERE id = test_project_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    IF updated_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Workspace admin cannot update project (updated %)', updated_count;
    END IF;

    -- Revert change
    SET LOCAL ROLE postgres;
    UPDATE public.projects SET name = 'Test Project' WHERE id = test_project_id;
    RESET ROLE;

    RAISE NOTICE 'TEST PASSED: Workspace admin can update project';
END $$;

-- =============================================================================
-- TEST 7: Project member cannot update project
-- =============================================================================

DO $$
DECLARE
    carol_id uuid := '33333333-3333-3333-3333-333333333333';
    test_project_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    updated_count int;
BEGIN
    -- Set auth context to Carol (project member, not creator)
    PERFORM set_config('request.jwt.claim.sub', carol_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', carol_id)::text, true);

    -- Carol should NOT be able to update the project
    UPDATE public.projects
    SET name = 'Member Hacked Name'
    WHERE id = test_project_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    IF updated_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Project member was able to update project';
    END IF;

    RAISE NOTICE 'TEST PASSED: Project member cannot update project';
END $$;

-- =============================================================================
-- TEST 8: Project creator can delete project
-- =============================================================================

DO $$
DECLARE
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    temp_project_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    deleted_count int;
BEGIN
    -- Create a temporary project for delete test
    SET LOCAL ROLE postgres;
    INSERT INTO public.projects (id, workspace_id, name, color, created_by)
    VALUES (temp_project_id, test_workspace_id, 'Temp Project', '#EF4444', bob_id);
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (temp_project_id, bob_id, 'owner');
    RESET ROLE;

    -- Set auth context to Bob (project creator)
    PERFORM set_config('request.jwt.claim.sub', bob_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', bob_id)::text, true);

    -- Bob should be able to delete the project
    DELETE FROM public.projects WHERE id = temp_project_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    IF deleted_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Project creator cannot delete project (deleted %)', deleted_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: Project creator can delete project';
END $$;

-- =============================================================================
-- TEST 9: Project member cannot delete project
-- =============================================================================

DO $$
DECLARE
    carol_id uuid := '33333333-3333-3333-3333-333333333333';
    test_project_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    deleted_count int;
BEGIN
    -- Set auth context to Carol (project member, not creator)
    PERFORM set_config('request.jwt.claim.sub', carol_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', carol_id)::text, true);

    -- Carol should NOT be able to delete the project
    DELETE FROM public.projects WHERE id = test_project_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    IF deleted_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Project member was able to delete project';
    END IF;

    RAISE NOTICE 'TEST PASSED: Project member cannot delete project';
END $$;

-- =============================================================================
-- TEST 10: Project creator can add project members
-- =============================================================================

DO $$
DECLARE
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    dave_id uuid := '44444444-4444-4444-4444-444444444444';
    test_project_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    new_member_id uuid;
BEGIN
    -- Set auth context to Bob (project creator)
    PERFORM set_config('request.jwt.claim.sub', bob_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', bob_id)::text, true);

    -- Bob should be able to add Dave as a project member
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (test_project_id, dave_id, 'member')
    RETURNING user_id INTO new_member_id;

    IF new_member_id IS NULL THEN
        RAISE EXCEPTION 'TEST FAILED: Project creator could not add project member';
    END IF;

    -- Cleanup: Remove Dave
    SET LOCAL ROLE postgres;
    DELETE FROM public.project_members WHERE project_id = test_project_id AND user_id = dave_id;
    RESET ROLE;

    RAISE NOTICE 'TEST PASSED: Project creator can add project members';
END $$;

-- =============================================================================
-- TEST 11: Project member cannot add project members
-- =============================================================================

DO $$
DECLARE
    carol_id uuid := '33333333-3333-3333-3333-333333333333';
    dave_id uuid := '44444444-4444-4444-4444-444444444444';
    test_project_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
BEGIN
    -- Set auth context to Carol (project member, not creator)
    PERFORM set_config('request.jwt.claim.sub', carol_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', carol_id)::text, true);

    -- Carol should NOT be able to add Dave as a project member
    BEGIN
        INSERT INTO public.project_members (project_id, user_id, role)
        VALUES (test_project_id, dave_id, 'member');

        RAISE EXCEPTION 'TEST FAILED: Project member was able to add project member';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'TEST PASSED: Project member cannot add project members';
        WHEN check_violation THEN
            RAISE NOTICE 'TEST PASSED: Project member cannot add project members (check violation)';
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%row-level security%' OR SQLERRM LIKE '%new row violates%' THEN
                RAISE NOTICE 'TEST PASSED: Project member cannot add project members (RLS violation)';
            ELSE
                RAISE;
            END IF;
    END;
END $$;

-- =============================================================================
-- TEST 12: Workspace member can create project
-- =============================================================================

DO $$
DECLARE
    dave_id uuid := '44444444-4444-4444-4444-444444444444';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    new_project_id uuid;
BEGIN
    -- Set auth context to Dave (workspace member)
    PERFORM set_config('request.jwt.claim.sub', dave_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', dave_id)::text, true);

    -- Dave should be able to create a project in the workspace
    INSERT INTO public.projects (workspace_id, name, color, created_by)
    VALUES (test_workspace_id, 'Dave Project', '#10B981', dave_id)
    RETURNING id INTO new_project_id;

    IF new_project_id IS NULL THEN
        RAISE EXCEPTION 'TEST FAILED: Workspace member could not create project';
    END IF;

    -- Cleanup
    SET LOCAL ROLE postgres;
    DELETE FROM public.projects WHERE id = new_project_id;
    RESET ROLE;

    RAISE NOTICE 'TEST PASSED: Workspace member can create project';
END $$;

-- =============================================================================
-- TEST 13: Non-workspace member cannot create project
-- =============================================================================

DO $$
DECLARE
    eve_id uuid := '55555555-5555-5555-5555-555555555555';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
BEGIN
    -- Set auth context to Eve (not a workspace member)
    PERFORM set_config('request.jwt.claim.sub', eve_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', eve_id)::text, true);

    -- Eve should NOT be able to create a project
    BEGIN
        INSERT INTO public.projects (workspace_id, name, color, created_by)
        VALUES (test_workspace_id, 'Eve Hacked Project', '#EF4444', eve_id);

        RAISE EXCEPTION 'TEST FAILED: Non-workspace member was able to create project';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'TEST PASSED: Non-workspace member cannot create project';
        WHEN check_violation THEN
            RAISE NOTICE 'TEST PASSED: Non-workspace member cannot create project (check violation)';
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%row-level security%' OR SQLERRM LIKE '%new row violates%' THEN
                RAISE NOTICE 'TEST PASSED: Non-workspace member cannot create project (RLS violation)';
            ELSE
                RAISE;
            END IF;
    END;
END $$;

-- =============================================================================
-- TEST 14: Time entry with project_id visible to approver
-- =============================================================================

DO $$
DECLARE
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    carol_id uuid := '33333333-3333-3333-3333-333333333333';
    test_project_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    test_entry_id uuid;
    entry_count int;
    alice_category_id uuid;
BEGIN
    -- Create a category for Carol
    SET LOCAL ROLE postgres;
    INSERT INTO public.categories (id, user_id, name, color, type)
    VALUES (gen_random_uuid(), carol_id, 'Carol Work', '#6366F1', 'work')
    RETURNING id INTO alice_category_id;

    -- Create a time entry for Carol with project_id and submitted status, Bob as approver
    INSERT INTO public.time_entries (
        user_id, category_id, project_id, start_at, end_at, duration_seconds,
        approval_status, approver_id, submitted_at
    ) VALUES (
        carol_id, alice_category_id, test_project_id,
        now() - interval '2 hours', now() - interval '1 hour', 3600,
        'submitted', bob_id, now()
    )
    RETURNING id INTO test_entry_id;
    RESET ROLE;

    -- Set auth context to Bob (the approver)
    PERFORM set_config('request.jwt.claim.sub', bob_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', bob_id)::text, true);

    -- Bob should be able to see Carol's submitted entry (he's the approver)
    SELECT count(*) INTO entry_count
    FROM public.time_entries
    WHERE id = test_entry_id;

    -- Cleanup
    SET LOCAL ROLE postgres;
    DELETE FROM public.time_entries WHERE id = test_entry_id;
    DELETE FROM public.categories WHERE id = alice_category_id;
    RESET ROLE;

    IF entry_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Approver cannot see submitted time entry (found %)', entry_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: Time entry with project_id visible to approver';
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
    DELETE FROM public.project_members WHERE project_id = test_project_id;
    DELETE FROM public.projects WHERE workspace_id = test_workspace_id;
    DELETE FROM public.workspace_members WHERE workspace_id = test_workspace_id;
    DELETE FROM public.workspaces WHERE id = test_workspace_id;
    DELETE FROM public.categories WHERE user_id IN (alice_id, bob_id, carol_id, dave_id, eve_id);
    DELETE FROM public.users WHERE id IN (alice_id, bob_id, carol_id, dave_id, eve_id);
    DELETE FROM auth.users WHERE id IN (alice_id, bob_id, carol_id, dave_id, eve_id);
    RESET ROLE;

    RAISE NOTICE 'Test cleanup complete';
END $$;
