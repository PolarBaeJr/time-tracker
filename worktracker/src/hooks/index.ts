/**
 * Custom hooks barrel export
 */

// Auth hooks
export { useAuth } from './useAuth';
export { useSession, type UseSessionResult } from './useSession';

// Category hooks
export {
  useCategories,
  CategoriesFetchError,
  type UseCategoriesOptions,
  type UseCategoriesResult,
} from './useCategories';
export {
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  CategoryMutationError,
  type UseCreateCategoryResult,
  type UseUpdateCategoryResult,
  type UseDeleteCategoryResult,
} from './useCategoryMutations';

// Time entry hooks
export {
  useTimeEntries,
  fetchTimeEntries,
  TimeEntriesFetchError,
  type TimeEntriesPage,
  type UseTimeEntriesOptions,
  type UseTimeEntriesResult,
} from './useTimeEntries';

export {
  useCreateTimeEntry,
  useUpdateTimeEntry,
  useDeleteTimeEntry,
  TimeEntryMutationError,
  type UpdateTimeEntryParams,
  type UseCreateTimeEntryOptions,
  type UseUpdateTimeEntryOptions,
  type UseDeleteTimeEntryOptions,
  type UseCreateTimeEntryResult,
  type UseUpdateTimeEntryResult,
  type UseDeleteTimeEntryResult,
} from './useTimeEntryMutations';

export {
  useTimeEntrySummary,
  useTimeEntrySummaryWithBreakdown,
  fetchTimeEntrySummary,
  fetchTimeEntrySummaryWithBreakdown,
  TimeEntrySummaryError,
  type TimeEntrySummary,
  type TimeEntrySummaryParams,
  type UseTimeEntrySummaryOptions,
  type UseTimeEntrySummaryResult,
  type CategoryTimeBreakdown,
  type TimeEntrySummaryWithBreakdown,
  type UseTimeEntrySummaryWithBreakdownOptions,
  type UseTimeEntrySummaryWithBreakdownResult,
} from './useTimeEntrySummary';

// Goal hooks
export {
  useGoals,
  fetchGoals,
  GoalsFetchError,
  type FetchGoalsParams,
  type UseGoalsOptions,
  type UseGoalsResult,
} from './useGoals';

export {
  useGoalProgress,
  fetchGoalProgress,
  GoalProgressError,
  type GoalProgressResult,
  type FetchGoalProgressParams,
  type UseGoalProgressOptions,
  type UseGoalProgressResult,
} from './useGoalProgress';

export {
  useSetOverallGoal,
  useSetCategoryGoal,
  useDeleteGoal,
  GoalMutationError,
  type UseSetOverallGoalOptions,
  type UseSetCategoryGoalOptions,
  type UseDeleteGoalOptions,
  type UseSetOverallGoalResult,
  type UseSetCategoryGoalResult,
  type UseDeleteGoalResult,
} from './useGoalMutations';

// Realtime timer hooks
export {
  useRealtimeTimer,
  useMarkLocalTimerAction,
  markLocalTimerAction,
  type UseRealtimeTimerResult,
  type UseRealtimeTimerOptions,
  type ActiveTimerConnectionStatus,
} from './useRealtimeTimer';
