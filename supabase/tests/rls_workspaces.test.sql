-- RLS Integration Tests for Workspace Tables
-- Run with: supabase test db
-- Tests verify Row Level Security policies for workspaces, workspace_members, and workspace_invites
-- Covers: workspace visibility, update/delete permissions, member management, owner protection, invites

-- =============================================================================
-- TEST SETUP: Create test users and workspace
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';  -- Owner
    bob_id uuid := '22222222-2222-2222-2222-222222222222';    -- Admin
    carol_id uuid := '33333333-3333-3333-3333-333333333333';  -- Member
    dave_id uuid := '44444444-4444-4444-4444-444444444444';   -- Non-member
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
BEGIN
    -- Clean up any existing test data
    SET LOCAL ROLE postgres;
    DELETE FROM public.workspace_invites WHERE workspace_id = test_workspace_id;
    DELETE FROM public.workspace_members WHERE workspace_id = test_workspace_id;
    DELETE FROM public.workspaces WHERE id = test_workspace_id;
    DELETE FROM public.users WHERE id IN (alice_id, bob_id, carol_id, dave_id);
    DELETE FROM auth.users WHERE id IN (alice_id, bob_id, carol_id, dave_id);
    RESET ROLE;

    -- Create Alice (workspace owner) in auth.users
    INSERT INTO auth.users (
        id, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, instance_id, aud, role
    ) VALUES (
        alice_id, 'alice@test.local', crypt('password123', gen_salt('bf')),
        now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
    );

    -- Create Bob (workspace admin) in auth.users
    INSERT INTO auth.users (
        id, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, instance_id, aud, role
    ) VALUES (
        bob_id, 'bob@test.local', crypt('password456', gen_salt('bf')),
        now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
    );

    -- Create Carol (workspace member) in auth.users
    INSERT INTO auth.users (
        id, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, instance_id, aud, role
    ) VALUES (
        carol_id, 'carol@test.local', crypt('password789', gen_salt('bf')),
        now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
    );

    -- Create Dave (non-member) in auth.users
    INSERT INTO auth.users (
        id, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, instance_id, aud, role
    ) VALUES (
        dave_id, 'dave@test.local', crypt('passwordabc', gen_salt('bf')),
        now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
    );

    -- Create corresponding public.users rows
    INSERT INTO public.users (id, email, name, timezone, week_start_day)
    VALUES
        (alice_id, 'alice@test.local', 'Alice Owner', 'America/New_York', 1),
        (bob_id, 'bob@test.local', 'Bob Admin', 'America/Los_Angeles', 0),
        (carol_id, 'carol@test.local', 'Carol Member', 'America/Chicago', 1),
        (dave_id, 'dave@test.local', 'Dave Outsider', 'America/Denver', 0);

    -- Create test workspace (bypass RLS)
    SET LOCAL ROLE postgres;
    INSERT INTO public.workspaces (id, name, slug, owner_id)
    VALUES (test_workspace_id, 'Test Workspace', 'test-workspace', alice_id);

    -- Add workspace members
    INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES
        (test_workspace_id, alice_id, 'owner'),
        (test_workspace_id, bob_id, 'admin'),
        (test_workspace_id, carol_id, 'member');
    RESET ROLE;

    RAISE NOTICE 'Test setup complete: Alice(owner), Bob(admin), Carol(member), Dave(non-member)';
END $$;

-- =============================================================================
-- TEST 1: Workspace members can read workspace
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    workspace_count int;
BEGIN
    -- Set auth context to Alice (owner)
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice should be able to read the workspace
    SELECT count(*) INTO workspace_count
    FROM public.workspaces
    WHERE id = test_workspace_id;

    IF workspace_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Workspace member cannot read workspace (found %)', workspace_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: Workspace members can read workspace';
END $$;

-- =============================================================================
-- TEST 2: Non-members cannot read workspace
-- =============================================================================

DO $$
DECLARE
    dave_id uuid := '44444444-4444-4444-4444-444444444444';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    workspace_count int;
BEGIN
    -- Set auth context to Dave (non-member)
    PERFORM set_config('request.jwt.claim.sub', dave_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', dave_id)::text, true);

    -- Dave should NOT be able to read the workspace
    SELECT count(*) INTO workspace_count
    FROM public.workspaces
    WHERE id = test_workspace_id;

    IF workspace_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Non-member can read workspace (found %)', workspace_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: Non-members cannot read workspace';
END $$;

-- =============================================================================
-- TEST 3: Owner can update workspace
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    updated_count int;
BEGIN
    -- Set auth context to Alice (owner)
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice should be able to update the workspace
    UPDATE public.workspaces
    SET name = 'Updated Test Workspace'
    WHERE id = test_workspace_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    IF updated_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Owner cannot update workspace (updated %)', updated_count;
    END IF;

    -- Revert change
    SET LOCAL ROLE postgres;
    UPDATE public.workspaces SET name = 'Test Workspace' WHERE id = test_workspace_id;
    RESET ROLE;

    RAISE NOTICE 'TEST PASSED: Owner can update workspace';
END $$;

-- =============================================================================
-- TEST 4: Admin can update workspace
-- =============================================================================

DO $$
DECLARE
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    updated_count int;
BEGIN
    -- Set auth context to Bob (admin)
    PERFORM set_config('request.jwt.claim.sub', bob_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', bob_id)::text, true);

    -- Bob should be able to update the workspace
    UPDATE public.workspaces
    SET name = 'Admin Updated Workspace'
    WHERE id = test_workspace_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    IF updated_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Admin cannot update workspace (updated %)', updated_count;
    END IF;

    -- Revert change
    SET LOCAL ROLE postgres;
    UPDATE public.workspaces SET name = 'Test Workspace' WHERE id = test_workspace_id;
    RESET ROLE;

    RAISE NOTICE 'TEST PASSED: Admin can update workspace';
END $$;

-- =============================================================================
-- TEST 5: Member cannot update workspace
-- =============================================================================

DO $$
DECLARE
    carol_id uuid := '33333333-3333-3333-3333-333333333333';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    updated_count int;
BEGIN
    -- Set auth context to Carol (member)
    PERFORM set_config('request.jwt.claim.sub', carol_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', carol_id)::text, true);

    -- Carol should NOT be able to update the workspace
    UPDATE public.workspaces
    SET name = 'Member Hacked Workspace'
    WHERE id = test_workspace_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    IF updated_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Member was able to update workspace';
    END IF;

    RAISE NOTICE 'TEST PASSED: Member cannot update workspace';
END $$;

-- =============================================================================
-- TEST 6: Owner can delete workspace
-- =============================================================================

DO $$
DECLARE
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    temp_workspace_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    deleted_count int;
BEGIN
    -- Create a temporary workspace for delete test (bypass RLS)
    SET LOCAL ROLE postgres;
    INSERT INTO public.workspaces (id, name, slug, owner_id)
    VALUES (temp_workspace_id, 'Temp Workspace', 'temp-workspace', alice_id);
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (temp_workspace_id, alice_id, 'owner');
    RESET ROLE;

    -- Set auth context to Alice (owner)
    PERFORM set_config('request.jwt.claim.sub', alice_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', alice_id)::text, true);

    -- Alice should be able to delete her workspace
    DELETE FROM public.workspaces WHERE id = temp_workspace_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    IF deleted_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Owner cannot delete workspace (deleted %)', deleted_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: Owner can delete workspace';
END $$;

-- =============================================================================
-- TEST 7: Admin cannot delete workspace
-- =============================================================================

DO $$
DECLARE
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    deleted_count int;
BEGIN
    -- Set auth context to Bob (admin)
    PERFORM set_config('request.jwt.claim.sub', bob_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', bob_id)::text, true);

    -- Bob should NOT be able to delete the workspace
    DELETE FROM public.workspaces WHERE id = test_workspace_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    IF deleted_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Admin was able to delete workspace';
    END IF;

    RAISE NOTICE 'TEST PASSED: Admin cannot delete workspace';
END $$;

-- =============================================================================
-- TEST 8: Admin can add members
-- =============================================================================

DO $$
DECLARE
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    dave_id uuid := '44444444-4444-4444-4444-444444444444';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    new_member_id uuid;
BEGIN
    -- Set auth context to Bob (admin)
    PERFORM set_config('request.jwt.claim.sub', bob_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', bob_id)::text, true);

    -- Bob should be able to add Dave as a member
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (test_workspace_id, dave_id, 'member')
    RETURNING user_id INTO new_member_id;

    IF new_member_id IS NULL THEN
        RAISE EXCEPTION 'TEST FAILED: Admin could not add member';
    END IF;

    -- Cleanup: Remove Dave
    SET LOCAL ROLE postgres;
    DELETE FROM public.workspace_members WHERE workspace_id = test_workspace_id AND user_id = dave_id;
    RESET ROLE;

    RAISE NOTICE 'TEST PASSED: Admin can add members';
END $$;

-- =============================================================================
-- TEST 9: Member cannot add members
-- =============================================================================

DO $$
DECLARE
    carol_id uuid := '33333333-3333-3333-3333-333333333333';
    dave_id uuid := '44444444-4444-4444-4444-444444444444';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
BEGIN
    -- Set auth context to Carol (member)
    PERFORM set_config('request.jwt.claim.sub', carol_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', carol_id)::text, true);

    -- Carol should NOT be able to add Dave as a member
    BEGIN
        INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES (test_workspace_id, dave_id, 'member');

        RAISE EXCEPTION 'TEST FAILED: Member was able to add new member';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'TEST PASSED: Member cannot add members';
        WHEN check_violation THEN
            RAISE NOTICE 'TEST PASSED: Member cannot add members (check violation)';
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%row-level security%' OR SQLERRM LIKE '%new row violates%' THEN
                RAISE NOTICE 'TEST PASSED: Member cannot add members (RLS violation)';
            ELSE
                RAISE;
            END IF;
    END;
END $$;

-- =============================================================================
-- TEST 10: Cannot remove owner from workspace
-- =============================================================================

DO $$
DECLARE
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    alice_id uuid := '11111111-1111-1111-1111-111111111111';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    deleted_count int;
BEGIN
    -- Set auth context to Bob (admin)
    PERFORM set_config('request.jwt.claim.sub', bob_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', bob_id)::text, true);

    -- Bob should NOT be able to remove Alice (owner) from the workspace
    DELETE FROM public.workspace_members
    WHERE workspace_id = test_workspace_id AND user_id = alice_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    IF deleted_count > 0 THEN
        -- Restore owner membership
        SET LOCAL ROLE postgres;
        INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES (test_workspace_id, alice_id, 'owner');
        RESET ROLE;

        RAISE EXCEPTION 'TEST FAILED: Admin was able to remove owner from workspace';
    END IF;

    RAISE NOTICE 'TEST PASSED: Cannot remove owner from workspace';
END $$;

-- =============================================================================
-- TEST 11: Admin can create invites
-- =============================================================================

DO $$
DECLARE
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    new_invite_id uuid;
    test_token_hash text := 'test_hash_' || extract(epoch from now())::text;
BEGIN
    -- Set auth context to Bob (admin)
    PERFORM set_config('request.jwt.claim.sub', bob_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', bob_id)::text, true);

    -- Bob should be able to create an invite
    INSERT INTO public.workspace_invites (
        workspace_id, invited_email, role, invited_by, token_hash, expires_at
    ) VALUES (
        test_workspace_id, 'newuser@test.local', 'member', bob_id, test_token_hash,
        now() + interval '7 days'
    )
    RETURNING id INTO new_invite_id;

    IF new_invite_id IS NULL THEN
        RAISE EXCEPTION 'TEST FAILED: Admin could not create invite';
    END IF;

    -- Cleanup
    SET LOCAL ROLE postgres;
    DELETE FROM public.workspace_invites WHERE id = new_invite_id;
    RESET ROLE;

    RAISE NOTICE 'TEST PASSED: Admin can create invites';
END $$;

-- =============================================================================
-- TEST 12: Member cannot create invites
-- =============================================================================

DO $$
DECLARE
    carol_id uuid := '33333333-3333-3333-3333-333333333333';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    test_token_hash text := 'test_hash_member_' || extract(epoch from now())::text;
BEGIN
    -- Set auth context to Carol (member)
    PERFORM set_config('request.jwt.claim.sub', carol_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', carol_id)::text, true);

    -- Carol should NOT be able to create an invite
    BEGIN
        INSERT INTO public.workspace_invites (
            workspace_id, invited_email, role, invited_by, token_hash, expires_at
        ) VALUES (
            test_workspace_id, 'hackeduser@test.local', 'member', carol_id, test_token_hash,
            now() + interval '7 days'
        );

        RAISE EXCEPTION 'TEST FAILED: Member was able to create invite';
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'TEST PASSED: Member cannot create invites';
        WHEN check_violation THEN
            RAISE NOTICE 'TEST PASSED: Member cannot create invites (check violation)';
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%row-level security%' OR SQLERRM LIKE '%new row violates%' THEN
                RAISE NOTICE 'TEST PASSED: Member cannot create invites (RLS violation)';
            ELSE
                RAISE;
            END IF;
    END;
END $$;

-- =============================================================================
-- TEST 13: Invite recipient can see their invite
-- =============================================================================

DO $$
DECLARE
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    dave_id uuid := '44444444-4444-4444-4444-444444444444';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    invite_id uuid;
    invite_count int;
    test_token_hash text := 'test_hash_recipient_' || extract(epoch from now())::text;
BEGIN
    -- Create an invite for Dave (bypass RLS)
    SET LOCAL ROLE postgres;
    INSERT INTO public.workspace_invites (
        workspace_id, invited_email, role, invited_by, token_hash, expires_at
    ) VALUES (
        test_workspace_id, 'dave@test.local', 'member', bob_id, test_token_hash,
        now() + interval '7 days'
    )
    RETURNING id INTO invite_id;
    RESET ROLE;

    -- Set auth context to Dave (the invitee)
    PERFORM set_config('request.jwt.claim.sub', dave_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', dave_id)::text, true);

    -- Dave should be able to see his invite
    SELECT count(*) INTO invite_count
    FROM public.workspace_invites
    WHERE id = invite_id;

    IF invite_count != 1 THEN
        SET LOCAL ROLE postgres;
        DELETE FROM public.workspace_invites WHERE id = invite_id;
        RESET ROLE;
        RAISE EXCEPTION 'TEST FAILED: Invite recipient cannot see their invite (found %)', invite_count;
    END IF;

    -- Cleanup
    SET LOCAL ROLE postgres;
    DELETE FROM public.workspace_invites WHERE id = invite_id;
    RESET ROLE;

    RAISE NOTICE 'TEST PASSED: Invite recipient can see their invite';
END $$;

-- =============================================================================
-- TEST 14: Other users cannot see invite
-- =============================================================================

DO $$
DECLARE
    bob_id uuid := '22222222-2222-2222-2222-222222222222';
    carol_id uuid := '33333333-3333-3333-3333-333333333333';
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    invite_id uuid;
    invite_count int;
    test_token_hash text := 'test_hash_other_' || extract(epoch from now())::text;
BEGIN
    -- Create an invite for a different email (bypass RLS)
    SET LOCAL ROLE postgres;
    INSERT INTO public.workspace_invites (
        workspace_id, invited_email, role, invited_by, token_hash, expires_at
    ) VALUES (
        test_workspace_id, 'stranger@test.local', 'member', bob_id, test_token_hash,
        now() + interval '7 days'
    )
    RETURNING id INTO invite_id;
    RESET ROLE;

    -- Set auth context to Carol (a member but NOT the invitee and NOT an admin)
    PERFORM set_config('request.jwt.claim.sub', carol_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', carol_id)::text, true);

    -- Carol should NOT be able to see this invite (she's a member, not admin, and not the invitee)
    SELECT count(*) INTO invite_count
    FROM public.workspace_invites
    WHERE id = invite_id;

    -- Cleanup first
    SET LOCAL ROLE postgres;
    DELETE FROM public.workspace_invites WHERE id = invite_id;
    RESET ROLE;

    IF invite_count > 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Non-admin, non-recipient can see invite (found %)', invite_count;
    END IF;

    RAISE NOTICE 'TEST PASSED: Other users cannot see invite';
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
    test_workspace_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
BEGIN
    SET LOCAL ROLE postgres;
    DELETE FROM public.workspace_invites WHERE workspace_id = test_workspace_id;
    DELETE FROM public.workspace_members WHERE workspace_id = test_workspace_id;
    DELETE FROM public.workspaces WHERE id = test_workspace_id;
    DELETE FROM public.users WHERE id IN (alice_id, bob_id, carol_id, dave_id);
    DELETE FROM auth.users WHERE id IN (alice_id, bob_id, carol_id, dave_id);
    RESET ROLE;

    RAISE NOTICE 'Test cleanup complete';
END $$;
