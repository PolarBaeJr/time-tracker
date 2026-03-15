/**
 * Workspace Context - Active workspace state management for collaboration
 *
 * Provides state management for the currently active workspace. The active workspace
 * determines which workspace's data (projects, activity feed, leaderboard, etc.)
 * is displayed throughout the app.
 *
 * When activeWorkspace is null, the app is in "Personal Mode" showing only the
 * user's personal time entries and data (non-collaborative features).
 *
 * Features:
 * - Persists active workspace ID to localStorage
 * - Validates persisted workspace still exists on hydration
 * - Clears active workspace on auth logout
 * - Provides computed helpers: isPersonalMode, hasWorkspaces
 */

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { WorkspaceSchema, type Workspace } from '@/schemas';
import { supabase } from '@/lib';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * LocalStorage key for persisting the active workspace ID
 * Versioned to allow future migrations
 */
const STORAGE_KEY = 'worktracker.active-workspace.v1';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Workspace Context Value
 *
 * Provides active workspace state and related helpers.
 */
export interface WorkspaceContextValue {
  /** Currently active workspace (null = personal mode) */
  activeWorkspace: Workspace | null;

  /** Set the active workspace (pass null for personal mode) */
  setActiveWorkspace: (workspace: Workspace | null) => void;

  /** All workspaces the current user belongs to */
  workspaces: Workspace[];

  /** Whether workspaces are currently being loaded */
  isLoading: boolean;

  /** Whether we're in personal mode (no active workspace) */
  isPersonalMode: boolean;

  /** Whether the user belongs to any workspaces */
  hasWorkspaces: boolean;

  /** Error from loading workspaces, if any */
  error: Error | null;
}

interface WorkspaceProviderProps {
  children: React.ReactNode;
}

// =============================================================================
// CONTEXT
// =============================================================================

export const WorkspaceContext = React.createContext<WorkspaceContextValue | undefined>(undefined);

// =============================================================================
// FETCH FUNCTION
// =============================================================================

/**
 * Fetch all workspaces the current user belongs to
 */
async function fetchWorkspaces(): Promise<Workspace[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;

  if (!userId) {
    return [];
  }

  // Get workspace IDs from membership
  const { data: memberships, error: membershipError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId);

  if (membershipError) {
    console.warn('[WorkspaceContext] Failed to fetch memberships:', membershipError.message);
    throw new Error(`Failed to fetch workspace memberships: ${membershipError.message}`);
  }

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const workspaceIds = memberships.map(m => m.workspace_id);

  // Fetch workspace details
  const { data: workspaces, error: workspacesError } = await supabase
    .from('workspaces')
    .select('*')
    .in('id', workspaceIds)
    .order('name', { ascending: true });

  if (workspacesError) {
    console.warn('[WorkspaceContext] Failed to fetch workspaces:', workspacesError.message);
    throw new Error(`Failed to fetch workspaces: ${workspacesError.message}`);
  }

  // Validate each workspace against schema
  const validWorkspaces: Workspace[] = [];
  for (const workspace of workspaces || []) {
    const parsed = WorkspaceSchema.safeParse(workspace);
    if (parsed.success) {
      validWorkspaces.push(parsed.data);
    } else {
      console.warn('[WorkspaceContext] Workspace failed validation:', parsed.error.flatten());
    }
  }

  return validWorkspaces;
}

// =============================================================================
// STORAGE HELPERS
// =============================================================================

/**
 * Get persisted workspace ID from localStorage
 */
function getPersistedWorkspaceId(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage may be unavailable (e.g., private browsing)
    return null;
  }
}

/**
 * Persist workspace ID to localStorage
 */
function persistWorkspaceId(workspaceId: string | null): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    if (workspaceId) {
      window.localStorage.setItem(STORAGE_KEY, workspaceId);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage may be unavailable
  }
}

// =============================================================================
// PROVIDER
// =============================================================================

/**
 * Workspace Provider Component
 *
 * Provides workspace state to the app. Must be used within AuthProvider.
 *
 * @example
 * ```tsx
 * <AuthProvider>
 *   <WorkspaceProvider>
 *     <App />
 *   </WorkspaceProvider>
 * </AuthProvider>
 * ```
 */
export function WorkspaceProvider({ children }: WorkspaceProviderProps): React.ReactElement {
  const { isAuthenticated, session } = useAuth();
  const queryClient = useQueryClient();

  // Track the active workspace ID (persisted to localStorage)
  const [activeWorkspaceId, setActiveWorkspaceId] = React.useState<string | null>(() => {
    // Initialize from localStorage on mount
    return getPersistedWorkspaceId();
  });

  // Fetch workspaces when authenticated
  const {
    data: workspaces = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: fetchWorkspaces,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Find the active workspace object from the ID
  const activeWorkspace = React.useMemo(() => {
    if (!activeWorkspaceId || workspaces.length === 0) {
      return null;
    }
    return workspaces.find(w => w.id === activeWorkspaceId) ?? null;
  }, [activeWorkspaceId, workspaces]);

  // Validate persisted workspace on hydration
  // If the persisted workspace no longer exists (user left/removed), clear it
  React.useEffect(() => {
    if (!isLoading && activeWorkspaceId && workspaces.length > 0) {
      const exists = workspaces.some(w => w.id === activeWorkspaceId);
      if (!exists) {
        console.info(
          '[WorkspaceContext] Persisted workspace no longer exists, clearing active workspace'
        );
        setActiveWorkspaceId(null);
        persistWorkspaceId(null);
      }
    }
  }, [isLoading, activeWorkspaceId, workspaces]);

  // Clear active workspace on logout
  React.useEffect(() => {
    if (!session) {
      setActiveWorkspaceId(null);
      persistWorkspaceId(null);
      // Clear workspace-related queries
      queryClient.removeQueries({ queryKey: queryKeys.workspaces });
    }
  }, [session, queryClient]);

  // Set active workspace handler
  const setActiveWorkspace = React.useCallback((workspace: Workspace | null) => {
    const newId = workspace?.id ?? null;
    setActiveWorkspaceId(newId);
    persistWorkspaceId(newId);
  }, []);

  // Computed values
  const isPersonalMode = activeWorkspace === null;
  const hasWorkspaces = workspaces.length > 0;

  const value = React.useMemo<WorkspaceContextValue>(
    () => ({
      activeWorkspace,
      setActiveWorkspace,
      workspaces,
      isLoading,
      isPersonalMode,
      hasWorkspaces,
      error: error as Error | null,
    }),
    [
      activeWorkspace,
      setActiveWorkspace,
      workspaces,
      isLoading,
      isPersonalMode,
      hasWorkspaces,
      error,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to access the workspace context
 *
 * @throws Error if used outside of WorkspaceProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { activeWorkspace, setActiveWorkspace, isPersonalMode } = useWorkspaceContext();
 *
 *   if (isPersonalMode) {
 *     return <PersonalDashboard />;
 *   }
 *
 *   return <WorkspaceDashboard workspace={activeWorkspace} />;
 * }
 * ```
 */
export function useWorkspaceContext(): WorkspaceContextValue {
  const context = React.useContext(WorkspaceContext);

  if (!context) {
    throw new Error('useWorkspaceContext must be used within a WorkspaceProvider');
  }

  return context;
}

/**
 * Convenience hook for accessing just the active workspace
 *
 * @returns The active workspace or null if in personal mode
 *
 * @example
 * ```tsx
 * function ProjectList() {
 *   const workspace = useActiveWorkspace();
 *
 *   if (!workspace) {
 *     return <Text>Select a workspace to view projects</Text>;
 *   }
 *
 *   return <ProjectsForWorkspace workspaceId={workspace.id} />;
 * }
 * ```
 */
export function useActiveWorkspace(): Workspace | null {
  const { activeWorkspace } = useWorkspaceContext();
  return activeWorkspace;
}

/**
 * Hook to get all workspaces the user belongs to
 *
 * @returns Array of workspaces (empty if not a member of any)
 */
export function useWorkspaces(): Workspace[] {
  const { workspaces } = useWorkspaceContext();
  return workspaces;
}

export default WorkspaceProvider;
