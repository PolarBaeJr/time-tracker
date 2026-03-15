/**
 * Workspace Members Hooks
 *
 * This module provides TanStack Query hooks for managing workspace members.
 *
 * USAGE:
 * ```typescript
 * import { useWorkspaceMembers, useUpdateMemberRole, useRemoveMember } from '@/hooks';
 *
 * function MembersList({ workspaceId }) {
 *   const { data: members, isLoading } = useWorkspaceMembers(workspaceId);
 *   const updateRole = useUpdateMemberRole();
 *
 *   return members?.map(m => (
 *     <MemberCard key={m.id} member={m} />
 *   ));
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only workspace members can view the member list
 * - Only admins/owners can update roles or remove members
 * - Owners cannot be removed or demoted
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  WorkspaceMemberWithUserSchema,
  type WorkspaceMemberWithUser,
  type WorkspaceRole,
} from '@/schemas';
import { WorkspaceFetchError } from './useWorkspaces';

// ============================================================================
// FETCH WORKSPACE MEMBERS
// ============================================================================

/**
 * Fetch all members of a workspace with user details
 *
 * @param workspaceId - UUID of the workspace
 * @returns Promise<WorkspaceMemberWithUser[]> - Array of validated members
 * @throws WorkspaceFetchError if the fetch fails
 */
export async function fetchWorkspaceMembers(
  workspaceId: string
): Promise<WorkspaceMemberWithUser[]> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select(
      `
      id,
      workspace_id,
      user_id,
      role,
      joined_at,
      user:users!workspace_members_user_id_fkey (
        id,
        email,
        name
      )
    `
    )
    .eq('workspace_id', workspaceId)
    .order('joined_at', { ascending: true });

  if (error) {
    throw new WorkspaceFetchError(error.message, error.code);
  }

  if (!data) {
    return [];
  }

  // Validate each member against the schema
  const validMembers: WorkspaceMemberWithUser[] = [];
  for (const member of data) {
    // Handle the user join result
    const userData = Array.isArray(member.user) ? member.user[0] : member.user;

    const memberData = {
      id: member.id,
      workspace_id: member.workspace_id,
      user_id: member.user_id,
      role: member.role,
      joined_at: member.joined_at,
      user: userData
        ? {
            id: userData.id,
            email: userData.email,
            name: userData.name,
          }
        : { id: member.user_id, email: 'unknown@example.com', name: null },
    };

    const parsed = WorkspaceMemberWithUserSchema.safeParse(memberData);
    if (parsed.success) {
      validMembers.push(parsed.data);
    } else {
      console.warn('[useWorkspaceMembers] Member failed validation:', parsed.error.flatten());
    }
  }

  return validMembers;
}

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Options for the useWorkspaceMembers hook
 */
export interface UseWorkspaceMembersOptions {
  /**
   * Whether the query should be enabled
   */
  enabled?: boolean;

  /**
   * Override the default stale time
   */
  staleTime?: number;
}

/**
 * Hook to fetch all members of a workspace
 *
 * @param workspaceId - UUID of the workspace
 * @param options - Optional configuration
 * @returns React Query result with members data
 *
 * @example
 * ```typescript
 * const { data: members, isLoading } = useWorkspaceMembers(workspaceId);
 * ```
 */
export function useWorkspaceMembers(workspaceId: string, options?: UseWorkspaceMembersOptions) {
  const { enabled = true, staleTime } = options ?? {};

  return useQuery({
    queryKey: queryKeys.workspaceMembers(workspaceId),
    queryFn: () => fetchWorkspaceMembers(workspaceId),
    enabled: enabled && !!workspaceId,
    staleTime,
  });
}

// ============================================================================
// UPDATE MEMBER ROLE
// ============================================================================

/**
 * Parameters for updating a member's role
 */
export interface UpdateMemberRoleParams {
  memberId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

/**
 * Update a member's role in a workspace
 *
 * @param params - Member ID, workspace ID, and new role
 * @returns Promise<WorkspaceMemberWithUser> - The updated member
 * @throws WorkspaceFetchError if update fails
 */
async function updateMemberRole({
  memberId,
  workspaceId,
  role,
}: UpdateMemberRoleParams): Promise<WorkspaceMemberWithUser> {
  // Validate role - cannot set role to 'owner' (ownership transfer not supported)
  if (role === 'owner') {
    throw new WorkspaceFetchError(
      'Cannot change role to owner. Use ownership transfer instead.',
      'INVALID_ROLE'
    );
  }

  // First, check that we're not modifying the owner's role
  const { data: existingMember, error: fetchError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('id', memberId)
    .single();

  if (fetchError) {
    throw new WorkspaceFetchError(fetchError.message, fetchError.code);
  }

  if (existingMember?.role === 'owner') {
    throw new WorkspaceFetchError(
      "Cannot change the owner's role. Transfer ownership first.",
      'CANNOT_MODIFY_OWNER'
    );
  }

  // Update the role - RLS ensures user is admin/owner
  const { data, error } = await supabase
    .from('workspace_members')
    .update({ role })
    .eq('id', memberId)
    .select(
      `
      id,
      workspace_id,
      user_id,
      role,
      joined_at,
      user:users!workspace_members_user_id_fkey (
        id,
        email,
        name
      )
    `
    )
    .single();

  if (error) {
    throw new WorkspaceFetchError(error.message, error.code, error.details);
  }

  if (!data) {
    throw new WorkspaceFetchError('Member not found or no permission', 'NOT_FOUND');
  }

  // Handle the user join result
  const userData = Array.isArray(data.user) ? data.user[0] : data.user;

  const memberData = {
    id: data.id,
    workspace_id: data.workspace_id,
    user_id: data.user_id,
    role: data.role,
    joined_at: data.joined_at,
    user: userData
      ? {
          id: userData.id,
          email: userData.email,
          name: userData.name,
        }
      : { id: data.user_id, email: 'unknown@example.com', name: null },
  };

  const parsed = WorkspaceMemberWithUserSchema.safeParse(memberData);
  if (!parsed.success) {
    console.warn('[useWorkspaceMembers] Invalid response data:', data, parsed.error);
    return memberData as WorkspaceMemberWithUser;
  }

  return parsed.data;
}

/**
 * Options for useUpdateMemberRole hook
 */
export interface UseUpdateMemberRoleOptions {
  /**
   * Callback invoked on successful update
   */
  onSuccess?: (member: WorkspaceMemberWithUser) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: WorkspaceFetchError) => void;
}

/**
 * Hook to update a member's role
 *
 * Requires admin or owner role. Cannot modify the owner's role.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useUpdateMemberRole(options?: UseUpdateMemberRoleOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMemberRole,
    onMutate: async ({ memberId, workspaceId, role }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.workspaceMembers(workspaceId) });

      // Snapshot previous values for rollback
      const previousMembers = queryClient.getQueryData<WorkspaceMemberWithUser[]>(
        queryKeys.workspaceMembers(workspaceId)
      );

      // Optimistically update the cache
      if (previousMembers) {
        queryClient.setQueryData<WorkspaceMemberWithUser[]>(
          queryKeys.workspaceMembers(workspaceId),
          previousMembers.map(m => (m.id === memberId ? { ...m, role } : m))
        );
      }

      return { previousMembers, workspaceId };
    },
    onError: (error, _params, context) => {
      // Rollback optimistic update on error
      if (context?.previousMembers && context?.workspaceId) {
        queryClient.setQueryData(
          queryKeys.workspaceMembers(context.workspaceId),
          context.previousMembers
        );
      }

      const fetchError =
        error instanceof WorkspaceFetchError ? error : new WorkspaceFetchError(error.message);
      options?.onError?.(fetchError);
    },
    onSuccess: (data, { workspaceId }) => {
      // Invalidate to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaceMembers(workspaceId) });
      options?.onSuccess?.(data);
    },
  });
}

// ============================================================================
// REMOVE MEMBER
// ============================================================================

/**
 * Parameters for removing a member from a workspace
 */
export interface RemoveMemberParams {
  memberId: string;
  workspaceId: string;
}

/**
 * Remove a member from a workspace
 *
 * @param params - Member ID and workspace ID
 * @returns Promise<void>
 * @throws WorkspaceFetchError if removal fails
 */
async function removeMember({ memberId, workspaceId }: RemoveMemberParams): Promise<void> {
  // First, check that we're not removing the owner
  const { data: existingMember, error: fetchError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('id', memberId)
    .single();

  if (fetchError) {
    throw new WorkspaceFetchError(fetchError.message, fetchError.code);
  }

  if (existingMember?.role === 'owner') {
    throw new WorkspaceFetchError(
      'Cannot remove the workspace owner. Transfer ownership or delete the workspace instead.',
      'CANNOT_REMOVE_OWNER'
    );
  }

  // RLS ensures user is admin/owner
  const { error } = await supabase.from('workspace_members').delete().eq('id', memberId);

  if (error) {
    throw new WorkspaceFetchError(error.message, error.code, error.details);
  }
}

/**
 * Options for useRemoveMember hook
 */
export interface UseRemoveMemberOptions {
  /**
   * Callback invoked on successful removal
   */
  onSuccess?: (memberId: string, workspaceId: string) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: WorkspaceFetchError, memberId: string) => void;
}

/**
 * Hook to remove a member from a workspace
 *
 * Requires admin or owner role. Cannot remove the owner.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useRemoveMember(options?: UseRemoveMemberOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeMember,
    onMutate: async ({ memberId, workspaceId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.workspaceMembers(workspaceId) });

      // Snapshot previous values for rollback
      const previousMembers = queryClient.getQueryData<WorkspaceMemberWithUser[]>(
        queryKeys.workspaceMembers(workspaceId)
      );

      // Optimistically remove from cache
      if (previousMembers) {
        queryClient.setQueryData<WorkspaceMemberWithUser[]>(
          queryKeys.workspaceMembers(workspaceId),
          previousMembers.filter(m => m.id !== memberId)
        );
      }

      return { previousMembers, workspaceId, memberId };
    },
    onError: (error, { memberId }, context) => {
      // Rollback optimistic update on error
      if (context?.previousMembers && context?.workspaceId) {
        queryClient.setQueryData(
          queryKeys.workspaceMembers(context.workspaceId),
          context.previousMembers
        );
      }

      const fetchError =
        error instanceof WorkspaceFetchError ? error : new WorkspaceFetchError(error.message);
      options?.onError?.(fetchError, memberId);
    },
    onSuccess: (_data, { memberId, workspaceId }) => {
      // Invalidate to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaceMembers(workspaceId) });
      // Also invalidate workspaces to update member counts
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      options?.onSuccess?.(memberId, workspaceId);
    },
  });
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UseWorkspaceMembersResult = ReturnType<typeof useWorkspaceMembers>;
export type UseUpdateMemberRoleResult = ReturnType<typeof useUpdateMemberRole>;
export type UseRemoveMemberResult = ReturnType<typeof useRemoveMember>;
