/**
 * TanStack Query Client Configuration
 *
 * This module exports a pre-configured QueryClient instance for use with
 * React Query throughout the application.
 *
 * Configuration:
 * - staleTime: 5 minutes - Data is considered fresh for 5 minutes
 * - gcTime: 30 minutes - Unused/inactive cache data is garbage collected after 30 minutes
 *
 * USAGE:
 * ```typescript
 * // In App.tsx or root component
 * import { QueryClientProvider } from '@tanstack/react-query';
 * import { queryClient } from '@/lib/queryClient';
 *
 * function App() {
 *   return (
 *     <QueryClientProvider client={queryClient}>
 *       <YourApp />
 *     </QueryClientProvider>
 *   );
 * }
 * ```
 *
 * @see https://tanstack.com/query/latest/docs/react/guides/important-defaults
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * 5 minutes in milliseconds
 * Data is considered fresh and won't be refetched for this duration
 */
const STALE_TIME_MS = 5 * 60 * 1000;

/**
 * 30 minutes in milliseconds (formerly cacheTime, renamed to gcTime in v5)
 * Unused/inactive cache data is garbage collected after this duration
 */
const GC_TIME_MS = 30 * 60 * 1000;

/**
 * Pre-configured QueryClient instance
 *
 * Default options:
 * - Queries are fresh for 5 minutes (staleTime)
 * - Cache is garbage collected after 30 minutes of inactivity (gcTime)
 * - Retry failed queries up to 3 times with exponential backoff (default)
 * - Refetch on window focus disabled for mobile-first experience
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      gcTime: GC_TIME_MS,
      // Disable refetch on window focus for mobile-first experience
      // Can be overridden per-query if needed
      refetchOnWindowFocus: false,
      // Keep default retry behavior (3 retries with exponential backoff)
      retry: 3,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
});

/**
 * Query key constants for consistent cache management
 *
 * These keys are used to identify and invalidate cached data.
 * Always use these constants rather than string literals to ensure
 * cache invalidation works correctly.
 */
export const queryKeys = {
  /** All categories for the current user */
  categories: ['categories'] as const,

  /** Single category by ID */
  category: (id: string) => ['categories', id] as const,

  /** All time entries (with optional filters) */
  timeEntries: (filters?: Record<string, unknown>) =>
    filters ? ['timeEntries', filters] : (['timeEntries'] as const),

  /** Single time entry by ID */
  timeEntry: (id: string) => ['timeEntries', id] as const,

  /** Goals for a specific month */
  goals: (month: string) => ['goals', month] as const,

  /** Single goal by ID */
  goal: (id: string) => ['goals', 'single', id] as const,

  /** User profile */
  user: ['user'] as const,

  /** Active timer */
  activeTimer: ['activeTimer'] as const,
} as const;

export type QueryKeys = typeof queryKeys;
