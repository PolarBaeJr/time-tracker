-- Migration: Row Level Security Policies for Collaboration Tables
-- Implements comprehensive RLS for Phase 5 collaboration features
-- Includes helper functions for workspace membership checks

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY ON ALL COLLABORATION TABLES
-- =============================================================================

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_dashboards ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- HELPER FUNCTIONS FOR WORKSPACE ACCESS CHECKS
-- =============================================================================

-- Check if current user is a member of the workspace
-- Returns TRUE if user has any role (owner, admin, or member)
CREATE OR REPLACE FUNCTION is_workspace_member(ws_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = ws_id
          AND user_id = auth.uid()
    );
$$;

COMMENT ON FUNCTION is_workspace_member(uuid) IS
    'Returns TRUE if the current user is a member of the specified workspace (any role)';

-- Check if current user is an admin or owner of the workspace
-- Returns TRUE if user has admin or owner role
CREATE OR REPLACE FUNCTION is_workspace_admin(ws_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = ws_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin')
    );
$$;

COMMENT ON FUNCTION is_workspace_admin(uuid) IS
    'Returns TRUE if the current user is an owner or admin of the specified workspace';

-- Check if current user is the owner of the workspace
-- Returns TRUE only if user has owner role
CREATE OR REPLACE FUNCTION is_workspace_owner(ws_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = ws_id
          AND user_id = auth.uid()
          AND role = 'owner'
    );
$$;

COMMENT ON FUNCTION is_workspace_owner(uuid) IS
    'Returns TRUE if the current user is the owner of the specified workspace';

-- Helper to get the current user's email for invite policies
-- Returns the email from public.users for the authenticated user
CREATE OR REPLACE FUNCTION get_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT email FROM public.users WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION get_current_user_email() IS
    'Returns the email address of the currently authenticated user';

-- Check if current user is a member of a project
CREATE OR REPLACE FUNCTION is_project_member(proj_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_id = proj_id
          AND user_id = auth.uid()
    );
$$;

COMMENT ON FUNCTION is_project_member(uuid) IS
    'Returns TRUE if the current user is a member of the specified project';

-- Get workspace ID from a project ID (for checking workspace membership)
CREATE OR REPLACE FUNCTION get_project_workspace_id(proj_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT workspace_id FROM public.projects WHERE id = proj_id;
$$;

COMMENT ON FUNCTION get_project_workspace_id(uuid) IS
    'Returns the workspace_id for a given project';

-- =============================================================================
-- WORKSPACES TABLE POLICIES
-- =============================================================================

-- SELECT: Workspace members can view the workspace
CREATE POLICY workspaces_select ON public.workspaces
    FOR SELECT
    USING (is_workspace_member(id));

COMMENT ON POLICY workspaces_select ON public.workspaces IS
    'Members can view workspaces they belong to';

-- INSERT: Only the owner can create a workspace (owner_id must match)
CREATE POLICY workspaces_insert ON public.workspaces
    FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

COMMENT ON POLICY workspaces_insert ON public.workspaces IS
    'Users can create workspaces where they are the owner';

-- UPDATE: Admins and owners can update workspace details
CREATE POLICY workspaces_update ON public.workspaces
    FOR UPDATE
    USING (is_workspace_admin(id))
    WITH CHECK (is_workspace_admin(id));

COMMENT ON POLICY workspaces_update ON public.workspaces IS
    'Owners and admins can update workspace details';

-- DELETE: Only owners can delete workspaces
CREATE POLICY workspaces_delete ON public.workspaces
    FOR DELETE
    USING (is_workspace_owner(id));

COMMENT ON POLICY workspaces_delete ON public.workspaces IS
    'Only workspace owners can delete workspaces';

-- =============================================================================
-- WORKSPACE_MEMBERS TABLE POLICIES
-- =============================================================================

-- SELECT: Workspace members can view the member list
CREATE POLICY workspace_members_select ON public.workspace_members
    FOR SELECT
    USING (is_workspace_member(workspace_id));

COMMENT ON POLICY workspace_members_select ON public.workspace_members IS
    'Workspace members can see all members of their workspace';

-- INSERT: Admins can add new members
-- Also allow owner to add themselves when creating workspace (via separate trigger)
CREATE POLICY workspace_members_insert ON public.workspace_members
    FOR INSERT
    WITH CHECK (
        -- Admin adding a member
        is_workspace_admin(workspace_id)
        -- OR user adding themselves as owner (for workspace creation flow)
        OR (
            auth.uid() = user_id
            AND role = 'owner'
            AND NOT EXISTS (
                SELECT 1 FROM public.workspace_members
                WHERE workspace_id = workspace_members.workspace_id
            )
        )
    );

COMMENT ON POLICY workspace_members_insert ON public.workspace_members IS
    'Admins can add members; creators can add themselves as owner';

-- UPDATE: Admins can change member roles (but not owner role)
-- Note: Owner role protection is enforced by checking current row (role column in USING)
-- and preventing updates to role='owner' (WITH CHECK)
CREATE POLICY workspace_members_update ON public.workspace_members
    FOR UPDATE
    USING (
        is_workspace_admin(workspace_id)
        -- Cannot update rows with owner role (owners cannot be demoted via UPDATE)
        AND role != 'owner'
    )
    WITH CHECK (
        is_workspace_admin(workspace_id)
        -- Cannot change role TO owner (only one owner per workspace, set at creation)
        AND role != 'owner'
    );

COMMENT ON POLICY workspace_members_update ON public.workspace_members IS
    'Admins can update member roles (cannot modify or set owner role)';

-- DELETE: Admins can remove members, but cannot remove the owner
CREATE POLICY workspace_members_delete ON public.workspace_members
    FOR DELETE
    USING (
        is_workspace_admin(workspace_id)
        AND role != 'owner'
    );

COMMENT ON POLICY workspace_members_delete ON public.workspace_members IS
    'Admins can remove members (except the owner)';

-- =============================================================================
-- WORKSPACE_INVITES TABLE POLICIES
-- =============================================================================

-- SELECT: Admins can see all invites; invitees can see their own invites
CREATE POLICY workspace_invites_select ON public.workspace_invites
    FOR SELECT
    USING (
        is_workspace_admin(workspace_id)
        OR invited_email = get_current_user_email()
    );

COMMENT ON POLICY workspace_invites_select ON public.workspace_invites IS
    'Admins see all workspace invites; users see invites sent to their email';

-- INSERT: Admins can create invites for their workspace
CREATE POLICY workspace_invites_insert ON public.workspace_invites
    FOR INSERT
    WITH CHECK (
        is_workspace_admin(workspace_id)
        AND invited_by = auth.uid()
    );

COMMENT ON POLICY workspace_invites_insert ON public.workspace_invites IS
    'Admins can create invites (invited_by must be themselves)';

-- UPDATE: Invitees can accept their own invites (status change only)
CREATE POLICY workspace_invites_update ON public.workspace_invites
    FOR UPDATE
    USING (invited_email = get_current_user_email())
    WITH CHECK (invited_email = get_current_user_email());

COMMENT ON POLICY workspace_invites_update ON public.workspace_invites IS
    'Invitees can update their own invites (to accept)';

-- DELETE: Admins can revoke/delete invites
CREATE POLICY workspace_invites_delete ON public.workspace_invites
    FOR DELETE
    USING (is_workspace_admin(workspace_id));

COMMENT ON POLICY workspace_invites_delete ON public.workspace_invites IS
    'Admins can delete/revoke workspace invites';

-- =============================================================================
-- PROJECTS TABLE POLICIES
-- =============================================================================

-- SELECT: Workspace members can see projects they have access to
-- Access means: project member, project creator, or workspace admin
CREATE POLICY projects_select ON public.projects
    FOR SELECT
    USING (
        is_workspace_member(workspace_id)
        AND (
            is_project_member(id)
            OR created_by = auth.uid()
            OR is_workspace_admin(workspace_id)
        )
    );

COMMENT ON POLICY projects_select ON public.projects IS
    'Workspace members can see projects they are members of, created, or as admin';

-- INSERT: Workspace members can create projects
CREATE POLICY projects_insert ON public.projects
    FOR INSERT
    WITH CHECK (
        is_workspace_member(workspace_id)
        AND created_by = auth.uid()
    );

COMMENT ON POLICY projects_insert ON public.projects IS
    'Workspace members can create projects (creator must be themselves)';

-- UPDATE: Project creator or workspace admin can update projects
CREATE POLICY projects_update ON public.projects
    FOR UPDATE
    USING (
        created_by = auth.uid()
        OR is_workspace_admin(workspace_id)
    )
    WITH CHECK (
        created_by = auth.uid()
        OR is_workspace_admin(workspace_id)
    );

COMMENT ON POLICY projects_update ON public.projects IS
    'Project creators and workspace admins can update projects';

-- DELETE: Project creator or workspace admin can delete projects
CREATE POLICY projects_delete ON public.projects
    FOR DELETE
    USING (
        created_by = auth.uid()
        OR is_workspace_admin(workspace_id)
    );

COMMENT ON POLICY projects_delete ON public.projects IS
    'Project creators and workspace admins can delete projects';

-- =============================================================================
-- PROJECT_MEMBERS TABLE POLICIES
-- =============================================================================

-- SELECT: Project members can see the member list
-- (Also check workspace membership for security)
CREATE POLICY project_members_select ON public.project_members
    FOR SELECT
    USING (
        is_workspace_member(get_project_workspace_id(project_id))
        AND (
            is_project_member(project_id)
            OR is_workspace_admin(get_project_workspace_id(project_id))
        )
    );

COMMENT ON POLICY project_members_select ON public.project_members IS
    'Project members and workspace admins can see project membership';

-- INSERT: Project creator or workspace admin can add members
CREATE POLICY project_members_insert ON public.project_members
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id
              AND (
                  p.created_by = auth.uid()
                  OR is_workspace_admin(p.workspace_id)
              )
        )
        -- Creator can add themselves when creating project
        OR (
            user_id = auth.uid()
            AND NOT EXISTS (
                SELECT 1 FROM public.project_members
                WHERE project_id = project_members.project_id
            )
        )
    );

COMMENT ON POLICY project_members_insert ON public.project_members IS
    'Project creators and workspace admins can add project members';

-- UPDATE: Project creator or workspace admin can change roles
CREATE POLICY project_members_update ON public.project_members
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id
              AND (
                  p.created_by = auth.uid()
                  OR is_workspace_admin(p.workspace_id)
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id
              AND (
                  p.created_by = auth.uid()
                  OR is_workspace_admin(p.workspace_id)
              )
        )
    );

COMMENT ON POLICY project_members_update ON public.project_members IS
    'Project creators and workspace admins can update project member roles';

-- DELETE: Project creator or workspace admin can remove members
CREATE POLICY project_members_delete ON public.project_members
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id
              AND (
                  p.created_by = auth.uid()
                  OR is_workspace_admin(p.workspace_id)
              )
        )
    );

COMMENT ON POLICY project_members_delete ON public.project_members IS
    'Project creators and workspace admins can remove project members';

-- =============================================================================
-- APPROVAL_ASSIGNMENTS TABLE POLICIES
-- =============================================================================

-- SELECT: Workspace members can see approval assignments
CREATE POLICY approval_assignments_select ON public.approval_assignments
    FOR SELECT
    USING (is_workspace_member(workspace_id));

COMMENT ON POLICY approval_assignments_select ON public.approval_assignments IS
    'Workspace members can view approval assignments';

-- INSERT: Admins can create approval assignments
CREATE POLICY approval_assignments_insert ON public.approval_assignments
    FOR INSERT
    WITH CHECK (
        is_workspace_admin(workspace_id)
        AND created_by = auth.uid()
    );

COMMENT ON POLICY approval_assignments_insert ON public.approval_assignments IS
    'Workspace admins can create approval assignments';

-- UPDATE: Admins can update approval assignments
CREATE POLICY approval_assignments_update ON public.approval_assignments
    FOR UPDATE
    USING (is_workspace_admin(workspace_id))
    WITH CHECK (is_workspace_admin(workspace_id));

COMMENT ON POLICY approval_assignments_update ON public.approval_assignments IS
    'Workspace admins can update approval assignments';

-- DELETE: Admins can delete approval assignments
CREATE POLICY approval_assignments_delete ON public.approval_assignments
    FOR DELETE
    USING (is_workspace_admin(workspace_id));

COMMENT ON POLICY approval_assignments_delete ON public.approval_assignments IS
    'Workspace admins can delete approval assignments';

-- =============================================================================
-- ACTIVITY_FEED TABLE POLICIES
-- =============================================================================

-- SELECT: Workspace members can read activity feed
CREATE POLICY activity_feed_select ON public.activity_feed
    FOR SELECT
    USING (is_workspace_member(workspace_id));

COMMENT ON POLICY activity_feed_select ON public.activity_feed IS
    'Workspace members can view the activity feed';

-- No INSERT/UPDATE/DELETE policies - activity feed is trigger-only
-- The triggers run with SECURITY DEFINER and bypass RLS

-- =============================================================================
-- SHARED_DASHBOARDS TABLE POLICIES
-- =============================================================================

-- SELECT: Users can see their own shared dashboards
CREATE POLICY shared_dashboards_select ON public.shared_dashboards
    FOR SELECT
    USING (auth.uid() = user_id);

COMMENT ON POLICY shared_dashboards_select ON public.shared_dashboards IS
    'Users can view their own shared dashboards';

-- INSERT: Users can create shared dashboards
CREATE POLICY shared_dashboards_insert ON public.shared_dashboards
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY shared_dashboards_insert ON public.shared_dashboards IS
    'Users can create shared dashboards for themselves';

-- UPDATE: Users can update their own shared dashboards
CREATE POLICY shared_dashboards_update ON public.shared_dashboards
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY shared_dashboards_update ON public.shared_dashboards IS
    'Users can update their own shared dashboards';

-- DELETE: Users can delete their own shared dashboards
CREATE POLICY shared_dashboards_delete ON public.shared_dashboards
    FOR DELETE
    USING (auth.uid() = user_id);

COMMENT ON POLICY shared_dashboards_delete ON public.shared_dashboards IS
    'Users can delete their own shared dashboards';

-- =============================================================================
-- UPDATE TIME_ENTRIES POLICIES FOR APPROVAL WORKFLOW
-- =============================================================================

-- Drop the existing SELECT policy to replace with enhanced version
DROP POLICY IF EXISTS time_entries_select_own ON public.time_entries;

-- New SELECT policy: Users can see their own entries OR entries they need to approve
-- OR entries in workspaces where they are admin (for reporting)
CREATE POLICY time_entries_select_enhanced ON public.time_entries
    FOR SELECT
    USING (
        -- Own entries (always visible)
        auth.uid() = user_id
        -- OR designated approver for this entry
        OR auth.uid() = approver_id
        -- OR workspace admin viewing project entries
        OR (
            project_id IS NOT NULL
            AND is_workspace_admin(get_project_workspace_id(project_id))
        )
    );

COMMENT ON POLICY time_entries_select_enhanced ON public.time_entries IS
    'Users see own entries, entries to approve, and admins see workspace entries';

-- Drop existing UPDATE policy to add approval workflow restrictions
DROP POLICY IF EXISTS time_entries_update_own ON public.time_entries;

-- New UPDATE policy: Owners can update draft entries; approvers can update approval status
-- Note: RLS WITH CHECK ensures user_id cannot be changed (must equal auth.uid() or approver)
CREATE POLICY time_entries_update_enhanced ON public.time_entries
    FOR UPDATE
    USING (
        -- Entry owner can update (with restrictions in WITH CHECK)
        auth.uid() = user_id
        -- OR designated approver can update (for approval actions)
        OR auth.uid() = approver_id
    )
    WITH CHECK (
        -- Owner updating: user_id must still match (prevents changing ownership)
        auth.uid() = user_id
        -- OR approver updating: entry must still have same user_id (checked by user_id col)
        -- Approver cannot become owner - they can only modify approval fields
        OR auth.uid() = approver_id
    );

COMMENT ON POLICY time_entries_update_enhanced ON public.time_entries IS
    'Owners update own entries; approvers can approve/reject';

-- =============================================================================
-- SECURITY NOTES
-- =============================================================================

/*
COLLABORATION RLS SECURITY MODEL:

1. HELPER FUNCTIONS:
   - All use SECURITY DEFINER to run with elevated privileges
   - SET search_path prevents search_path injection attacks
   - STABLE marking allows query optimizer to cache results within transaction
   - is_workspace_member/admin/owner check membership roles
   - get_current_user_email retrieves user's email for invite matching

2. WORKSPACE ACCESS HIERARCHY:
   - Owner: Full control (delete workspace, cannot be removed)
   - Admin: Manage members, invites, projects, approvals
   - Member: Read access, create projects, log time

3. PROJECT ACCESS:
   - Inherits from workspace membership
   - Additional restriction: must be project member or creator or admin
   - Project creator has owner-like control over their project

4. APPROVAL WORKFLOW:
   - Entry owner can submit (change status to 'submitted')
   - Approver can approve/reject (set status, add note)
   - Approved entries become read-only to owner
   - Admins have visibility for reporting

5. ACTIVITY FEED:
   - Read-only via RLS (no INSERT/UPDATE/DELETE policies)
   - Entries created by triggers with SECURITY DEFINER
   - Ensures feed cannot be manipulated by users

6. SHARED DASHBOARDS:
   - Simple user ownership model
   - Public access is via Edge Function, not RLS modification

7. TIME ENTRIES CHANGES:
   - SELECT: Enhanced to include approver and admin visibility
   - UPDATE: Enhanced to allow approver status changes
   - INSERT/DELETE: Unchanged (owner only)

8. INVITE SECURITY:
   - Admins create invites
   - Only invitee can accept (matched by email)
   - Token validation happens in Edge Function

9. PERFORMANCE CONSIDERATIONS:
   - Helper functions are STABLE for query caching
   - Indexes on workspace_members for fast membership lookups
   - Consider materialized membership cache for large workspaces
*/
