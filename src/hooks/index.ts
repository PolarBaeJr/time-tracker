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
  useBulkUpdateEntries,
  useBulkDeleteEntries,
  useSplitTimeEntry,
  useMergeTimeEntries,
  usePermanentlyDeleteTimeEntry,
  useRestoreTimeEntry,
  useDuplicateTimeEntry,
  TimeEntryMutationError,
  type UpdateTimeEntryParams,
  type BulkUpdateParams,
  type SplitTimeEntryParams,
  type UseCreateTimeEntryOptions,
  type UseUpdateTimeEntryOptions,
  type UseDeleteTimeEntryOptions,
  type UseRestoreTimeEntryOptions,
  type UseDuplicateTimeEntryOptions,
  type UseCreateTimeEntryResult,
  type UseUpdateTimeEntryResult,
  type UseDeleteTimeEntryResult,
  type UsePermanentlyDeleteTimeEntryResult,
  type UseRestoreTimeEntryResult,
  type UseDuplicateTimeEntryResult,
  type UseBulkUpdateEntriesResult,
  type UseBulkDeleteEntriesResult,
  type UseSplitTimeEntryResult,
  type UseMergeTimeEntriesResult,
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
  useSetEarningsGoal,
  useDeleteGoal,
  GoalMutationError,
  type SetEarningsGoalInput,
  type UseSetOverallGoalOptions,
  type UseSetCategoryGoalOptions,
  type UseSetTypeGoalOptions,
  type UseSetEarningsGoalOptions,
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
  fetchEarnings,
  fetchMonthlyEarnings,
  useEarnings,
  useMonthlyEarnings,
  AnalyticsFetchError,
  type DailyTotal,
  type WeeklyTotal,
  type MonthlyTotal,
  type HourOfDayDistribution,
  type DayOfWeekDistribution,
  type EarningsData,
  type MonthlyEarningsEntry,
  type UseDailyTotalsOptions,
  type UseWeeklyTotalsOptions,
  type UseMonthlyTotalsOptions,
  type UseHourOfDayDistributionOptions,
  type UseDayOfWeekDistributionOptions,
  type UseEarningsOptions,
  type UseMonthlyEarningsOptions,
  type UseDailyTotalsResult,
  type UseWeeklyTotalsResult,
  type UseMonthlyTotalsResult,
  type UseHourOfDayDistributionResult,
  type UseDayOfWeekDistributionResult,
  type UseEarningsResult,
  type UseMonthlyEarningsResult,
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

// Pomodoro stats hooks
export {
  usePomodoroStats,
  type PomodoroStatsData,
  type UsePomodoroStatsOptions,
  type UsePomodoroStatsResult,
} from './usePomodoroStats';

// Keyboard shortcuts hook
export { useKeyboardShortcuts, type ShortcutDef } from './useKeyboardShortcuts';

// Timer sounds hook
export { useTimerSounds, type SoundEvent } from './useTimerSounds';

// Desktop notifications
export { sendNotification } from './useDesktopNotifications';

// Idle detection hook
export { useIdleDetection } from './useIdleDetection';

// Tray sync
export { useTraySync } from './useTraySync';

// Tag hooks
export {
  useTags,
  useEntryTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  useSetEntryTags,
  TagError,
  type UseTagsOptions,
  type UseTagsResult,
  type UseEntryTagsResult,
  type UseCreateTagResult,
  type UseUpdateTagResult,
  type UseDeleteTagResult,
  type UseSetEntryTagsResult,
} from './useTags';

// Entry comment hooks
export {
  useEntryComments,
  useCreateEntryComment,
  useDeleteEntryComment,
  EntryCommentError,
  type UseEntryCommentsResult,
  type UseCreateEntryCommentResult,
  type UseDeleteEntryCommentResult,
} from './useEntryComments';

// Entry attachment hooks
export {
  useEntryAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  useAttachmentUrl,
  EntryAttachmentError,
  type UseEntryAttachmentsResult,
  type UseUploadAttachmentResult,
  type UseDeleteAttachmentResult,
  type UseAttachmentUrlResult,
} from './useEntryAttachments';

// Entry template hooks
export {
  useEntryTemplatesQuery,
  useCreateEntryTemplate,
  useUpdateEntryTemplate,
  useDeleteEntryTemplate,
  useMigrateLocalTemplates,
  EntryTemplateError,
  type UseEntryTemplatesQueryResult,
  type UseCreateEntryTemplateResult,
  type UseUpdateEntryTemplateResult,
  type UseDeleteEntryTemplateResult,
} from './useEntryTemplates';

// Splash screen hook
export {
  useSplashScreen,
  type UseSplashScreenOptions,
  type UseSplashScreenResult,
} from './useSplashScreen';

// Spotify hooks
export {
  useSpotifyConnection,
  useConnectSpotify,
  useSpotifyCallback,
  useDisconnectSpotify,
  useSpotifyPlayback,
  useSpotifyControls,
  type SpotifyConnection,
  type SpotifyTrack,
  type SpotifyPlaybackState,
} from './useSpotify';

// AI hooks
export { useAIConnection, useConfigureAI, useDisconnectAI, useInitializeAI } from './useAI';

// Email hooks
export {
  useEmailConnections,
  useEmailConnection,
  useConnectGmail,
  useConnectOutlook,
  useConnectIMAP,
  useGmailCallback,
  useOutlookCallback,
  useDisconnectEmail,
  useEmailMessages,
  useSyncEmails,
  useRecentEmails,
  useEmailTokenDeath,
  useToggleEmailConnection,
} from './useEmail';

// Widget layout hooks
export { useWidgetLayout, type UseWidgetLayoutResult } from './useWidgetLayout';

// Calendar hooks
export {
  useCalendarConnections,
  useCalendarConnection,
  useConnectGoogleCalendar,
  useConnectOutlookCalendar,
  useGoogleCalendarCallback,
  useOutlookCalendarCallback,
  useDisconnectCalendar,
  useCalendarEvents,
  useSyncCalendar,
  useTodayEvents,
  useUpcomingEvents,
  useCalendarTokenDeath,
} from './useCalendar';

// Todo hooks
export {
  useTodos,
  useTodo,
  useCreateTodo,
  useUpdateTodo,
  useToggleTodo,
  useReorderTodos,
  useDeleteTodo,
  fetchTodos,
  fetchTodo,
  TodoError,
  type UseTodosOptions,
  type UseTodosResult,
  type UseTodoResult,
  type UseCreateTodoOptions,
  type UseCreateTodoResult,
  type UseUpdateTodoOptions,
  type UseUpdateTodoResult,
  type UseToggleTodoOptions,
  type UseToggleTodoResult,
  type UseReorderTodosOptions,
  type UseReorderTodosResult,
  type UseDeleteTodoOptions,
  type UseDeleteTodoResult,
} from './useTodos';

// Notes hooks
export {
  useNotes,
  useNote,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  usePinNote,
  useRestoreNote,
  fetchNotes,
  fetchNote,
  NoteFetchError,
  type UseNotesOptions,
  type UseNoteOptions,
  type UseCreateNoteOptions,
  type UseUpdateNoteOptions,
  type UseDeleteNoteOptions,
  type UsePinNoteOptions,
  type UseRestoreNoteOptions,
  type UpdateNoteParams,
  type PinNoteParams,
  type UseNotesResult,
  type UseNoteResult,
  type UseCreateNoteResult,
  type UseUpdateNoteResult,
  type UseDeleteNoteResult,
  type UsePinNoteResult,
  type UseRestoreNoteResult,
} from './useNotes';

// Chat hooks
export {
  useChatConversations,
  useChatMessages,
  useCreateConversation,
  useSendMessage,
  useDeleteConversation,
  useClearConversationHistory,
  getRemainingMessages,
  chatQueryKeys,
  ChatError,
  RateLimitError,
  type UseChatConversationsOptions,
  type UseChatMessagesOptions,
  type UseCreateConversationOptions,
  type UseSendMessageOptions,
  type UseDeleteConversationOptions,
  type UseClearConversationHistoryOptions,
  type SendMessageInput,
  type UseChatConversationsResult,
  type UseChatMessagesResult,
  type UseCreateConversationResult,
  type UseSendMessageResult,
  type UseDeleteConversationResult,
  type UseClearConversationHistoryResult,
} from './useChat';

// Animated value hook
export {
  useAnimatedValue,
  useAnimatedValues,
  type UseAnimatedValueOptions,
  type UseAnimatedValueResult,
} from './useAnimatedValue';

// Haptic feedback hook
export { useHaptics, haptics, type HapticType, type UseHapticsResult } from './useHaptics';

// Toast hook
export {
  useToast,
  DEFAULT_TOAST_DURATION,
  type UseToastResult,
  type ShowToastOptions,
} from './useToast';

// Count-up animation hook
export {
  useCountUpAnimation,
  formatHoursCountUp,
  type UseCountUpAnimationOptions,
  type UseCountUpAnimationResult,
} from './useCountUpAnimation';

// Reduced motion hook
export {
  useReducedMotion,
  getSystemReducedMotionPreference,
  initializeReducedMotion,
  type UseReducedMotionResult,
} from './useReducedMotion';

// Public profile hooks
export {
  usePublicProfile,
  useUpdatePublicProfileSettings,
  fetchPublicProfile,
  checkSlugAvailability,
  isValidSlug,
  PublicProfileFetchError,
  type PublicProfile,
  type PublicProfileStats,
  type UpdatePublicProfileInput,
  type UsePublicProfileOptions,
  type UseUpdatePublicProfileSettingsOptions,
  type UseUpdatePublicProfileSettingsResult,
} from './usePublicProfile';

// Workspace hooks
export {
  useWorkspacesQuery,
  useWorkspace,
  fetchWorkspaces,
  fetchWorkspace,
  WorkspaceFetchError,
  type UseWorkspacesQueryOptions,
  type UseWorkspaceOptions,
  type UseWorkspacesQueryResult,
  type UseWorkspaceResult,
} from './useWorkspaces';

export {
  useCreateWorkspace,
  useUpdateWorkspace,
  useDeleteWorkspace,
  type UseCreateWorkspaceOptions,
  type UseUpdateWorkspaceOptions,
  type UseDeleteWorkspaceOptions,
  type UpdateWorkspaceParams,
  type UseCreateWorkspaceResult,
  type UseUpdateWorkspaceResult,
  type UseDeleteWorkspaceResult,
} from './useWorkspaceMutations';

export {
  useWorkspaceMembers,
  useUpdateMemberRole,
  useRemoveMember,
  fetchWorkspaceMembers,
  type UseWorkspaceMembersOptions,
  type UseUpdateMemberRoleOptions,
  type UseRemoveMemberOptions,
  type UpdateMemberRoleParams,
  type RemoveMemberParams,
  type UseWorkspaceMembersResult,
  type UseUpdateMemberRoleResult,
  type UseRemoveMemberResult,
} from './useWorkspaceMembers';

// Project hooks
export {
  useProjects,
  useProject,
  fetchProjects,
  fetchProject,
  ProjectFetchError,
  type FetchProjectsOptions,
  type UseProjectsOptions,
  type UseProjectOptions,
  type UseProjectsResult,
  type UseProjectResult,
} from './useProjects';

export {
  useCreateProject,
  useUpdateProject,
  useArchiveProject,
  useDeleteProject,
  type CreateProjectParams,
  type UpdateProjectParams,
  type ArchiveProjectParams,
  type DeleteProjectParams,
  type UseCreateProjectOptions,
  type UseUpdateProjectOptions,
  type UseArchiveProjectOptions,
  type UseDeleteProjectOptions,
  type UseCreateProjectResult,
  type UseUpdateProjectResult,
  type UseArchiveProjectResult,
  type UseDeleteProjectResult,
} from './useProjectMutations';

export {
  useProjectMembers,
  useAddProjectMember,
  useUpdateProjectMemberRole,
  useRemoveProjectMember,
  fetchProjectMembers,
  type AddProjectMemberParams,
  type UpdateProjectMemberRoleParams,
  type RemoveProjectMemberParams,
  type UseProjectMembersOptions,
  type UseAddProjectMemberOptions,
  type UseUpdateProjectMemberRoleOptions,
  type UseRemoveProjectMemberOptions,
  type UseProjectMembersResult,
  type UseAddProjectMemberResult,
  type UseUpdateProjectMemberRoleResult,
  type UseRemoveProjectMemberResult,
} from './useProjectMembers';

// Shared Dashboard hooks
export {
  useSharedDashboards,
  useCreateSharedDashboard,
  useRevokeSharedDashboard,
  useUpdateSharedDashboard,
  useDeleteSharedDashboard,
  fetchSharedDashboards,
  fetchSharedDashboard,
  getShareUrl,
  isSharedDashboardValid,
  SharedDashboardError,
  type CreatedSharedDashboard,
  type UpdateSharedDashboardParams,
  type UseSharedDashboardsOptions,
  type UseCreateSharedDashboardOptions,
  type UseRevokeSharedDashboardOptions,
  type UseUpdateSharedDashboardOptions,
  type UseDeleteSharedDashboardOptions,
  type UseSharedDashboardsResult,
  type UseCreateSharedDashboardResult,
  type UseRevokeSharedDashboardResult,
  type UseUpdateSharedDashboardResult,
  type UseDeleteSharedDashboardResult,
} from './useSharedDashboards';

export {
  useSharedDashboardView,
  fetchSharedDashboardData,
  formatDuration,
  secondsToHours,
  isLinkInvalid,
  SharedDashboardViewError,
  type UseSharedDashboardViewOptions,
  type UseSharedDashboardViewResult,
} from './useSharedDashboardView';
