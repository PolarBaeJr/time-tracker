/**
 * Workspace Query Hooks
 *
 * This module provides TanStack Query hooks for fetching workspaces.
 * Workspaces are shared organizations where users can collaborate.
 *
 * USAGE:
 * ```typescript
 * import { useWorkspacesQuery, useWorkspace } from '@/hooks/useWorkspaces';
 *
 * function WorkspaceList() {
 *   const { data: workspaces, isLoading } = useWorkspacesQuery();
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return workspaces?.map(ws => <WorkspaceCard key={ws.id} workspace={ws} />);
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only workspaces the user is a member of are returned
 * - User membership is checked via auth.uid()
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  WorkspaceSchema,
  WorkspaceWithMemberCountSchema,
  type Workspace,
  type WorkspaceWithMemberCount,
  type WorkspaceRole,
} from '@/schemas';

// ============================================================================
// ERROR CLASS
// ============================================================================

/**
 * Error thrown when workspace operations fail
 */
export class WorkspaceFetchError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'WorkspaceFetchError';
  }
}

// ============================================================================
// FETCH WORKSPACES
// ============================================================================

/**
 * Fetch all workspaces the current user is a member of
 *
 * Returns workspaces with member count and current user's role.
 *
 * @returns Promise<WorkspaceWithMemberCount[]> - Array of validated workspaces
 * @throws WorkspaceFetchError if the fetch fails
 */
export async function fetchWorkspaces(): Promise<WorkspaceWithMemberCount[]> {
  // Get current user
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;

  if (!userId) {
    return [];
  }

  // Get workspace IDs and roles from membership
  const { data: memberships, error: membershipError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', userId);

  if (membershipError) {
    throw new WorkspaceFetchError(membershipError.message, membershipError.code);
  }

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const workspaceIds = memberships.map(m => m.workspace_id);
  const roleMap = new Map<string, WorkspaceRole>(
    memberships.map(m => [m.workspace_id, m.role as WorkspaceRole])
  );

  // Fetch workspace details with member counts
  const { data: workspaces, error: workspacesError } = await supabase
    .from('workspaces')
    .select(
      `
      *,
      workspace_members (count)
    `
    )
    .in('id', workspaceIds)
    .order('name', { ascending: true });

  if (workspacesError) {
    throw new WorkspaceFetchError(workspacesError.message, workspacesError.code);
  }

  if (!workspaces) {
    return [];
  }

  // Transform and validate results
  const validWorkspaces: WorkspaceWithMemberCount[] = [];
  for (const workspace of workspaces) {
    // Extract member count from the nested aggregate
    const memberCount =
      Array.isArray(workspace.workspace_members) && workspace.workspace_members.length > 0
        ? (workspace.workspace_members[0]?.count ?? 0)
        : 0;

    const workspaceData = {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      owner_id: workspace.owner_id,
      created_at: workspace.created_at,
      member_count: memberCount,
      current_user_role: roleMap.get(workspace.id),
    };

    const parsed = WorkspaceWithMemberCountSchema.safeParse(workspaceData);
    if (parsed.success) {
      validWorkspaces.push(parsed.data);
    } else {
      console.warn('[useWorkspaces] Workspace failed validation:', parsed.error.flatten());
    }
  }

  return validWorkspaces;
}

/**
 * Fetch a single workspace by ID
 *
 * @param id - UUID of the workspace to fetch
 * @returns Promise<Workspace> - The validated workspace
 * @throws WorkspaceFetchError if the fetch fails
 */
export async function fetchWorkspace(id: string): Promise<Workspace> {
  const { data, error } = await supabase.from('workspaces').select('*').eq('id', id).single();

  if (error) {
    throw new WorkspaceFetchError(error.message, error.code);
  }

  if (!data) {
    throw new WorkspaceFetchError('Workspace not found', 'NOT_FOUND');
  }

  const parsed = WorkspaceSchema.safeParse(data);
  if (!parsed.success) {
    console.warn('[useWorkspaces] Invalid workspace data:', data, parsed.error);
    return data as Workspace;
  }

  return parsed.data;
}

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Options for the useWorkspacesQuery hook
 */
export interface UseWorkspacesQueryOptions {
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
 * Hook to fetch all workspaces the current user is a member of
 *
 * Note: This hook is named useWorkspacesQuery to avoid conflicts with
 * useWorkspaces from WorkspaceContext which returns all workspaces from context.
 *
 * @param options - Optional configuration
 * @returns React Query result with workspaces data
 *
 * @example
 * ```typescript
 * const { data: workspaces, isLoading } = useWorkspacesQuery();
 *
 * // With options
 * const { data } = useWorkspacesQuery({ enabled: isAuthenticated });
 * ```
 */
export function useWorkspacesQuery(options?: UseWorkspacesQueryOptions) {
  const { enabled = true, staleTime } = options ?? {};

  return useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: fetchWorkspaces,
    enabled,
    staleTime,
  });
}

/**
 * Options for the useWorkspace hook
 */
export interface UseWorkspaceOptions {
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
 * Hook to fetch a single workspace by ID
 *
 * @param id - UUID of the workspace to fetch
 * @param options - Optional configuration
 * @returns React Query result with workspace data
 *
 * @example
 * ```typescript
 * const { data: workspace, isLoading } = useWorkspace(workspaceId);
 * ```
 */
export function useWorkspace(id: string, options?: UseWorkspaceOptions) {
  const { enabled = true, staleTime } = options ?? {};

  return useQuery({
    queryKey: queryKeys.workspace(id),
    queryFn: () => fetchWorkspace(id),
    enabled: enabled && !!id,
    staleTime,
  });
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UseWorkspacesQueryResult = ReturnType<typeof useWorkspacesQuery>;
export type UseWorkspaceResult = ReturnType<typeof useWorkspace>;
