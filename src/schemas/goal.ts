import { z } from 'zod';

/**
 * Monthly Goal Schema - Entity schema for query responses
 *
 * Represents a monthly time tracking goal.
 * Goals can be:
 * - Overall goals: Apply to total time (category_id IS NULL)
 * - Per-category goals: Apply to specific category (category_id IS NOT NULL)
 *
 * Uniqueness constraints (handled by partial indexes in DB):
 * - One overall goal per user per month
 * - One goal per category per user per month
 */
export const MonthlyGoalSchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),

  /** UUID of the owning user (server-managed via auth.uid()) */
  user_id: z.string().uuid(),

  /**
   * Month for this goal (date, first day of month)
   * Format: YYYY-MM-DD (e.g., '2024-03-01')
   */
  month: z.string().date(),

  /**
   * UUID of the category this goal applies to (nullable)
   * NULL = overall/total goal or per-type goal
   * NOT NULL = per-category goal
   */
  category_id: z.string().uuid().nullable(),

  /**
   * Category type for per-type goals (nullable)
   * NULL = overall/total goal or per-category goal
   * NOT NULL = per-type goal
   */
  category_type: z.string().min(1).max(50).nullable().optional(),

  /**
   * Target hours to achieve in this month
   * Must be positive (> 0)
   */
  target_hours: z.number().positive('Target hours must be greater than 0'),
});

/**
 * Create Goal Schema - Mutation schema for creating new goals
 *
 * EXCLUDES server-managed fields: id, user_id
 * Note: Due to partial unique indexes on monthly_goals table,
 * upsert operations need special handling for overall vs per-category goals.
 */
export const CreateGoalSchema = z.object({
  /**
   * Month for this goal (first day of month)
   * Format: YYYY-MM-DD (e.g., '2024-03-01')
   */
  month: z.string().date(),

  /**
   * UUID of the category this goal applies to (optional)
   * Omit or set to null for overall/total goal
   */
  category_id: z.string().uuid().nullable().optional(),

  /**
   * Category type for per-type goals (optional)
   * Omit or set to null for overall/total goal or per-category goal
   */
  category_type: z.string().min(1).max(50).nullable().optional(),

  /**
   * Target hours to achieve
   * Must be positive (> 0)
   */
  target_hours: z.number().positive('Target hours must be greater than 0'),
});

/**
 * Update Goal Schema - Mutation schema for updating existing goals
 *
 * EXCLUDES server-managed fields: id, user_id
 * Only target_hours can be updated; month and category_id define the goal identity.
 */
export const UpdateGoalSchema = z.object({
  /**
   * Updated target hours
   * Must be positive (> 0)
   */
  target_hours: z.number().positive('Target hours must be greater than 0').optional(),
});

// Inferred TypeScript types
export type MonthlyGoal = z.infer<typeof MonthlyGoalSchema>;
export type CreateGoalInput = z.infer<typeof CreateGoalSchema>;
export type UpdateGoalInput = z.infer<typeof UpdateGoalSchema>;

/**
 * Goal progress calculation result
 * Used by useGoalProgress hook
 */
export interface GoalProgress {
  /** The goal being tracked */
  goal: MonthlyGoal;

  /** Target hours from the goal */
  targetHours: number;

  /** Actual hours logged so far */
  actualHours: number;

  /** Progress as percentage (0-100+, can exceed 100 if over target) */
  progressPercent: number;

  /** Hours remaining to reach target (negative if exceeded) */
  remainingHours: number;

  /** Hours per day needed to meet goal (based on remaining days) */
  dailyRequiredToMeetGoal: number;

  /** Number of days remaining in the month */
  daysRemaining: number;

  /** Whether the goal has been achieved */
  isAchieved: boolean;
}

/**
 * Schema for setting overall goals (category_id IS NULL)
 * Used for the useSetOverallGoal mutation
 */
export const SetOverallGoalSchema = z.object({
  month: z.string().date(),
  target_hours: z.number().positive('Target hours must be greater than 0'),
});

/**
 * Schema for setting per-category goals (category_id IS NOT NULL)
 * Used for the useSetCategoryGoal mutation
 */
export const SetCategoryGoalSchema = z.object({
  month: z.string().date(),
  category_id: z.string().uuid(),
  target_hours: z.number().positive('Target hours must be greater than 0'),
});

/**
 * Schema for setting per-type goals (category_type IS NOT NULL)
 * Used for the useSetTypeGoal mutation
 */
export const SetTypeGoalSchema = z.object({
  month: z.string().date(),
  category_type: z.string().min(1).max(50),
  target_hours: z.number().positive('Target hours must be greater than 0'),
});

export type SetOverallGoalInput = z.infer<typeof SetOverallGoalSchema>;
export type SetCategoryGoalInput = z.infer<typeof SetCategoryGoalSchema>;
export type SetTypeGoalInput = z.infer<typeof SetTypeGoalSchema>;
