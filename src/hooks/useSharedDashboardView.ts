/**
 * Shared Dashboard View Hook
 *
 * This module provides a TanStack Query hook for viewing shared dashboards.
 * No authentication is required - the hook calls a public Edge Function that
 * returns aggregate analytics data based on the share token.
 *
 * USAGE:
 * ```typescript
 * import { useSharedDashboardView } from '@/hooks/useSharedDashboardView';
 *
 * function SharedDashboardPage({ token }: { token: string }) {
 *   const { data, isLoading, error } = useSharedDashboardView(token);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       <h1>{data.title}</h1>
 *       <p>Total hours this week: {data.summary.total_hours_week}</p>
 *       <DailyChart data={data.daily_totals} />
 *       <CategoryBreakdown data={data.category_breakdown} />
 *     </div>
 *   );
 * }
 * ```
 *
 * SECURITY:
 * - No authentication required (public endpoint)
 * - Only aggregate statistics are exposed, never individual entries
 * - Token validation happens server-side
 * - Expired/revoked links return appropriate errors
 */

import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryClient';
import {
  SharedDashboardDataSchema,
  SharedDashboardViewQuerySchema,
  type SharedDashboardData,
  type SharedDashboardViewQuery,
} from '@/schemas';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Stale time for shared dashboard data (5 minutes)
 * Matches the server-side cache duration
 */
const SHARED_DASHBOARD_STALE_TIME = 5 * 60 * 1000;

/**
 * Base URL for the shared dashboard Edge Function
 * Uses Supabase Edge Function URL pattern
 */
const getEdgeFunctionUrl = (): string => {
  // In development, use local Supabase
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:54321/functions/v1/shared-dashboard';
  }

  // In production, use the configured Supabase URL
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  return `${supabaseUrl}/functions/v1/shared-dashboard`;
};

// ============================================================================
// ERROR CLASS
// ============================================================================

/**
 * Error thrown when shared dashboard view operations fail
 */
export class SharedDashboardViewError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'SharedDashboardViewError';
  }
}

// ============================================================================
// FETCH FUNCTION
// ============================================================================

/**
 * Fetch shared dashboard data from the Edge Function
 *
 * This function calls the public shared-dashboard Edge Function which:
 * 1. Validates the token
 * 2. Checks if the dashboard is active and not expired
 * 3. Returns aggregate analytics data
 *
 * @param token - The unique share token (UUID format)
 * @param options - Optional query parameters for date range
 * @returns Promise<SharedDashboardData> - Aggregate analytics data
 * @throws SharedDashboardViewError if the fetch fails
 *
 * @example
 * ```typescript
 * // Basic fetch
 * const data = await fetchSharedDashboardData('abc-123-token');
 *
 * // With date range
 * const data = await fetchSharedDashboardData('abc-123-token', {
 *   start_date: '2024-01-01',
 *   end_date: '2024-01-31',
 * });
 * ```
 */
export async function fetchSharedDashboardData(
  token: string,
  options?: SharedDashboardViewQuery
): Promise<SharedDashboardData> {
  // Validate token format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) {
    throw new SharedDashboardViewError('Invalid token format', 'INVALID_TOKEN', 400);
  }

  // Validate options if provided
  if (options) {
    const validationResult = SharedDashboardViewQuerySchema.safeParse(options);
    if (!validationResult.success) {
      throw new SharedDashboardViewError(
        `Invalid query parameters: ${validationResult.error.message}`,
        'INVALID_PARAMS',
        400,
        validationResult.error.flatten()
      );
    }
  }

  // Build URL with query parameters
  const url = new URL(getEdgeFunctionUrl());
  url.searchParams.set('token', token);

  if (options?.start_date) {
    url.searchParams.set('start_date', options.start_date);
  }
  if (options?.end_date) {
    url.searchParams.set('end_date', options.end_date);
  }

  // Fetch from Edge Function
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Handle error responses
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = (errorData as { error?: string }).error ?? 'Failed to fetch dashboard';

    switch (response.status) {
      case 400:
        throw new SharedDashboardViewError(errorMessage, 'BAD_REQUEST', 400, errorData);
      case 404:
        throw new SharedDashboardViewError(
          'Dashboard not found or no longer available',
          'NOT_FOUND',
          404
        );
      case 410:
        throw new SharedDashboardViewError('This share link has expired', 'EXPIRED', 410);
      case 403:
        throw new SharedDashboardViewError('This share link has been revoked', 'REVOKED', 403);
      default:
        throw new SharedDashboardViewError(
          errorMessage,
          'SERVER_ERROR',
          response.status,
          errorData
        );
    }
  }

  // Parse and validate response
  const data = await response.json();

  const parsed = SharedDashboardDataSchema.safeParse(data);
  if (!parsed.success) {
    console.warn('[useSharedDashboardView] Invalid response data:', data, parsed.error);
    // Return data as-is if validation fails but structure is usable
    return data as SharedDashboardData;
  }

  return parsed.data;
}

// ============================================================================
// QUERY HOOK
// ============================================================================

/**
 * Options for the useSharedDashboardView hook
 */
export interface UseSharedDashboardViewOptions {
  /** Whether the query should be enabled */
  enabled?: boolean;

  /** Override the default stale time (default: 5 minutes) */
  staleTime?: number;

  /** Date range start (YYYY-MM-DD format) */
  startDate?: string;

  /** Date range end (YYYY-MM-DD format) */
  endDate?: string;

  /** Callback on successful fetch */
  onSuccess?: (data: SharedDashboardData) => void;

  /** Callback on error */
  onError?: (error: SharedDashboardViewError) => void;
}

/**
 * Hook to fetch and display a shared dashboard
 *
 * This hook calls the public Edge Function to fetch aggregate analytics
 * for a shared dashboard. No authentication is required.
 *
 * @param token - The unique share token (UUID format)
 * @param options - Optional configuration
 * @returns React Query result with dashboard data
 *
 * @example
 * ```typescript
 * // Basic usage
 * function SharedDashboard({ token }: { token: string }) {
 *   const { data, isLoading, error } = useSharedDashboardView(token);
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return <Dashboard data={data} />;
 * }
 *
 * // With date range
 * function SharedDashboard({ token }: { token: string }) {
 *   const [startDate, setStartDate] = useState('2024-01-01');
 *   const [endDate, setEndDate] = useState('2024-01-31');
 *
 *   const { data, isLoading } = useSharedDashboardView(token, {
 *     startDate,
 *     endDate,
 *   });
 *
 *   return (
 *     <div>
 *       <DateRangePicker
 *         startDate={startDate}
 *         endDate={endDate}
 *         onStartDateChange={setStartDate}
 *         onEndDateChange={setEndDate}
 *       />
 *       {isLoading ? <Loading /> : <Dashboard data={data} />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSharedDashboardView(token: string, options?: UseSharedDashboardViewOptions) {
  const {
    enabled = true,
    staleTime = SHARED_DASHBOARD_STALE_TIME,
    startDate,
    endDate,
    onSuccess,
    onError,
  } = options ?? {};

  // Build query options
  const queryOptions: SharedDashboardViewQuery = {};
  if (startDate) {
    queryOptions.start_date = startDate;
  }
  if (endDate) {
    queryOptions.end_date = endDate;
  }

  return useQuery({
    queryKey: queryKeys.sharedDashboard(token),
    queryFn: async () => {
      const data = await fetchSharedDashboardData(
        token,
        Object.keys(queryOptions).length > 0 ? queryOptions : undefined
      );
      onSuccess?.(data);
      return data;
    },
    enabled: enabled && !!token,
    staleTime,
    // Don't retry on 404/410/403 errors - they're permanent
    retry: (failureCount, error) => {
      if (error instanceof SharedDashboardViewError) {
        const nonRetryableCodes = ['NOT_FOUND', 'EXPIRED', 'REVOKED', 'INVALID_TOKEN'];
        if (nonRetryableCodes.includes(error.code ?? '')) {
          return false;
        }
      }
      return failureCount < 3;
    },
    // Handle errors
    meta: {
      onError,
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format total seconds as hours and minutes string
 *
 * @param totalSeconds - Total seconds to format
 * @returns Formatted string like "12h 30m" or "45m"
 */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

/**
 * Convert seconds to hours with decimal precision
 *
 * @param totalSeconds - Total seconds to convert
 * @param decimals - Number of decimal places (default: 1)
 * @returns Hours as a number
 */
export function secondsToHours(totalSeconds: number, decimals = 1): number {
  const hours = totalSeconds / 3600;
  const factor = Math.pow(10, decimals);
  return Math.round(hours * factor) / factor;
}

/**
 * Check if a dashboard view error indicates the link is invalid
 *
 * @param error - The error to check
 * @returns true if the link is permanently invalid (not found, expired, or revoked)
 */
export function isLinkInvalid(error: SharedDashboardViewError): boolean {
  const invalidCodes = ['NOT_FOUND', 'EXPIRED', 'REVOKED', 'INVALID_TOKEN'];
  return invalidCodes.includes(error.code ?? '');
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UseSharedDashboardViewResult = ReturnType<typeof useSharedDashboardView>;
