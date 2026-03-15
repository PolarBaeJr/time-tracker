-- Migration: Activity Feed Triggers
-- Creates triggers to automatically emit activity feed events
-- All trigger functions use SECURITY DEFINER to bypass RLS when inserting

-- =============================================================================
-- HELPER FUNCTION TO GET WORKSPACE ID FROM PROJECT
-- =============================================================================

-- Helper to get workspace_id from project (already exists in RLS migration, but redeclare for safety)
CREATE OR REPLACE FUNCTION get_workspace_id_from_project(proj_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT workspace_id FROM public.projects WHERE id = proj_id;
$$;

COMMENT ON FUNCTION get_workspace_id_from_project(uuid) IS
    'Returns the workspace_id for a given project ID';

-- =============================================================================
-- TIME ENTRIES ACTIVITY TRIGGERS
-- =============================================================================

-- Trigger function for time_entries INSERT
-- Emits 'entry_logged' when a new entry is linked to a project
CREATE OR REPLACE FUNCTION emit_time_entry_logged()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_workspace_id uuid;
    v_project_name text;
    v_category_name text;
BEGIN
    -- Only emit if entry is linked to a project
    IF NEW.project_id IS NOT NULL THEN
        -- Get workspace from project
        SELECT p.workspace_id, p.name INTO v_workspace_id, v_project_name
        FROM public.projects p
        WHERE p.id = NEW.project_id;

        -- Get category name if set
        IF NEW.category_id IS NOT NULL THEN
            SELECT name INTO v_category_name
            FROM public.categories
            WHERE id = NEW.category_id;
        END IF;

        -- Insert activity event
        INSERT INTO public.activity_feed (
            workspace_id,
            actor_user_id,
            event_type,
            payload
        ) VALUES (
            v_workspace_id,
            NEW.user_id,
            'entry_logged',
            jsonb_build_object(
                'time_entry_id', NEW.id,
                'project_id', NEW.project_id,
                'project_name', v_project_name,
                'category_name', v_category_name,
                'duration_seconds', NEW.duration_seconds,
                'notes', LEFT(NEW.notes, 100) -- Truncate for preview
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION emit_time_entry_logged() IS
    'Emits entry_logged event when time entry is created with project_id';

CREATE TRIGGER trigger_time_entries_activity_insert
    AFTER INSERT ON public.time_entries
    FOR EACH ROW
    EXECUTE FUNCTION emit_time_entry_logged();

-- Trigger function for time_entries UPDATE (approval status changes)
-- Emits 'entry_approved' or 'entry_rejected' when status changes
CREATE OR REPLACE FUNCTION emit_time_entry_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_workspace_id uuid;
    v_project_name text;
    v_entry_owner_name text;
    v_event_type activity_event_type;
BEGIN
    -- Only process if this is a project entry and approval_status changed
    IF NEW.project_id IS NOT NULL AND OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
        -- Get workspace and project info
        SELECT p.workspace_id, p.name INTO v_workspace_id, v_project_name
        FROM public.projects p
        WHERE p.id = NEW.project_id;

        -- Get entry owner name
        SELECT name INTO v_entry_owner_name
        FROM public.users
        WHERE id = NEW.user_id;

        -- Check for approval/rejection
        IF NEW.approval_status = 'approved' AND OLD.approval_status = 'submitted' THEN
            v_event_type := 'entry_approved';
        ELSIF NEW.approval_status = 'rejected' AND OLD.approval_status = 'submitted' THEN
            v_event_type := 'entry_rejected';
        ELSE
            -- Not an approval action, skip
            RETURN NEW;
        END IF;

        -- Insert activity event (actor is approver)
        INSERT INTO public.activity_feed (
            workspace_id,
            actor_user_id,
            event_type,
            payload
        ) VALUES (
            v_workspace_id,
            NEW.approver_id, -- The approver is the actor
            v_event_type,
            jsonb_build_object(
                'time_entry_id', NEW.id,
                'entry_owner_id', NEW.user_id,
                'entry_owner_name', v_entry_owner_name,
                'project_id', NEW.project_id,
                'project_name', v_project_name,
                'duration_seconds', NEW.duration_seconds,
                'approval_note', NEW.approval_note
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION emit_time_entry_approval() IS
    'Emits entry_approved/entry_rejected events when approval status changes';

CREATE TRIGGER trigger_time_entries_activity_approval
    AFTER UPDATE ON public.time_entries
    FOR EACH ROW
    EXECUTE FUNCTION emit_time_entry_approval();

-- =============================================================================
-- ACTIVE TIMERS ACTIVITY TRIGGERS
-- =============================================================================

-- Note: Active timers don't have project_id column yet, so we check via category
-- If a future migration adds project_id to active_timers, update this trigger

-- For now, timer_started/timer_stopped events are skipped since active_timers
-- doesn't have workspace association. These events can be added when:
-- 1. active_timers gets a project_id column, OR
-- 2. We infer workspace from the category (if categories get workspace_id)

-- Placeholder comment for future implementation:
/*
CREATE OR REPLACE FUNCTION emit_timer_started()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- Implementation when active_timers has project_id
$$;

CREATE OR REPLACE FUNCTION emit_timer_stopped()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- Implementation when active_timers has project_id
$$;
*/

-- =============================================================================
-- WORKSPACE MEMBERS ACTIVITY TRIGGERS
-- =============================================================================

-- Trigger function for workspace_members INSERT
-- Emits 'member_joined' when a new member is added
CREATE OR REPLACE FUNCTION emit_member_joined()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_name text;
BEGIN
    -- Get the new member's name
    SELECT name INTO v_user_name
    FROM public.users
    WHERE id = NEW.user_id;

    -- Insert activity event (actor is the new member)
    INSERT INTO public.activity_feed (
        workspace_id,
        actor_user_id,
        event_type,
        payload
    ) VALUES (
        NEW.workspace_id,
        NEW.user_id,
        'member_joined',
        jsonb_build_object(
            'member_id', NEW.user_id,
            'member_name', v_user_name,
            'role', NEW.role::text
        )
    );

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION emit_member_joined() IS
    'Emits member_joined event when a new workspace member is added';

CREATE TRIGGER trigger_workspace_members_activity_insert
    AFTER INSERT ON public.workspace_members
    FOR EACH ROW
    EXECUTE FUNCTION emit_member_joined();

-- Trigger function for workspace_members UPDATE (role changes)
-- Emits 'member_role_changed' when role is updated
CREATE OR REPLACE FUNCTION emit_member_role_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_name text;
BEGIN
    -- Only emit if role actually changed
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        -- Get the member's name
        SELECT name INTO v_user_name
        FROM public.users
        WHERE id = NEW.user_id;

        -- Insert activity event (actor is the member whose role changed)
        -- Note: We could also make the admin who changed the role the actor,
        -- but we don't have that info in the trigger context
        INSERT INTO public.activity_feed (
            workspace_id,
            actor_user_id,
            event_type,
            payload
        ) VALUES (
            NEW.workspace_id,
            NEW.user_id,
            'member_role_changed',
            jsonb_build_object(
                'member_id', NEW.user_id,
                'member_name', v_user_name,
                'old_role', OLD.role::text,
                'new_role', NEW.role::text
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION emit_member_role_changed() IS
    'Emits member_role_changed event when a workspace member role is updated';

CREATE TRIGGER trigger_workspace_members_activity_update
    AFTER UPDATE ON public.workspace_members
    FOR EACH ROW
    EXECUTE FUNCTION emit_member_role_changed();

-- Trigger function for workspace_members DELETE
-- Emits 'member_left' when a member is removed
CREATE OR REPLACE FUNCTION emit_member_left()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_name text;
BEGIN
    -- Get the leaving member's name
    SELECT name INTO v_user_name
    FROM public.users
    WHERE id = OLD.user_id;

    -- Insert activity event (actor is the member who left)
    INSERT INTO public.activity_feed (
        workspace_id,
        actor_user_id,
        event_type,
        payload
    ) VALUES (
        OLD.workspace_id,
        OLD.user_id,
        'member_left',
        jsonb_build_object(
            'member_id', OLD.user_id,
            'member_name', v_user_name,
            'role', OLD.role::text
        )
    );

    RETURN OLD;
END;
$$;

COMMENT ON FUNCTION emit_member_left() IS
    'Emits member_left event when a workspace member is removed';

CREATE TRIGGER trigger_workspace_members_activity_delete
    AFTER DELETE ON public.workspace_members
    FOR EACH ROW
    EXECUTE FUNCTION emit_member_left();

-- =============================================================================
-- PROJECTS ACTIVITY TRIGGERS
-- =============================================================================

-- Trigger function for projects INSERT
-- Emits 'project_created' when a new project is created
CREATE OR REPLACE FUNCTION emit_project_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insert activity event
    INSERT INTO public.activity_feed (
        workspace_id,
        actor_user_id,
        event_type,
        payload
    ) VALUES (
        NEW.workspace_id,
        NEW.created_by,
        'project_created',
        jsonb_build_object(
            'project_id', NEW.id,
            'project_name', NEW.name,
            'project_color', NEW.color,
            'description', LEFT(NEW.description, 100) -- Truncate for preview
        )
    );

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION emit_project_created() IS
    'Emits project_created event when a new project is created';

CREATE TRIGGER trigger_projects_activity_insert
    AFTER INSERT ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION emit_project_created();

-- =============================================================================
-- PROJECT MEMBERS ACTIVITY TRIGGERS
-- =============================================================================

-- Trigger function for project_members INSERT
-- Emits 'project_member_added' when a new project member is added
CREATE OR REPLACE FUNCTION emit_project_member_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_workspace_id uuid;
    v_project_name text;
    v_user_name text;
BEGIN
    -- Get project and workspace info
    SELECT p.workspace_id, p.name INTO v_workspace_id, v_project_name
    FROM public.projects p
    WHERE p.id = NEW.project_id;

    -- Get the new member's name
    SELECT name INTO v_user_name
    FROM public.users
    WHERE id = NEW.user_id;

    -- Insert activity event (actor is the new member)
    INSERT INTO public.activity_feed (
        workspace_id,
        actor_user_id,
        event_type,
        payload
    ) VALUES (
        v_workspace_id,
        NEW.user_id,
        'project_member_added',
        jsonb_build_object(
            'project_id', NEW.project_id,
            'project_name', v_project_name,
            'member_id', NEW.user_id,
            'member_name', v_user_name,
            'role', NEW.role::text
        )
    );

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION emit_project_member_added() IS
    'Emits project_member_added event when a new project member is added';

CREATE TRIGGER trigger_project_members_activity_insert
    AFTER INSERT ON public.project_members
    FOR EACH ROW
    EXECUTE FUNCTION emit_project_member_added();

-- =============================================================================
-- MONTHLY GOALS ACTIVITY TRIGGERS
-- =============================================================================

-- Note: Monthly goals don't have workspace_id column
-- Goal events (goal_created, goal_completed) are workspace-scoped
-- These can be implemented when:
-- 1. Monthly goals get a workspace_id column, OR
-- 2. We create workspace-level goals as a separate table

-- Placeholder for future implementation:
/*
CREATE OR REPLACE FUNCTION emit_goal_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- Implementation when monthly_goals has workspace_id
$$;

CREATE OR REPLACE FUNCTION emit_goal_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- Implementation when monthly_goals has workspace_id
-- Would check if target_hours is met by summing entries
$$;
*/

-- =============================================================================
-- SECURITY NOTES
-- =============================================================================

/*
ACTIVITY FEED TRIGGER SECURITY:

1. SECURITY DEFINER:
   - All trigger functions use SECURITY DEFINER
   - This allows triggers to INSERT into activity_feed even though
     direct INSERTs are blocked by RLS (no INSERT policy)
   - Triggers run with the privileges of the function owner (postgres)

2. SET search_path:
   - All functions set search_path = public
   - Prevents search_path injection attacks

3. DATA SANITIZATION:
   - Long text fields (notes, description) are truncated with LEFT(x, 100)
   - This prevents large payloads while preserving preview text

4. ACTOR IDENTIFICATION:
   - For most events, the actor is the user performing the action
   - For approval events, the actor is the approver, not the entry owner
   - Payload includes both actor and subject IDs for full context

5. WORKSPACE ASSOCIATION:
   - All events require a workspace_id
   - Events without workspace context (personal entries, goals) are not emitted
   - This maintains workspace isolation

6. REALTIME COMPATIBILITY:
   - Events include all data needed for display in the payload
   - Clients don't need to refetch related records
   - Reduces database queries for realtime updates

7. EVENT TYPES IMPLEMENTED:
   - entry_logged: Time entry created with project
   - entry_approved: Entry approved by approver
   - entry_rejected: Entry rejected by approver
   - member_joined: New member added to workspace
   - member_left: Member removed from workspace
   - member_role_changed: Member's role updated
   - project_created: New project created
   - project_member_added: Member added to project

8. EVENT TYPES NOT IMPLEMENTED (require schema changes):
   - timer_started: Needs project_id on active_timers
   - timer_stopped: Needs project_id on active_timers
   - goal_created: Needs workspace_id on monthly_goals
   - goal_completed: Needs workspace_id on monthly_goals
*/
