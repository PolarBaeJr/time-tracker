/**
 * Approval Query Hooks
 *
 * This module provides TanStack Query hooks for fetching approval-related data.
 *
 * USAGE:
 * ```typescript
 * import { usePendingApprovals, useMySubmissions, useApprovalAssignments } from '@/hooks';
 *
 * function ApprovalQueue({ workspaceId }) {
 *   const { data: pending, isLoading } = usePendingApprovals(workspaceId);
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return pending?.map(entry => <ApprovalItem key={entry.id} entry={entry} />);
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure approvers only see entries assigned to them
 * - Members only see their own submissions
 * - Admins can view all assignments
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  TimeEntryWithApprovalAndUserSchema,
  ApprovalAssignmentWithUsersSchema,
  type TimeEntryWithApprovalAndUser,
  type ApprovalAssignmentWithUsers,
  type ApprovalStatus,
} from '@/schemas';

// ============================================================================
// ERROR CLASS
// ============================================================================

/**
 * Error thrown when approval operations fail
 */
export class ApprovalFetchError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApprovalFetchError';
  }
}

// ============================================================================
// FETCH PENDING APPROVALS
// ============================================================================

/**
 * Fetch time entries pending approval (for approvers)
 *
 * Returns entries where the current user is the designated approver
 * and approval_status = 'submitted'.
 *
 * @param workspaceId - UUID of the workspace
 * @returns Promise<TimeEntryWithApprovalAndUser[]> - Array of entries pending approval
 * @throws ApprovalFetchError if the fetch fails
 */
export async function fetchPendingApprovals(
  workspaceId: string
): Promise<TimeEntryWithApprovalAndUser[]> {
  // Get current user
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;

  if (!userId) {
    return [];
  }

  // Get project IDs for this workspace to filter entries
  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('workspace_id', workspaceId);

  const projectIds = projects?.map(p => p.id) ?? [];

  if (projectIds.length === 0) {
    return [];
  }

  // Fetch entries where user is approver and status is submitted
  const { data, error } = await supabase
    .from('time_entries')
    .select(
      `
      id,
      user_id,
      category_id,
      start_at,
      end_at,
      duration_seconds,
      notes,
      entry_type,
      is_billable,
      created_at,
      updated_at,
      project_id,
      approval_status,
      approver_id,
      approval_note,
      approved_at,
      submitted_at,
      user:users!time_entries_user_id_fkey (
        id,
        email,
        name
      ),
      category:categories (
        id,
        name,
        color
      ),
      project:projects (
        id,
        name,
        color
      )
    `
    )
    .eq('approver_id', userId)
    .eq('approval_status', 'submitted')
    .in('project_id', projectIds)
    .order('submitted_at', { ascending: false });

  if (error) {
    throw new ApprovalFetchError(error.message, error.code);
  }

  if (!data) {
    return [];
  }

  // Validate and transform results
  const validEntries: TimeEntryWithApprovalAndUser[] = [];
  for (const entry of data) {
    const userData = Array.isArray(entry.user) ? entry.user[0] : entry.user;
    const categoryData = Array.isArray(entry.category) ? entry.category[0] : entry.category;
    const projectData = Array.isArray(entry.project) ? entry.project[0] : entry.project;

    const entryData = {
      id: entry.id,
      user_id: entry.user_id,
      category_id: entry.category_id,
      start_at: entry.start_at,
      end_at: entry.end_at,
      duration_seconds: entry.duration_seconds,
      notes: entry.notes,
      entry_type: entry.entry_type,
      is_billable: entry.is_billable,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
      project_id: entry.project_id,
      approval_status: entry.approval_status,
      approver_id: entry.approver_id,
      approval_note: entry.approval_note,
      approved_at: entry.approved_at,
      submitted_at: entry.submitted_at,
      user: userData
        ? { id: userData.id, email: userData.email, name: userData.name }
        : { id: entry.user_id, email: 'unknown@example.com', name: null },
      category: categoryData ?? null,
      project: projectData ?? null,
    };

    const parsed = TimeEntryWithApprovalAndUserSchema.safeParse(entryData);
    if (parsed.success) {
      validEntries.push(parsed.data);
    } else {
      console.warn('[useApprovals] Entry failed validation:', parsed.error.flatten());
    }
  }

  return validEntries;
}

// ============================================================================
// FETCH MY SUBMISSIONS
// ============================================================================

/**
 * Fetch the current user's submitted/approved/rejected entries
 *
 * @param workspaceId - UUID of the workspace
 * @param statuses - Optional filter by status(es)
 * @returns Promise<TimeEntryWithApprovalAndUser[]> - Array of user's submissions
 * @throws ApprovalFetchError if the fetch fails
 */
export async function fetchMySubmissions(
  workspaceId: string,
  statuses: ApprovalStatus[] = ['submitted', 'approved', 'rejected']
): Promise<TimeEntryWithApprovalAndUser[]> {
  // Get current user
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;

  if (!userId) {
    return [];
  }

  // Get project IDs for this workspace
  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('workspace_id', workspaceId);

  const projectIds = projects?.map(p => p.id) ?? [];

  if (projectIds.length === 0) {
    return [];
  }

  // Fetch user's entries with non-draft status in this workspace
  const { data, error } = await supabase
    .from('time_entries')
    .select(
      `
      id,
      user_id,
      category_id,
      start_at,
      end_at,
      duration_seconds,
      notes,
      entry_type,
      is_billable,
      created_at,
      updated_at,
      project_id,
      approval_status,
      approver_id,
      approval_note,
      approved_at,
      submitted_at,
      user:users!time_entries_user_id_fkey (
        id,
        email,
        name
      ),
      category:categories (
        id,
        name,
        color
      ),
      project:projects (
        id,
        name,
        color
      )
    `
    )
    .eq('user_id', userId)
    .in('approval_status', statuses)
    .in('project_id', projectIds)
    .order('submitted_at', { ascending: false, nullsFirst: false });

  if (error) {
    throw new ApprovalFetchError(error.message, error.code);
  }

  if (!data) {
    return [];
  }

  // Validate and transform results
  const validEntries: TimeEntryWithApprovalAndUser[] = [];
  for (const entry of data) {
    const userData = Array.isArray(entry.user) ? entry.user[0] : entry.user;
    const categoryData = Array.isArray(entry.category) ? entry.category[0] : entry.category;
    const projectData = Array.isArray(entry.project) ? entry.project[0] : entry.project;

    const entryData = {
      id: entry.id,
      user_id: entry.user_id,
      category_id: entry.category_id,
      start_at: entry.start_at,
      end_at: entry.end_at,
      duration_seconds: entry.duration_seconds,
      notes: entry.notes,
      entry_type: entry.entry_type,
      is_billable: entry.is_billable,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
      project_id: entry.project_id,
      approval_status: entry.approval_status,
      approver_id: entry.approver_id,
      approval_note: entry.approval_note,
      approved_at: entry.approved_at,
      submitted_at: entry.submitted_at,
      user: userData
        ? { id: userData.id, email: userData.email, name: userData.name }
        : { id: entry.user_id, email: 'unknown@example.com', name: null },
      category: categoryData ?? null,
      project: projectData ?? null,
    };

    const parsed = TimeEntryWithApprovalAndUserSchema.safeParse(entryData);
    if (parsed.success) {
      validEntries.push(parsed.data);
    } else {
      console.warn('[useApprovals] Entry failed validation:', parsed.error.flatten());
    }
  }

  return validEntries;
}

// ============================================================================
// FETCH APPROVAL ASSIGNMENTS
// ============================================================================

/**
 * Fetch all approval assignments for a workspace
 *
 * @param workspaceId - UUID of the workspace
 * @returns Promise<ApprovalAssignmentWithUsers[]> - Array of assignments with user details
 * @throws ApprovalFetchError if the fetch fails
 */
export async function fetchApprovalAssignments(
  workspaceId: string
): Promise<ApprovalAssignmentWithUsers[]> {
  const { data, error } = await supabase
    .from('approval_assignments')
    .select(
      `
      id,
      workspace_id,
      member_user_id,
      approver_user_id,
      created_by,
      created_at,
      member:users!approval_assignments_member_user_id_fkey (
        id,
        email,
        name
      ),
      approver:users!approval_assignments_approver_user_id_fkey (
        id,
        email,
        name
      )
    `
    )
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new ApprovalFetchError(error.message, error.code);
  }

  if (!data) {
    return [];
  }

  // Validate and transform results
  const validAssignments: ApprovalAssignmentWithUsers[] = [];
  for (const assignment of data) {
    const memberData = Array.isArray(assignment.member) ? assignment.member[0] : assignment.member;
    const approverData = Array.isArray(assignment.approver)
      ? assignment.approver[0]
      : assignment.approver;

    if (!memberData || !approverData) continue;

    const assignmentData = {
      id: assignment.id,
      workspace_id: assignment.workspace_id,
      member_user_id: assignment.member_user_id,
      approver_user_id: assignment.approver_user_id,
      created_by: assignment.created_by,
      created_at: assignment.created_at,
      member: {
        id: memberData.id,
        email: memberData.email,
        name: memberData.name,
      },
      approver: {
        id: approverData.id,
        email: approverData.email,
        name: approverData.name,
      },
    };

    const parsed = ApprovalAssignmentWithUsersSchema.safeParse(assignmentData);
    if (parsed.success) {
      validAssignments.push(parsed.data);
    } else {
      console.warn('[useApprovals] Assignment failed validation:', parsed.error.flatten());
    }
  }

  return validAssignments;
}

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Options for the usePendingApprovals hook
 */
export interface UsePendingApprovalsOptions {
  /** Whether the query should be enabled */
  enabled?: boolean;
  /** Override the default stale time */
  staleTime?: number;
}

/**
 * Result type for usePendingApprovals hook
 */
export type UsePendingApprovalsResult = ReturnType<typeof usePendingApprovals>;

/**
 * Hook to fetch entries pending approval (for approvers)
 *
 * @param workspaceId - UUID of the workspace
 * @param options - Optional configuration
 * @returns React Query result with pending entries
 */
export function usePendingApprovals(workspaceId: string, options?: UsePendingApprovalsOptions) {
  const { enabled = true, staleTime } = options ?? {};

  return useQuery({
    queryKey: queryKeys.pendingApprovals(workspaceId),
    queryFn: () => fetchPendingApprovals(workspaceId),
    enabled: enabled && !!workspaceId,
    staleTime,
  });
}

/**
 * Options for the useMySubmissions hook
 */
export interface UseMySubmissionsOptions {
  /** Whether the query should be enabled */
  enabled?: boolean;
  /** Override the default stale time */
  staleTime?: number;
  /** Filter by specific status(es) */
  statuses?: ApprovalStatus[];
}

/**
 * Result type for useMySubmissions hook
 */
export type UseMySubmissionsResult = ReturnType<typeof useMySubmissions>;

/**
 * Hook to fetch the current user's submitted entries
 *
 * @param workspaceId - UUID of the workspace
 * @param options - Optional configuration
 * @returns React Query result with user's submissions
 */
export function useMySubmissions(workspaceId: string, options?: UseMySubmissionsOptions) {
  const { enabled = true, staleTime, statuses } = options ?? {};

  return useQuery({
    queryKey: [...queryKeys.mySubmissions(workspaceId), statuses],
    queryFn: () => fetchMySubmissions(workspaceId, statuses),
    enabled: enabled && !!workspaceId,
    staleTime,
  });
}

/**
 * Options for the useApprovalAssignments hook
 */
export interface UseApprovalAssignmentsOptions {
  /** Whether the query should be enabled */
  enabled?: boolean;
  /** Override the default stale time */
  staleTime?: number;
}

/**
 * Result type for useApprovalAssignments hook
 */
export type UseApprovalAssignmentsResult = ReturnType<typeof useApprovalAssignments>;

/**
 * Hook to fetch all approval assignments for a workspace
 *
 * @param workspaceId - UUID of the workspace
 * @param options - Optional configuration
 * @returns React Query result with assignments
 */
export function useApprovalAssignments(
  workspaceId: string,
  options?: UseApprovalAssignmentsOptions
) {
  const { enabled = true, staleTime } = options ?? {};

  return useQuery({
    queryKey: queryKeys.approvalAssignments(workspaceId),
    queryFn: () => fetchApprovalAssignments(workspaceId),
    enabled: enabled && !!workspaceId,
    staleTime,
  });
}
