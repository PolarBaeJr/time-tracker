/**
 * Leaderboard Query Hooks
 *
 * This module provides TanStack Query hooks for fetching workspace leaderboards.
 * Leaderboards rank workspace members by total hours tracked in a period.
 *
 * USAGE:
 * ```typescript
 * import { useLeaderboard, getWeekRange, getMonthRange } from '@/hooks/useLeaderboard';
 *
 * function LeaderboardView({ workspaceId }) {
 *   const { data, isLoading } = useLeaderboard(workspaceId, {
 *     period: 'week',
 *     metric: 'total',
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return data?.entries.map(e => <LeaderboardEntry key={e.user_id} entry={e} />);
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only workspace members can view leaderboards
 * - Only aggregate data is returned (no individual entries)
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  LeaderboardResponseSchema,
  LeaderboardEntrySchema,
  LEADERBOARD_STALE_TIME,
  type LeaderboardResponse,
  type LeaderboardEntry,
  type LeaderboardPeriod,
  type LeaderboardMetric,
} from '@/schemas';

// ============================================================================
// ERROR CLASS
// ============================================================================

/**
 * Error thrown when leaderboard operations fail
 */
export class LeaderboardFetchError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'LeaderboardFetchError';
  }
}

// ============================================================================
// DATE RANGE HELPERS
// ============================================================================

/**
 * Date range with start and end dates
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Get the current week's date range based on user's week_start_day preference.
 *
 * @param weekStartDay - Day of week to start on (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @param referenceDate - Reference date (defaults to now)
 * @returns DateRange with start (00:00:00) and end (23:59:59.999) of the current week
 *
 * @example
 * // If today is Wednesday March 15, 2026 and week starts on Monday (1)
 * getWeekRange(1) // { start: Mon Mar 13 00:00:00, end: Sun Mar 19 23:59:59.999 }
 */
export function getWeekRange(weekStartDay: number = 1, referenceDate?: Date): DateRange {
  const now = referenceDate ?? new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Calculate days since the start of the week
  // If weekStartDay is Monday (1) and today is Wednesday (3): 3 - 1 = 2 days back
  // If weekStartDay is Monday (1) and today is Sunday (0): (0 - 1 + 7) % 7 = 6 days back
  const daysSinceStart = (currentDay - weekStartDay + 7) % 7;

  // Start of week (midnight)
  const start = new Date(now);
  start.setDate(now.getDate() - daysSinceStart);
  start.setHours(0, 0, 0, 0);

  // End of week (last millisecond of the 7th day)
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Get the current month's date range.
 *
 * @param referenceDate - Reference date (defaults to now)
 * @returns DateRange with start (1st of month 00:00:00) and end (last day 23:59:59.999)
 *
 * @example
 * // If today is March 15, 2026
 * getMonthRange() // { start: Mar 1 00:00:00, end: Mar 31 23:59:59.999 }
 */
export function getMonthRange(referenceDate?: Date): DateRange {
  const now = referenceDate ?? new Date();

  // Start of month (1st day, midnight)
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  // End of month (last day, last millisecond)
  // Setting day to 0 of next month gives last day of current month
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  return { start, end };
}

/**
 * Get date range for a given period
 *
 * @param period - 'week' or 'month'
 * @param weekStartDay - Day of week to start on for weekly range (0-6)
 * @returns DateRange for the specified period
 */
export function getDateRangeForPeriod(
  period: LeaderboardPeriod,
  weekStartDay: number = 1
): DateRange {
  return period === 'week' ? getWeekRange(weekStartDay) : getMonthRange();
}

// ============================================================================
// FETCH LEADERBOARD
// ============================================================================

/**
 * Options for fetching leaderboard
 */
export interface FetchLeaderboardOptions {
  /** Time period for ranking ('week' or 'month') */
  period?: LeaderboardPeriod;
  /** Metric to rank by ('total' or 'billable') */
  metric?: LeaderboardMetric;
  /** Maximum entries to return (default: 20) */
  limit?: number;
  /** User's week_start_day preference (0-6, default: 1 for Monday) */
  weekStartDay?: number;
}

/**
 * Fetch leaderboard for a workspace
 *
 * Queries time_entries joined with projects to aggregate hours per user.
 * Returns ranked entries with current user's position highlighted.
 *
 * @param workspaceId - UUID of the workspace
 * @param options - Optional configuration for period, metric, and limit
 * @returns Promise<LeaderboardResponse> - Validated leaderboard data
 * @throws LeaderboardFetchError if the fetch fails
 */
export async function fetchLeaderboard(
  workspaceId: string,
  options?: FetchLeaderboardOptions
): Promise<LeaderboardResponse> {
  const { period = 'week', metric = 'total', limit = 20, weekStartDay = 1 } = options ?? {};

  // Get current user
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new LeaderboardFetchError('Failed to get session', 'AUTH_ERROR', sessionError);
  }

  const currentUserId = sessionData.session?.user.id;
  if (!currentUserId) {
    throw new LeaderboardFetchError('Not authenticated', 'NOT_AUTHENTICATED');
  }

  // Calculate date range
  const dateRange = getDateRangeForPeriod(period, weekStartDay);
  const startIso = dateRange.start.toISOString();
  const endIso = dateRange.end.toISOString();

  // Get workspace members with their user details
  const { data: membersData, error: membersError } = await supabase
    .from('workspace_members')
    .select(
      `
      user_id,
      users:user_id (
        id,
        name,
        email
      )
    `
    )
    .eq('workspace_id', workspaceId);

  if (membersError) {
    throw new LeaderboardFetchError(
      'Failed to fetch workspace members',
      'MEMBERS_FETCH_ERROR',
      membersError
    );
  }

  // Build a map of user_id -> user info
  const userMap = new Map<string, { name: string; email: string }>();
  const memberUserIds: string[] = [];
  for (const member of membersData ?? []) {
    const user = member.users as unknown as { id: string; name: string | null; email: string };
    if (user) {
      memberUserIds.push(user.id);
      userMap.set(user.id, {
        name: user.name || user.email.split('@')[0],
        email: user.email,
      });
    }
  }

  if (memberUserIds.length === 0) {
    // Return empty leaderboard
    return {
      period,
      metric,
      workspace_id: workspaceId,
      date_range: {
        start: startIso,
        end: endIso,
      },
      entries: [],
      current_user_entry: null,
      total_participants: 0,
      calculated_at: new Date().toISOString(),
    };
  }

  // Get all projects in this workspace (for filtering time entries)
  const { data: projectsData, error: projectsError } = await supabase
    .from('projects')
    .select('id')
    .eq('workspace_id', workspaceId);

  if (projectsError) {
    throw new LeaderboardFetchError(
      'Failed to fetch workspace projects',
      'PROJECTS_FETCH_ERROR',
      projectsError
    );
  }

  const projectIds = (projectsData ?? []).map(p => p.id);

  if (projectIds.length === 0) {
    // No projects = no time entries to rank
    return {
      period,
      metric,
      workspace_id: workspaceId,
      date_range: {
        start: startIso,
        end: endIso,
      },
      entries: [],
      current_user_entry: null,
      total_participants: 0,
      calculated_at: new Date().toISOString(),
    };
  }

  // Build time entries query
  // Filter by: project_id in workspace projects, date range
  // Group by user_id, sum duration_seconds
  let query = supabase
    .from('time_entries')
    .select('user_id, duration_seconds, is_billable')
    .in('project_id', projectIds)
    .gte('start_at', startIso)
    .lte('start_at', endIso);

  // If metric is billable, filter to only billable entries
  if (metric === 'billable') {
    query = query.eq('is_billable', true);
  }

  const { data: entriesData, error: entriesError } = await query;

  if (entriesError) {
    throw new LeaderboardFetchError(
      'Failed to fetch time entries',
      'ENTRIES_FETCH_ERROR',
      entriesError
    );
  }

  // Aggregate by user_id
  const userTotals = new Map<string, number>();
  for (const entry of entriesData ?? []) {
    if (entry.user_id && memberUserIds.includes(entry.user_id)) {
      const current = userTotals.get(entry.user_id) ?? 0;
      userTotals.set(entry.user_id, current + (entry.duration_seconds ?? 0));
    }
  }

  // Convert to array and sort by total_seconds DESC
  const sortedEntries: Array<{ user_id: string; total_seconds: number }> = [];
  for (const [user_id, total_seconds] of userTotals.entries()) {
    sortedEntries.push({ user_id, total_seconds });
  }
  sortedEntries.sort((a, b) => b.total_seconds - a.total_seconds);

  // Assign ranks (same total_seconds = same rank)
  const rankedEntries: LeaderboardEntry[] = [];
  let currentRank = 0;
  let prevTotal: number | null = null;

  for (let i = 0; i < sortedEntries.length; i++) {
    const entry = sortedEntries[i];

    // If different from previous total, assign new rank
    if (entry.total_seconds !== prevTotal) {
      currentRank = i + 1;
    }

    const userInfo = userMap.get(entry.user_id);
    if (!userInfo) continue;

    const leaderboardEntry: LeaderboardEntry = {
      user_id: entry.user_id,
      name: userInfo.name,
      email: userInfo.email,
      total_seconds: entry.total_seconds,
      rank: currentRank,
      is_current_user: entry.user_id === currentUserId,
    };

    // Validate with schema
    const parsed = LeaderboardEntrySchema.safeParse(leaderboardEntry);
    if (parsed.success) {
      rankedEntries.push(parsed.data);
    }

    prevTotal = entry.total_seconds;
  }

  // Get top N entries
  const topEntries = rankedEntries.slice(0, limit);

  // Find current user's entry if not in top N
  let currentUserEntry: LeaderboardEntry | null = null;
  const isCurrentUserInTop = topEntries.some(e => e.user_id === currentUserId);
  if (!isCurrentUserInTop) {
    currentUserEntry = rankedEntries.find(e => e.user_id === currentUserId) ?? null;
  }

  // Build response
  const response: LeaderboardResponse = {
    period,
    metric,
    workspace_id: workspaceId,
    date_range: {
      start: startIso,
      end: endIso,
    },
    entries: topEntries,
    current_user_entry: currentUserEntry,
    total_participants: rankedEntries.length,
    calculated_at: new Date().toISOString(),
  };

  // Validate full response
  const validated = LeaderboardResponseSchema.safeParse(response);
  if (!validated.success) {
    throw new LeaderboardFetchError(
      'Invalid leaderboard data format',
      'VALIDATION_ERROR',
      validated.error.issues
    );
  }

  return validated.data;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Options for useLeaderboard hook
 */
export interface UseLeaderboardOptions {
  /** Time period for ranking ('week' or 'month') */
  period?: LeaderboardPeriod;
  /** Metric to rank by ('total' or 'billable') */
  metric?: LeaderboardMetric;
  /** User's week_start_day preference (0-6, default: 1) */
  weekStartDay?: number;
  /** Whether to enable the query (default: true) */
  enabled?: boolean;
}

/**
 * Hook for fetching workspace leaderboard data
 *
 * Caches data with 5-minute stale time (not realtime).
 * Automatically refetches when period or metric changes.
 *
 * @param workspaceId - UUID of the workspace (or null to disable)
 * @param options - Configuration for period, metric, and week start day
 * @returns TanStack Query result with leaderboard data
 *
 * @example
 * ```typescript
 * const { data, isLoading, error } = useLeaderboard(workspaceId, {
 *   period: 'week',
 *   metric: 'total',
 *   weekStartDay: 1, // Monday
 * });
 *
 * // Access ranked entries
 * data?.entries.map(entry => ({
 *   rank: entry.rank,
 *   name: entry.name,
 *   hours: entry.total_seconds / 3600,
 * }));
 *
 * // Check if current user is on the board
 * const myRank = data?.current_user_entry?.rank ?? 'Not ranked';
 * ```
 */
export function useLeaderboard(workspaceId: string | null, options?: UseLeaderboardOptions) {
  const { period = 'week', metric = 'total', weekStartDay = 1, enabled = true } = options ?? {};

  return useQuery({
    queryKey: workspaceId ? queryKeys.leaderboard(workspaceId, period, metric) : ['leaderboard'],
    queryFn: () => {
      if (!workspaceId) {
        throw new LeaderboardFetchError('Workspace ID required', 'MISSING_WORKSPACE_ID');
      }
      return fetchLeaderboard(workspaceId, { period, metric, weekStartDay });
    },
    enabled: enabled && !!workspaceId,
    staleTime: LEADERBOARD_STALE_TIME,
    // Don't retry on auth errors
    retry: (failureCount, error) => {
      if (error instanceof LeaderboardFetchError) {
        if (error.code === 'NOT_AUTHENTICATED' || error.code === 'MISSING_WORKSPACE_ID') {
          return false;
        }
      }
      return failureCount < 3;
    },
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format seconds as human-readable duration
 *
 * @param seconds - Total seconds
 * @returns Formatted string like "5h 30m" or "45m"
 */
export function formatLeaderboardDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

/**
 * Get rank badge type based on position
 *
 * @param rank - User's rank (1-indexed)
 * @returns 'gold' | 'silver' | 'bronze' | null
 */
export function getRankBadge(rank: number): 'gold' | 'silver' | 'bronze' | null {
  switch (rank) {
    case 1:
      return 'gold';
    case 2:
      return 'silver';
    case 3:
      return 'bronze';
    default:
      return null;
  }
}

/**
 * Calculate progress percentage relative to leader
 *
 * @param userSeconds - User's total seconds
 * @param leaderSeconds - Leader's total seconds
 * @returns Percentage (0-100) of leader's time
 */
export function getProgressPercentage(userSeconds: number, leaderSeconds: number): number {
  if (leaderSeconds === 0) return 0;
  return Math.round((userSeconds / leaderSeconds) * 100);
}
