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
