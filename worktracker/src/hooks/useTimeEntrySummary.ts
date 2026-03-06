/**
 * Time Entry Summary Hook
 *
 * This hook provides aggregated time entry data for a given date range,
 * including total hours and entry counts.
 *
 * USAGE:
 * ```typescript
 * import { useTimeEntrySummary } from '@/hooks/useTimeEntrySummary';
 *
 * function DailySummary() {
 *   const today = new Date().toISOString().split('T')[0];
 *   const { data: summary, isLoading } = useTimeEntrySummary({
 *     dateStart: `${today}T00:00:00Z`,
 *     dateEnd: `${today}T23:59:59Z`,
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <View>
 *       <Text>Today: {summary?.totalHours.toFixed(1)} hours</Text>
 *       <Text>{summary?.entryCount} entries</Text>
 *     </View>
 *   );
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only the authenticated user's entries are counted
 * - Aggregation is performed server-side for efficiency
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';

/**
 * Error thrown when summary fetch fails
 */
export class TimeEntrySummaryError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'TimeEntrySummaryError';
  }
}

/**
 * Summary data for time entries in a range
 */
export interface TimeEntrySummary {
  /** Total duration in seconds */
  totalSeconds: number;
  /** Total duration in hours (derived from totalSeconds) */
  totalHours: number;
  /** Number of entries in the range */
  entryCount: number;
  /** Average entry duration in seconds (null if no entries) */
  averageDurationSeconds: number | null;
  /** Average entry duration in hours (null if no entries) */
  averageDurationHours: number | null;
}

/**
 * Parameters for fetching a time entry summary
 */
export interface TimeEntrySummaryParams {
  /** Start of date range (ISO 8601 datetime) */
  dateStart: string;
  /** End of date range (ISO 8601 datetime) */
  dateEnd: string;
  /** Optional category ID to filter by */
  categoryId?: string | null;
}

/**
 * Fetch aggregated summary data for time entries in a date range
 *
 * @param params - Date range and optional category filter
 * @returns Promise<TimeEntrySummary> - Aggregated summary data
 * @throws TimeEntrySummaryError if the fetch fails
 */
async function fetchTimeEntrySummary(params: TimeEntrySummaryParams): Promise<TimeEntrySummary> {
  const { dateStart, dateEnd, categoryId } = params;

  // Build the query for aggregation
  // We'll fetch entries and aggregate client-side since Supabase
  // doesn't support complex aggregations in a single query without RPC
  let query = supabase
    .from('time_entries')
    .select('duration_seconds')
    .gte('start_at', dateStart)
    .lte('start_at', dateEnd);

  if (categoryId !== undefined) {
    if (categoryId === null) {
      query = query.is('category_id', null);
    } else {
      query = query.eq('category_id', categoryId);
    }
  }

  const { data, error, count } = await query;

  if (error) {
    throw new TimeEntrySummaryError(error.message, error.code);
  }

  if (!data || data.length === 0) {
    return {
      totalSeconds: 0,
      totalHours: 0,
      entryCount: 0,
      averageDurationSeconds: null,
      averageDurationHours: null,
    };
  }

  // Calculate aggregates
  const totalSeconds = data.reduce((sum, entry) => sum + (entry.duration_seconds || 0), 0);
  const entryCount = data.length;
  const averageDurationSeconds = entryCount > 0 ? totalSeconds / entryCount : null;

  return {
    totalSeconds,
    totalHours: totalSeconds / 3600,
    entryCount,
    averageDurationSeconds,
    averageDurationHours: averageDurationSeconds !== null ? averageDurationSeconds / 3600 : null,
  };
}

/**
 * Options for useTimeEntrySummary hook
 */
export interface UseTimeEntrySummaryOptions extends TimeEntrySummaryParams {
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
 * Hook to fetch aggregated time entry data for a date range
 *
 * @param options - Date range, optional category filter, and query options
 * @returns React Query result with summary data
 *
 * @example
 * ```typescript
 * // Get today's summary
 * const today = new Date();
 * const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
 * const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();
 *
 * const { data } = useTimeEntrySummary({
 *   dateStart: startOfDay,
 *   dateEnd: endOfDay,
 * });
 *
 * // Get summary for a specific category
 * const { data } = useTimeEntrySummary({
 *   dateStart: startOfDay,
 *   dateEnd: endOfDay,
 *   categoryId: 'work-category-uuid',
 * });
 *
 * // Get uncategorized entries only
 * const { data } = useTimeEntrySummary({
 *   dateStart: startOfDay,
 *   dateEnd: endOfDay,
 *   categoryId: null,
 * });
 * ```
 */
export function useTimeEntrySummary(options: UseTimeEntrySummaryOptions) {
  const { dateStart, dateEnd, categoryId, enabled = true, staleTime } = options;

  return useQuery({
    queryKey: [
      ...queryKeys.timeEntries({ summary: true, dateStart, dateEnd, categoryId }),
    ],
    queryFn: () => fetchTimeEntrySummary({ dateStart, dateEnd, categoryId }),
    enabled,
    staleTime,
  });
}

/**
 * Type for the useTimeEntrySummary hook return value
 */
export type UseTimeEntrySummaryResult = ReturnType<typeof useTimeEntrySummary>;

// ============================================================================
// CATEGORY BREAKDOWN HOOK
// ============================================================================

/**
 * Category time breakdown entry
 */
export interface CategoryTimeBreakdown {
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  totalSeconds: number;
  totalHours: number;
  entryCount: number;
  /** Percentage of total time in the range */
  percentage: number;
}

/**
 * Summary with category breakdown
 */
export interface TimeEntrySummaryWithBreakdown extends TimeEntrySummary {
  /** Breakdown by category */
  categoryBreakdown: CategoryTimeBreakdown[];
}

/**
 * Fetch summary with category breakdown
 *
 * @param params - Date range parameters
 * @returns Promise<TimeEntrySummaryWithBreakdown> - Summary with category breakdown
 */
async function fetchTimeEntrySummaryWithBreakdown(
  params: Omit<TimeEntrySummaryParams, 'categoryId'>
): Promise<TimeEntrySummaryWithBreakdown> {
  const { dateStart, dateEnd } = params;

  // Fetch entries with category information
  const { data, error } = await supabase
    .from('time_entries')
    .select(`
      duration_seconds,
      category_id,
      categories (
        id,
        name,
        color
      )
    `)
    .gte('start_at', dateStart)
    .lte('start_at', dateEnd);

  if (error) {
    throw new TimeEntrySummaryError(error.message, error.code);
  }

  if (!data || data.length === 0) {
    return {
      totalSeconds: 0,
      totalHours: 0,
      entryCount: 0,
      averageDurationSeconds: null,
      averageDurationHours: null,
      categoryBreakdown: [],
    };
  }

  // Calculate totals
  const totalSeconds = data.reduce((sum, entry) => sum + (entry.duration_seconds || 0), 0);
  const entryCount = data.length;

  // Group by category
  const categoryMap = new Map<
    string | null,
    { seconds: number; count: number; name: string | null; color: string | null }
  >();

  for (const entry of data) {
    const categoryId = entry.category_id;
    // categories is returned as a single object due to the foreign key relation (not an array)
    // But TypeScript infers it as an array, so we need to handle both cases
    const rawCategory = entry.categories as unknown;
    let category: { id: string; name: string; color: string } | null = null;

    if (rawCategory) {
      if (Array.isArray(rawCategory) && rawCategory.length > 0) {
        category = rawCategory[0] as { id: string; name: string; color: string };
      } else if (typeof rawCategory === 'object' && 'id' in rawCategory) {
        category = rawCategory as { id: string; name: string; color: string };
      }
    }

    const existing = categoryMap.get(categoryId) ?? {
      seconds: 0,
      count: 0,
      name: category?.name ?? null,
      color: category?.color ?? null,
    };

    categoryMap.set(categoryId, {
      ...existing,
      seconds: existing.seconds + (entry.duration_seconds || 0),
      count: existing.count + 1,
    });
  }

  // Convert to breakdown array
  const categoryBreakdown: CategoryTimeBreakdown[] = Array.from(categoryMap.entries())
    .map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.name,
      categoryColor: data.color,
      totalSeconds: data.seconds,
      totalHours: data.seconds / 3600,
      entryCount: data.count,
      percentage: totalSeconds > 0 ? (data.seconds / totalSeconds) * 100 : 0,
    }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds); // Sort by time descending

  const averageDurationSeconds = entryCount > 0 ? totalSeconds / entryCount : null;

  return {
    totalSeconds,
    totalHours: totalSeconds / 3600,
    entryCount,
    averageDurationSeconds,
    averageDurationHours: averageDurationSeconds !== null ? averageDurationSeconds / 3600 : null,
    categoryBreakdown,
  };
}

/**
 * Options for useTimeEntrySummaryWithBreakdown hook
 */
export interface UseTimeEntrySummaryWithBreakdownOptions {
  /** Start of date range (ISO 8601 datetime) */
  dateStart: string;
  /** End of date range (ISO 8601 datetime) */
  dateEnd: string;
  /** Whether the query should be enabled */
  enabled?: boolean;
  /** Override the default stale time */
  staleTime?: number;
}

/**
 * Hook to fetch summary with category breakdown
 *
 * @param options - Date range and query options
 * @returns React Query result with summary and breakdown data
 *
 * @example
 * ```typescript
 * const { data } = useTimeEntrySummaryWithBreakdown({
 *   dateStart: '2024-01-01T00:00:00Z',
 *   dateEnd: '2024-01-31T23:59:59Z',
 * });
 *
 * console.log(data?.totalHours); // 120.5
 * console.log(data?.categoryBreakdown[0]?.categoryName); // 'Work'
 * console.log(data?.categoryBreakdown[0]?.percentage); // 45.2
 * ```
 */
export function useTimeEntrySummaryWithBreakdown(options: UseTimeEntrySummaryWithBreakdownOptions) {
  const { dateStart, dateEnd, enabled = true, staleTime } = options;

  return useQuery({
    queryKey: [
      ...queryKeys.timeEntries({ summaryWithBreakdown: true, dateStart, dateEnd }),
    ],
    queryFn: () => fetchTimeEntrySummaryWithBreakdown({ dateStart, dateEnd }),
    enabled,
    staleTime,
  });
}

/**
 * Type for the useTimeEntrySummaryWithBreakdown hook return value
 */
export type UseTimeEntrySummaryWithBreakdownResult = ReturnType<typeof useTimeEntrySummaryWithBreakdown>;

/**
 * Export fetch functions for direct use in services
 */
export { fetchTimeEntrySummary, fetchTimeEntrySummaryWithBreakdown };
