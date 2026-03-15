-- Migration: Add collaboration columns to time_entries table
-- Enables project linking and time entry approval workflow for team collaboration

-- =============================================================================
-- ADD PROJECT LINK COLUMN
-- =============================================================================

-- Link time entries to shared projects (optional)
-- ON DELETE SET NULL preserves entries when project is deleted
ALTER TABLE public.time_entries
ADD COLUMN project_id uuid
    REFERENCES public.projects(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.time_entries.project_id IS
    'Optional link to a shared project in a workspace (NULL if personal entry)';

-- =============================================================================
-- ADD APPROVAL WORKFLOW COLUMNS
-- =============================================================================

-- Approval status tracking
-- Uses approval_status enum defined in 20240101000030_add_workspaces.sql
-- Default 'draft' for all entries (including personal/non-workspace entries)
ALTER TABLE public.time_entries
ADD COLUMN approval_status approval_status NOT NULL DEFAULT 'draft';

COMMENT ON COLUMN public.time_entries.approval_status IS
    'Approval workflow status: draft (default), submitted, approved, or rejected';

-- The designated approver for this entry
-- Set when entry is submitted for approval based on approval_assignments
-- ON DELETE SET NULL handles approver account deletion gracefully
ALTER TABLE public.time_entries
ADD COLUMN approver_id uuid
    REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.time_entries.approver_id IS
    'User designated to approve this entry (NULL if no approval workflow)';

-- Approver's note (feedback on approval/rejection)
-- Max 500 characters, nullable
ALTER TABLE public.time_entries
ADD COLUMN approval_note text
    CHECK (approval_note IS NULL OR char_length(approval_note) <= 500);

COMMENT ON COLUMN public.time_entries.approval_note IS
    'Approver feedback when approving/rejecting entry (max 500 chars)';

-- Timestamp when entry was approved
-- NULL if not yet approved
ALTER TABLE public.time_entries
ADD COLUMN approved_at timestamptz;

COMMENT ON COLUMN public.time_entries.approved_at IS
    'When the entry was approved (NULL if not approved)';

-- Timestamp when entry was submitted for approval
-- NULL if still in draft status
ALTER TABLE public.time_entries
ADD COLUMN submitted_at timestamptz;

COMMENT ON COLUMN public.time_entries.submitted_at IS
    'When the entry was submitted for approval (NULL if draft)';

-- =============================================================================
-- CREATE INDEXES
-- =============================================================================

-- Index for project-filtered queries
-- Common query: "show all entries for project X"
CREATE INDEX idx_time_entries_project ON public.time_entries(project_id)
    WHERE project_id IS NOT NULL;

-- Composite index for approval queue queries
-- Common query: "show pending approvals for approver X"
-- Most efficient when filtering by both approver_id and approval_status
CREATE INDEX idx_time_entries_approver_status ON public.time_entries(approver_id, approval_status)
    WHERE approver_id IS NOT NULL;

-- Index for submitted entries by status
-- Common query: "show all submitted entries" or "show all approved entries"
CREATE INDEX idx_time_entries_approval_status ON public.time_entries(approval_status)
    WHERE approval_status != 'draft';

-- =============================================================================
-- SECURITY NOTES
-- =============================================================================

/*
APPROVAL WORKFLOW SECURITY:

1. APPROVAL STATUS TRANSITIONS:
   - draft -> submitted: Only entry owner can submit
   - submitted -> approved/rejected: Only designated approver can change
   - approved/rejected -> draft: Not allowed (create new entry instead)

   These rules will be enforced via RLS policies in migration 000033.

2. APPROVER ASSIGNMENT:
   - approver_id is set when entry is submitted, copied from approval_assignments
   - Cannot be changed after submission (enforced by RLS)
   - ON DELETE SET NULL handles approver deletion

3. ENTRY VISIBILITY:
   - Draft entries: Only visible to owner
   - Submitted entries: Visible to owner AND designated approver
   - Approved/rejected entries: Visible to owner AND designated approver
   - Workspace admins/owners can see all workspace entries via separate policy

4. PROJECT LINKING:
   - project_id creates implicit workspace association
   - User must be a project member to link entry to project
   - This is enforced via RLS policies in migration 000033

5. BACKWARD COMPATIBILITY:
   - All existing entries default to approval_status = 'draft'
   - Personal entries (no project_id) continue to work unchanged
   - Approval workflow only activates when project_id is set and user is in workspace
*/
