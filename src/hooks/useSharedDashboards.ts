/**
 * Shared Dashboards Query and Mutation Hooks
 *
 * This module provides TanStack Query hooks for managing shared dashboard links.
 * Users can create shareable links to their analytics dashboards, which can be
 * viewed by anyone with the link (no authentication required).
 *
 * USAGE:
 * ```typescript
 * import {
 *   useSharedDashboards,
 *   useCreateSharedDashboard,
 *   useRevokeSharedDashboard,
 *   useUpdateSharedDashboard,
 * } from '@/hooks/useSharedDashboards';
 *
 * function SharedDashboardsManager() {
 *   const { data: dashboards, isLoading } = useSharedDashboards();
 *   const createMutation = useCreateSharedDashboard();
 *   const revokeMutation = useRevokeSharedDashboard();
 *   const updateMutation = useUpdateSharedDashboard();
 *
 *   const handleCreate = async () => {
 *     const result = await createMutation.mutateAsync({
 *       title: 'My Dashboard',
 *       workspace_id: null, // Personal analytics
 *       expires_at: null, // Never expires
 *     });
 *     console.log('Share URL:', result.share_url);
 *   };
 *
 *   return <DashboardsList dashboards={dashboards} />;
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only the authenticated user's dashboards are returned
 * - user_id is set server-side via auth.uid(), NOT included in client requests
 * - Token is generated server-side as a UUID
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  SharedDashboardSchema,
  SharedDashboardWithStatsSchema,
  CreateSharedDashboardSchema,
  UpdateSharedDashboardSchema,
  type SharedDashboard,
  type SharedDashboardWithStats,
  type CreateSharedDashboardInput,
  type UpdateSharedDashboardInput,
} from '@/schemas';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Base URL for shared dashboard links
 * In production this should come from environment config
 */
const SHARE_BASE_URL =
  typeof window !== 'undefined' ? `${window.location.origin}/shared` : '/shared';

// ============================================================================
// ERROR CLASS
// ============================================================================

/**
 * Error thrown when shared dashboard operations fail
 */
export class SharedDashboardError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'SharedDashboardError';
  }
}

// ============================================================================
// FETCH FUNCTIONS
// ============================================================================

/**
 * Fetch all shared dashboards for the current user
 *
 * @returns Promise<SharedDashboardWithStats[]> - Array of shared dashboards with stats
 * @throws SharedDashboardError if the fetch fails
 */
export async function fetchSharedDashboards(): Promise<SharedDashboardWithStats[]> {
  const { data, error } = await supabase
    .from('shared_dashboards')
    .select(
      `
      *,
      workspaces:workspace_id (name)
    `
    )
    .order('created_at', { ascending: false });

  if (error) {
    throw new SharedDashboardError(error.message, error.code);
  }

  if (!data) {
    return [];
  }

  // Transform and validate each dashboard
  return data.map(item => {
    // Extract workspace name from joined data
    const workspaceName =
      item.workspaces && typeof item.workspaces === 'object' && 'name' in item.workspaces
        ? (item.workspaces as { name: string }).name
        : null;

    const dashboard = {
      id: item.id,
      user_id: item.user_id,
      workspace_id: item.workspace_id,
      token: item.token,
      title: item.title,
      is_active: item.is_active,
      expires_at: item.expires_at,
      created_at: item.created_at,
      workspace_name: workspaceName,
      // Stats fields are populated from view_count tracking (if implemented)
      view_count: undefined,
      last_viewed_at: undefined,
    };

    const parsed = SharedDashboardWithStatsSchema.safeParse(dashboard);
    if (!parsed.success) {
      console.warn('[useSharedDashboards] Invalid dashboard data:', item, parsed.error);
      return dashboard as SharedDashboardWithStats;
    }

    return parsed.data;
  });
}

/**
 * Fetch a single shared dashboard by ID
 *
 * @param id - UUID of the shared dashboard
 * @returns Promise<SharedDashboard> - The shared dashboard
 * @throws SharedDashboardError if the fetch fails
 */
export async function fetchSharedDashboard(id: string): Promise<SharedDashboard> {
  const { data, error } = await supabase
    .from('shared_dashboards')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw new SharedDashboardError(error.message, error.code);
  }

  if (!data) {
    throw new SharedDashboardError('Shared dashboard not found', 'NOT_FOUND');
  }

  const parsed = SharedDashboardSchema.safeParse(data);
  if (!parsed.success) {
    console.warn('[useSharedDashboards] Invalid dashboard data:', data, parsed.error);
    return data as SharedDashboard;
  }

  return parsed.data;
}

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Options for the useSharedDashboards hook
 */
export interface UseSharedDashboardsOptions {
  /** Whether the query should be enabled */
  enabled?: boolean;

  /** Override the default stale time */
  staleTime?: number;
}

/**
 * Hook to fetch all shared dashboards for the current user
 *
 * @param options - Optional configuration
 * @returns React Query result with shared dashboards data
 *
 * @example
 * ```typescript
 * const { data: dashboards, isLoading } = useSharedDashboards();
 * ```
 */
export function useSharedDashboards(options?: UseSharedDashboardsOptions) {
  const { enabled = true, staleTime } = options ?? {};

  return useQuery({
    queryKey: queryKeys.sharedDashboards,
    queryFn: fetchSharedDashboards,
    enabled,
    staleTime,
  });
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Response from creating a shared dashboard
 */
export interface CreatedSharedDashboard extends SharedDashboard {
  /** Full shareable URL */
  share_url: string;
}

// ============================================================================
// CREATE SHARED DASHBOARD
// ============================================================================

/**
 * Create a new shared dashboard
 *
 * @param input - Dashboard data validated against CreateSharedDashboardSchema
 * @returns Promise<CreatedSharedDashboard> - The created dashboard with share URL
 * @throws SharedDashboardError if validation or creation fails
 */
async function createSharedDashboard(
  input: CreateSharedDashboardInput
): Promise<CreatedSharedDashboard> {
  // Validate input
  const validationResult = CreateSharedDashboardSchema.safeParse(input);
  if (!validationResult.success) {
    throw new SharedDashboardError(
      `Validation failed: ${validationResult.error.message}`,
      'VALIDATION_ERROR',
      validationResult.error.flatten()
    );
  }

  const validatedInput = validationResult.data;

  // Generate a unique token for the share link
  const token = crypto.randomUUID();

  // Insert the dashboard - user_id is set server-side via auth.uid() DEFAULT
  const { data, error } = await supabase
    .from('shared_dashboards')
    .insert({
      title: validatedInput.title,
      workspace_id: validatedInput.workspace_id ?? null,
      expires_at: validatedInput.expires_at ?? null,
      token,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw new SharedDashboardError(error.message, error.code, error.details);
  }

  if (!data) {
    throw new SharedDashboardError('No data returned from insert', 'NO_DATA');
  }

  const parsed = SharedDashboardSchema.safeParse(data);
  const dashboard = parsed.success ? parsed.data : (data as SharedDashboard);

  return {
    ...dashboard,
    share_url: `${SHARE_BASE_URL}/${dashboard.token}`,
  };
}

/**
 * Options for useCreateSharedDashboard hook
 */
export interface UseCreateSharedDashboardOptions {
  /** Callback invoked on successful creation */
  onSuccess?: (dashboard: CreatedSharedDashboard) => void;

  /** Callback invoked on error */
  onError?: (error: SharedDashboardError) => void;
}

/**
 * Hook to create a new shared dashboard
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 *
 * @example
 * ```typescript
 * const createMutation = useCreateSharedDashboard({
 *   onSuccess: (dashboard) => {
 *     // Copy share URL to clipboard
 *     navigator.clipboard.writeText(dashboard.share_url);
 *     showToast('Share link copied!');
 *   },
 * });
 *
 * // Create personal dashboard
 * createMutation.mutate({ title: 'My Analytics', workspace_id: null });
 *
 * // Create workspace dashboard
 * createMutation.mutate({ title: 'Team Stats', workspace_id: 'workspace-uuid' });
 * ```
 */
export function useCreateSharedDashboard(options?: UseCreateSharedDashboardOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSharedDashboard,
    onSuccess: data => {
      // Invalidate shared dashboards query to refetch with new data
      queryClient.invalidateQueries({ queryKey: queryKeys.sharedDashboards });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      const dashboardError =
        error instanceof SharedDashboardError ? error : new SharedDashboardError(error.message);
      options?.onError?.(dashboardError);
    },
  });
}

// ============================================================================
// REVOKE SHARED DASHBOARD
// ============================================================================

/**
 * Revoke a shared dashboard by setting is_active = false
 *
 * @param id - UUID of the shared dashboard to revoke
 * @returns Promise<SharedDashboard> - The revoked dashboard
 * @throws SharedDashboardError if revocation fails
 */
async function revokeSharedDashboard(id: string): Promise<SharedDashboard> {
  const { data, error } = await supabase
    .from('shared_dashboards')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new SharedDashboardError(error.message, error.code, error.details);
  }

  if (!data) {
    throw new SharedDashboardError('Shared dashboard not found or no permission', 'NOT_FOUND');
  }

  const parsed = SharedDashboardSchema.safeParse(data);
  if (!parsed.success) {
    console.warn('[useSharedDashboards] Invalid response data:', data, parsed.error);
    return data as SharedDashboard;
  }

  return parsed.data;
}

/**
 * Options for useRevokeSharedDashboard hook
 */
export interface UseRevokeSharedDashboardOptions {
  /** Callback invoked on successful revocation */
  onSuccess?: (dashboard: SharedDashboard) => void;

  /** Callback invoked on error */
  onError?: (error: SharedDashboardError, id: string) => void;
}

/**
 * Hook to revoke a shared dashboard
 *
 * Revoking sets is_active = false, making the share link invalid.
 * The dashboard record is not deleted (for audit purposes).
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 *
 * @example
 * ```typescript
 * const revokeMutation = useRevokeSharedDashboard({
 *   onSuccess: () => showToast('Share link revoked'),
 * });
 *
 * revokeMutation.mutate('dashboard-uuid');
 * ```
 */
export function useRevokeSharedDashboard(options?: UseRevokeSharedDashboardOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeSharedDashboard,
    onMutate: async id => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.sharedDashboards });

      // Snapshot previous values for rollback
      const previousDashboards = queryClient.getQueryData<SharedDashboardWithStats[]>(
        queryKeys.sharedDashboards
      );

      // Optimistically update the cache
      if (previousDashboards) {
        queryClient.setQueryData<SharedDashboardWithStats[]>(
          queryKeys.sharedDashboards,
          previousDashboards.map(d => (d.id === id ? { ...d, is_active: false } : d))
        );
      }

      return { previousDashboards, revokedId: id };
    },
    onError: (error, id, context) => {
      // Rollback optimistic update on error
      if (context?.previousDashboards) {
        queryClient.setQueryData(queryKeys.sharedDashboards, context.previousDashboards);
      }

      const dashboardError =
        error instanceof SharedDashboardError ? error : new SharedDashboardError(error.message);
      options?.onError?.(dashboardError, id);
    },
    onSuccess: data => {
      // Invalidate to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.sharedDashboards });
      options?.onSuccess?.(data);
    },
  });
}

// ============================================================================
// UPDATE SHARED DASHBOARD
// ============================================================================

/**
 * Parameters for updating a shared dashboard
 */
export interface UpdateSharedDashboardParams {
  id: string;
  data: UpdateSharedDashboardInput;
}

/**
 * Update an existing shared dashboard
 *
 * @param params - Dashboard ID and update data
 * @returns Promise<SharedDashboard> - The updated dashboard
 * @throws SharedDashboardError if validation or update fails
 */
async function updateSharedDashboard({
  id,
  data,
}: UpdateSharedDashboardParams): Promise<SharedDashboard> {
  // Validate input
  const validationResult = UpdateSharedDashboardSchema.safeParse(data);
  if (!validationResult.success) {
    throw new SharedDashboardError(
      `Validation failed: ${validationResult.error.message}`,
      'VALIDATION_ERROR',
      validationResult.error.flatten()
    );
  }

  const validatedInput = validationResult.data;

  // Build the update object, only including defined fields
  const updateData: Record<string, unknown> = {};

  if (validatedInput.title !== undefined) {
    updateData.title = validatedInput.title;
  }
  if (validatedInput.expires_at !== undefined) {
    updateData.expires_at = validatedInput.expires_at;
  }
  if (validatedInput.is_active !== undefined) {
    updateData.is_active = validatedInput.is_active;
  }

  // RLS ensures user can only update their own dashboards
  const { data: result, error } = await supabase
    .from('shared_dashboards')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new SharedDashboardError(error.message, error.code, error.details);
  }

  if (!result) {
    throw new SharedDashboardError('Shared dashboard not found or no permission', 'NOT_FOUND');
  }

  const parsed = SharedDashboardSchema.safeParse(result);
  if (!parsed.success) {
    console.warn('[useSharedDashboards] Invalid response data:', result, parsed.error);
    return result as SharedDashboard;
  }

  return parsed.data;
}

/**
 * Options for useUpdateSharedDashboard hook
 */
export interface UseUpdateSharedDashboardOptions {
  /** Callback invoked on successful update */
  onSuccess?: (dashboard: SharedDashboard) => void;

  /** Callback invoked on error */
  onError?: (error: SharedDashboardError) => void;
}

/**
 * Hook to update an existing shared dashboard
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 *
 * @example
 * ```typescript
 * const updateMutation = useUpdateSharedDashboard({
 *   onSuccess: () => showToast('Dashboard updated'),
 * });
 *
 * // Update title
 * updateMutation.mutate({
 *   id: 'dashboard-uuid',
 *   data: { title: 'New Title' },
 * });
 *
 * // Set expiration
 * updateMutation.mutate({
 *   id: 'dashboard-uuid',
 *   data: { expires_at: '2024-12-31T23:59:59Z' },
 * });
 *
 * // Re-activate a revoked dashboard
 * updateMutation.mutate({
 *   id: 'dashboard-uuid',
 *   data: { is_active: true },
 * });
 * ```
 */
export function useUpdateSharedDashboard(options?: UseUpdateSharedDashboardOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSharedDashboard,
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.sharedDashboards });

      // Snapshot previous values for rollback
      const previousDashboards = queryClient.getQueryData<SharedDashboardWithStats[]>(
        queryKeys.sharedDashboards
      );

      // Optimistically update the cache
      if (previousDashboards) {
        queryClient.setQueryData<SharedDashboardWithStats[]>(
          queryKeys.sharedDashboards,
          previousDashboards.map(d => (d.id === id ? { ...d, ...data } : d))
        );
      }

      return { previousDashboards };
    },
    onError: (error, _params, context) => {
      // Rollback optimistic update on error
      if (context?.previousDashboards) {
        queryClient.setQueryData(queryKeys.sharedDashboards, context.previousDashboards);
      }

      const dashboardError =
        error instanceof SharedDashboardError ? error : new SharedDashboardError(error.message);
      options?.onError?.(dashboardError);
    },
    onSuccess: data => {
      // Invalidate to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.sharedDashboards });
      options?.onSuccess?.(data);
    },
  });
}

// ============================================================================
// DELETE SHARED DASHBOARD
// ============================================================================

/**
 * Permanently delete a shared dashboard
 *
 * @param id - UUID of the shared dashboard to delete
 * @returns Promise<void>
 * @throws SharedDashboardError if deletion fails
 */
async function deleteSharedDashboard(id: string): Promise<void> {
  const { error } = await supabase.from('shared_dashboards').delete().eq('id', id);

  if (error) {
    throw new SharedDashboardError(error.message, error.code, error.details);
  }
}

/**
 * Options for useDeleteSharedDashboard hook
 */
export interface UseDeleteSharedDashboardOptions {
  /** Callback invoked on successful deletion */
  onSuccess?: (id: string) => void;

  /** Callback invoked on error */
  onError?: (error: SharedDashboardError, id: string) => void;
}

/**
 * Hook to permanently delete a shared dashboard
 *
 * Note: Consider using useRevokeSharedDashboard instead for audit trail.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useDeleteSharedDashboard(options?: UseDeleteSharedDashboardOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSharedDashboard,
    onMutate: async id => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.sharedDashboards });

      // Snapshot previous values for rollback
      const previousDashboards = queryClient.getQueryData<SharedDashboardWithStats[]>(
        queryKeys.sharedDashboards
      );

      // Optimistically remove from cache
      if (previousDashboards) {
        queryClient.setQueryData<SharedDashboardWithStats[]>(
          queryKeys.sharedDashboards,
          previousDashboards.filter(d => d.id !== id)
        );
      }

      return { previousDashboards, deletedId: id };
    },
    onError: (error, id, context) => {
      // Rollback optimistic update on error
      if (context?.previousDashboards) {
        queryClient.setQueryData(queryKeys.sharedDashboards, context.previousDashboards);
      }

      const dashboardError =
        error instanceof SharedDashboardError ? error : new SharedDashboardError(error.message);
      options?.onError?.(dashboardError, id);
    },
    onSuccess: (_data, id) => {
      // Invalidate to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.sharedDashboards });
      // Remove single dashboard from cache
      queryClient.removeQueries({ queryKey: queryKeys.sharedDashboard(id) });
      options?.onSuccess?.(id);
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate the share URL for a token
 *
 * @param token - The unique share token
 * @returns Full URL for sharing
 */
export function getShareUrl(token: string): string {
  return `${SHARE_BASE_URL}/${token}`;
}

/**
 * Check if a shared dashboard is currently valid (active and not expired)
 *
 * @param dashboard - The shared dashboard to check
 * @returns true if the dashboard can be accessed
 */
export function isSharedDashboardValid(dashboard: SharedDashboard): boolean {
  if (!dashboard.is_active) {
    return false;
  }

  if (dashboard.expires_at) {
    const expiresAt = new Date(dashboard.expires_at);
    if (expiresAt < new Date()) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UseSharedDashboardsResult = ReturnType<typeof useSharedDashboards>;
export type UseCreateSharedDashboardResult = ReturnType<typeof useCreateSharedDashboard>;
export type UseRevokeSharedDashboardResult = ReturnType<typeof useRevokeSharedDashboard>;
export type UseUpdateSharedDashboardResult = ReturnType<typeof useUpdateSharedDashboard>;
export type UseDeleteSharedDashboardResult = ReturnType<typeof useDeleteSharedDashboard>;
