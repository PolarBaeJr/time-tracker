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
  useSetTypeGoal,
  useDeleteGoal,
  GoalMutationError,
  type UseSetOverallGoalOptions,
  type UseSetCategoryGoalOptions,
  type UseSetTypeGoalOptions,
  type UseDeleteGoalOptions,
  type UseSetOverallGoalResult,
  type UseSetCategoryGoalResult,
  type UseSetTypeGoalResult,
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

// Deep link hooks
export {
  useDeepLink,
  DeepLinkError,
  type UseDeepLinkOptions,
  type UseDeepLinkResult,
} from './useDeepLink';

// Analytics hooks
export {
  useDailyTotals,
  useWeeklyTotals,
  useMonthlyTotals,
  useHourOfDayDistribution,
  useDayOfWeekDistribution,
  fetchDailyTotals,
  fetchWeeklyTotals,
  fetchMonthlyTotals,
  fetchHourOfDayDistribution,
  fetchDayOfWeekDistribution,
  AnalyticsFetchError,
  type DailyTotal,
  type WeeklyTotal,
  type MonthlyTotal,
  type HourOfDayDistribution,
  type DayOfWeekDistribution,
  type UseDailyTotalsOptions,
  type UseWeeklyTotalsOptions,
  type UseMonthlyTotalsOptions,
  type UseHourOfDayDistributionOptions,
  type UseDayOfWeekDistributionOptions,
  type UseDailyTotalsResult,
  type UseWeeklyTotalsResult,
  type UseMonthlyTotalsResult,
  type UseHourOfDayDistributionResult,
  type UseDayOfWeekDistributionResult,
} from './useAnalytics';

// Network status hooks
export {
  useNetworkStatus,
  getNetworkStatus,
  isDeviceOnline,
  type NetworkStatus,
  type UseNetworkStatusOptions,
  type UseNetworkStatusResult,
} from './useNetworkStatus';

// Offline sync hooks
export {
  useOfflineSync,
  queueCreateEntry,
  queueUpdateEntry,
  queueDeleteEntry,
  type ActionResult,
  type SyncResults,
  type UseOfflineSyncOptions,
  type UseOfflineSyncResult,
} from './useOfflineSync';

// User settings hooks
export {
  useUserSettings,
  useUpdateUserSettings,
  userSettingsQueryKey,
  UserSettingsError,
  type UseUserSettingsOptions,
  type UseUserSettingsResult,
  type UseUpdateUserSettingsOptions,
  type UseUpdateUserSettingsResult,
} from './useUserSettings';

// Pomodoro hooks
export {
  usePomodoro,
  DEFAULT_POMODORO_SETTINGS,
  type PomodoroSettings,
  type PomodoroState,
} from './usePomodoro';

export {
  usePomodoroSettings,
  usePomodoroPresets,
  savePreset,
  deletePreset,
  applyServerPreferences,
  getSettingsForSync,
  setSyncCallback,
  type PomodoroSettingsData,
  type PomodoroPreset,
  type UsePomodoroSettingsResult,
  type UsePomodoroPresetsResult,
} from './usePomodoroSettings';

// Keyboard shortcuts hook
export { useKeyboardShortcuts, type ShortcutDef } from './useKeyboardShortcuts';

// Timer sounds hook
export { useTimerSounds, type SoundEvent } from './useTimerSounds';

// Splash screen hook
export {
  useSplashScreen,
  type UseSplashScreenOptions,
  type UseSplashScreenResult,
} from './useSplashScreen';
