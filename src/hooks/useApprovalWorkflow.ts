/**
 * Approval Workflow Mutation Hooks
 *
 * This module provides TanStack Query mutations for approval workflow operations.
 *
 * USAGE:
 * ```typescript
 * import { useSubmitEntries, useApproveEntries, useRejectEntries } from '@/hooks';
 *
 * function ApprovalActions({ entryIds }) {
 *   const approve = useApproveEntries({
 *     onSuccess: () => console.log('Entries approved'),
 *   });
 *
 *   const handleApprove = () => {
 *     approve.mutate({ workspaceId, entry_ids: entryIds });
 *   };
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies enforce that only entry owners can submit
 * - Only designated approvers can approve/reject
 * - Only admins can manage assignments
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  SubmitEntriesInputSchema,
  ApproveEntriesInputSchema,
  RejectEntriesInputSchema,
  CreateApprovalAssignmentSchema,
  ApprovalAssignmentSchema,
  type SubmitEntriesInput,
  type ApproveEntriesInput,
  type RejectEntriesInput,
  type CreateApprovalAssignmentInput,
  type ApprovalAssignment,
} from '@/schemas';
import { ApprovalFetchError } from './useApprovals';

// ============================================================================
// SUBMIT ENTRIES
// ============================================================================

/**
 * Parameters for submitting entries
 */
export interface SubmitEntriesParams extends SubmitEntriesInput {
  workspaceId: string;
}

/**
 * Submit time entries for approval
 *
 * @param params - Workspace ID and entry IDs to submit
 * @returns Promise<void>
 * @throws ApprovalFetchError if submission fails
 */
async function submitEntries({ workspaceId, entry_ids }: SubmitEntriesParams): Promise<void> {
  // Validate input
  const validationResult = SubmitEntriesInputSchema.safeParse({ entry_ids });
  if (!validationResult.success) {
    throw new ApprovalFetchError(
      `Validation failed: ${validationResult.error.message}`,
      'VALIDATION_ERROR',
      validationResult.error.flatten()
    );
  }

  // Get current user
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user.id) {
    throw new ApprovalFetchError('Not authenticated', 'UNAUTHORIZED');
  }

  const userId = sessionData.session.user.id;

  // Find the user's approver for this workspace
  const { data: assignment, error: assignmentError } = await supabase
    .from('approval_assignments')
    .select('approver_user_id')
    .eq('workspace_id', workspaceId)
    .eq('member_user_id', userId)
    .single();

  if (assignmentError && assignmentError.code !== 'PGRST116') {
    throw new ApprovalFetchError(assignmentError.message, assignmentError.code);
  }

  if (!assignment) {
    throw new ApprovalFetchError(
      'No approver assigned. Please contact your workspace admin.',
      'NO_APPROVER'
    );
  }

  // Verify all entries belong to the user and are in draft status
  const { data: entries, error: entriesError } = await supabase
    .from('time_entries')
    .select('id, user_id, approval_status')
    .in('id', entry_ids);

  if (entriesError) {
    throw new ApprovalFetchError(entriesError.message, entriesError.code);
  }

  if (!entries || entries.length !== entry_ids.length) {
    throw new ApprovalFetchError('Some entries were not found', 'ENTRIES_NOT_FOUND');
  }

  for (const entry of entries) {
    if (entry.user_id !== userId) {
      throw new ApprovalFetchError('You can only submit your own entries', 'NOT_OWNER');
    }
    if (entry.approval_status !== 'draft') {
      throw new ApprovalFetchError(
        'Only draft entries can be submitted for approval',
        'INVALID_STATUS'
      );
    }
  }

  // Update entries with approval info
  const { error: updateError } = await supabase
    .from('time_entries')
    .update({
      approval_status: 'submitted',
      submitted_at: new Date().toISOString(),
      approver_id: assignment.approver_user_id,
    })
    .in('id', entry_ids);

  if (updateError) {
    throw new ApprovalFetchError(updateError.message, updateError.code, updateError.details);
  }
}

/**
 * Options for useSubmitEntries hook
 */
export interface UseSubmitEntriesOptions {
  /** Callback invoked on successful submission */
  onSuccess?: (params: SubmitEntriesParams) => void;
  /** Callback invoked on error */
  onError?: (error: ApprovalFetchError) => void;
}

/**
 * Result type for useSubmitEntries hook
 */
export type UseSubmitEntriesResult = ReturnType<typeof useSubmitEntries>;

/**
 * Hook to submit time entries for approval
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useSubmitEntries(options?: UseSubmitEntriesOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitEntries,
    onSuccess: (_data, params) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.mySubmissions(params.workspaceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries() });
      options?.onSuccess?.(params);
    },
    onError: (error: Error) => {
      const fetchError =
        error instanceof ApprovalFetchError ? error : new ApprovalFetchError(error.message);
      options?.onError?.(fetchError);
    },
  });
}

// ============================================================================
// APPROVE ENTRIES
// ============================================================================

/**
 * Parameters for approving entries
 */
export interface ApproveEntriesParams extends ApproveEntriesInput {
  workspaceId: string;
}

/**
 * Approve time entries
 *
 * @param params - Workspace ID, entry IDs, and optional note
 * @returns Promise<void>
 * @throws ApprovalFetchError if approval fails
 */
async function approveEntries({
  workspaceId,
  entry_ids,
  approval_note,
}: ApproveEntriesParams): Promise<void> {
  // Validate input
  const validationResult = ApproveEntriesInputSchema.safeParse({ entry_ids, approval_note });
  if (!validationResult.success) {
    throw new ApprovalFetchError(
      `Validation failed: ${validationResult.error.message}`,
      'VALIDATION_ERROR',
      validationResult.error.flatten()
    );
  }

  // Get current user
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user.id) {
    throw new ApprovalFetchError('Not authenticated', 'UNAUTHORIZED');
  }

  const userId = sessionData.session.user.id;

  // Verify all entries are assigned to the current user as approver and are submitted
  const { data: entries, error: entriesError } = await supabase
    .from('time_entries')
    .select('id, approver_id, approval_status')
    .in('id', entry_ids);

  if (entriesError) {
    throw new ApprovalFetchError(entriesError.message, entriesError.code);
  }

  if (!entries || entries.length !== entry_ids.length) {
    throw new ApprovalFetchError('Some entries were not found', 'ENTRIES_NOT_FOUND');
  }

  for (const entry of entries) {
    if (entry.approver_id !== userId) {
      throw new ApprovalFetchError(
        'You are not authorized to approve these entries',
        'NOT_APPROVER'
      );
    }
    if (entry.approval_status !== 'submitted') {
      throw new ApprovalFetchError('Only submitted entries can be approved', 'INVALID_STATUS');
    }
  }

  // Update entries with approval
  const { error: updateError } = await supabase
    .from('time_entries')
    .update({
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      approval_note: approval_note ?? null,
    })
    .in('id', entry_ids);

  if (updateError) {
    throw new ApprovalFetchError(updateError.message, updateError.code, updateError.details);
  }
}

/**
 * Options for useApproveEntries hook
 */
export interface UseApproveEntriesOptions {
  /** Callback invoked on successful approval */
  onSuccess?: (params: ApproveEntriesParams) => void;
  /** Callback invoked on error */
  onError?: (error: ApprovalFetchError) => void;
}

/**
 * Result type for useApproveEntries hook
 */
export type UseApproveEntriesResult = ReturnType<typeof useApproveEntries>;

/**
 * Hook to approve time entries
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useApproveEntries(options?: UseApproveEntriesOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveEntries,
    onSuccess: (_data, params) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingApprovals(params.workspaceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.mySubmissions(params.workspaceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries() });
      options?.onSuccess?.(params);
    },
    onError: (error: Error) => {
      const fetchError =
        error instanceof ApprovalFetchError ? error : new ApprovalFetchError(error.message);
      options?.onError?.(fetchError);
    },
  });
}

// ============================================================================
// REJECT ENTRIES
// ============================================================================

/**
 * Parameters for rejecting entries
 */
export interface RejectEntriesParams extends RejectEntriesInput {
  workspaceId: string;
}

/**
 * Reject time entries
 *
 * @param params - Workspace ID, entry IDs, and required note
 * @returns Promise<void>
 * @throws ApprovalFetchError if rejection fails
 */
async function rejectEntries({
  workspaceId,
  entry_ids,
  approval_note,
}: RejectEntriesParams): Promise<void> {
  // Validate input
  const validationResult = RejectEntriesInputSchema.safeParse({ entry_ids, approval_note });
  if (!validationResult.success) {
    throw new ApprovalFetchError(
      `Validation failed: ${validationResult.error.message}`,
      'VALIDATION_ERROR',
      validationResult.error.flatten()
    );
  }

  // Get current user
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user.id) {
    throw new ApprovalFetchError('Not authenticated', 'UNAUTHORIZED');
  }

  const userId = sessionData.session.user.id;

  // Verify all entries are assigned to the current user as approver and are submitted
  const { data: entries, error: entriesError } = await supabase
    .from('time_entries')
    .select('id, approver_id, approval_status')
    .in('id', entry_ids);

  if (entriesError) {
    throw new ApprovalFetchError(entriesError.message, entriesError.code);
  }

  if (!entries || entries.length !== entry_ids.length) {
    throw new ApprovalFetchError('Some entries were not found', 'ENTRIES_NOT_FOUND');
  }

  for (const entry of entries) {
    if (entry.approver_id !== userId) {
      throw new ApprovalFetchError(
        'You are not authorized to reject these entries',
        'NOT_APPROVER'
      );
    }
    if (entry.approval_status !== 'submitted') {
      throw new ApprovalFetchError('Only submitted entries can be rejected', 'INVALID_STATUS');
    }
  }

  // Update entries with rejection
  const { error: updateError } = await supabase
    .from('time_entries')
    .update({
      approval_status: 'rejected',
      approved_at: new Date().toISOString(),
      approval_note,
    })
    .in('id', entry_ids);

  if (updateError) {
    throw new ApprovalFetchError(updateError.message, updateError.code, updateError.details);
  }
}

/**
 * Options for useRejectEntries hook
 */
export interface UseRejectEntriesOptions {
  /** Callback invoked on successful rejection */
  onSuccess?: (params: RejectEntriesParams) => void;
  /** Callback invoked on error */
  onError?: (error: ApprovalFetchError) => void;
}

/**
 * Result type for useRejectEntries hook
 */
export type UseRejectEntriesResult = ReturnType<typeof useRejectEntries>;

/**
 * Hook to reject time entries
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useRejectEntries(options?: UseRejectEntriesOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: rejectEntries,
    onSuccess: (_data, params) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingApprovals(params.workspaceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.mySubmissions(params.workspaceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries() });
      options?.onSuccess?.(params);
    },
    onError: (error: Error) => {
      const fetchError =
        error instanceof ApprovalFetchError ? error : new ApprovalFetchError(error.message);
      options?.onError?.(fetchError);
    },
  });
}

// ============================================================================
// SET APPROVAL ASSIGNMENT
// ============================================================================

/**
 * Parameters for setting approval assignment
 */
export interface SetApprovalAssignmentParams extends CreateApprovalAssignmentInput {
  workspaceId: string;
}

/**
 * Set or update an approval assignment
 *
 * @param params - Workspace ID, member user ID, and approver user ID
 * @returns Promise<ApprovalAssignment> - The created/updated assignment
 * @throws ApprovalFetchError if operation fails
 */
async function setApprovalAssignment({
  workspaceId,
  member_user_id,
  approver_user_id,
}: SetApprovalAssignmentParams): Promise<ApprovalAssignment> {
  // Validate input
  const validationResult = CreateApprovalAssignmentSchema.safeParse({
    member_user_id,
    approver_user_id,
  });
  if (!validationResult.success) {
    throw new ApprovalFetchError(
      `Validation failed: ${validationResult.error.message}`,
      'VALIDATION_ERROR',
      validationResult.error.flatten()
    );
  }

  // Get current user
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user.id) {
    throw new ApprovalFetchError('Not authenticated', 'UNAUTHORIZED');
  }

  const userId = sessionData.session.user.id;

  // Upsert the assignment
  const { data, error } = await supabase
    .from('approval_assignments')
    .upsert(
      {
        workspace_id: workspaceId,
        member_user_id,
        approver_user_id,
        created_by: userId,
      },
      {
        onConflict: 'workspace_id,member_user_id',
      }
    )
    .select()
    .single();

  if (error) {
    throw new ApprovalFetchError(error.message, error.code, error.details);
  }

  if (!data) {
    throw new ApprovalFetchError('Failed to create assignment', 'NO_DATA');
  }

  const parsed = ApprovalAssignmentSchema.safeParse(data);
  if (!parsed.success) {
    console.warn('[useApprovalWorkflow] Invalid response data:', data, parsed.error);
    return data as ApprovalAssignment;
  }

  return parsed.data;
}

/**
 * Options for useSetApprovalAssignment hook
 */
export interface UseSetApprovalAssignmentOptions {
  /** Callback invoked on successful assignment */
  onSuccess?: (assignment: ApprovalAssignment) => void;
  /** Callback invoked on error */
  onError?: (error: ApprovalFetchError) => void;
}

/**
 * Result type for useSetApprovalAssignment hook
 */
export type UseSetApprovalAssignmentResult = ReturnType<typeof useSetApprovalAssignment>;

/**
 * Hook to set or update an approval assignment
 *
 * Requires admin or owner role.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useSetApprovalAssignment(options?: UseSetApprovalAssignmentOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setApprovalAssignment,
    onSuccess: (data, params) => {
      // Invalidate assignments query
      queryClient.invalidateQueries({
        queryKey: queryKeys.approvalAssignments(params.workspaceId),
      });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      const fetchError =
        error instanceof ApprovalFetchError ? error : new ApprovalFetchError(error.message);
      options?.onError?.(fetchError);
    },
  });
}

// ============================================================================
// DELETE APPROVAL ASSIGNMENT
// ============================================================================

/**
 * Parameters for deleting approval assignment
 */
export interface DeleteApprovalAssignmentParams {
  assignmentId: string;
  workspaceId: string;
}

/**
 * Delete an approval assignment
 *
 * @param params - Assignment ID and workspace ID
 * @returns Promise<void>
 * @throws ApprovalFetchError if deletion fails
 */
async function deleteApprovalAssignment({
  assignmentId,
}: DeleteApprovalAssignmentParams): Promise<void> {
  // RLS ensures user is admin/owner
  const { error } = await supabase.from('approval_assignments').delete().eq('id', assignmentId);

  if (error) {
    throw new ApprovalFetchError(error.message, error.code, error.details);
  }
}

/**
 * Options for useDeleteApprovalAssignment hook
 */
export interface UseDeleteApprovalAssignmentOptions {
  /** Callback invoked on successful deletion */
  onSuccess?: (assignmentId: string, workspaceId: string) => void;
  /** Callback invoked on error */
  onError?: (error: ApprovalFetchError, assignmentId: string) => void;
}

/**
 * Result type for useDeleteApprovalAssignment hook
 */
export type UseDeleteApprovalAssignmentResult = ReturnType<typeof useDeleteApprovalAssignment>;

/**
 * Hook to delete an approval assignment
 *
 * Requires admin or owner role.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useDeleteApprovalAssignment(options?: UseDeleteApprovalAssignmentOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteApprovalAssignment,
    onSuccess: (_data, { assignmentId, workspaceId }) => {
      // Invalidate assignments query
      queryClient.invalidateQueries({ queryKey: queryKeys.approvalAssignments(workspaceId) });
      options?.onSuccess?.(assignmentId, workspaceId);
    },
    onError: (error: Error, { assignmentId }) => {
      const fetchError =
        error instanceof ApprovalFetchError ? error : new ApprovalFetchError(error.message);
      options?.onError?.(fetchError, assignmentId);
    },
  });
}
