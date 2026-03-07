/**
 * Type Definitions
 *
 * This module re-exports all TypeScript types from Zod schemas
 * and defines additional application-wide types.
 *
 * Types are inferred from Zod schemas using z.infer<T> to ensure
 * runtime validation and static typing stay in sync.
 */

// Re-export all types from schemas
export type {
  // User types
  User,
  UpdateUserInput,
  // Category types
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
  // Time entry types
  EntryType,
  TimeEntry,
  CreateTimeEntryInput,
  UpdateTimeEntryInput,
  TimeEntryFilters,
  // Timer types
  TimerMode,
  PomodoroPhase,
  ActiveTimer,
  StartTimerInput,
  StopTimerInput,
  TimerState,
  QueuedAction,
  // Goal types
  MonthlyGoal,
  CreateGoalInput,
  UpdateGoalInput,
  SetOverallGoalInput,
  SetCategoryGoalInput,
  GoalProgress,
} from '../schemas';

/**
 * API Response wrapper type
 */
export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

/**
 * API Error type
 */
export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  limit: number;
  offset?: number;
  cursor?: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  hasMore: boolean;
  nextCursor?: string;
  total?: number;
}

/**
 * Analytics date range
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Analytics aggregation result
 */
export interface AggregatedTime {
  /** Label for the period (date, week, month) */
  label: string;
  /** Total seconds tracked in this period */
  totalSeconds: number;
  /** Total hours (derived from totalSeconds) */
  totalHours: number;
}

/**
 * Hour of day distribution (0-23)
 */
export interface HourDistribution {
  hour: number;
  totalSeconds: number;
}

/**
 * Day of week distribution (0-6, where 0 is Sunday or user's week_start_day)
 */
export interface DayOfWeekDistribution {
  dayIndex: number;
  dayName: string;
  totalSeconds: number;
}

/**
 * KPI summary for analytics dashboard
 */
export interface KPISummary {
  todayHours: number;
  weekHours: number;
  monthHours: number;
  streak: number; // Consecutive days with entries
}

/**
 * Network status
 */
export interface NetworkStatus {
  isOnline: boolean;
  isConnected: boolean;
}

/**
 * Realtime connection status
 */
export type RealtimeConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

/**
 * Toast/notification type
 */
export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}
