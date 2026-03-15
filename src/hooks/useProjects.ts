/**
 * Project Query Hooks
 *
 * This module provides TanStack Query hooks for fetching projects.
 * Projects are shared entities within workspaces where members can log time.
 *
 * USAGE:
 * ```typescript
 * import { useProjects, useProject } from '@/hooks/useProjects';
 *
 * function ProjectList({ workspaceId }) {
 *   const { data: projects, isLoading } = useProjects(workspaceId);
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return projects?.map(p => <ProjectCard key={p.id} project={p} />);
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only visible projects are returned
 * - User must be workspace member to see projects
 * - Project visibility depends on membership or admin status
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  ProjectSchema,
  ProjectWithStatsSchema,
  ProjectWithMembersSchema,
  type Project,
  type ProjectWithStats,
  type ProjectWithMembers,
} from '@/schemas';

// ============================================================================
// ERROR CLASS
// ============================================================================

/**
 * Error thrown when project operations fail
 */
export class ProjectFetchError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ProjectFetchError';
  }
}

// ============================================================================
// FETCH PROJECTS
// ============================================================================

/**
 * Options for fetching projects
 */
export interface FetchProjectsOptions {
  /** Include archived projects (default: false) */
  includeArchived?: boolean;
  /** Only show projects the user is a member of (default: true) */
  memberOnly?: boolean;
}

/**
 * Fetch all projects in a workspace the current user can access
 *
 * Returns projects with member count and current user's membership status.
 *
 * @param workspaceId - UUID of the workspace
 * @param options - Optional filtering options
 * @returns Promise<ProjectWithStats[]> - Array of validated projects
 * @throws ProjectFetchError if the fetch fails
 */
export async function fetchProjects(
  workspaceId: string,
  options?: FetchProjectsOptions
): Promise<ProjectWithStats[]> {
  const { includeArchived = false, memberOnly = true } = options ?? {};

  // Get current user
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;

  if (!userId) {
    return [];
  }

  // Build query
  let query = supabase
    .from('projects')
    .select(
      `
      *,
      project_members (count)
    `
    )
    .eq('workspace_id', workspaceId)
    .order('name', { ascending: true });

  // Filter by archive status
  if (!includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data: projects, error: projectsError } = await query;

  if (projectsError) {
    throw new ProjectFetchError(projectsError.message, projectsError.code);
  }

  if (!projects) {
    return [];
  }

  // Get current user's project memberships
  const { data: memberships } = await supabase
    .from('project_members')
    .select('project_id, role')
    .eq('user_id', userId);

  const membershipMap = new Map<string, string>(
    memberships?.map(m => [m.project_id, m.role]) ?? []
  );

  // Transform and validate results
  const validProjects: ProjectWithStats[] = [];
  for (const project of projects) {
    // Filter by membership if requested
    const isMember = membershipMap.has(project.id);
    const isCreator = project.created_by === userId;

    if (memberOnly && !isMember && !isCreator) {
      continue;
    }

    // Extract member count from the nested aggregate
    const memberCount =
      Array.isArray(project.project_members) && project.project_members.length > 0
        ? (project.project_members[0]?.count ?? 0)
        : 0;

    const projectData = {
      id: project.id,
      workspace_id: project.workspace_id,
      name: project.name,
      color: project.color,
      description: project.description,
      is_archived: project.is_archived,
      created_by: project.created_by,
      created_at: project.created_at,
      member_count: memberCount,
      is_member: isMember,
      current_user_role: membershipMap.get(project.id),
    };

    const parsed = ProjectWithStatsSchema.safeParse(projectData);
    if (parsed.success) {
      validProjects.push(parsed.data);
    } else {
      console.warn('[useProjects] Project failed validation:', parsed.error.flatten());
    }
  }

  return validProjects;
}

/**
 * Fetch a single project by ID with member details
 *
 * @param id - UUID of the project to fetch
 * @returns Promise<ProjectWithMembers> - The validated project with members
 * @throws ProjectFetchError if the fetch fails
 */
export async function fetchProject(id: string): Promise<ProjectWithMembers> {
  const { data, error } = await supabase
    .from('projects')
    .select(
      `
      *,
      project_members (
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
      )
    `
    )
    .eq('id', id)
    .single();

  if (error) {
    throw new ProjectFetchError(error.message, error.code);
  }

  if (!data) {
    throw new ProjectFetchError('Project not found', 'NOT_FOUND');
  }

  // Transform members to include user details
  const members =
    data.project_members?.map((pm: Record<string, unknown>) => {
      const userData = Array.isArray(pm.user) ? pm.user[0] : pm.user;
      return {
        id: pm.id,
        project_id: pm.project_id,
        user_id: pm.user_id,
        role: pm.role,
        added_at: pm.added_at,
        user: userData
          ? {
              id: (userData as Record<string, unknown>).id,
              email: (userData as Record<string, unknown>).email,
              name: (userData as Record<string, unknown>).name,
            }
          : { id: pm.user_id, email: 'unknown@example.com', name: null },
      };
    }) ?? [];

  const projectData = {
    id: data.id,
    workspace_id: data.workspace_id,
    name: data.name,
    color: data.color,
    description: data.description,
    is_archived: data.is_archived,
    created_by: data.created_by,
    created_at: data.created_at,
    members,
  };

  const parsed = ProjectWithMembersSchema.safeParse(projectData);
  if (!parsed.success) {
    console.warn('[useProjects] Invalid project data:', data, parsed.error);
    return projectData as ProjectWithMembers;
  }

  return parsed.data;
}

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Options for the useProjects hook
 */
export interface UseProjectsOptions {
  /**
   * Whether the query should be enabled
   */
  enabled?: boolean;

  /**
   * Override the default stale time
   */
  staleTime?: number;

  /**
   * Include archived projects
   */
  includeArchived?: boolean;

  /**
   * Only show projects the user is a member of
   */
  memberOnly?: boolean;
}

/**
 * Result type for useProjects hook
 */
export type UseProjectsResult = ReturnType<typeof useProjects>;

/**
 * Hook to fetch all projects in a workspace
 *
 * @param workspaceId - UUID of the workspace
 * @param options - Optional configuration
 * @returns React Query result with projects data
 *
 * @example
 * ```typescript
 * const { data: projects, isLoading } = useProjects(workspaceId);
 *
 * // With options
 * const { data } = useProjects(workspaceId, { includeArchived: true });
 * ```
 */
export function useProjects(workspaceId: string, options?: UseProjectsOptions) {
  const { enabled = true, staleTime, includeArchived, memberOnly } = options ?? {};

  return useQuery({
    queryKey: queryKeys.projects(workspaceId),
    queryFn: () => fetchProjects(workspaceId, { includeArchived, memberOnly }),
    enabled: enabled && !!workspaceId,
    staleTime,
  });
}

/**
 * Options for the useProject hook
 */
export interface UseProjectOptions {
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
 * Result type for useProject hook
 */
export type UseProjectResult = ReturnType<typeof useProject>;

/**
 * Hook to fetch a single project by ID
 *
 * @param id - UUID of the project to fetch
 * @param options - Optional configuration
 * @returns React Query result with project data
 *
 * @example
 * ```typescript
 * const { data: project, isLoading } = useProject(projectId);
 * ```
 */
export function useProject(id: string, options?: UseProjectOptions) {
  const { enabled = true, staleTime } = options ?? {};

  return useQuery({
    queryKey: queryKeys.project(id),
    queryFn: () => fetchProject(id),
    enabled: enabled && !!id,
    staleTime,
  });
}
