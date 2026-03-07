/**
 * Analytics Query Hooks
 *
 * TanStack Query hooks for fetching time tracking analytics data including:
 * - Daily totals (last N days)
 * - Weekly totals (last N weeks)
 * - Monthly totals (last N months)
 * - Hour of day distribution (24 values showing time prominence by hour)
 * - Day of week distribution (7 values showing time prominence by day)
 *
 * USAGE:
 * ```typescript
 * import { useDailyTotals, useHourOfDayDistribution } from '@/hooks/useAnalytics';
 *
 * function AnalyticsDashboard() {
 *   const { data: dailyData } = useDailyTotals({ days: 7 });
 *   const { data: hourData } = useHourOfDayDistribution();
 *
 *   // dailyData: [{ date: '2024-03-05', totalSeconds: 28800 }, ...]
 *   // hourData: [0, 0, 0, 0, 0, 0, 1200, 3600, 7200, ...] // 24 values
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only the authenticated user's data is aggregated
 * - All queries respect user_id from auth.uid()
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import {
  getLastNDays,
  getLastNWeeks,
  getLastNMonths,
  getHourFromISOString,
  getHourOfDay,
  getDayOfWeekFromISOString,
  type DayOfWeek,
  type DateRangeOptions,
} from '@/utils/analytics';

// ============================================================================
// ERROR CLASSES
// ============================================================================

/**
 * Error thrown when analytics fetch fails
 */
export class AnalyticsFetchError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'AnalyticsFetchError';
  }
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Daily total entry
 */
export interface DailyTotal {
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Total seconds tracked on this day */
  totalSeconds: number;
}

/**
 * Weekly total entry
 */
export interface WeeklyTotal {
  /** Start of week in YYYY-MM-DD format */
  weekStart: string;
  /** Total seconds tracked in this week */
  totalSeconds: number;
}

/**
 * Monthly total entry
 */
export interface MonthlyTotal {
  /** Month in YYYY-MM format */
  month: string;
  /** Total seconds tracked in this month */
  totalSeconds: number;
}

/**
 * Hour of day distribution (24 values)
 */
export type HourOfDayDistribution = number[];

/**
 * Day of week distribution (7 values, index 0 = Sunday)
 */
export type DayOfWeekDistribution = number[];

// ============================================================================
// DAILY TOTALS
// ============================================================================

/**
 * Options for useDailyTotals hook
 */
export interface UseDailyTotalsOptions {
  /** Number of days to fetch (including today, default: 7) */
  days?: number;
  /** Whether the query should be enabled */
  enabled?: boolean;
  /** Override the default stale time */
  staleTime?: number;
}

/**
 * Fetch daily totals for the last N days
 */
async function fetchDailyTotals(days: number, options: DateRangeOptions): Promise<DailyTotal[]> {
  const dayRanges = getLastNDays(days, options);

  // Fetch all entries in the date range
  const { data, error } = await supabase
    .from('time_entries')
    .select('start_at, duration_seconds')
    .gte('start_at', dayRanges[dayRanges.length - 1].start)
    .lte('start_at', dayRanges[0].end);

  if (error) {
    throw new AnalyticsFetchError(error.message, error.code);
  }

  // Aggregate by day
  const dailyMap = new Map<string, number>();

  // Initialize all days with 0
  for (const range of dayRanges) {
    dailyMap.set(range.date, 0);
  }

  // Sum up entries by day
  if (data) {
    for (const entry of data) {
      if (!entry.start_at || entry.duration_seconds === null) continue;

      // Find which day this entry belongs to
      const entryDate = new Date(entry.start_at);
      for (const range of dayRanges) {
        const rangeStart = new Date(range.start);
        const rangeEnd = new Date(range.end);

        if (entryDate >= rangeStart && entryDate <= rangeEnd) {
          const current = dailyMap.get(range.date) ?? 0;
          dailyMap.set(range.date, current + entry.duration_seconds);
          break;
        }
      }
    }
  }

  // Convert to array, sorted by date descending (newest first)
  return dayRanges.map(range => ({
    date: range.date,
    totalSeconds: dailyMap.get(range.date) ?? 0,
  }));
}

/**
 * Hook to fetch daily totals for the last N days
 *
 * @param options - Configuration options
 * @returns React Query result with daily totals
 *
 * @example
 * ```typescript
 * const { data } = useDailyTotals({ days: 7 });
 * // data: [{ date: '2024-03-05', totalSeconds: 28800 }, ...]
 * ```
 */
export function useDailyTotals(options?: UseDailyTotalsOptions) {
  const { days = 7, enabled = true, staleTime } = options ?? {};
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.analytics.dailyTotals(days),
    queryFn: () =>
      fetchDailyTotals(days, {
        timezone: user?.timezone ?? 'UTC',
        weekStartDay: (user?.week_start_day ?? 1) as DayOfWeek,
      }),
    enabled,
    staleTime,
  });
}

// ============================================================================
// WEEKLY TOTALS
// ============================================================================

/**
 * Options for useWeeklyTotals hook
 */
export interface UseWeeklyTotalsOptions {
  /** Number of weeks to fetch (including current week, default: 4) */
  weeks?: number;
  /** Whether the query should be enabled */
  enabled?: boolean;
  /** Override the default stale time */
  staleTime?: number;
}

/**
 * Fetch weekly totals for the last N weeks
 */
async function fetchWeeklyTotals(weeks: number, options: DateRangeOptions): Promise<WeeklyTotal[]> {
  const weekRanges = getLastNWeeks(weeks, options);

  // Fetch all entries in the date range
  const { data, error } = await supabase
    .from('time_entries')
    .select('start_at, duration_seconds')
    .gte('start_at', weekRanges[weekRanges.length - 1].start)
    .lte('start_at', weekRanges[0].end);

  if (error) {
    throw new AnalyticsFetchError(error.message, error.code);
  }

  // Aggregate by week
  const weeklyMap = new Map<string, number>();

  // Initialize all weeks with 0
  for (const range of weekRanges) {
    weeklyMap.set(range.weekStart, 0);
  }

  // Sum up entries by week
  if (data) {
    for (const entry of data) {
      if (!entry.start_at || entry.duration_seconds === null) continue;

      // Find which week this entry belongs to
      const entryDate = new Date(entry.start_at);
      for (const range of weekRanges) {
        const rangeStart = new Date(range.start);
        const rangeEnd = new Date(range.end);

        if (entryDate >= rangeStart && entryDate <= rangeEnd) {
          const current = weeklyMap.get(range.weekStart) ?? 0;
          weeklyMap.set(range.weekStart, current + entry.duration_seconds);
          break;
        }
      }
    }
  }

  // Convert to array, sorted by week start descending (newest first)
  return weekRanges.map(range => ({
    weekStart: range.weekStart,
    totalSeconds: weeklyMap.get(range.weekStart) ?? 0,
  }));
}

/**
 * Hook to fetch weekly totals for the last N weeks
 *
 * @param options - Configuration options
 * @returns React Query result with weekly totals
 *
 * @example
 * ```typescript
 * const { data } = useWeeklyTotals({ weeks: 4 });
 * // data: [{ weekStart: '2024-03-04', totalSeconds: 144000 }, ...]
 * ```
 */
export function useWeeklyTotals(options?: UseWeeklyTotalsOptions) {
  const { weeks = 4, enabled = true, staleTime } = options ?? {};
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.analytics.weeklyTotals(weeks),
    queryFn: () =>
      fetchWeeklyTotals(weeks, {
        timezone: user?.timezone ?? 'UTC',
        weekStartDay: (user?.week_start_day ?? 1) as DayOfWeek,
      }),
    enabled,
    staleTime,
  });
}

// ============================================================================
// MONTHLY TOTALS
// ============================================================================

/**
 * Options for useMonthlyTotals hook
 */
export interface UseMonthlyTotalsOptions {
  /** Number of months to fetch (including current month, default: 6) */
  months?: number;
  /** Whether the query should be enabled */
  enabled?: boolean;
  /** Override the default stale time */
  staleTime?: number;
}

/**
 * Fetch monthly totals for the last N months
 */
async function fetchMonthlyTotals(
  months: number,
  options: DateRangeOptions
): Promise<MonthlyTotal[]> {
  const monthRanges = getLastNMonths(months, options);

  // Fetch all entries in the date range
  const { data, error } = await supabase
    .from('time_entries')
    .select('start_at, duration_seconds')
    .gte('start_at', monthRanges[monthRanges.length - 1].start)
    .lte('start_at', monthRanges[0].end);

  if (error) {
    throw new AnalyticsFetchError(error.message, error.code);
  }

  // Aggregate by month
  const monthlyMap = new Map<string, number>();

  // Initialize all months with 0
  for (const range of monthRanges) {
    monthlyMap.set(range.month, 0);
  }

  // Sum up entries by month
  if (data) {
    for (const entry of data) {
      if (!entry.start_at || entry.duration_seconds === null) continue;

      // Find which month this entry belongs to
      const entryDate = new Date(entry.start_at);
      for (const range of monthRanges) {
        const rangeStart = new Date(range.start);
        const rangeEnd = new Date(range.end);

        if (entryDate >= rangeStart && entryDate <= rangeEnd) {
          const current = monthlyMap.get(range.month) ?? 0;
          monthlyMap.set(range.month, current + entry.duration_seconds);
          break;
        }
      }
    }
  }

  // Convert to array, sorted by month descending (newest first)
  return monthRanges.map(range => ({
    month: range.month,
    totalSeconds: monthlyMap.get(range.month) ?? 0,
  }));
}

/**
 * Hook to fetch monthly totals for the last N months
 *
 * @param options - Configuration options
 * @returns React Query result with monthly totals
 *
 * @example
 * ```typescript
 * const { data } = useMonthlyTotals({ months: 6 });
 * // data: [{ month: '2024-03', totalSeconds: 576000 }, ...]
 * ```
 */
export function useMonthlyTotals(options?: UseMonthlyTotalsOptions) {
  const { months = 6, enabled = true, staleTime } = options ?? {};
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.analytics.monthlyTotals(months),
    queryFn: () =>
      fetchMonthlyTotals(months, {
        timezone: user?.timezone ?? 'UTC',
      }),
    enabled,
    staleTime,
  });
}

// ============================================================================
// HOUR OF DAY DISTRIBUTION
// ============================================================================

/**
 * Options for useHourOfDayDistribution hook
 */
export interface UseHourOfDayDistributionOptions {
  /** Number of days to include in the distribution (default: 30) */
  days?: number;
  /** Whether the query should be enabled */
  enabled?: boolean;
  /** Override the default stale time */
  staleTime?: number;
}

/**
 * Fetch hour of day distribution
 *
 * Returns an array of 24 values representing the total seconds tracked
 * during each hour of the day across the specified date range.
 */
async function fetchHourOfDayDistribution(
  days: number,
  options: DateRangeOptions
): Promise<HourOfDayDistribution> {
  const dayRanges = getLastNDays(days, options);
  const timezone = options.timezone ?? 'UTC';

  // Fetch all entries in the date range
  const { data, error } = await supabase
    .from('time_entries')
    .select('start_at, duration_seconds')
    .gte('start_at', dayRanges[dayRanges.length - 1].start)
    .lte('start_at', dayRanges[0].end);

  if (error) {
    throw new AnalyticsFetchError(error.message, error.code);
  }

  // Initialize 24 hours with 0
  const distribution: HourOfDayDistribution = new Array(24).fill(0);

  // Distribute each entry's duration across the actual hours it spans
  if (data) {
    for (const entry of data) {
      if (!entry.start_at || !entry.duration_seconds) continue;

      const start = new Date(entry.start_at);
      let remaining = entry.duration_seconds;
      let cursor = new Date(start);

      while (remaining > 0) {
        const hour = getHourOfDay(cursor, timezone);
        // Seconds until the start of the next hour
        const secsToNextHour = (60 - cursor.getMinutes()) * 60 - cursor.getSeconds();
        const slice = Math.min(remaining, secsToNextHour);

        distribution[hour] += slice;
        remaining -= slice;
        cursor = new Date(cursor.getTime() + slice * 1000);
      }
    }
  }

  return distribution;
}

/**
 * Hook to fetch hour of day distribution
 *
 * Returns an array of 24 values (index 0 = midnight, index 23 = 11 PM)
 * representing the total time tracked during each hour.
 *
 * @param options - Configuration options
 * @returns React Query result with hour distribution
 *
 * @example
 * ```typescript
 * const { data } = useHourOfDayDistribution({ days: 30 });
 * // data: [0, 0, 0, 0, 0, 0, 1200, 3600, 7200, ...] // 24 values
 * // Index 9 (9 AM) has 7200 seconds = 2 hours tracked at 9 AM
 * ```
 */
export function useHourOfDayDistribution(options?: UseHourOfDayDistributionOptions) {
  const { days = 30, enabled = true, staleTime } = options ?? {};
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.analytics.hourOfDay(days),
    queryFn: () =>
      fetchHourOfDayDistribution(days, {
        timezone: user?.timezone ?? 'UTC',
      }),
    enabled,
    staleTime,
  });
}

// ============================================================================
// DAY OF WEEK DISTRIBUTION
// ============================================================================

/**
 * Options for useDayOfWeekDistribution hook
 */
export interface UseDayOfWeekDistributionOptions {
  /** Number of weeks to include in the distribution (default: 4) */
  weeks?: number;
  /** Whether the query should be enabled */
  enabled?: boolean;
  /** Override the default stale time */
  staleTime?: number;
}

/**
 * Fetch day of week distribution
 *
 * Returns an array of 7 values representing the total seconds tracked
 * on each day of the week across the specified date range.
 */
async function fetchDayOfWeekDistribution(
  weeks: number,
  options: DateRangeOptions
): Promise<DayOfWeekDistribution> {
  const weekRanges = getLastNWeeks(weeks, options);
  const timezone = options.timezone ?? 'UTC';

  // Fetch all entries in the date range
  const { data, error } = await supabase
    .from('time_entries')
    .select('start_at, duration_seconds')
    .gte('start_at', weekRanges[weekRanges.length - 1].start)
    .lte('start_at', weekRanges[0].end);

  if (error) {
    throw new AnalyticsFetchError(error.message, error.code);
  }

  // Initialize 7 days with 0 (index 0 = Sunday)
  const distribution: DayOfWeekDistribution = new Array(7).fill(0);

  // Aggregate by day of week
  if (data) {
    for (const entry of data) {
      if (!entry.start_at || entry.duration_seconds === null) continue;

      const dayOfWeek = getDayOfWeekFromISOString(entry.start_at, timezone);
      distribution[dayOfWeek] += entry.duration_seconds;
    }
  }

  return distribution;
}

/**
 * Hook to fetch day of week distribution
 *
 * Returns an array of 7 values (index 0 = Sunday, index 6 = Saturday)
 * representing the total time tracked on each day of the week.
 *
 * @param options - Configuration options
 * @returns React Query result with day of week distribution
 *
 * @example
 * ```typescript
 * const { data } = useDayOfWeekDistribution({ weeks: 4 });
 * // data: [3600, 28800, 28800, 28800, 28800, 28800, 7200]
 * // Index 1 (Monday) has 28800 seconds = 8 hours tracked on Mondays
 * ```
 */
export function useDayOfWeekDistribution(options?: UseDayOfWeekDistributionOptions) {
  const { weeks = 4, enabled = true, staleTime } = options ?? {};
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.analytics.dayOfWeek(weeks),
    queryFn: () =>
      fetchDayOfWeekDistribution(weeks, {
        timezone: user?.timezone ?? 'UTC',
        weekStartDay: (user?.week_start_day ?? 1) as DayOfWeek,
      }),
    enabled,
    staleTime,
  });
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UseDailyTotalsResult = ReturnType<typeof useDailyTotals>;
export type UseWeeklyTotalsResult = ReturnType<typeof useWeeklyTotals>;
export type UseMonthlyTotalsResult = ReturnType<typeof useMonthlyTotals>;
export type UseHourOfDayDistributionResult = ReturnType<typeof useHourOfDayDistribution>;
export type UseDayOfWeekDistributionResult = ReturnType<typeof useDayOfWeekDistribution>;

/**
 * Export fetch functions for direct use in services
 */
export {
  fetchDailyTotals,
  fetchWeeklyTotals,
  fetchMonthlyTotals,
  fetchHourOfDayDistribution,
  fetchDayOfWeekDistribution,
};
