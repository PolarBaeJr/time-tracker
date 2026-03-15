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

// Offline queue service
export {
  offlineQueue,
  validateQueuedAction,
  createQueuedAction,
  calculateBackoffDelay,
  OfflineQueueError,
  MAX_RETRY_ATTEMPTS,
  type CreateEntryPayload,
  type UpdateEntryPayload,
  type DeleteEntryPayload,
  type QueuedActionPayload,
  type ValidationResult,
} from './offlineQueue';

// Achievement service
export {
  calculateStreak,
  calculateTotalHours,
  calculateAchievements,
  calculateAndUpdateAchievements,
  wouldUnlock,
  getProgressText,
  AchievementServiceError,
  type AchievementCalculationResult,
} from './achievementService';
