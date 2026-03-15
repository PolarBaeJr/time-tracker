/**
 * Project Mutation Hooks
 *
 * This module provides TanStack Query mutations for creating, updating,
 * archiving, and deleting projects.
 *
 * USAGE:
 * ```typescript
 * import { useCreateProject, useUpdateProject, useArchiveProject } from '@/hooks';
 *
 * function CreateProjectForm({ workspaceId }) {
 *   const createProject = useCreateProject({
 *     onSuccess: (project) => console.log('Created project:', project.name),
 *   });
 *
 *   const handleSubmit = (data) => {
 *     createProject.mutate({ workspaceId, ...data });
 *   };
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies enforce that only workspace members can create projects
 * - Only project creator or workspace admin can update/archive/delete
 * - Creator is automatically added as project owner
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  ProjectSchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  type Project,
  type CreateProjectInput,
  type UpdateProjectInput,
  type ProjectWithStats,
} from '@/schemas';
import { ProjectFetchError } from './useProjects';

// ============================================================================
// CREATE PROJECT
// ============================================================================

/**
 * Parameters for creating a project
 */
export interface CreateProjectParams extends CreateProjectInput {
  workspaceId: string;
}

/**
 * Create a new project and add the creator as owner
 *
 * @param params - Project data with workspace ID
 * @returns Promise<Project> - The created project
 * @throws ProjectFetchError if validation or creation fails
 */
async function createProject(params: CreateProjectParams): Promise<Project> {
  const { workspaceId, ...input } = params;

  // Validate input
  const validationResult = CreateProjectSchema.safeParse(input);
  if (!validationResult.success) {
    throw new ProjectFetchError(
      `Validation failed: ${validationResult.error.message}`,
      'VALIDATION_ERROR',
      validationResult.error.flatten()
    );
  }

  const validatedInput = validationResult.data;

  // Get current user
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user.id) {
    throw new ProjectFetchError('Not authenticated', 'UNAUTHORIZED');
  }

  const userId = sessionData.session.user.id;

  // Insert the project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      workspace_id: workspaceId,
      name: validatedInput.name,
      color: validatedInput.color,
      description: validatedInput.description ?? null,
      created_by: userId,
    })
    .select()
    .single();

  if (projectError) {
    throw new ProjectFetchError(projectError.message, projectError.code, projectError.details);
  }

  if (!project) {
    throw new ProjectFetchError('No data returned from insert', 'NO_DATA');
  }

  // Add the creator as an owner member
  const { error: memberError } = await supabase.from('project_members').insert({
    project_id: project.id,
    user_id: userId,
    role: 'owner',
  });

  if (memberError) {
    // Cleanup: delete the project if member creation fails
    await supabase.from('projects').delete().eq('id', project.id);
    throw new ProjectFetchError(
      `Failed to add owner as member: ${memberError.message}`,
      memberError.code,
      memberError.details
    );
  }

  const parsed = ProjectSchema.safeParse(project);
  if (!parsed.success) {
    console.warn('[useProjectMutations] Invalid response data:', project, parsed.error);
    return project as Project;
  }

  return parsed.data;
}

/**
 * Options for useCreateProject hook
 */
export interface UseCreateProjectOptions {
  /**
   * Callback invoked on successful creation
   */
  onSuccess?: (project: Project) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: ProjectFetchError) => void;
}

/**
 * Result type for useCreateProject hook
 */
export type UseCreateProjectResult = ReturnType<typeof useCreateProject>;

/**
 * Hook to create a new project
 *
 * Creates the project and adds the creator as an owner member.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useCreateProject(options?: UseCreateProjectOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProject,
    onSuccess: (data, { workspaceId }) => {
      // Invalidate projects query to include the new project
      queryClient.invalidateQueries({ queryKey: queryKeys.projects(workspaceId) });
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
// UPDATE PROJECT
// ============================================================================

/**
 * Parameters for updating a project
 */
export interface UpdateProjectParams {
  id: string;
  workspaceId: string;
  data: UpdateProjectInput;
}

/**
 * Update an existing project
 *
 * @param params - Project ID, workspace ID, and update data
 * @returns Promise<Project> - The updated project
 * @throws ProjectFetchError if validation or update fails
 */
async function updateProject({ id, data }: UpdateProjectParams): Promise<Project> {
  // Validate input
  const validationResult = UpdateProjectSchema.safeParse(data);
  if (!validationResult.success) {
    throw new ProjectFetchError(
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
  if (validatedInput.color !== undefined) {
    updateData.color = validatedInput.color;
  }
  if (validatedInput.description !== undefined) {
    updateData.description = validatedInput.description;
  }
  if (validatedInput.is_archived !== undefined) {
    updateData.is_archived = validatedInput.is_archived;
  }

  if (Object.keys(updateData).length === 0) {
    throw new ProjectFetchError('No fields to update', 'VALIDATION_ERROR');
  }

  // RLS ensures user is creator or workspace admin
  const { data: result, error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new ProjectFetchError(error.message, error.code, error.details);
  }

  if (!result) {
    throw new ProjectFetchError('Project not found or no permission', 'NOT_FOUND');
  }

  const parsed = ProjectSchema.safeParse(result);
  if (!parsed.success) {
    console.warn('[useProjectMutations] Invalid response data:', result, parsed.error);
    return result as Project;
  }

  return parsed.data;
}

/**
 * Options for useUpdateProject hook
 */
export interface UseUpdateProjectOptions {
  /**
   * Callback invoked on successful update
   */
  onSuccess?: (project: Project) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: ProjectFetchError) => void;
}

/**
 * Result type for useUpdateProject hook
 */
export type UseUpdateProjectResult = ReturnType<typeof useUpdateProject>;

/**
 * Hook to update an existing project
 *
 * Requires project creator or workspace admin role.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useUpdateProject(options?: UseUpdateProjectOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProject,
    onMutate: async ({ id, workspaceId, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.projects(workspaceId) });
      await queryClient.cancelQueries({ queryKey: queryKeys.project(id) });

      // Snapshot previous values for rollback
      const previousProjects = queryClient.getQueryData<ProjectWithStats[]>(
        queryKeys.projects(workspaceId)
      );
      const previousProject = queryClient.getQueryData<Project>(queryKeys.project(id));

      // Optimistically update the cache
      if (previousProjects) {
        queryClient.setQueryData<ProjectWithStats[]>(queryKeys.projects(workspaceId), old =>
          old?.map(p => (p.id === id ? { ...p, ...data } : p))
        );
      }

      if (previousProject) {
        queryClient.setQueryData<Project>(queryKeys.project(id), {
          ...previousProject,
          ...data,
        });
      }

      return { previousProjects, previousProject, workspaceId };
    },
    onError: (error, { id, workspaceId }, context) => {
      // Rollback optimistic update on error
      if (context?.previousProjects) {
        queryClient.setQueryData(queryKeys.projects(workspaceId), context.previousProjects);
      }
      if (context?.previousProject) {
        queryClient.setQueryData(queryKeys.project(id), context.previousProject);
      }

      const fetchError =
        error instanceof ProjectFetchError ? error : new ProjectFetchError(error.message);
      options?.onError?.(fetchError);
    },
    onSuccess: (data, { workspaceId }) => {
      // Invalidate to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.projects(workspaceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(data.id) });
      options?.onSuccess?.(data);
    },
  });
}

// ============================================================================
// ARCHIVE PROJECT
// ============================================================================

/**
 * Parameters for archiving a project
 */
export interface ArchiveProjectParams {
  id: string;
  workspaceId: string;
}

/**
 * Archive a project (soft delete)
 *
 * @param params - Project ID and workspace ID
 * @returns Promise<Project> - The archived project
 * @throws ProjectFetchError if archive fails
 */
async function archiveProject({ id }: ArchiveProjectParams): Promise<Project> {
  // RLS ensures user is creator or workspace admin
  const { data: result, error } = await supabase
    .from('projects')
    .update({ is_archived: true })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new ProjectFetchError(error.message, error.code, error.details);
  }

  if (!result) {
    throw new ProjectFetchError('Project not found or no permission', 'NOT_FOUND');
  }

  const parsed = ProjectSchema.safeParse(result);
  if (!parsed.success) {
    console.warn('[useProjectMutations] Invalid response data:', result, parsed.error);
    return result as Project;
  }

  return parsed.data;
}

/**
 * Options for useArchiveProject hook
 */
export interface UseArchiveProjectOptions {
  /**
   * Callback invoked on successful archive
   */
  onSuccess?: (project: Project) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: ProjectFetchError) => void;
}

/**
 * Result type for useArchiveProject hook
 */
export type UseArchiveProjectResult = ReturnType<typeof useArchiveProject>;

/**
 * Hook to archive a project
 *
 * Sets is_archived = true. Project can be restored by updating is_archived to false.
 * Requires project creator or workspace admin role.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useArchiveProject(options?: UseArchiveProjectOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveProject,
    onMutate: async ({ id, workspaceId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.projects(workspaceId) });

      // Snapshot previous values for rollback
      const previousProjects = queryClient.getQueryData<ProjectWithStats[]>(
        queryKeys.projects(workspaceId)
      );

      // Optimistically update the cache (remove from non-archived list)
      if (previousProjects) {
        queryClient.setQueryData<ProjectWithStats[]>(
          queryKeys.projects(workspaceId),
          previousProjects.filter(p => p.id !== id)
        );
      }

      return { previousProjects, workspaceId };
    },
    onError: (error, { workspaceId }, context) => {
      // Rollback optimistic update on error
      if (context?.previousProjects) {
        queryClient.setQueryData(queryKeys.projects(workspaceId), context.previousProjects);
      }

      const fetchError =
        error instanceof ProjectFetchError ? error : new ProjectFetchError(error.message);
      options?.onError?.(fetchError);
    },
    onSuccess: (data, { workspaceId }) => {
      // Invalidate to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.projects(workspaceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(data.id) });
      options?.onSuccess?.(data);
    },
  });
}

// ============================================================================
// DELETE PROJECT
// ============================================================================

/**
 * Parameters for deleting a project
 */
export interface DeleteProjectParams {
  id: string;
  workspaceId: string;
}

/**
 * Delete a project permanently
 *
 * @param params - Project ID and workspace ID
 * @returns Promise<void>
 * @throws ProjectFetchError if deletion fails
 */
async function deleteProject({ id }: DeleteProjectParams): Promise<void> {
  // RLS ensures user is creator or workspace admin
  const { error } = await supabase.from('projects').delete().eq('id', id);

  if (error) {
    throw new ProjectFetchError(error.message, error.code, error.details);
  }
}

/**
 * Options for useDeleteProject hook
 */
export interface UseDeleteProjectOptions {
  /**
   * Callback invoked on successful deletion
   */
  onSuccess?: (id: string, workspaceId: string) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: ProjectFetchError, id: string) => void;
}

/**
 * Result type for useDeleteProject hook
 */
export type UseDeleteProjectResult = ReturnType<typeof useDeleteProject>;

/**
 * Hook to delete a project
 *
 * Requires workspace admin role. This permanently deletes the project and all
 * associated data (members, time entries project_id set to null) via CASCADE/SET NULL.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useDeleteProject(options?: UseDeleteProjectOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProject,
    onMutate: async ({ id, workspaceId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.projects(workspaceId) });

      // Snapshot previous values for rollback
      const previousProjects = queryClient.getQueryData<ProjectWithStats[]>(
        queryKeys.projects(workspaceId)
      );

      // Optimistically remove from cache
      if (previousProjects) {
        queryClient.setQueryData<ProjectWithStats[]>(
          queryKeys.projects(workspaceId),
          previousProjects.filter(p => p.id !== id)
        );
      }

      return { previousProjects, workspaceId, deletedId: id };
    },
    onError: (error, { id, workspaceId }, context) => {
      // Rollback optimistic update on error
      if (context?.previousProjects) {
        queryClient.setQueryData(queryKeys.projects(workspaceId), context.previousProjects);
      }

      const fetchError =
        error instanceof ProjectFetchError ? error : new ProjectFetchError(error.message);
      options?.onError?.(fetchError, id);
    },
    onSuccess: (_data, { id, workspaceId }) => {
      // Invalidate to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.projects(workspaceId) });
      // Remove single project from cache
      queryClient.removeQueries({ queryKey: queryKeys.project(id) });
      // Also invalidate related queries
      queryClient.removeQueries({ queryKey: queryKeys.projectMembers(id) });
      options?.onSuccess?.(id, workspaceId);
    },
  });
}
