/**
 * API services barrel export
 *
 * This module exports all service functions for interacting with
 * the Supabase backend.
 */

// Timer service
export {
  startTimer,
  stopTimer,
  getActiveTimer,
  syncTimer,
  syncTimerWithStore,
  TimerServiceError,
  type TimerResult,
  type StartTimerOptions,
  type StopTimerOptions,
  type SyncResult,
} from './timerService';
