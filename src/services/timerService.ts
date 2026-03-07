/**
 * Timer Service
 *
 * This module provides functions for managing the active timer via Supabase.
 * All timer operations use server-side timestamps for accuracy.
 *
 * IMPORTANT DESIGN DECISIONS:
 * - startTimer() does NOT send started_at - the database DEFAULT now() handles it
 * - stopTimer() calls the stop_timer_and_create_entry RPC for atomic operation
 * - category_id is validated with CategoryIdSchema (NOT CreateCategorySchema)
 * - All functions handle errors gracefully with typed error results
 *
 * USAGE:
 * ```typescript
 * import { startTimer, stopTimer, getActiveTimer } from '@/services/timerService';
 *
 * // Start timer with optional category
 * const result = await startTimer({ categoryId: 'uuid' });
 * if (result.error) {
 *   console.error(result.error.message);
 * } else {
 *   console.log('Timer started:', result.data);
 * }
 *
 * // Stop timer with optional notes
 * const entry = await stopTimer({ notes: 'Working on feature X' });
 * ```
 *
 * SECURITY:
 * - user_id is set server-side via auth.uid() - never sent from client
 * - RLS policies ensure users can only access their own timers
 * - Category ownership is validated by RLS policies
 */

import { supabase } from '@/lib/supabase';
import { getTimerStoreState } from '@/stores';
import {
  ActiveTimerSchema,
  TimeEntrySchema,
  CategoryIdSchema,
  StopTimerSchema,
  type ActiveTimer,
  type TimeEntry,
  type StopTimerInput,
} from '@/schemas';

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Error thrown by timer service operations
 */
export class TimerServiceError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly operation?: 'start' | 'stop' | 'get' | 'sync'
  ) {
    super(message);
    this.name = 'TimerServiceError';
  }
}

/**
 * Result type for timer operations
 * Uses a discriminated union pattern for type-safe error handling
 */
export type TimerResult<T> = { data: T; error: null } | { data: null; error: TimerServiceError };

// ============================================================================
// START TIMER
// ============================================================================

/**
 * Options for starting a timer
 */
export interface StartTimerOptions {
  /**
   * Category ID to associate with the timer (optional)
   * Must be a valid UUID belonging to the current user
   */
  categoryId?: string | null;

  /** Timer mode: 'normal', 'pomodoro', or 'countdown' */
  timerMode?: 'normal' | 'pomodoro' | 'countdown';

  /** Pomodoro phase to start */
  pomodoroPhase?: 'work' | 'break' | 'long_break';

  /** Target duration for this phase in seconds */
  phaseDurationSeconds?: number;

  /** Number of pomodoros already completed */
  pomodorosCompleted?: number;

  /** Target duration for countdown mode in seconds */
  countdownDurationSeconds?: number;
}

/**
 * Start a new timer for the current user
 *
 * IMPORTANT: Does NOT send started_at to the server.
 * The database DEFAULT now() sets the server-side timestamp.
 *
 * @param options - Optional configuration (categoryId)
 * @returns Promise<TimerResult<ActiveTimer>> - The created timer or error
 *
 * @example
 * ```typescript
 * // Start without category
 * const result = await startTimer();
 *
 * // Start with category
 * const result = await startTimer({ categoryId: 'uuid-here' });
 *
 * if (result.error) {
 *   showError(result.error.message);
 * } else {
 *   timerStore.setActiveTimer(result.data);
 * }
 * ```
 */
export async function startTimer(options?: StartTimerOptions): Promise<TimerResult<ActiveTimer>> {
  try {
    // Validate category_id if provided using CategoryIdSchema
    // This validates UUID format but does NOT validate category entity fields
    const categoryId = options?.categoryId ?? null;
    const validatedCategoryId = CategoryIdSchema.parse(categoryId);

    // Insert new timer - DO NOT include started_at (server sets it)
    // The database DEFAULT now() ensures accurate server-side timestamp
    const insertData: Record<string, unknown> = {
      category_id: validatedCategoryId,
      running: true,
    };

    // Add pomodoro fields if in pomodoro mode
    if (options?.timerMode === 'pomodoro') {
      insertData.timer_mode = 'pomodoro';
      insertData.pomodoro_phase = options.pomodoroPhase ?? 'work';
      insertData.phase_duration_seconds = options.phaseDurationSeconds ?? 1500;
      insertData.pomodoros_completed = options.pomodorosCompleted ?? 0;
    }

    // Add countdown fields if in countdown mode
    if (options?.timerMode === 'countdown') {
      insertData.timer_mode = 'countdown';
      insertData.phase_duration_seconds = options.countdownDurationSeconds ?? 2700;
    }

    const { data, error } = await supabase
      .from('active_timers')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation (user already has active timer)
      if (error.code === '23505') {
        return {
          data: null,
          error: new TimerServiceError(
            'A timer is already running. Stop it before starting a new one.',
            error.code,
            'start'
          ),
        };
      }

      return {
        data: null,
        error: new TimerServiceError(error.message, error.code, 'start'),
      };
    }

    if (!data) {
      return {
        data: null,
        error: new TimerServiceError('No data returned from server', undefined, 'start'),
      };
    }

    // Validate response with ActiveTimerSchema
    const parsed = ActiveTimerSchema.safeParse(data);
    if (!parsed.success) {
      console.warn('Invalid timer data from server:', parsed.error);
      // Still return the data but cast it - schema validation is defensive
      return { data: data as ActiveTimer, error: null };
    }

    return { data: parsed.data, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error starting timer';
    return {
      data: null,
      error: new TimerServiceError(message, undefined, 'start'),
    };
  }
}

// ============================================================================
// STOP TIMER
// ============================================================================

/**
 * Options for stopping a timer
 */
export interface StopTimerOptions {
  /**
   * Optional notes to attach to the created time entry
   * Max 1000 characters
   */
  notes?: string | null;
}

/**
 * Stop the active timer and create a time entry
 *
 * This calls the stop_timer_and_create_entry RPC function which:
 * 1. Finds the active timer for the current user
 * 2. Calculates duration from started_at to now()
 * 3. Creates a time_entry record
 * 4. Deletes the active_timer record
 * 5. Returns the created time_entry
 *
 * All steps are atomic - either all succeed or all fail.
 *
 * @param options - Optional configuration (notes)
 * @returns Promise<TimerResult<TimeEntry>> - The created time entry or error
 *
 * @example
 * ```typescript
 * const result = await stopTimer({ notes: 'Completed feature implementation' });
 *
 * if (result.error) {
 *   showError(result.error.message);
 * } else {
 *   console.log('Entry created:', result.data);
 *   timerStore.setActiveTimer(null);
 * }
 * ```
 */
export async function stopTimer(options?: StopTimerOptions): Promise<TimerResult<TimeEntry>> {
  try {
    // Validate input with StopTimerSchema
    const input: StopTimerInput = {
      notes: options?.notes ?? null,
    };
    StopTimerSchema.parse(input);

    // Call the RPC function which handles everything atomically
    const { data, error } = await supabase.rpc('stop_timer_and_create_entry', {
      p_notes: input.notes,
    });

    if (error) {
      // Handle "no active timer" error from the RPC function
      if (error.message.includes('No active timer found')) {
        return {
          data: null,
          error: new TimerServiceError('No active timer to stop', error.code, 'stop'),
        };
      }

      return {
        data: null,
        error: new TimerServiceError(error.message, error.code, 'stop'),
      };
    }

    if (!data) {
      return {
        data: null,
        error: new TimerServiceError('No entry returned from server', undefined, 'stop'),
      };
    }

    // Validate response with TimeEntrySchema
    const parsed = TimeEntrySchema.safeParse(data);
    if (!parsed.success) {
      console.warn('Invalid time entry data from server:', parsed.error);
      return { data: data as TimeEntry, error: null };
    }

    return { data: parsed.data, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error stopping timer';
    return {
      data: null,
      error: new TimerServiceError(message, undefined, 'stop'),
    };
  }
}

// ============================================================================
// GET ACTIVE TIMER
// ============================================================================

/**
 * Get the current user's active timer
 *
 * RLS policies ensure only the user's own timer is returned.
 *
 * @returns Promise<TimerResult<ActiveTimer | null>> - The active timer, null if none, or error
 *
 * @example
 * ```typescript
 * const result = await getActiveTimer();
 *
 * if (result.error) {
 *   showError(result.error.message);
 * } else if (result.data) {
 *   timerStore.setActiveTimer(result.data);
 * } else {
 *   // No active timer
 *   timerStore.setActiveTimer(null);
 * }
 * ```
 */
export async function getActiveTimer(): Promise<TimerResult<ActiveTimer | null>> {
  try {
    const { data, error } = await supabase.from('active_timers').select('*').maybeSingle(); // Returns null if no rows, instead of error

    if (error) {
      return {
        data: null,
        error: new TimerServiceError(error.message, error.code, 'get'),
      };
    }

    // No active timer
    if (!data) {
      return { data: null, error: null };
    }

    // Validate response with ActiveTimerSchema
    const parsed = ActiveTimerSchema.safeParse(data);
    if (!parsed.success) {
      console.warn('Invalid timer data from server:', parsed.error);
      return { data: data as ActiveTimer, error: null };
    }

    return { data: parsed.data, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error fetching timer';
    return {
      data: null,
      error: new TimerServiceError(message, undefined, 'get'),
    };
  }
}

// ============================================================================
// SYNC TIMER
// ============================================================================

/**
 * Conflict resolution result when syncing timer state
 */
export interface SyncResult {
  /** Whether a conflict was detected and resolved */
  hadConflict: boolean;
  /** The resolved timer state (server wins) */
  resolvedTimer: ActiveTimer | null;
  /** Human-readable description of what happened */
  message: string;
}

/**
 * Sync local timer state with server state
 *
 * Implements conflict resolution with "server wins" policy.
 * This function compares local state with server state and resolves conflicts.
 *
 * @param localTimer - The locally stored timer state (may be stale)
 * @param serverTimer - The authoritative server timer state
 * @returns SyncResult describing what happened
 *
 * @example
 * ```typescript
 * const serverResult = await getActiveTimer();
 * if (serverResult.data !== undefined) {
 *   const localTimer = timerStore.getState().activeTimer;
 *   const syncResult = syncTimer(localTimer, serverResult.data);
 *
 *   if (syncResult.hadConflict) {
 *     showNotification(syncResult.message);
 *   }
 *
 *   timerStore.setActiveTimer(syncResult.resolvedTimer);
 * }
 * ```
 */
export function syncTimer(
  localTimer: ActiveTimer | null,
  serverTimer: ActiveTimer | null
): SyncResult {
  // Case 1: Both null - no conflict
  if (localTimer === null && serverTimer === null) {
    return {
      hadConflict: false,
      resolvedTimer: null,
      message: 'No timer active',
    };
  }

  // Case 2: Local has timer, server doesn't - timer was stopped elsewhere
  if (localTimer !== null && serverTimer === null) {
    return {
      hadConflict: true,
      resolvedTimer: null,
      message: 'Timer was stopped on another device',
    };
  }

  // Case 3: Local doesn't have timer, server does - timer was started elsewhere
  if (localTimer === null && serverTimer !== null) {
    return {
      hadConflict: true,
      resolvedTimer: serverTimer,
      message: 'Timer was started on another device',
    };
  }

  // Case 4: Both have timers - compare them
  // Server always wins since it has the authoritative timestamp
  if (localTimer !== null && serverTimer !== null) {
    // Same timer ID - might have updated category
    if (localTimer.id === serverTimer.id) {
      // Check if category changed
      if (localTimer.category_id !== serverTimer.category_id) {
        return {
          hadConflict: true,
          resolvedTimer: serverTimer,
          message: 'Timer category was changed on another device',
        };
      }

      // Check if started_at changed (shouldn't happen, but defensive)
      if (localTimer.started_at !== serverTimer.started_at) {
        return {
          hadConflict: true,
          resolvedTimer: serverTimer,
          message: 'Timer data was updated from another device',
        };
      }

      // No conflict - same timer
      return {
        hadConflict: false,
        resolvedTimer: serverTimer,
        message: 'Timer in sync',
      };
    }

    // Different timer IDs - local timer was replaced
    return {
      hadConflict: true,
      resolvedTimer: serverTimer,
      message: 'A different timer is now active (started from another device)',
    };
  }

  // Fallback (should be unreachable)
  return {
    hadConflict: false,
    resolvedTimer: serverTimer,
    message: 'Timer synced',
  };
}

// ============================================================================
// SYNC WITH STORE
// ============================================================================

/**
 * Fetch server timer and sync with local store
 *
 * This is a convenience function that:
 * 1. Fetches the current timer from the server
 * 2. Compares it with local state
 * 3. Resolves any conflicts (server wins)
 * 4. Updates the local store
 *
 * @returns Promise with sync result or error
 *
 * @example
 * ```typescript
 * // Call this on app startup or when reconnecting
 * const result = await syncTimerWithStore();
 *
 * if (result.error) {
 *   console.error('Failed to sync timer:', result.error);
 * } else if (result.data.hadConflict) {
 *   showToast(result.data.message);
 * }
 * ```
 */
export async function syncTimerWithStore(): Promise<TimerResult<SyncResult>> {
  try {
    // Get server state
    const serverResult = await getActiveTimer();

    if (serverResult.error) {
      return {
        data: null,
        error: new TimerServiceError(serverResult.error.message, serverResult.error.code, 'sync'),
      };
    }

    // Get local state from store
    const store = getTimerStoreState();
    const localTimer = store.activeTimer;

    // Sync and resolve conflicts
    const syncResult = syncTimer(localTimer, serverResult.data);

    // Update local store with resolved state
    store.syncFromServer(syncResult.resolvedTimer);

    return { data: syncResult, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error syncing timer';
    return {
      data: null,
      error: new TimerServiceError(message, undefined, 'sync'),
    };
  }
}
