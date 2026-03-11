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

import { QueryClient, onlineManager } from '@tanstack/react-query';

// Sync TanStack Query's online state with the browser's navigator.onLine (web only)
import { Platform } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof navigator !== 'undefined') {
  onlineManager.setOnline(navigator.onLine);

  window.addEventListener('online', () => onlineManager.setOnline(true));
  window.addEventListener('offline', () => onlineManager.setOnline(false));
}

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

  /** Analytics query keys */
  analytics: {
    /** Daily totals for the last N days */
    dailyTotals: (days: number) => ['analytics', 'daily', days] as const,

    /** Weekly totals for the last N weeks */
    weeklyTotals: (weeks: number) => ['analytics', 'weekly', weeks] as const,

    /** Monthly totals for the last N months */
    monthlyTotals: (months: number) => ['analytics', 'monthly', months] as const,

    /** Hour of day distribution (last N days) */
    hourOfDay: (days: number) => ['analytics', 'hourOfDay', days] as const,

    /** Day of week distribution (last N weeks) */
    dayOfWeek: (weeks: number) => ['analytics', 'dayOfWeek', weeks] as const,

    /** Earnings data */
    earnings: ['analytics', 'earnings'] as const,

    /** Monthly earnings for the last N months */
    monthlyEarnings: (months: number) => ['analytics', 'monthlyEarnings', months] as const,

    /** All analytics queries (for invalidation) */
    all: ['analytics'] as const,
  },

  /** Tags for the current user */
  tags: ['tags'] as const,

  /** Tags for a specific time entry */
  entryTags: (entryId: string) => ['entryTags', entryId] as const,

  /** Comments for a specific time entry */
  entryComments: (entryId: string) => ['entryComments', entryId] as const,

  /** Attachments for a specific time entry */
  entryAttachments: (entryId: string) => ['entryAttachments', entryId] as const,

  /** Entry templates for the current user */
  entryTemplates: ['entryTemplates'] as const,

  /** Spotify connection for the current user */
  spotifyConnection: ['spotifyConnection'] as const,

  /** Spotify playback state */
  spotifyPlayback: ['spotifyPlayback'] as const,

  /** AI connection configuration for the current user */
  aiConnection: ['aiConnection'] as const,

  /** Email connections for current user */
  emailConnections: ['emailConnections'] as const,

  /** Single email connection by ID */
  emailConnection: (id: string) => ['emailConnections', id] as const,

  /** Email messages for a connection */
  emailMessages: (connectionId: string) => ['emailMessages', connectionId] as const,

  /** Recent emails across all connections */
  recentEmails: ['recentEmails'] as const,

  /** Calendar connections for current user */
  calendarConnections: ['calendarConnections'] as const,

  /** Single calendar connection by ID */
  calendarConnection: (id: string) => ['calendarConnections', id] as const,

  /** Calendar events for a connection */
  calendarEvents: (connectionId: string, dateRange?: { start: string; end: string }) =>
    dateRange
      ? (['calendarEvents', connectionId, dateRange] as const)
      : (['calendarEvents', connectionId] as const),

  /** Today's events across all calendars */
  todayEvents: ['todayEvents'] as const,

  /** Upcoming events across all calendars */
  upcomingEvents: (days: number) => ['upcomingEvents', days] as const,
} as const;

export type QueryKeys = typeof queryKeys;
