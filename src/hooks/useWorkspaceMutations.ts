/**
 * Workspace Mutation Hooks
 *
 * This module provides TanStack Query mutations for creating, updating,
 * and deleting workspaces.
 *
 * USAGE:
 * ```typescript
 * import { useCreateWorkspace, useUpdateWorkspace, useDeleteWorkspace } from '@/hooks';
 *
 * function CreateWorkspaceForm() {
 *   const createWorkspace = useCreateWorkspace({
 *     onSuccess: (ws) => console.log('Created workspace:', ws.name),
 *   });
 *
 *   const handleSubmit = (data) => {
 *     createWorkspace.mutate(data);
 *   };
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies enforce that only the workspace owner can update/delete
 * - User membership is automatically created for the creator as 'owner'
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  WorkspaceSchema,
  CreateWorkspaceSchema,
  UpdateWorkspaceSchema,
  type Workspace,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
} from '@/schemas';
import { WorkspaceFetchError } from './useWorkspaces';

// ============================================================================
// CREATE WORKSPACE
// ============================================================================

/**
 * Create a new workspace and add the creator as owner
 *
 * @param input - Workspace data validated against CreateWorkspaceSchema
 * @returns Promise<Workspace> - The created workspace
 * @throws WorkspaceFetchError if validation or creation fails
 */
async function createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
  // Validate input
  const validationResult = CreateWorkspaceSchema.safeParse(input);
  if (!validationResult.success) {
    throw new WorkspaceFetchError(
      `Validation failed: ${validationResult.error.message}`,
      'VALIDATION_ERROR',
      validationResult.error.flatten()
    );
  }

  const validatedInput = validationResult.data;

  // Get current user
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user.id) {
    throw new WorkspaceFetchError('Not authenticated', 'UNAUTHORIZED');
  }

  const userId = sessionData.session.user.id;

  // Insert the workspace
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({
      name: validatedInput.name,
      slug: validatedInput.slug,
      owner_id: userId,
    })
    .select()
    .single();

  if (workspaceError) {
    // Handle unique constraint violations (slug already taken)
    if (workspaceError.code === '23505') {
      throw new WorkspaceFetchError(
        'A workspace with this slug already exists',
        'SLUG_TAKEN',
        workspaceError.details
      );
    }
    throw new WorkspaceFetchError(
      workspaceError.message,
      workspaceError.code,
      workspaceError.details
    );
  }

  if (!workspace) {
    throw new WorkspaceFetchError('No data returned from insert', 'NO_DATA');
  }

  // Add the creator as an owner member
  const { error: memberError } = await supabase.from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id: userId,
    role: 'owner',
  });

  if (memberError) {
    // Cleanup: delete the workspace if member creation fails
    await supabase.from('workspaces').delete().eq('id', workspace.id);
    throw new WorkspaceFetchError(
      `Failed to add owner as member: ${memberError.message}`,
      memberError.code,
      memberError.details
    );
  }

  const parsed = WorkspaceSchema.safeParse(workspace);
  if (!parsed.success) {
    console.warn('[useWorkspaceMutations] Invalid response data:', workspace, parsed.error);
    return workspace as Workspace;
  }

  return parsed.data;
}

/**
 * Options for useCreateWorkspace hook
 */
export interface UseCreateWorkspaceOptions {
  /**
   * Callback invoked on successful creation
   */
  onSuccess?: (workspace: Workspace) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: WorkspaceFetchError) => void;
}

/**
 * Hook to create a new workspace
 *
 * Creates the workspace and adds the creator as an owner member.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useCreateWorkspace(options?: UseCreateWorkspaceOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWorkspace,
    onSuccess: data => {
      // Invalidate workspaces query to include the new workspace
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      const fetchError =
        error instanceof WorkspaceFetchError ? error : new WorkspaceFetchError(error.message);
      options?.onError?.(fetchError);
    },
  });
}

// ============================================================================
// UPDATE WORKSPACE
// ============================================================================

/**
 * Parameters for updating a workspace
 */
export interface UpdateWorkspaceParams {
  id: string;
  data: UpdateWorkspaceInput;
}

/**
 * Update an existing workspace
 *
 * @param params - Workspace ID and update data
 * @returns Promise<Workspace> - The updated workspace
 * @throws WorkspaceFetchError if validation or update fails
 */
async function updateWorkspace({ id, data }: UpdateWorkspaceParams): Promise<Workspace> {
  // Validate input
  const validationResult = UpdateWorkspaceSchema.safeParse(data);
  if (!validationResult.success) {
    throw new WorkspaceFetchError(
      `Validation failed: ${validationResult.error.message}`,
      'VALIDATION_ERROR',
      validationResult.error.flatten()
    );
  }

  const validatedInput = validationResult.data;

  // Build the update object, only including defined fields
  const updateData: Record<string, unknown> = {};

  if (validatedInput.name !== undefined) {
    updateData.name = validatedInput.name;
  }
  if (validatedInput.slug !== undefined) {
    updateData.slug = validatedInput.slug;
  }

  if (Object.keys(updateData).length === 0) {
    throw new WorkspaceFetchError('No fields to update', 'VALIDATION_ERROR');
  }

  // RLS ensures user is admin/owner
  const { data: result, error } = await supabase
    .from('workspaces')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    // Handle unique constraint violations (slug already taken)
    if (error.code === '23505') {
      throw new WorkspaceFetchError(
        'A workspace with this slug already exists',
        'SLUG_TAKEN',
        error.details
      );
    }
    throw new WorkspaceFetchError(error.message, error.code, error.details);
  }

  if (!result) {
    throw new WorkspaceFetchError('Workspace not found or no permission', 'NOT_FOUND');
  }

  const parsed = WorkspaceSchema.safeParse(result);
  if (!parsed.success) {
    console.warn('[useWorkspaceMutations] Invalid response data:', result, parsed.error);
    return result as Workspace;
  }

  return parsed.data;
}

/**
 * Options for useUpdateWorkspace hook
 */
export interface UseUpdateWorkspaceOptions {
  /**
   * Callback invoked on successful update
   */
  onSuccess?: (workspace: Workspace) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: WorkspaceFetchError) => void;
}

/**
 * Hook to update an existing workspace
 *
 * Requires admin or owner role.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useUpdateWorkspace(options?: UseUpdateWorkspaceOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateWorkspace,
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.workspaces });
      await queryClient.cancelQueries({ queryKey: queryKeys.workspace(id) });

      // Snapshot previous values for rollback
      const previousWorkspaces = queryClient.getQueryData<Workspace[]>(queryKeys.workspaces);
      const previousWorkspace = queryClient.getQueryData<Workspace>(queryKeys.workspace(id));

      // Optimistically update the cache
      if (previousWorkspaces) {
        queryClient.setQueryData<Workspace[]>(queryKeys.workspaces, old =>
          old?.map(ws => (ws.id === id ? { ...ws, ...data } : ws))
        );
      }

      if (previousWorkspace) {
        queryClient.setQueryData<Workspace>(queryKeys.workspace(id), {
          ...previousWorkspace,
          ...data,
        });
      }

      return { previousWorkspaces, previousWorkspace };
    },
    onError: (error, { id }, context) => {
      // Rollback optimistic update on error
      if (context?.previousWorkspaces) {
        queryClient.setQueryData(queryKeys.workspaces, context.previousWorkspaces);
      }
      if (context?.previousWorkspace) {
        queryClient.setQueryData(queryKeys.workspace(id), context.previousWorkspace);
      }

      const fetchError =
        error instanceof WorkspaceFetchError ? error : new WorkspaceFetchError(error.message);
      options?.onError?.(fetchError);
    },
    onSuccess: data => {
      // Invalidate to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      queryClient.invalidateQueries({ queryKey: queryKeys.workspace(data.id) });
      options?.onSuccess?.(data);
    },
  });
}

// ============================================================================
// DELETE WORKSPACE
// ============================================================================

/**
 * Delete a workspace permanently
 *
 * @param id - UUID of the workspace to delete
 * @returns Promise<void>
 * @throws WorkspaceFetchError if deletion fails
 */
async function deleteWorkspace(id: string): Promise<void> {
  // RLS ensures user is owner
  const { error } = await supabase.from('workspaces').delete().eq('id', id);

  if (error) {
    throw new WorkspaceFetchError(error.message, error.code, error.details);
  }
}

/**
 * Options for useDeleteWorkspace hook
 */
export interface UseDeleteWorkspaceOptions {
  /**
   * Callback invoked on successful deletion
   */
  onSuccess?: (id: string) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: WorkspaceFetchError, id: string) => void;
}

/**
 * Hook to delete a workspace
 *
 * Requires owner role. This permanently deletes the workspace and all
 * associated data (members, projects, etc.) via CASCADE.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useDeleteWorkspace(options?: UseDeleteWorkspaceOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteWorkspace,
    onMutate: async id => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.workspaces });

      // Snapshot previous values for rollback
      const previousWorkspaces = queryClient.getQueryData<Workspace[]>(queryKeys.workspaces);

      // Optimistically remove from cache
      if (previousWorkspaces) {
        queryClient.setQueryData<Workspace[]>(
          queryKeys.workspaces,
          previousWorkspaces.filter(ws => ws.id !== id)
        );
      }

      return { previousWorkspaces, deletedId: id };
    },
    onError: (error, id, context) => {
      // Rollback optimistic update on error
      if (context?.previousWorkspaces) {
        queryClient.setQueryData(queryKeys.workspaces, context.previousWorkspaces);
      }

      const fetchError =
        error instanceof WorkspaceFetchError ? error : new WorkspaceFetchError(error.message);
      options?.onError?.(fetchError, id);
    },
    onSuccess: (_data, id) => {
      // Invalidate to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      // Remove single workspace from cache
      queryClient.removeQueries({ queryKey: queryKeys.workspace(id) });
      // Also invalidate related queries
      queryClient.removeQueries({ queryKey: queryKeys.workspaceMembers(id) });
      queryClient.removeQueries({ queryKey: queryKeys.workspaceInvites(id) });
      queryClient.removeQueries({ queryKey: queryKeys.projects(id) });
      options?.onSuccess?.(id);
    },
  });
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UseCreateWorkspaceResult = ReturnType<typeof useCreateWorkspace>;
export type UseUpdateWorkspaceResult = ReturnType<typeof useUpdateWorkspace>;
export type UseDeleteWorkspaceResult = ReturnType<typeof useDeleteWorkspace>;
