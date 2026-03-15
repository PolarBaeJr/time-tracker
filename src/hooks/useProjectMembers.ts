/**
 * Project Members Hooks
 *
 * This module provides TanStack Query hooks for managing project members.
 *
 * USAGE:
 * ```typescript
 * import { useProjectMembers, useAddProjectMember, useRemoveProjectMember } from '@/hooks';
 *
 * function MembersList({ projectId }) {
 *   const { data: members, isLoading } = useProjectMembers(projectId);
 *   const addMember = useAddProjectMember();
 *
 *   return members?.map(m => (
 *     <MemberCard key={m.id} member={m} />
 *   ));
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only project/workspace members can view the member list
 * - Only project creator or workspace admins can add/remove members
 * - Project creator (owner) cannot be removed
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  ProjectMemberWithUserSchema,
  AddProjectMemberSchema,
  type ProjectMemberWithUser,
  type AddProjectMemberInput,
  type WorkspaceRole,
} from '@/schemas';
import { ProjectFetchError } from './useProjects';

// ============================================================================
// FETCH PROJECT MEMBERS
// ============================================================================

/**
 * Fetch all members of a project with user details
 *
 * @param projectId - UUID of the project
 * @returns Promise<ProjectMemberWithUser[]> - Array of validated members
 * @throws ProjectFetchError if the fetch fails
 */
export async function fetchProjectMembers(projectId: string): Promise<ProjectMemberWithUser[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select(
      `
      id,
      project_id,
      user_id,
      role,
      added_at,
      user:users!project_members_user_id_fkey (
        id,
        email,
        name
      )
    `
    )
    .eq('project_id', projectId)
    .order('added_at', { ascending: true });

  if (error) {
    throw new ProjectFetchError(error.message, error.code);
  }

  if (!data) {
    return [];
  }

  // Validate each member against the schema
  const validMembers: ProjectMemberWithUser[] = [];
  for (const member of data) {
    // Handle the user join result
    const userData = Array.isArray(member.user) ? member.user[0] : member.user;

    const memberData = {
      id: member.id,
      project_id: member.project_id,
      user_id: member.user_id,
      role: member.role,
      added_at: member.added_at,
      user: userData
        ? {
            id: userData.id,
            email: userData.email,
            name: userData.name,
          }
        : { id: member.user_id, email: 'unknown@example.com', name: null },
    };

    const parsed = ProjectMemberWithUserSchema.safeParse(memberData);
    if (parsed.success) {
      validMembers.push(parsed.data);
    } else {
      console.warn('[useProjectMembers] Member failed validation:', parsed.error.flatten());
    }
  }

  return validMembers;
}

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Options for the useProjectMembers hook
 */
export interface UseProjectMembersOptions {
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
 * Result type for useProjectMembers hook
 */
export type UseProjectMembersResult = ReturnType<typeof useProjectMembers>;

/**
 * Hook to fetch all members of a project
 *
 * @param projectId - UUID of the project
 * @param options - Optional configuration
 * @returns React Query result with members data
 *
 * @example
 * ```typescript
 * const { data: members, isLoading } = useProjectMembers(projectId);
 * ```
 */
export function useProjectMembers(projectId: string, options?: UseProjectMembersOptions) {
  const { enabled = true, staleTime } = options ?? {};

  return useQuery({
    queryKey: queryKeys.projectMembers(projectId),
    queryFn: () => fetchProjectMembers(projectId),
    enabled: enabled && !!projectId,
    staleTime,
  });
}

// ============================================================================
// ADD PROJECT MEMBER
// ============================================================================

/**
 * Parameters for adding a member to a project
 */
export interface AddProjectMemberParams extends AddProjectMemberInput {
  projectId: string;
}

/**
 * Add a member to a project
 *
 * @param params - Project ID and member details
 * @returns Promise<ProjectMemberWithUser> - The added member
 * @throws ProjectFetchError if addition fails
 */
async function addProjectMember({
  projectId,
  user_id,
  role,
}: AddProjectMemberParams): Promise<ProjectMemberWithUser> {
  // Validate input
  const validationResult = AddProjectMemberSchema.safeParse({ user_id, role });
  if (!validationResult.success) {
    throw new ProjectFetchError(
      `Validation failed: ${validationResult.error.message}`,
      'VALIDATION_ERROR',
      validationResult.error.flatten()
    );
  }

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', user_id)
    .single();

  if (existingMember) {
    throw new ProjectFetchError('User is already a project member', 'ALREADY_MEMBER');
  }

  // RLS ensures user is project creator or workspace admin
  const { data, error } = await supabase
    .from('project_members')
    .insert({
      project_id: projectId,
      user_id,
      role: role ?? 'member',
    })
    .select(
      `
      id,
      project_id,
      user_id,
      role,
      added_at,
      user:users!project_members_user_id_fkey (
        id,
        email,
        name
      )
    `
    )
    .single();

  if (error) {
    throw new ProjectFetchError(error.message, error.code, error.details);
  }

  if (!data) {
    throw new ProjectFetchError('Failed to add member', 'NO_DATA');
  }

  // Handle the user join result
  const userData = Array.isArray(data.user) ? data.user[0] : data.user;

  const memberData = {
    id: data.id,
    project_id: data.project_id,
    user_id: data.user_id,
    role: data.role,
    added_at: data.added_at,
    user: userData
      ? {
          id: userData.id,
          email: userData.email,
          name: userData.name,
        }
      : { id: data.user_id, email: 'unknown@example.com', name: null },
  };

  const parsed = ProjectMemberWithUserSchema.safeParse(memberData);
  if (!parsed.success) {
    console.warn('[useProjectMembers] Invalid response data:', data, parsed.error);
    return memberData as ProjectMemberWithUser;
  }

  return parsed.data;
}

/**
 * Options for useAddProjectMember hook
 */
export interface UseAddProjectMemberOptions {
  /**
   * Callback invoked on successful addition
   */
  onSuccess?: (member: ProjectMemberWithUser) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: ProjectFetchError) => void;
}

/**
 * Result type for useAddProjectMember hook
 */
export type UseAddProjectMemberResult = ReturnType<typeof useAddProjectMember>;

/**
 * Hook to add a member to a project
 *
 * Requires project creator or workspace admin role.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useAddProjectMember(options?: UseAddProjectMemberOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addProjectMember,
    onSuccess: (data, { projectId }) => {
      // Invalidate project members query
      queryClient.invalidateQueries({ queryKey: queryKeys.projectMembers(projectId) });
      // Also invalidate project detail to update member count
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      const fetchError =
        error instanceof ProjectFetchError ? error : new ProjectFetchError(error.message);
      options?.onError?.(fetchError);
    },
  });
}

// ============================================================================
// UPDATE PROJECT MEMBER ROLE
// ============================================================================

/**
 * Parameters for updating a project member's role
 */
export interface UpdateProjectMemberRoleParams {
  memberId: string;
  projectId: string;
  role: WorkspaceRole;
}

/**
 * Update a project member's role
 *
 * @param params - Member ID, project ID, and new role
 * @returns Promise<ProjectMemberWithUser> - The updated member
 * @throws ProjectFetchError if update fails
 */
async function updateProjectMemberRole({
  memberId,
  role,
}: UpdateProjectMemberRoleParams): Promise<ProjectMemberWithUser> {
  // Validate role - cannot set role to 'owner'
  if (role === 'owner') {
    throw new ProjectFetchError(
      'Cannot change role to owner. Transfer project ownership instead.',
      'INVALID_ROLE'
    );
  }

  // First, check that we're not modifying the owner's role
  const { data: existingMember, error: fetchError } = await supabase
    .from('project_members')
    .select('role')
    .eq('id', memberId)
    .single();

  if (fetchError) {
    throw new ProjectFetchError(fetchError.message, fetchError.code);
  }

  if (existingMember?.role === 'owner') {
    throw new ProjectFetchError(
      "Cannot change the project owner's role. Transfer ownership first.",
      'CANNOT_MODIFY_OWNER'
    );
  }

  // Update the role - RLS ensures user is project creator or workspace admin
  const { data, error } = await supabase
    .from('project_members')
    .update({ role })
    .eq('id', memberId)
    .select(
      `
      id,
      project_id,
      user_id,
      role,
      added_at,
      user:users!project_members_user_id_fkey (
        id,
        email,
        name
      )
    `
    )
    .single();

  if (error) {
    throw new ProjectFetchError(error.message, error.code, error.details);
  }

  if (!data) {
    throw new ProjectFetchError('Member not found or no permission', 'NOT_FOUND');
  }

  // Handle the user join result
  const userData = Array.isArray(data.user) ? data.user[0] : data.user;

  const memberData = {
    id: data.id,
    project_id: data.project_id,
    user_id: data.user_id,
    role: data.role,
    added_at: data.added_at,
    user: userData
      ? {
          id: userData.id,
          email: userData.email,
          name: userData.name,
        }
      : { id: data.user_id, email: 'unknown@example.com', name: null },
  };

  const parsed = ProjectMemberWithUserSchema.safeParse(memberData);
  if (!parsed.success) {
    console.warn('[useProjectMembers] Invalid response data:', data, parsed.error);
    return memberData as ProjectMemberWithUser;
  }

  return parsed.data;
}

/**
 * Options for useUpdateProjectMemberRole hook
 */
export interface UseUpdateProjectMemberRoleOptions {
  /**
   * Callback invoked on successful update
   */
  onSuccess?: (member: ProjectMemberWithUser) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: ProjectFetchError) => void;
}

/**
 * Result type for useUpdateProjectMemberRole hook
 */
export type UseUpdateProjectMemberRoleResult = ReturnType<typeof useUpdateProjectMemberRole>;

/**
 * Hook to update a project member's role
 *
 * Requires project creator or workspace admin role. Cannot modify the owner's role.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useUpdateProjectMemberRole(options?: UseUpdateProjectMemberRoleOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProjectMemberRole,
    onMutate: async ({ memberId, projectId, role }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.projectMembers(projectId) });

      // Snapshot previous values for rollback
      const previousMembers = queryClient.getQueryData<ProjectMemberWithUser[]>(
        queryKeys.projectMembers(projectId)
      );

      // Optimistically update the cache
      if (previousMembers) {
        queryClient.setQueryData<ProjectMemberWithUser[]>(
          queryKeys.projectMembers(projectId),
          previousMembers.map(m => (m.id === memberId ? { ...m, role } : m))
        );
      }

      return { previousMembers, projectId };
    },
    onError: (error, _params, context) => {
      // Rollback optimistic update on error
      if (context?.previousMembers && context?.projectId) {
        queryClient.setQueryData(
          queryKeys.projectMembers(context.projectId),
          context.previousMembers
        );
      }

      const fetchError =
        error instanceof ProjectFetchError ? error : new ProjectFetchError(error.message);
      options?.onError?.(fetchError);
    },
    onSuccess: (data, { projectId }) => {
      // Invalidate to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.projectMembers(projectId) });
      options?.onSuccess?.(data);
    },
  });
}

// ============================================================================
// REMOVE PROJECT MEMBER
// ============================================================================

/**
 * Parameters for removing a member from a project
 */
export interface RemoveProjectMemberParams {
  memberId: string;
  projectId: string;
}

/**
 * Remove a member from a project
 *
 * @param params - Member ID and project ID
 * @returns Promise<void>
 * @throws ProjectFetchError if removal fails
 */
async function removeProjectMember({ memberId }: RemoveProjectMemberParams): Promise<void> {
  // First, check that we're not removing the owner
  const { data: existingMember, error: fetchError } = await supabase
    .from('project_members')
    .select('role')
    .eq('id', memberId)
    .single();

  if (fetchError) {
    throw new ProjectFetchError(fetchError.message, fetchError.code);
  }

  if (existingMember?.role === 'owner') {
    throw new ProjectFetchError(
      'Cannot remove the project owner. Transfer ownership or delete the project instead.',
      'CANNOT_REMOVE_OWNER'
    );
  }

  // RLS ensures user is project creator or workspace admin
  const { error } = await supabase.from('project_members').delete().eq('id', memberId);

  if (error) {
    throw new ProjectFetchError(error.message, error.code, error.details);
  }
}

/**
 * Options for useRemoveProjectMember hook
 */
export interface UseRemoveProjectMemberOptions {
  /**
   * Callback invoked on successful removal
   */
  onSuccess?: (memberId: string, projectId: string) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: ProjectFetchError, memberId: string) => void;
}

/**
 * Result type for useRemoveProjectMember hook
 */
export type UseRemoveProjectMemberResult = ReturnType<typeof useRemoveProjectMember>;

/**
 * Hook to remove a member from a project
 *
 * Requires project creator or workspace admin role. Cannot remove the owner.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useRemoveProjectMember(options?: UseRemoveProjectMemberOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeProjectMember,
    onMutate: async ({ memberId, projectId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.projectMembers(projectId) });

      // Snapshot previous values for rollback
      const previousMembers = queryClient.getQueryData<ProjectMemberWithUser[]>(
        queryKeys.projectMembers(projectId)
      );

      // Optimistically remove from cache
      if (previousMembers) {
        queryClient.setQueryData<ProjectMemberWithUser[]>(
          queryKeys.projectMembers(projectId),
          previousMembers.filter(m => m.id !== memberId)
        );
      }

      return { previousMembers, projectId, memberId };
    },
    onError: (error, { memberId }, context) => {
      // Rollback optimistic update on error
      if (context?.previousMembers && context?.projectId) {
        queryClient.setQueryData(
          queryKeys.projectMembers(context.projectId),
          context.previousMembers
        );
      }

      const fetchError =
        error instanceof ProjectFetchError ? error : new ProjectFetchError(error.message);
      options?.onError?.(fetchError, memberId);
    },
    onSuccess: (_data, { memberId, projectId }) => {
      // Invalidate to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.projectMembers(projectId) });
      // Also invalidate project detail to update member count
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      options?.onSuccess?.(memberId, projectId);
    },
  });
}
