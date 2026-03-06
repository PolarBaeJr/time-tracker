/**
 * Time Entries Query Hook
 *
 * This hook provides a TanStack Query (React Query) based interface for fetching
 * user time entries from Supabase with cursor-based pagination and filtering.
 *
 * USAGE:
 * ```typescript
 * import { useTimeEntries } from '@/hooks/useTimeEntries';
 *
 * function EntryList() {
 *   const {
 *     data,
 *     isLoading,
 *     hasNextPage,
 *     fetchNextPage,
 *     isFetchingNextPage,
 *   } = useTimeEntries({
 *     filters: { dateStart: '2024-01-01T00:00:00Z' },
 *   });
 *
 *   const entries = data?.pages.flatMap(page => page.data) ?? [];
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <>
 *       {entries.map(entry => <EntryCard key={entry.id} entry={entry} />)}
 *       {hasNextPage && (
 *         <Button onPress={() => fetchNextPage()} loading={isFetchingNextPage}>
 *           Load More
 *         </Button>
 *       )}
 *     </>
 *   );
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only the authenticated user's entries are returned
 * - user_id is NOT included in queries; it's enforced server-side via auth.uid()
 */

import { useInfiniteQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import { TimeEntrySchema, TimeEntryFiltersSchema, type TimeEntry, type TimeEntryFilters } from '@/schemas';

/**
 * Default page size for paginated queries
 */
const DEFAULT_PAGE_SIZE = 20;

/**
 * Error thrown when time entries fetch fails
 */
export class TimeEntriesFetchError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'TimeEntriesFetchError';
  }
}

/**
 * Response shape for a page of time entries
 */
export interface TimeEntriesPage {
  data: TimeEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Parameters for fetching time entries
 */
interface FetchTimeEntriesParams {
  filters?: TimeEntryFilters;
  pageSize?: number;
  cursor?: string;
}

/**
 * Fetch a page of time entries with cursor-based pagination
 *
 * Uses created_at as the cursor field for consistent ordering.
 * Entries are returned in descending order (newest first).
 *
 * @param params - Fetch parameters including filters, page size, and cursor
 * @returns Promise<TimeEntriesPage> - Page of entries with pagination info
 * @throws TimeEntriesFetchError if the fetch fails
 */
async function fetchTimeEntries({
  filters,
  pageSize = DEFAULT_PAGE_SIZE,
  cursor,
}: FetchTimeEntriesParams): Promise<TimeEntriesPage> {
  // Validate filters if provided
  if (filters) {
    const validationResult = TimeEntryFiltersSchema.safeParse(filters);
    if (!validationResult.success) {
      throw new TimeEntriesFetchError(
        `Invalid filters: ${validationResult.error.message}`,
        'INVALID_FILTERS'
      );
    }
  }

  // Build the query
  let query = supabase.from('time_entries').select('*').order('created_at', { ascending: false });

  // Apply cursor-based pagination
  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  // Apply filters
  if (filters?.dateStart) {
    query = query.gte('start_at', filters.dateStart);
  }

  if (filters?.dateEnd) {
    query = query.lte('start_at', filters.dateEnd);
  }

  if (filters?.categoryId !== undefined) {
    if (filters.categoryId === null) {
      query = query.is('category_id', null);
    } else {
      query = query.eq('category_id', filters.categoryId);
    }
  }

  if (filters?.searchNotes) {
    query = query.ilike('notes', `%${filters.searchNotes}%`);
  }

  if (filters?.minDuration !== undefined) {
    query = query.gte('duration_seconds', filters.minDuration);
  }

  if (filters?.maxDuration !== undefined) {
    query = query.lte('duration_seconds', filters.maxDuration);
  }

  // Apply pagination limit (fetch one extra to determine hasMore)
  query = query.limit(pageSize + 1);

  const { data, error } = await query;

  if (error) {
    throw new TimeEntriesFetchError(error.message, error.code);
  }

  if (!data) {
    return {
      data: [],
      nextCursor: null,
      hasMore: false,
    };
  }

  // Determine if there are more pages
  const hasMore = data.length > pageSize;
  const pageData = hasMore ? data.slice(0, pageSize) : data;

  // Validate each entry against the schema
  const validatedEntries = pageData.map((entry) => {
    const parsed = TimeEntrySchema.safeParse(entry);
    if (!parsed.success) {
      console.warn('[useTimeEntries] Invalid entry data:', entry, parsed.error);
      // Return as-is with type assertion for defensive handling
      return entry as TimeEntry;
    }
    return parsed.data;
  });

  // Get the cursor for the next page (created_at of the last item)
  const nextCursor = validatedEntries.length > 0 ? validatedEntries[validatedEntries.length - 1].created_at : null;

  return {
    data: validatedEntries,
    nextCursor: hasMore ? nextCursor : null,
    hasMore,
  };
}

/**
 * Options for the useTimeEntries hook
 */
export interface UseTimeEntriesOptions {
  /**
   * Filters to apply to the query
   */
  filters?: TimeEntryFilters;

  /**
   * Number of entries per page (default: 20)
   */
  pageSize?: number;

  /**
   * Whether the query should be enabled
   * Useful for conditional fetching (e.g., only when user is authenticated)
   */
  enabled?: boolean;

  /**
   * Override the default stale time
   */
  staleTime?: number;
}

/**
 * Hook to fetch paginated time entries with filtering support
 *
 * Uses TanStack Query's useInfiniteQuery for cursor-based pagination.
 * Entries are ordered by created_at descending (newest first).
 *
 * @param options - Configuration options including filters and pagination
 * @returns React Query infinite query result with time entries
 *
 * @example
 * ```typescript
 * // Fetch all entries
 * const { data, fetchNextPage, hasNextPage } = useTimeEntries();
 *
 * // Fetch entries in a date range
 * const { data } = useTimeEntries({
 *   filters: {
 *     dateStart: '2024-01-01T00:00:00Z',
 *     dateEnd: '2024-01-31T23:59:59Z',
 *   },
 * });
 *
 * // Fetch entries for a specific category
 * const { data } = useTimeEntries({
 *   filters: { categoryId: 'uuid-here' },
 * });
 *
 * // Search entries by notes
 * const { data } = useTimeEntries({
 *   filters: { searchNotes: 'meeting' },
 * });
 *
 * // Flatten all pages into a single array
 * const allEntries = data?.pages.flatMap(page => page.data) ?? [];
 * ```
 */
export function useTimeEntries(options?: UseTimeEntriesOptions) {
  const { filters, pageSize = DEFAULT_PAGE_SIZE, enabled = true, staleTime } = options ?? {};

  return useInfiniteQuery({
    queryKey: queryKeys.timeEntries(filters as Record<string, unknown> | undefined),
    queryFn: ({ pageParam }) =>
      fetchTimeEntries({
        filters,
        pageSize,
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
    staleTime,
  });
}

/**
 * Type for the useTimeEntries hook return value
 */
export type UseTimeEntriesResult = ReturnType<typeof useTimeEntries>;

/**
 * Export the fetch function for direct use in services
 */
export { fetchTimeEntries };
