/**
 * Goals Query Hook
 *
 * This hook provides a TanStack Query based interface for fetching
 * monthly goals from Supabase.
 *
 * USAGE:
 * ```typescript
 * import { useGoals } from '@/hooks/useGoals';
 *
 * function GoalsList() {
 *   const { data: goals, isLoading } = useGoals({ month: '2024-03-01' });
 *
 *   if (isLoading) return <Spinner />;
 *
 *   const overallGoal = goals?.find(g => g.category_id === null);
 *   const categoryGoals = goals?.filter(g => g.category_id !== null);
 *
 *   return (
 *     <View>
 *       <Text>Overall: {overallGoal?.target_hours}h</Text>
 *       {categoryGoals?.map(g => (
 *         <Text key={g.id}>{g.target_hours}h</Text>
 *       ))}
 *     </View>
 *   );
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only the authenticated user's goals are returned
 * - user_id is NOT included in queries; it's enforced server-side via auth.uid()
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import { MonthlyGoalSchema, type MonthlyGoal } from '@/schemas';

/**
 * Error thrown when goals fetch fails
 */
export class GoalsFetchError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'GoalsFetchError';
  }
}

/**
 * Parameters for fetching goals
 */
export interface FetchGoalsParams {
  /** Month in YYYY-MM-DD format (first day of month) */
  month: string;
}

/**
 * Fetch all goals for a specific month
 *
 * Returns both overall goals (category_id IS NULL) and
 * per-category goals for the authenticated user.
 *
 * @param params - Month to fetch goals for
 * @returns Promise<MonthlyGoal[]> - Array of goals for the month
 * @throws GoalsFetchError if the fetch fails
 */
async function fetchGoals({ month }: FetchGoalsParams): Promise<MonthlyGoal[]> {
  const { data, error } = await supabase
    .from('monthly_goals')
    .select('*')
    .eq('month', month)
    .order('category_id', { ascending: true, nullsFirst: true });

  if (error) {
    throw new GoalsFetchError(error.message, error.code);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Validate each goal against the schema
  const validatedGoals = data.map((goal) => {
    const parsed = MonthlyGoalSchema.safeParse(goal);
    if (!parsed.success) {
      console.warn('[useGoals] Invalid goal data:', goal, parsed.error);
      // Return as-is with type assertion for defensive handling
      return goal as MonthlyGoal;
    }
    return parsed.data;
  });

  return validatedGoals;
}

/**
 * Options for useGoals hook
 */
export interface UseGoalsOptions {
  /** Month in YYYY-MM-DD format (first day of month) */
  month: string;

  /**
   * Whether the query should be enabled
   * Useful for conditional fetching
   */
  enabled?: boolean;

  /**
   * Override the default stale time
   */
  staleTime?: number;
}

/**
 * Hook to fetch monthly goals
 *
 * Returns all goals for the specified month including:
 * - Overall goal (category_id IS NULL) - max 1 per month
 * - Per-category goals (category_id IS NOT NULL) - max 1 per category per month
 *
 * @param options - Month and query options
 * @returns React Query result with goals array
 *
 * @example
 * ```typescript
 * // Fetch goals for March 2024
 * const { data: goals, isLoading } = useGoals({ month: '2024-03-01' });
 *
 * // Get overall goal
 * const overallGoal = goals?.find(g => g.category_id === null);
 *
 * // Get category-specific goals
 * const categoryGoals = goals?.filter(g => g.category_id !== null) ?? [];
 *
 * // Get goal for a specific category
 * const workGoal = goals?.find(g => g.category_id === workCategoryId);
 * ```
 */
export function useGoals(options: UseGoalsOptions) {
  const { month, enabled = true, staleTime } = options;

  return useQuery({
    queryKey: queryKeys.goals(month),
    queryFn: () => fetchGoals({ month }),
    enabled,
    staleTime,
  });
}

/**
 * Type for the useGoals hook return value
 */
export type UseGoalsResult = ReturnType<typeof useGoals>;

/**
 * Export the fetch function for direct use in services
 */
export { fetchGoals };
