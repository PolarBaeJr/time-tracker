/**
 * Zod Validation Schemas
 *
 * This module exports all Zod schemas for data validation.
 *
 * Schema Naming Convention:
 * - EntitySchema: Full entity schema for validating query responses (e.g., UserSchema)
 * - CreateEntitySchema: Mutation schema for creating new entities, EXCLUDES server-managed fields
 * - UpdateEntitySchema: Mutation schema for updating entities, all fields optional
 *
 * CRITICAL: Create/Update schemas must NEVER include server-managed fields:
 * - id (auto-generated UUID)
 * - user_id (set via auth.uid() default)
 * - created_at (set via now() default)
 * - updated_at (set via trigger)
 *
 * This ensures clients cannot override server-enforced values.
 */

// User schemas and types
export {
  UserSchema,
  UpdateUserSchema,
  UserPreferencesSchema,
  type User,
  type UpdateUserInput,
  type UserPreferences,
} from './user';

// Category schemas and types
export {
  CategorySchema,
  CreateCategorySchema,
  UpdateCategorySchema,
  CategoryIdSchema,
  type Category,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from './category';

// Time entry schemas and types
export {
  EntryTypeEnum,
  TimeEntrySchema,
  CreateTimeEntrySchema,
  UpdateTimeEntrySchema,
  TimeEntryFiltersSchema,
  type EntryType,
  type TimeEntry,
  type CreateTimeEntryInput,
  type UpdateTimeEntryInput,
  type TimeEntryFilters,
} from './timeEntry';

// Timer schemas and types
export {
  TimerModeEnum,
  PomodoroPhaseEnum,
  ActiveTimerSchema,
  StartTimerSchema,
  StopTimerSchema,
  QueuedActionSchema,
  type TimerMode,
  type PomodoroPhase,
  type ActiveTimer,
  type StartTimerInput,
  type StopTimerInput,
  type TimerState,
  type QueuedAction,
} from './timer';

// Goal schemas and types
export {
  MonthlyGoalSchema,
  CreateGoalSchema,
  UpdateGoalSchema,
  SetOverallGoalSchema,
  SetCategoryGoalSchema,
  SetTypeGoalSchema,
  type MonthlyGoal,
  type CreateGoalInput,
  type UpdateGoalInput,
  type SetOverallGoalInput,
  type SetCategoryGoalInput,
  type SetTypeGoalInput,
  type GoalProgress,
} from './goal';

// Tag schemas and types
export {
  TagSchema,
  CreateTagSchema,
  UpdateTagSchema,
  TimeEntryTagSchema,
  type Tag,
  type CreateTagInput,
  type UpdateTagInput,
  type TimeEntryTag,
} from './tag';

// Entry comment schemas and types
export {
  EntryCommentSchema,
  CreateEntryCommentSchema,
  type EntryComment,
  type CreateEntryCommentInput,
} from './entryComment';

// Entry attachment schemas and types
export { EntryAttachmentSchema, type EntryAttachment } from './entryAttachment';

// Entry template schemas and types
export {
  EntryTemplateSchema,
  CreateEntryTemplateSchema,
  UpdateEntryTemplateSchema,
  type EntryTemplate,
  type CreateEntryTemplateInput,
  type UpdateEntryTemplateInput,
} from './entryTemplate';

// Email schemas and types
export {
  EmailProviderEnum,
  EmailConnectionSchema,
  CreateEmailConnectionOAuthSchema,
  CreateEmailConnectionIMAPSchema,
  CreateEmailConnectionSchema,
  EmailMessageSchema,
  EmailMessagesListSchema,
  EmailSyncOptionsSchema,
  EmailSyncResultSchema,
  type EmailProvider,
  type EmailConnection,
  type CreateEmailConnectionOAuthInput,
  type CreateEmailConnectionIMAPInput,
  type CreateEmailConnectionInput,
  type EmailMessage,
  type EmailMessagesList,
  type EmailSyncOptions,
  type EmailSyncResult,
} from './email';

// Calendar schemas and types
export {
  CalendarProviderEnum,
  CalendarConnectionSchema,
  CreateCalendarConnectionSchema,
  EventStatusEnum,
  EventAttendeeSchema,
  CalendarEventSchema,
  CalendarEventsListSchema,
  CalendarDateRangeSchema,
  CalendarSyncOptionsSchema,
  CalendarSyncResultSchema,
  TodayEventsSummarySchema,
  type CalendarProvider,
  type CalendarConnection,
  type CreateCalendarConnectionInput,
  type EventStatus,
  type EventAttendee,
  type CalendarEvent,
  type CalendarEventsList,
  type CalendarDateRange,
  type CalendarSyncOptions,
  type CalendarSyncResult,
  type TodayEventsSummary,
} from './calendar';

// Chat schemas and types
export {
  ChatRoleEnum,
  ChatMessageSchema,
  ChatConversationSchema,
  CreateChatMessageSchema,
  CreateConversationSchema,
  UpdateConversationSchema,
  ChatConversationWithPreviewSchema,
  type ChatRole,
  type ChatMessage,
  type ChatConversation,
  type CreateChatMessageInput,
  type CreateConversationInput,
  type UpdateConversationInput,
  type ChatConversationWithPreview,
} from './chat';

// Todo schemas and types
export {
  TodoPriorityEnum,
  TodoSchema,
  CreateTodoSchema,
  UpdateTodoSchema,
  TodosFilterSchema,
  ReorderTodosSchema,
  type TodoPriority,
  type Todo,
  type CreateTodoInput,
  type UpdateTodoInput,
  type TodosFilter,
  type ReorderTodosInput,
} from './todo';

// Note schemas and types
export {
  NoteSchema,
  CreateNoteSchema,
  UpdateNoteSchema,
  NotesFilterSchema,
  type Note,
  type CreateNoteInput,
  type UpdateNoteInput,
  type NotesFilter,
} from './note';

// UX settings schemas and types
export {
  SoundPresetEnum,
  UXSettingsSchema,
  UpdateUXSettingsSchema,
  type SoundPreset,
  type UXSettings,
  type UpdateUXSettingsInput,
} from './uxSettings';

// Achievement schemas and types
export {
  AchievementIdEnum,
  AchievementCategoryEnum,
  AchievementDefinitionSchema,
  UserAchievementSchema,
  AchievementSchema,
  AchievementStateSchema,
  ACHIEVEMENT_DEFINITIONS,
  ALL_ACHIEVEMENT_IDS,
  DEFAULT_ACHIEVEMENT_STATE,
  type AchievementId,
  type AchievementCategory,
  type AchievementDefinition,
  type UserAchievement,
  type Achievement,
  type AchievementState,
} from './achievement';

// Onboarding schemas and types
export {
  OnboardingStepEnum,
  OnboardingStepDefinitionSchema,
  OnboardingStateSchema,
  ONBOARDING_STEP_DEFINITIONS,
  ALL_ONBOARDING_STEPS,
  DEFAULT_ONBOARDING_STATE,
  getNextOnboardingStep,
  getPreviousOnboardingStep,
  calculateOnboardingProgress,
  type OnboardingStep,
  type OnboardingStepDefinition,
  type OnboardingState,
} from './onboarding';

// =============================================================================
// Phase 5: Collaboration Schemas
// =============================================================================

// Workspace schemas and types
export {
  WorkspaceRoleEnum,
  InviteStatusEnum,
  WorkspaceSchema,
  WorkspaceMemberSchema,
  WorkspaceMemberWithUserSchema,
  WorkspaceInviteSchema,
  WorkspaceWithMemberCountSchema,
  CreateWorkspaceSchema,
  UpdateWorkspaceSchema,
  CreateInviteSchema,
  AcceptInviteSchema,
  type WorkspaceRole,
  type InviteStatus,
  type Workspace,
  type WorkspaceMember,
  type WorkspaceMemberWithUser,
  type WorkspaceInvite,
  type WorkspaceWithMemberCount,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
  type CreateInviteInput,
  type AcceptInviteInput,
} from './workspace';

// Project schemas and types
export {
  DEFAULT_PROJECT_COLOR,
  ProjectSchema,
  ProjectMemberSchema,
  ProjectMemberWithUserSchema,
  ProjectWithMembersSchema,
  ProjectWithStatsSchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  AddProjectMemberSchema,
  ProjectsFilterSchema,
  type Project,
  type ProjectMember,
  type ProjectMemberWithUser,
  type ProjectWithMembers,
  type ProjectWithStats,
  type CreateProjectInput,
  type UpdateProjectInput,
  type AddProjectMemberInput,
  type ProjectsFilter,
} from './project';

// Approval schemas and types
export {
  ApprovalStatusEnum,
  ApprovalAssignmentSchema,
  ApprovalAssignmentWithUsersSchema,
  TimeEntryWithApprovalSchema,
  TimeEntryWithApprovalAndUserSchema,
  ApprovalSummarySchema,
  CreateApprovalAssignmentSchema,
  SubmitEntriesInputSchema,
  ApproveEntriesInputSchema,
  RejectEntriesInputSchema,
  ApprovalFilterSchema,
  type ApprovalStatus,
  type ApprovalAssignment,
  type ApprovalAssignmentWithUsers,
  type TimeEntryWithApproval,
  type TimeEntryWithApprovalAndUser,
  type ApprovalSummary,
  type CreateApprovalAssignmentInput,
  type SubmitEntriesInput,
  type ApproveEntriesInput,
  type RejectEntriesInput,
  type ApprovalFilter,
} from './approval';

// Activity feed schemas and types
export {
  ActivityEventTypeEnum,
  ALL_ACTIVITY_EVENT_TYPES,
  ActivityEventPayloadSchema,
  TimerStartedPayloadSchema,
  TimerStoppedPayloadSchema,
  EntryLoggedPayloadSchema,
  EntryApprovalPayloadSchema,
  GoalPayloadSchema,
  MemberPayloadSchema,
  ProjectCreatedPayloadSchema,
  ProjectMemberAddedPayloadSchema,
  ActivityEventSchema,
  ActivityEventWithActorSchema,
  ActivityFeedPageSchema,
  ActivityFeedFilterSchema,
  ActivityEventRealtimePayloadSchema,
  EVENT_TYPE_NAMES,
  EVENT_TYPE_CATEGORIES,
  type ActivityEventType,
  type ActivityEventPayload,
  type ActivityEvent,
  type ActivityEventWithActor,
  type ActivityFeedPage,
  type ActivityFeedFilter,
  type ActivityEventRealtimePayload,
  type TimerStartedPayload,
  type TimerStoppedPayload,
  type EntryLoggedPayload,
  type EntryApprovalPayload,
  type GoalPayload,
  type MemberPayload,
  type ProjectCreatedPayload,
  type ProjectMemberAddedPayload,
} from './activityFeed';

// Shared dashboard schemas and types
export {
  SharedDashboardSchema,
  SharedDashboardWithStatsSchema,
  DailyTotalSchema,
  CategoryBreakdownSchema,
  TopProjectSchema,
  SharedDashboardDataSchema,
  CreateSharedDashboardSchema,
  UpdateSharedDashboardSchema,
  SharedDashboardViewQuerySchema,
  CreatedSharedDashboardResponseSchema,
  type SharedDashboard,
  type SharedDashboardWithStats,
  type DailyTotal,
  type CategoryBreakdown,
  type TopProject,
  type SharedDashboardData,
  type CreateSharedDashboardInput,
  type UpdateSharedDashboardInput,
  type SharedDashboardViewQuery,
  type CreatedSharedDashboardResponse,
} from './sharedDashboard';

// Leaderboard schemas and types
export {
  LeaderboardPeriodEnum,
  LeaderboardMetricEnum,
  LeaderboardEntrySchema,
  LeaderboardEntryWithAvatarSchema,
  LeaderboardResponseSchema,
  LeaderboardStatsSchema,
  LeaderboardQuerySchema,
  PERIOD_NAMES,
  METRIC_NAMES,
  LEADERBOARD_STALE_TIME,
  RANK_BADGES,
  type LeaderboardPeriod,
  type LeaderboardMetric,
  type LeaderboardEntry,
  type LeaderboardEntryWithAvatar,
  type LeaderboardResponse,
  type LeaderboardStats,
  type LeaderboardQuery,
} from './leaderboard';
