/**
 * Goal Progress Hook
 *
 * This hook combines goals with time entry summaries to calculate
 * progress toward monthly targets.
 *
 * USAGE:
 * ```typescript
 * import { useGoalProgress } from '@/hooks/useGoalProgress';
 *
 * function GoalProgressCard() {
 *   const { data: progress, isLoading } = useGoalProgress({
 *     month: '2024-03-01',
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <View>
 *       {progress?.overall && (
 *         <Text>
 *           Overall: {progress.overall.actualHours.toFixed(1)} /
 *           {progress.overall.targetHours}h ({progress.overall.progressPercent.toFixed(0)}%)
 *         </Text>
 *       )}
 *       {progress?.categories.map(p => (
 *         <Text key={p.goal.id}>
 *           {p.goal.category_id}: {p.progressPercent.toFixed(0)}%
 *         </Text>
 *       ))}
 *     </View>
 *   );
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only the authenticated user's data is used
 * - Both goals and time entries are fetched with user_id enforcement server-side
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import { MonthlyGoalSchema, type MonthlyGoal, type GoalProgress } from '@/schemas';

/**
 * Error thrown when goal progress calculation fails
 */
export class GoalProgressError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'GoalProgressError';
  }
}

/**
 * Result of goal progress calculation
 */
export interface GoalProgressResult {
  /** Overall goal progress (if an overall goal exists) */
  overall: GoalProgress | null;

  /** Per-category goal progress */
  categories: GoalProgress[];

  /** Per-type goal progress */
  types: GoalProgress[];

  /** Month being tracked */
  month: string;

  /** Start of month as ISO datetime */
  monthStart: string;

  /** End of month as ISO datetime */
  monthEnd: string;

  /** Total logged hours across all categories */
  totalLoggedHours: number;
}

/**
 * Parameters for fetching goal progress
 */
export interface FetchGoalProgressParams {
  /** Month in YYYY-MM-DD format (first day of month) */
  month: string;
}

/**
 * Calculate the number of days remaining in a month from the current date
 */
function calculateDaysRemaining(month: string): number {
  const now = new Date();
  const monthDate = new Date(month);

  // Get the last day of the month
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

  // If we're past the month, return 0
  if (now > lastDay) {
    return 0;
  }

  // If we're before the month, return total days in month
  if (now < monthDate) {
    return lastDay.getDate();
  }

  // Calculate days remaining (including today)
  return lastDay.getDate() - now.getDate() + 1;
}

/**
 * Calculate progress for a single goal
 */
function calculateProgress(
  goal: MonthlyGoal,
  actualHours: number,
  daysRemaining: number
): GoalProgress {
  const remainingHours = goal.target_hours - actualHours;
  const progressPercent = (actualHours / goal.target_hours) * 100;
  const dailyRequired = daysRemaining > 0 ? remainingHours / daysRemaining : 0;

  return {
    goal,
    targetHours: goal.target_hours,
    actualHours,
    progressPercent,
    remainingHours,
    dailyRequiredToMeetGoal: Math.max(0, dailyRequired),
    daysRemaining,
    isAchieved: actualHours >= goal.target_hours,
  };
}

/**
 * Fetch goal progress data combining goals with time entry summaries
 *
 * @param params - Month to calculate progress for
 * @returns Promise<GoalProgressResult> - Combined progress data
 * @throws GoalProgressError if the fetch fails
 */
async function fetchGoalProgress({ month }: FetchGoalProgressParams): Promise<GoalProgressResult> {
  // Calculate month boundaries
  const monthDate = new Date(month);
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString();
  const monthEnd = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  ).toISOString();

  // Fetch goals, time entries, and categories in parallel
  const [goalsResult, timeEntriesResult, categoriesResult] = await Promise.all([
    supabase
      .from('monthly_goals')
      .select('*')
      .eq('month', month)
      .order('category_id', { ascending: true, nullsFirst: true }),
    supabase
      .from('time_entries')
      .select('duration_seconds, category_id, is_billable')
      .gte('start_at', monthStart)
      .lte('start_at', monthEnd),
    supabase.from('categories').select('id, type, hourly_rate'),
  ]);

  if (goalsResult.error) {
    throw new GoalProgressError(goalsResult.error.message, goalsResult.error.code);
  }

  if (timeEntriesResult.error) {
    throw new GoalProgressError(timeEntriesResult.error.message, timeEntriesResult.error.code);
  }

  if (categoriesResult.error) {
    throw new GoalProgressError(categoriesResult.error.message, categoriesResult.error.code);
  }

  const goals = goalsResult.data ?? [];
  const timeEntries = timeEntriesResult.data ?? [];
  const categoriesData = categoriesResult.data ?? [];

  // Build maps from category ID to type and hourly rate
  const categoryIdToType = new Map<string, string>();
  const categoryIdToRate = new Map<string, number>();
  for (const cat of categoriesData) {
    categoryIdToType.set(cat.id, cat.type);
    if (cat.hourly_rate != null) {
      categoryIdToRate.set(cat.id, cat.hourly_rate);
    }
  }

  // Validate goals
  const validatedGoals = goals.map(goal => {
    const parsed = MonthlyGoalSchema.safeParse(goal);
    if (!parsed.success) {
      console.warn('[useGoalProgress] Invalid goal data:', goal, parsed.error);
      return goal as MonthlyGoal;
    }
    return parsed.data;
  });

  // Calculate total hours by category
  const hoursByCategory = new Map<string | null, number>();
  let totalLoggedSeconds = 0;

  for (const entry of timeEntries) {
    const seconds = entry.duration_seconds || 0;
    totalLoggedSeconds += seconds;

    const categoryId = entry.category_id as string | null;
    const existing = hoursByCategory.get(categoryId) ?? 0;
    hoursByCategory.set(categoryId, existing + seconds);
  }

  // Build hours by type map
  const hoursByType = new Map<string, number>();
  let totalEarnings = 0;
  for (const entry of timeEntries) {
    const categoryId = entry.category_id as string | null;
    if (categoryId) {
      const type = categoryIdToType.get(categoryId);
      if (type) {
        const existing = hoursByType.get(type) ?? 0;
        hoursByType.set(type, existing + (entry.duration_seconds || 0));
      }
      if ((entry as { is_billable?: boolean }).is_billable) {
        const rate = categoryIdToRate.get(categoryId);
        if (rate) {
          totalEarnings += (rate * (entry.duration_seconds || 0)) / 3600;
        }
      }
    }
  }

  // Calculate days remaining
  const daysRemaining = calculateDaysRemaining(month);

  // Find overall goal and calculate progress
  const overallGoal = validatedGoals.find(g => g.category_id === null && g.category_type === null);
  const overallProgress = overallGoal
    ? calculateProgress(overallGoal, totalLoggedSeconds / 3600, daysRemaining)
    : null;

  // Calculate per-category progress
  const categoryGoals = validatedGoals.filter(
    g => g.category_id !== null && g.category_type === null
  );
  const categoryProgress = categoryGoals.map(goal => {
    const categorySeconds = hoursByCategory.get(goal.category_id) ?? 0;
    return calculateProgress(goal, categorySeconds / 3600, daysRemaining);
  });

  // Calculate per-type progress
  const typeGoals = validatedGoals.filter(g => g.category_type !== null);
  const typeProgress = typeGoals.map(goal => {
    if (goal.category_type === '__earnings__') {
      return calculateProgress(goal, totalEarnings, daysRemaining);
    }
    const typeSeconds = hoursByType.get(goal.category_type!) ?? 0;
    return calculateProgress(goal, typeSeconds / 3600, daysRemaining);
  });

  return {
    overall: overallProgress,
    categories: categoryProgress,
    types: typeProgress,
    month,
    monthStart,
    monthEnd,
    totalLoggedHours: totalLoggedSeconds / 3600,
  };
}

/**
 * Options for useGoalProgress hook
 */
export interface UseGoalProgressOptions {
  /** Month in YYYY-MM-DD format (first day of month) */
  month: string;

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
 * Hook to calculate goal progress for a month
 *
 * Combines goals with time entry data to calculate:
 * - Progress percentage
 * - Remaining hours
 * - Daily hours needed to meet goal
 * - Achievement status
 *
 * @param options - Month and query options
 * @returns React Query result with progress data
 *
 * @example
 * ```typescript
 * const { data: progress } = useGoalProgress({ month: '2024-03-01' });
 *
 * // Check overall progress
 * if (progress?.overall) {
 *   console.log(`${progress.overall.progressPercent.toFixed(0)}% complete`);
 *   console.log(`Need ${progress.overall.dailyRequiredToMeetGoal.toFixed(1)}h/day`);
 * }
 *
 * // Check category progress
 * for (const cat of progress?.categories ?? []) {
 *   console.log(`${cat.goal.category_id}: ${cat.isAchieved ? 'Done!' : 'In progress'}`);
 * }
 * ```
 */
export function useGoalProgress(options: UseGoalProgressOptions) {
  const { month, enabled = true, staleTime } = options;

  return useQuery({
    queryKey: [...queryKeys.goals(month), 'progress'],
    queryFn: () => fetchGoalProgress({ month }),
    enabled,
    staleTime,
  });
}

/**
 * Type for the useGoalProgress hook return value
 */
export type UseGoalProgressResult = ReturnType<typeof useGoalProgress>;

/**
 * Export the fetch function for direct use in services
 */
export { fetchGoalProgress };
