import { z } from 'zod';

/**
 * Active Timer Schema - Entity schema for query responses
 *
 * Represents an active/running timer for a user.
 * Each user can have at most one active timer (UNIQUE constraint on user_id).
 * The timer tracks when work started and which category it belongs to.
 *
 * Timer behavior:
 * - started_at is set server-side via DEFAULT now() for accurate timestamps
 * - Elapsed time is calculated as: now() - started_at
 * - Timer survives app restarts and syncs across devices via Supabase Realtime
 */
export const TimerModeEnum = z.enum(['normal', 'pomodoro', 'countdown']);
export const PomodoroPhaseEnum = z.enum(['work', 'break', 'long_break']);

export const ActiveTimerSchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),

  /** UUID of the owning user (server-managed via auth.uid()) */
  user_id: z.string().uuid(),

  /**
   * UUID of the associated category (nullable)
   * Can be null if user starts timer without selecting a category
   */
  category_id: z.string().uuid().nullable(),

  /**
   * Timestamp when the timer was started (ISO 8601 datetime)
   * Set server-side via DEFAULT now() to ensure accurate timestamps
   * regardless of client clock skew
   */
  started_at: z.string().datetime({ offset: true }),

  /** Whether the timer is currently running */
  running: z.boolean(),

  /** Timer mode: normal (stopwatch) or pomodoro (timed phases) */
  timer_mode: TimerModeEnum.default('normal'),

  /** Current pomodoro phase */
  pomodoro_phase: PomodoroPhaseEnum.default('work'),

  /** Target duration for current phase in seconds */
  phase_duration_seconds: z.number().int().positive().nullable().default(null),

  /** Work phases completed in current pomodoro cycle */
  pomodoros_completed: z.number().int().nonnegative().default(0),
});

/**
 * Start Timer Schema - For starting a new timer
 *
 * EXCLUDES server-managed fields: id, user_id, started_at
 * started_at is intentionally excluded because the server sets it via DEFAULT now()
 * to ensure accurate server-side timestamps.
 */
export const StartTimerSchema = z.object({
  /**
   * UUID of the category to track time against (optional)
   * If not provided, timer runs without a category
   */
  category_id: z.string().uuid().nullable().optional(),

  /** Timer mode: normal or pomodoro */
  timer_mode: TimerModeEnum.optional(),

  /** Pomodoro phase to start (for pomodoro mode) */
  pomodoro_phase: PomodoroPhaseEnum.optional(),

  /** Target duration in seconds for the phase */
  phase_duration_seconds: z.number().int().positive().optional(),

  /** Number of pomodoros already completed in this cycle */
  pomodoros_completed: z.number().int().nonnegative().optional(),
});

/**
 * Stop Timer Schema - For stopping the active timer
 *
 * When stopping a timer, the server calculates the duration and creates
 * a time entry automatically via the stop_timer_and_create_entry RPC function.
 */
export const StopTimerSchema = z.object({
  /** Optional notes to attach to the created time entry */
  notes: z.string().max(1000).nullable().optional(),
});

// Inferred TypeScript types
export type TimerMode = z.infer<typeof TimerModeEnum>;
export type PomodoroPhase = z.infer<typeof PomodoroPhaseEnum>;
export type ActiveTimer = z.infer<typeof ActiveTimerSchema>;
export type StartTimerInput = z.infer<typeof StartTimerSchema>;
export type StopTimerInput = z.infer<typeof StopTimerSchema>;

/**
 * Timer state for local state management
 * Extends ActiveTimer with computed/local fields
 */
export interface TimerState {
  /** The active timer from the server (null if no timer running) */
  activeTimer: ActiveTimer | null;

  /** Locally computed elapsed time in seconds */
  localElapsed: number;

  /** Whether the timer is currently running (derived from activeTimer) */
  isRunning: boolean;

  /** Whether we're connected to the realtime subscription */
  isConnected: boolean;

  /** Connection status for UI indicator */
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
}

/**
 * Queued action for offline support
 * Note: start_timer and stop_timer are NOT queued because they require
 * server-side timestamps. Offline timer usage creates manual entries instead.
 */
export const QueuedActionSchema = z.object({
  /** Unique ID for the queued action */
  id: z.string().uuid(),

  /** Type of action (only entry operations, not timer operations) */
  action: z.enum(['create_entry', 'update_entry', 'delete_entry']),

  /** Action payload */
  payload: z.record(z.string(), z.unknown()),

  /** When the action was queued */
  timestamp: z.string().datetime({ offset: true }),

  /** Number of retry attempts */
  retryCount: z.number().int().nonnegative().default(0),
});

export type QueuedAction = z.infer<typeof QueuedActionSchema>;
