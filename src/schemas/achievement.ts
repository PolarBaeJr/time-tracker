import { z } from 'zod';

/**
 * Achievement Types and Categories
 *
 * Achievements are organized by category:
 * - streak: Based on consecutive days of time tracking
 * - time: Based on total hours tracked
 * - first: First-time accomplishments
 */

/**
 * Achievement ID Enum
 *
 * All defined achievement IDs. These correspond to specific milestones
 * in the user's time tracking journey.
 */
export const AchievementIdEnum = z.enum([
  // Streak achievements - consecutive days of tracking
  'STREAK_3', // 3 day streak
  'STREAK_7', // 7 day streak (1 week)
  'STREAK_14', // 14 day streak (2 weeks)
  'STREAK_30', // 30 day streak (1 month)

  // Time achievements - total hours tracked
  'TIME_10H', // 10 hours tracked
  'TIME_50H', // 50 hours tracked
  'TIME_100H', // 100 hours tracked

  // First accomplishments
  'FIRST_ENTRY', // Created first time entry
  'FIRST_CATEGORY', // Created first category
  'FIRST_GOAL', // Set first monthly goal
]);

export type AchievementId = z.infer<typeof AchievementIdEnum>;

/**
 * Achievement Category Enum
 */
export const AchievementCategoryEnum = z.enum(['streak', 'time', 'first']);

export type AchievementCategory = z.infer<typeof AchievementCategoryEnum>;

/**
 * Achievement Definition Schema
 *
 * Static definition of what an achievement represents.
 * This is the "template" for achievements - it doesn't change per user.
 */
export const AchievementDefinitionSchema = z.object({
  /** Unique identifier for this achievement */
  id: AchievementIdEnum,

  /** Display name for the achievement */
  name: z.string().min(1).max(100),

  /** Description of how to earn this achievement */
  description: z.string().min(1).max(500),

  /** Icon name (Material icon or custom) */
  icon: z.string().min(1).max(50),

  /** Achievement category for grouping/filtering */
  category: AchievementCategoryEnum,

  /**
   * Target value to unlock (optional)
   * For streak achievements: number of consecutive days
   * For time achievements: number of hours
   * For "first" achievements: typically 1
   */
  targetValue: z.number().int().nonnegative().optional(),
});

export type AchievementDefinition = z.infer<typeof AchievementDefinitionSchema>;

/**
 * User Achievement Progress Schema
 *
 * Represents a user's progress toward (or completion of) an achievement.
 * This is the per-user state.
 */
export const UserAchievementSchema = z.object({
  /** Achievement ID this progress is for */
  id: AchievementIdEnum,

  /**
   * Current progress value
   * For streak achievements: current streak length
   * For time achievements: hours tracked so far
   * For "first" achievements: 0 or 1
   */
  progress: z.number().nonnegative(),

  /**
   * ISO 8601 timestamp when this achievement was unlocked
   * NULL if not yet unlocked
   */
  unlockedAt: z.string().datetime({ offset: true }).nullable(),

  /** Whether this achievement has been viewed/acknowledged by user */
  acknowledged: z.boolean().default(false),
});

export type UserAchievement = z.infer<typeof UserAchievementSchema>;

/**
 * Full Achievement Schema (Definition + Progress)
 *
 * Combines the static definition with user-specific progress.
 * This is what's typically rendered in the UI.
 */
export const AchievementSchema = z.object({
  /** Unique identifier for this achievement */
  id: AchievementIdEnum,

  /** Display name for the achievement */
  name: z.string().min(1).max(100),

  /** Description of how to earn this achievement */
  description: z.string().min(1).max(500),

  /** Icon name (Material icon or custom) */
  icon: z.string().min(1).max(50),

  /** Achievement category for grouping/filtering */
  category: AchievementCategoryEnum,

  /**
   * Target value to unlock (optional)
   * For streak achievements: number of consecutive days
   * For time achievements: number of hours
   * For "first" achievements: typically 1
   */
  targetValue: z.number().int().nonnegative().optional(),

  /**
   * Current progress value
   * For streak achievements: current streak length
   * For time achievements: hours tracked so far
   * For "first" achievements: 0 or 1
   */
  progress: z.number().nonnegative(),

  /**
   * Progress as a percentage (0-100, can exceed 100 if over target)
   */
  progressPercent: z.number().nonnegative(),

  /**
   * ISO 8601 timestamp when this achievement was unlocked
   * NULL if not yet unlocked
   */
  unlockedAt: z.string().datetime({ offset: true }).nullable(),

  /** Whether the achievement has been unlocked */
  isUnlocked: z.boolean(),
});

export type Achievement = z.infer<typeof AchievementSchema>;

/**
 * Map of achievement IDs to their user progress
 * Uses a partial record since not all achievements need to be tracked initially
 */
export type AchievementsMap = Partial<Record<AchievementId, UserAchievement>>;

/**
 * Achievement State Schema
 *
 * The complete state stored in AsyncStorage for achievements.
 * Persists user progress across sessions.
 */
export const AchievementStateSchema = z.object({
  /** Version for schema migrations */
  version: z.number().int().positive(),

  /** Map of achievement ID to user progress (partial - not all achievements need entries) */
  achievements: z
    .record(z.string(), UserAchievementSchema)
    .optional()
    .transform(val => val as AchievementsMap | undefined),

  /** Timestamp of last achievement calculation */
  lastCalculatedAt: z.string().datetime({ offset: true }).optional(),

  /** IDs of achievements unlocked but not yet shown to user */
  pendingNotifications: z.array(AchievementIdEnum).default([]),
});

export type AchievementState = z.infer<typeof AchievementStateSchema>;

/**
 * All achievement definitions
 *
 * These are the static templates for all achievements.
 * They define what achievements exist and how to display them.
 */
export const ACHIEVEMENT_DEFINITIONS: Record<AchievementId, AchievementDefinition> = {
  // Streak achievements
  STREAK_3: {
    id: 'STREAK_3',
    name: '3-Day Streak',
    description: 'Track time for 3 consecutive days',
    icon: 'local-fire-department',
    category: 'streak',
    targetValue: 3,
  },
  STREAK_7: {
    id: 'STREAK_7',
    name: 'Week Warrior',
    description: 'Track time for 7 consecutive days',
    icon: 'whatshot',
    category: 'streak',
    targetValue: 7,
  },
  STREAK_14: {
    id: 'STREAK_14',
    name: 'Fortnight Focus',
    description: 'Track time for 14 consecutive days',
    icon: 'bolt',
    category: 'streak',
    targetValue: 14,
  },
  STREAK_30: {
    id: 'STREAK_30',
    name: 'Monthly Master',
    description: 'Track time for 30 consecutive days',
    icon: 'emoji-events',
    category: 'streak',
    targetValue: 30,
  },

  // Time achievements
  TIME_10H: {
    id: 'TIME_10H',
    name: 'Time Tracker',
    description: 'Log a total of 10 hours',
    icon: 'schedule',
    category: 'time',
    targetValue: 10,
  },
  TIME_50H: {
    id: 'TIME_50H',
    name: 'Dedicated Worker',
    description: 'Log a total of 50 hours',
    icon: 'access-time',
    category: 'time',
    targetValue: 50,
  },
  TIME_100H: {
    id: 'TIME_100H',
    name: 'Century Club',
    description: 'Log a total of 100 hours',
    icon: 'military-tech',
    category: 'time',
    targetValue: 100,
  },

  // First accomplishments
  FIRST_ENTRY: {
    id: 'FIRST_ENTRY',
    name: 'First Steps',
    description: 'Create your first time entry',
    icon: 'flag',
    category: 'first',
    targetValue: 1,
  },
  FIRST_CATEGORY: {
    id: 'FIRST_CATEGORY',
    name: 'Organized',
    description: 'Create your first category',
    icon: 'category',
    category: 'first',
    targetValue: 1,
  },
  FIRST_GOAL: {
    id: 'FIRST_GOAL',
    name: 'Goal Setter',
    description: 'Set your first monthly goal',
    icon: 'track-changes',
    category: 'first',
    targetValue: 1,
  },
};

/**
 * Helper to get all achievement IDs
 */
export const ALL_ACHIEVEMENT_IDS: readonly AchievementId[] = AchievementIdEnum.options;

/**
 * Default empty achievement state
 */
export const DEFAULT_ACHIEVEMENT_STATE: AchievementState = {
  version: 1,
  achievements: {},
  lastCalculatedAt: undefined,
  pendingNotifications: [],
};
