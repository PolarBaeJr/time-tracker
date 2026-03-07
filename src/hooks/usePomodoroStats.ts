/**
 * Pomodoro Statistics Hook
 *
 * TanStack Query hook for fetching and computing pomodoro-related statistics
 * from time entries, including focus/break time breakdowns and streaks.
 *
 * USAGE:
 * ```typescript
 * import { usePomodoroStats } from '@/hooks/usePomodoroStats';
 *
 * function PomodoroStatsView() {
 *   const { data, isLoading } = usePomodoroStats();
 *   // data.pomodorosToday, data.focusTimeToday, etc.
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only the authenticated user's data is aggregated
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { AnalyticsFetchError } from '@/hooks/useAnalytics';
import { getLastNDays, type DateRangeOptions } from '@/utils/analytics';
import type { DayOfWeek } from '@/utils/analytics';

// ============================================================================
// TYPES
// ============================================================================

export interface PomodoroStatsData {
  /** Number of 'work' entries completed today */
  pomodorosToday: number;
  /** Total focus (work) time today in seconds */
  focusTimeToday: number;
  /** Total break + long_break time today in seconds */
  breakTimeToday: number;
  /** Number of 'work' entries completed this week */
  pomodorosThisWeek: number;
  /** Array of { date, count } for last 7 days */
  dailyCounts: Array<{ date: string; count: number }>;
  /** Consecutive days with at least one work entry */
  currentStreak: number;
}

export interface UsePomodoroStatsOptions {
  /** Whether the query should be enabled */
  enabled?: boolean;
}

export type UsePomodoroStatsResult = ReturnType<typeof usePomodoroStats>;

// ============================================================================
// FETCH FUNCTION
// ============================================================================

async function fetchPomodoroStats(options: DateRangeOptions): Promise<PomodoroStatsData> {
  // Get last 30 days for streak calculation, last 7 for daily counts
  const dayRanges = getLastNDays(30, options);
  const last7DayRanges = dayRanges.slice(0, 7);

  // Fetch all entries in the 30-day range with entry_type
  const { data, error } = await supabase
    .from('time_entries')
    .select('start_at, duration_seconds, entry_type')
    .gte('start_at', dayRanges[dayRanges.length - 1].start)
    .lte('start_at', dayRanges[0].end);

  if (error) {
    throw new AnalyticsFetchError(error.message, error.code);
  }

  // Initialize daily work counts for last 7 days
  const dailyWorkCounts = new Map<string, number>();
  for (const range of last7DayRanges) {
    dailyWorkCounts.set(range.date, 0);
  }

  // Initialize daily work presence for streak (last 30 days)
  const dailyHasWork = new Map<string, boolean>();
  for (const range of dayRanges) {
    dailyHasWork.set(range.date, false);
  }

  // Today's stats
  const todayDate = dayRanges[0].date;
  let pomodorosToday = 0;
  let focusTimeToday = 0;
  let breakTimeToday = 0;
  let pomodorosThisWeek = 0;

  // Process entries
  if (data) {
    for (const entry of data) {
      if (!entry.start_at || entry.duration_seconds === null) continue;

      const entryType = entry.entry_type ?? 'work';
      const entryDate = new Date(entry.start_at);

      // Find which day this entry belongs to
      for (const range of dayRanges) {
        const rangeStart = new Date(range.start);
        const rangeEnd = new Date(range.end);

        if (entryDate >= rangeStart && entryDate <= rangeEnd) {
          if (entryType === 'work') {
            // Mark day as having work
            dailyHasWork.set(range.date, true);

            // Daily counts (last 7 days)
            if (dailyWorkCounts.has(range.date)) {
              dailyWorkCounts.set(range.date, (dailyWorkCounts.get(range.date) ?? 0) + 1);
            }

            // Last 7 days = this week for pomodoro count
            if (last7DayRanges.some(r => r.date === range.date)) {
              pomodorosThisWeek++;
            }

            // Today's stats
            if (range.date === todayDate) {
              pomodorosToday++;
              focusTimeToday += entry.duration_seconds;
            }
          } else if (entryType === 'break' || entryType === 'long_break') {
            if (range.date === todayDate) {
              breakTimeToday += entry.duration_seconds;
            }
          }

          break;
        }
      }
    }
  }

  // Calculate streak: consecutive days with at least one work entry, starting from today
  let currentStreak = 0;
  for (const range of dayRanges) {
    if (dailyHasWork.get(range.date)) {
      currentStreak++;
    } else if (currentStreak === 0 && range.date === todayDate) {
      // Today has no work yet, check from yesterday
      continue;
    } else {
      break;
    }
  }

  // Build daily counts array (oldest first for chart display)
  const dailyCounts = last7DayRanges
    .map(range => ({
      date: range.date,
      count: dailyWorkCounts.get(range.date) ?? 0,
    }))
    .reverse();

  return {
    pomodorosToday,
    focusTimeToday,
    breakTimeToday,
    pomodorosThisWeek,
    dailyCounts,
    currentStreak,
  };
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook to fetch pomodoro statistics
 *
 * Computes focus/break time breakdowns, daily pomodoro counts,
 * and streak information from time entries.
 */
export function usePomodoroStats(options?: UsePomodoroStatsOptions) {
  const { enabled = true } = options ?? {};
  const { user } = useAuth();

  return useQuery({
    queryKey: ['analytics', 'pomodoroStats'],
    queryFn: () =>
      fetchPomodoroStats({
        timezone: user?.timezone ?? 'UTC',
        weekStartDay: (user?.week_start_day ?? 1) as DayOfWeek,
      }),
    enabled,
  });
}
