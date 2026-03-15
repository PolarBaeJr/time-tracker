/**
 * Achievement Service
 *
 * This module provides functions for calculating user achievements based on
 * their time tracking data. Achievements are calculated locally using cached
 * data from Supabase queries.
 *
 * IMPORTANT DESIGN DECISIONS:
 * - All calculations use locally cached data (no server-side RPC)
 * - Achievement state is persisted to AsyncStorage via achievementStore
 * - Streak calculations consider consecutive calendar days
 * - Time calculations aggregate all non-deleted entries
 *
 * SECURITY NOTES:
 * - Achievement progress is calculated client-side and can be manipulated
 * - This is acceptable for gamification purposes (no monetary/access impact)
 * - Server-side validation could be added in the future via Supabase RPC
 *
 * USAGE:
 * ```typescript
 * import { calculateAndUpdateAchievements } from '@/services/achievementService';
 *
 * // Recalculate all achievements from scratch
 * const newlyUnlocked = await calculateAndUpdateAchievements();
 * if (newlyUnlocked.length > 0) {
 *   showCelebration(newlyUnlocked);
 * }
 * ```
 */

import { supabase } from '@/lib/supabase';
import { updateMultipleAchievements, type AchievementId } from '@/stores/achievementStore';

/**
 * Error thrown by achievement service operations
 */
export class AchievementServiceError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'AchievementServiceError';
  }
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Minimal time entry data needed for achievement calculations
 */
interface TimeEntryForAchievement {
  start_at: string;
  duration_seconds: number;
}

/**
 * Fetch all time entries for achievement calculation
 *
 * This is an efficient query that only fetches the fields needed
 * for achievement calculations.
 */
async function fetchTimeEntriesForAchievements(): Promise<TimeEntryForAchievement[]> {
  const { data, error } = await supabase
    .from('time_entries')
    .select('start_at, duration_seconds')
    .is('deleted_at', null)
    .order('start_at', { ascending: true });

  if (error) {
    throw new AchievementServiceError(error.message, error.code);
  }

  return data ?? [];
}

/**
 * Count user's categories
 */
async function fetchCategoryCount(): Promise<number> {
  const { count, error } = await supabase
    .from('categories')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new AchievementServiceError(error.message, error.code);
  }

  return count ?? 0;
}

/**
 * Count user's monthly goals
 */
async function fetchGoalCount(): Promise<number> {
  const { count, error } = await supabase
    .from('monthly_goals')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new AchievementServiceError(error.message, error.code);
  }

  return count ?? 0;
}

// ============================================================================
// CALCULATION LOGIC
// ============================================================================

/**
 * Calculate the current tracking streak (consecutive days with entries)
 *
 * A streak is defined as consecutive calendar days where at least one
 * time entry was created. The streak is calculated backward from today.
 *
 * @param entries - Array of time entries sorted by start_at ascending
 * @returns Current streak length in days
 */
export function calculateStreak(entries: TimeEntryForAchievement[]): number {
  if (entries.length === 0) {
    return 0;
  }

  // Get unique calendar days (in UTC) with entries
  const daysWithEntries = new Set<string>();
  for (const entry of entries) {
    const date = new Date(entry.start_at);
    const dateStr = date.toISOString().split('T')[0];
    daysWithEntries.add(dateStr);
  }

  // Convert to sorted array (newest first)
  const sortedDays = Array.from(daysWithEntries).sort().reverse();

  if (sortedDays.length === 0) {
    return 0;
  }

  // Get today's date string
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Get yesterday's date string
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Check if the most recent entry is from today or yesterday
  // (streak continues if you have entries from yesterday, even if not today yet)
  const mostRecentDay = sortedDays[0];
  if (mostRecentDay !== todayStr && mostRecentDay !== yesterdayStr) {
    // Streak is broken - most recent entry is more than 1 day old
    return 0;
  }

  // Count consecutive days starting from the most recent
  let streak = 1;
  const currentDate = new Date(mostRecentDay + 'T00:00:00Z');

  for (let i = 1; i < sortedDays.length; i++) {
    // Move back one day
    currentDate.setDate(currentDate.getDate() - 1);
    const expectedDateStr = currentDate.toISOString().split('T')[0];

    if (sortedDays[i] === expectedDateStr) {
      streak++;
    } else {
      // Gap found, streak ends
      break;
    }
  }

  return streak;
}

/**
 * Calculate total tracked hours from entries
 *
 * @param entries - Array of time entries
 * @returns Total hours tracked (as a decimal)
 */
export function calculateTotalHours(entries: TimeEntryForAchievement[]): number {
  const totalSeconds = entries.reduce((sum, entry) => sum + (entry.duration_seconds || 0), 0);
  return totalSeconds / 3600;
}

// ============================================================================
// MAIN CALCULATION
// ============================================================================

/**
 * Achievement calculation result
 */
export interface AchievementCalculationResult {
  /** Map of achievement ID to calculated progress value */
  progress: Map<AchievementId, number>;

  /** Array of achievement IDs that were newly unlocked */
  newlyUnlocked: AchievementId[];

  /** Timestamp of calculation */
  calculatedAt: Date;
}

/**
 * Calculate all achievement progress values
 *
 * This function queries the database for the necessary data and
 * calculates progress for all achievements.
 *
 * @returns Promise<AchievementCalculationResult> - Calculation results
 */
export async function calculateAchievements(): Promise<AchievementCalculationResult> {
  // Fetch all required data in parallel
  const [entries, categoryCount, goalCount] = await Promise.all([
    fetchTimeEntriesForAchievements(),
    fetchCategoryCount(),
    fetchGoalCount(),
  ]);

  // Calculate streak
  const streak = calculateStreak(entries);

  // Calculate total hours
  const totalHours = calculateTotalHours(entries);

  // Calculate entry count
  const entryCount = entries.length;

  // Build progress map
  const progress = new Map<AchievementId, number>();

  // Streak achievements
  progress.set('STREAK_3', streak);
  progress.set('STREAK_7', streak);
  progress.set('STREAK_14', streak);
  progress.set('STREAK_30', streak);

  // Time achievements (using hours, since targets are in hours)
  progress.set('TIME_10H', totalHours);
  progress.set('TIME_50H', totalHours);
  progress.set('TIME_100H', totalHours);

  // First achievements
  progress.set('FIRST_ENTRY', Math.min(entryCount, 1));
  progress.set('FIRST_CATEGORY', Math.min(categoryCount, 1));
  progress.set('FIRST_GOAL', Math.min(goalCount, 1));

  return {
    progress,
    newlyUnlocked: [], // Will be filled by updateMultipleAchievements
    calculatedAt: new Date(),
  };
}

/**
 * Calculate and update all achievements in the store
 *
 * This is the main entry point for achievement calculation.
 * It calculates all achievement progress and updates the store,
 * returning any newly unlocked achievements.
 *
 * @returns Promise<AchievementId[]> - Array of newly unlocked achievement IDs
 *
 * @example
 * ```typescript
 * const newlyUnlocked = await calculateAndUpdateAchievements();
 *
 * if (newlyUnlocked.includes('STREAK_7')) {
 *   showToast('Achievement unlocked: Week Warrior!');
 * }
 * ```
 */
export async function calculateAndUpdateAchievements(): Promise<AchievementId[]> {
  try {
    const { progress } = await calculateAchievements();

    // Convert Map to array of updates
    const updates: Array<{ id: AchievementId; progress: number }> = [];
    progress.forEach((value, key) => {
      updates.push({ id: key, progress: value });
    });

    // Update store and get newly unlocked achievements
    const newlyUnlocked = updateMultipleAchievements(updates);

    return newlyUnlocked;
  } catch (error) {
    // Log error but don't throw - achievement calculation is non-critical
    console.error('[achievementService] Failed to calculate achievements:', error);
    return [];
  }
}

/**
 * Check if a single achievement would be unlocked with given progress
 *
 * This is a pure calculation function that doesn't modify any state.
 * Useful for preview UI or testing.
 *
 * @param id - Achievement ID to check
 * @param progress - Progress value to check
 * @returns true if the achievement would be unlocked
 */
export function wouldUnlock(id: AchievementId, progress: number): boolean {
  // Import dynamically to avoid circular dependency
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ACHIEVEMENT_DEFINITIONS } = require('@/schemas/achievement');

  const definition = ACHIEVEMENT_DEFINITIONS[id];
  if (!definition) {
    return false;
  }

  const targetValue = definition.targetValue ?? 1;
  return progress >= targetValue;
}

/**
 * Get human-readable progress text for an achievement
 *
 * @param id - Achievement ID
 * @param progress - Current progress value
 * @returns Human-readable progress string (e.g., "3/7 days", "10/50 hours")
 */
export function getProgressText(id: AchievementId, progress: number): string {
  // Import dynamically to avoid circular dependency
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ACHIEVEMENT_DEFINITIONS } = require('@/schemas/achievement');

  const definition = ACHIEVEMENT_DEFINITIONS[id];
  if (!definition) {
    return `${progress}`;
  }

  const targetValue = definition.targetValue ?? 1;

  switch (definition.category) {
    case 'streak':
      return `${Math.floor(progress)}/${targetValue} days`;
    case 'time':
      return `${progress.toFixed(1)}/${targetValue} hours`;
    case 'first':
      return progress >= 1 ? 'Completed' : 'Not yet';
    default:
      return `${progress}/${targetValue}`;
  }
}
