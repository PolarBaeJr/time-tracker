-- Migration: Create collaboration tables for Phase 5
-- Workspaces enable team collaboration with shared projects, time entry approval,
-- activity feeds, shared dashboards, and more.

-- =============================================================================
-- CREATE ENUM TYPES
-- =============================================================================

-- Workspace membership roles
CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'member');
COMMENT ON TYPE workspace_role IS 'Roles in a workspace: owner (full control), admin (manage members/approve), member (log time)';

-- Invite status for workspace invitations
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'expired');
COMMENT ON TYPE invite_status IS 'Status of workspace invitations';

-- Approval status for time entries
CREATE TYPE approval_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
COMMENT ON TYPE approval_status IS 'Status of time entry approval workflow';

-- Activity feed event types
CREATE TYPE activity_event_type AS ENUM (
    'timer_started',
    'timer_stopped',
    'entry_logged',
    'goal_created',
    'goal_completed',
    'entry_approved',
    'entry_rejected',
    'member_joined',
    'member_left',
    'member_role_changed',
    'project_created',
    'project_member_added'
);
COMMENT ON TYPE activity_event_type IS 'Types of events that can appear in the activity feed';

-- =============================================================================
-- CREATE WORKSPACES TABLE
-- =============================================================================

CREATE TABLE public.workspaces (
    -- Auto-generated UUID primary key
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Workspace name (required, 1-100 characters)
    name text NOT NULL
        CHECK (char_length(name) BETWEEN 1 AND 100),

    -- URL-friendly slug (required, unique, lowercase with hyphens/numbers)
    slug text NOT NULL UNIQUE
        CHECK (slug ~ '^[a-z0-9-]{3,50}$'),

    -- Owner of the workspace
    -- ON DELETE RESTRICT prevents deleting user who owns a workspace
    owner_id uuid NOT NULL
        REFERENCES public.users(id) ON DELETE RESTRICT,

    -- Timestamp for auditing
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for owner lookup
CREATE INDEX idx_workspaces_owner_id ON public.workspaces(owner_id);

-- Comments for documentation
COMMENT ON TABLE public.workspaces IS 'Shared workspaces for team collaboration';
COMMENT ON COLUMN public.workspaces.id IS 'Auto-generated UUID primary key';
COMMENT ON COLUMN public.workspaces.name IS 'Workspace display name (1-100 chars)';
COMMENT ON COLUMN public.workspaces.slug IS 'URL-friendly identifier (3-50 chars, lowercase, hyphens, numbers)';
COMMENT ON COLUMN public.workspaces.owner_id IS 'User who owns this workspace (cannot be deleted while owning workspace)';
COMMENT ON COLUMN public.workspaces.created_at IS 'When the workspace was created';

-- =============================================================================
-- CREATE WORKSPACE_MEMBERS TABLE
-- =============================================================================

CREATE TABLE public.workspace_members (
    -- Auto-generated UUID primary key
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The workspace this membership belongs to
    workspace_id uuid NOT NULL
        REFERENCES public.workspaces(id) ON DELETE CASCADE,

    -- The user who is a member
    user_id uuid NOT NULL
        REFERENCES public.users(id) ON DELETE CASCADE,

    -- Role within the workspace
    role workspace_role NOT NULL DEFAULT 'member',

    -- When the user joined
    joined_at timestamptz NOT NULL DEFAULT now(),

    -- Each user can only be a member of a workspace once
    UNIQUE (workspace_id, user_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON public.workspace_members(user_id);

-- Comments for documentation
COMMENT ON TABLE public.workspace_members IS 'Membership records linking users to workspaces with roles';
COMMENT ON COLUMN public.workspace_members.id IS 'Auto-generated UUID primary key';
COMMENT ON COLUMN public.workspace_members.workspace_id IS 'The workspace this membership belongs to';
COMMENT ON COLUMN public.workspace_members.user_id IS 'The user who is a member';
COMMENT ON COLUMN public.workspace_members.role IS 'Role: owner, admin, or member';
COMMENT ON COLUMN public.workspace_members.joined_at IS 'When the user joined the workspace';

-- =============================================================================
-- CREATE WORKSPACE_INVITES TABLE
-- =============================================================================

CREATE TABLE public.workspace_invites (
    -- Auto-generated UUID primary key
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The workspace this invite is for
    workspace_id uuid NOT NULL
        REFERENCES public.workspaces(id) ON DELETE CASCADE,

    -- Email address of the invitee (validated with regex)
    invited_email text NOT NULL
        CHECK (invited_email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'),

    -- Role to assign when invite is accepted
    role workspace_role NOT NULL DEFAULT 'member',

    -- User who sent the invite
    invited_by uuid NOT NULL
        REFERENCES public.users(id) ON DELETE CASCADE,

    -- SHA-256 hash of the invite token (raw token never stored)
    -- SECURITY: Only the hash is stored; raw token is sent via email
    token_hash text NOT NULL,

    -- Current status of the invite
    status invite_status NOT NULL DEFAULT 'pending',

    -- When the invite expires (default 7 days from creation)
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),

    -- When the invite was created
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for token lookup (used when accepting invites)
CREATE INDEX idx_workspace_invites_token_hash ON public.workspace_invites(token_hash);

-- Index for finding invites by email
CREATE INDEX idx_workspace_invites_email ON public.workspace_invites(invited_email);

-- Index for workspace-scoped queries
CREATE INDEX idx_workspace_invites_workspace_id ON public.workspace_invites(workspace_id);

-- Index for status filtering (find pending invites)
CREATE INDEX idx_workspace_invites_status ON public.workspace_invites(status) WHERE status = 'pending';

-- Comments for documentation
COMMENT ON TABLE public.workspace_invites IS 'Pending and processed workspace invitations';
COMMENT ON COLUMN public.workspace_invites.id IS 'Auto-generated UUID primary key';
COMMENT ON COLUMN public.workspace_invites.workspace_id IS 'The workspace this invite is for';
COMMENT ON COLUMN public.workspace_invites.invited_email IS 'Email address of the invitee';
COMMENT ON COLUMN public.workspace_invites.role IS 'Role to assign when accepted (admin or member)';
COMMENT ON COLUMN public.workspace_invites.invited_by IS 'User who sent the invite';
COMMENT ON COLUMN public.workspace_invites.token_hash IS 'SHA-256 hash of the invite token (raw token sent via email)';
COMMENT ON COLUMN public.workspace_invites.status IS 'Current status: pending, accepted, or expired';
COMMENT ON COLUMN public.workspace_invites.expires_at IS 'When the invite expires (default 7 days)';
COMMENT ON COLUMN public.workspace_invites.created_at IS 'When the invite was created';

-- =============================================================================
-- CREATE PROJECTS TABLE
-- =============================================================================

CREATE TABLE public.projects (
    -- Auto-generated UUID primary key
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The workspace this project belongs to
    workspace_id uuid NOT NULL
        REFERENCES public.workspaces(id) ON DELETE CASCADE,

    -- Project name (required, 1-100 characters)
    name text NOT NULL
        CHECK (char_length(name) BETWEEN 1 AND 100),

    -- Color for visual identification (hex format)
    color text NOT NULL DEFAULT '#6366F1'
        CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),

    -- Optional description (max 1000 characters)
    description text
        CHECK (description IS NULL OR char_length(description) <= 1000),

    -- Whether the project is archived (hidden from active view)
    is_archived boolean NOT NULL DEFAULT false,

    -- User who created the project
    -- ON DELETE RESTRICT prevents deleting user who created a project
    created_by uuid NOT NULL
        REFERENCES public.users(id) ON DELETE RESTRICT,

    -- When the project was created
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for workspace-scoped queries
CREATE INDEX idx_projects_workspace_id ON public.projects(workspace_id);

-- Index for archived filtering
CREATE INDEX idx_projects_workspace_archived ON public.projects(workspace_id, is_archived);

-- Index for creator lookup
CREATE INDEX idx_projects_created_by ON public.projects(created_by);

-- Comments for documentation
COMMENT ON TABLE public.projects IS 'Shared projects within workspaces that members can log time against';
COMMENT ON COLUMN public.projects.id IS 'Auto-generated UUID primary key';
COMMENT ON COLUMN public.projects.workspace_id IS 'The workspace this project belongs to';
COMMENT ON COLUMN public.projects.name IS 'Project name (1-100 chars)';
COMMENT ON COLUMN public.projects.color IS 'Color for visual identification (hex format, e.g., #6366F1)';
COMMENT ON COLUMN public.projects.description IS 'Optional description (max 1000 chars)';
COMMENT ON COLUMN public.projects.is_archived IS 'Whether the project is archived (hidden from active view)';
COMMENT ON COLUMN public.projects.created_by IS 'User who created the project';
COMMENT ON COLUMN public.projects.created_at IS 'When the project was created';

-- =============================================================================
-- CREATE PROJECT_MEMBERS TABLE
-- =============================================================================

CREATE TABLE public.project_members (
    -- Auto-generated UUID primary key
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The project this membership belongs to
    project_id uuid NOT NULL
        REFERENCES public.projects(id) ON DELETE CASCADE,

    -- The user who is a member
    user_id uuid NOT NULL
        REFERENCES public.users(id) ON DELETE CASCADE,

    -- Role within the project (using workspace_role enum for consistency)
    role workspace_role NOT NULL DEFAULT 'member',

    -- When the user was added
    added_at timestamptz NOT NULL DEFAULT now(),

    -- Each user can only be a member of a project once
    UNIQUE (project_id, user_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX idx_project_members_user_id ON public.project_members(user_id);

-- Comments for documentation
COMMENT ON TABLE public.project_members IS 'Membership records linking users to projects';
COMMENT ON COLUMN public.project_members.id IS 'Auto-generated UUID primary key';
COMMENT ON COLUMN public.project_members.project_id IS 'The project this membership belongs to';
COMMENT ON COLUMN public.project_members.user_id IS 'The user who is a member';
COMMENT ON COLUMN public.project_members.role IS 'Role within the project';
COMMENT ON COLUMN public.project_members.added_at IS 'When the user was added to the project';

-- =============================================================================
-- CREATE APPROVAL_ASSIGNMENTS TABLE
-- =============================================================================

CREATE TABLE public.approval_assignments (
    -- Auto-generated UUID primary key
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The workspace this assignment belongs to
    workspace_id uuid NOT NULL
        REFERENCES public.workspaces(id) ON DELETE CASCADE,

    -- The member whose entries need approval
    member_user_id uuid NOT NULL
        REFERENCES public.users(id) ON DELETE CASCADE,

    -- The user who approves this member's entries
    approver_user_id uuid NOT NULL
        REFERENCES public.users(id) ON DELETE CASCADE,

    -- User who created this assignment
    created_by uuid NOT NULL
        REFERENCES public.users(id) ON DELETE CASCADE,

    -- When the assignment was created
    created_at timestamptz NOT NULL DEFAULT now(),

    -- Each member can only have one approver per workspace
    UNIQUE (workspace_id, member_user_id),

    -- A user cannot be their own approver
    CHECK (member_user_id != approver_user_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_approval_assignments_workspace_id ON public.approval_assignments(workspace_id);
CREATE INDEX idx_approval_assignments_member_id ON public.approval_assignments(member_user_id);
CREATE INDEX idx_approval_assignments_approver_id ON public.approval_assignments(approver_user_id);

-- Comments for documentation
COMMENT ON TABLE public.approval_assignments IS 'Defines who approves whose time entries within a workspace';
COMMENT ON COLUMN public.approval_assignments.id IS 'Auto-generated UUID primary key';
COMMENT ON COLUMN public.approval_assignments.workspace_id IS 'The workspace this assignment belongs to';
COMMENT ON COLUMN public.approval_assignments.member_user_id IS 'The member whose entries need approval';
COMMENT ON COLUMN public.approval_assignments.approver_user_id IS 'The user who approves this member''s entries';
COMMENT ON COLUMN public.approval_assignments.created_by IS 'User who created this assignment';
COMMENT ON COLUMN public.approval_assignments.created_at IS 'When the assignment was created';

-- =============================================================================
-- CREATE ACTIVITY_FEED TABLE
-- =============================================================================

CREATE TABLE public.activity_feed (
    -- Auto-generated UUID primary key
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The workspace this event belongs to
    workspace_id uuid NOT NULL
        REFERENCES public.workspaces(id) ON DELETE CASCADE,

    -- The user who performed the action
    actor_user_id uuid NOT NULL
        REFERENCES public.users(id) ON DELETE CASCADE,

    -- Type of event
    event_type activity_event_type NOT NULL,

    -- Additional event-specific data (flexible JSON structure)
    -- Examples: { "duration_seconds": 3600, "category_name": "Development" }
    payload jsonb NOT NULL DEFAULT '{}',

    -- When the event occurred
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Composite index for workspace-scoped, chronological queries
CREATE INDEX idx_activity_feed_workspace_created ON public.activity_feed(workspace_id, created_at DESC);

-- Index for actor lookup
CREATE INDEX idx_activity_feed_actor ON public.activity_feed(actor_user_id);

-- Comments for documentation
COMMENT ON TABLE public.activity_feed IS 'Real-time activity feed events within workspaces';
COMMENT ON COLUMN public.activity_feed.id IS 'Auto-generated UUID primary key';
COMMENT ON COLUMN public.activity_feed.workspace_id IS 'The workspace this event belongs to';
COMMENT ON COLUMN public.activity_feed.actor_user_id IS 'The user who performed the action';
COMMENT ON COLUMN public.activity_feed.event_type IS 'Type of event (timer, entry, goal, approval, member events)';
COMMENT ON COLUMN public.activity_feed.payload IS 'Event-specific data in JSON format';
COMMENT ON COLUMN public.activity_feed.created_at IS 'When the event occurred';

-- =============================================================================
-- CREATE SHARED_DASHBOARDS TABLE
-- =============================================================================

CREATE TABLE public.shared_dashboards (
    -- Auto-generated UUID primary key
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Owner of this shared dashboard
    user_id uuid NOT NULL
        REFERENCES public.users(id) ON DELETE CASCADE,

    -- Optional workspace association (for team dashboards)
    workspace_id uuid
        REFERENCES public.workspaces(id) ON DELETE CASCADE,

    -- Unique token for public access (UUID format)
    token text NOT NULL UNIQUE,

    -- Dashboard title (required, 1-100 characters)
    title text NOT NULL
        CHECK (char_length(title) BETWEEN 1 AND 100),

    -- Whether the share link is active
    is_active boolean NOT NULL DEFAULT true,

    -- Optional expiration date (NULL = never expires)
    expires_at timestamptz,

    -- When the share was created
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for token lookup (public access)
CREATE INDEX idx_shared_dashboards_token ON public.shared_dashboards(token);

-- Index for user's shared dashboards
CREATE INDEX idx_shared_dashboards_user_id ON public.shared_dashboards(user_id);

-- Index for active dashboards
CREATE INDEX idx_shared_dashboards_active ON public.shared_dashboards(is_active) WHERE is_active = true;

-- Comments for documentation
COMMENT ON TABLE public.shared_dashboards IS 'Publicly accessible dashboard share links';
COMMENT ON COLUMN public.shared_dashboards.id IS 'Auto-generated UUID primary key';
COMMENT ON COLUMN public.shared_dashboards.user_id IS 'Owner who created this shared dashboard';
COMMENT ON COLUMN public.shared_dashboards.workspace_id IS 'Optional workspace for team dashboard sharing';
COMMENT ON COLUMN public.shared_dashboards.token IS 'Unique public access token';
COMMENT ON COLUMN public.shared_dashboards.title IS 'Dashboard title (1-100 chars)';
COMMENT ON COLUMN public.shared_dashboards.is_active IS 'Whether the share link is active';
COMMENT ON COLUMN public.shared_dashboards.expires_at IS 'Optional expiration date (NULL = never expires)';
COMMENT ON COLUMN public.shared_dashboards.created_at IS 'When the share was created';

-- =============================================================================
-- SECURITY NOTES
-- =============================================================================

/*
SECURITY CONSIDERATIONS FOR COLLABORATION TABLES:

1. WORKSPACE ISOLATION:
   - All workspace-related data includes workspace_id FK
   - RLS policies (separate migration) will enforce membership checks
   - Helper functions is_workspace_member(), is_workspace_admin(), is_workspace_owner()

2. ROLE-BASED ACCESS:
   - owner: Full control, can delete workspace, cannot be removed
   - admin: Can invite/remove members, manage projects, approve entries
   - member: Can log time, view shared data, participate in feed

3. INVITE SECURITY:
   - Only token_hash is stored in database
   - Raw token sent via email, never stored
   - Token expires after 7 days
   - Email validated with regex

4. APPROVAL WORKFLOW:
   - Self-approval prevented via CHECK constraint
   - Entries visible only to submitter and designated approver
   - Approval notes provide audit trail

5. ACTIVITY FEED:
   - Read-only for users (inserted via triggers/functions)
   - No direct INSERT/UPDATE/DELETE allowed via RLS
   - Realtime subscriptions filtered by workspace_id

6. SHARED DASHBOARDS:
   - Token-based public access (no auth required)
   - is_active flag allows revoking access
   - expires_at allows time-limited sharing
   - Only aggregate stats exposed, no individual entries

7. DATA RETENTION:
   - ON DELETE CASCADE for membership/invite cleanup
   - ON DELETE RESTRICT for owners/creators to prevent orphaned data
   - Soft delete NOT used for collaboration tables (simplifies cleanup)

RLS POLICIES WILL BE ADDED IN A SEPARATE MIGRATION (task-004)
*/
