import { z } from 'zod';

/**
 * Leaderboard Schemas - Validation schemas for team rankings
 *
 * Team ranking within a workspace based on hours tracked.
 * Rankings are calculated from time_entries for workspace members.
 * Cached with 5-minute stale time (not realtime).
 */

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Leaderboard period enum - time period for ranking calculation
 */
export const LeaderboardPeriodEnum = z.enum(['week', 'month']);

/**
 * Leaderboard metric enum - metric used for ranking
 * - total: All hours tracked
 * - billable: Only billable hours
 */
export const LeaderboardMetricEnum = z.enum(['total', 'billable']);

// =============================================================================
// ENTITY SCHEMAS
// =============================================================================

/**
 * Leaderboard Entry Schema - Single user's ranking
 */
export const LeaderboardEntrySchema = z.object({
  /** UUID of the user */
  user_id: z.string().uuid(),

  /** User's display name (or email if no name) */
  name: z.string(),

  /** User's email address */
  email: z.string().email(),

  /** Total seconds tracked in the period */
  total_seconds: z.number().int().nonnegative(),

  /**
   * User's rank (1-indexed)
   * Users with the same total_seconds share the same rank
   */
  rank: z.number().int().positive(),

  /**
   * Whether this is the current user's entry
   * Used for highlighting in the UI
   */
  is_current_user: z.boolean().optional(),
});

/**
 * Leaderboard Entry With Avatar Schema - Includes avatar data
 */
export const LeaderboardEntryWithAvatarSchema = LeaderboardEntrySchema.extend({
  /** Avatar URL (if available) */
  avatar_url: z.string().url().nullable().optional(),

  /** Initials fallback for avatar */
  initials: z.string().max(2).optional(),
});

/**
 * Leaderboard Response Schema - Full leaderboard response
 */
export const LeaderboardResponseSchema = z.object({
  /** Time period for this leaderboard */
  period: LeaderboardPeriodEnum,

  /** Metric used for ranking */
  metric: LeaderboardMetricEnum,

  /** Workspace ID this leaderboard is for */
  workspace_id: z.string().uuid(),

  /** Date range covered */
  date_range: z.object({
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
  }),

  /** Ranked entries (top 20) */
  entries: z.array(LeaderboardEntrySchema),

  /**
   * Current user's entry (if not in top 20)
   * Allows showing the user's position even if not ranked high
   */
  current_user_entry: LeaderboardEntrySchema.nullable(),

  /** Total number of workspace members with entries */
  total_participants: z.number().int().nonnegative(),

  /** Timestamp when leaderboard was calculated */
  calculated_at: z.string().datetime({ offset: true }),
});

/**
 * Leaderboard Stats Schema - Summary statistics
 */
export const LeaderboardStatsSchema = z.object({
  /** Total hours tracked by all members */
  total_hours: z.number().nonnegative(),

  /** Average hours per member */
  avg_hours_per_member: z.number().nonnegative(),

  /** Hours tracked by the leader */
  leader_hours: z.number().nonnegative(),

  /** Number of members with at least one entry */
  active_members: z.number().int().nonnegative(),
});

// =============================================================================
// QUERY SCHEMAS
// =============================================================================

/**
 * Leaderboard Query Schema - Query parameters for fetching leaderboard
 */
export const LeaderboardQuerySchema = z.object({
  /** Workspace ID to get leaderboard for */
  workspace_id: z.string().uuid(),

  /** Time period (defaults to 'week') */
  period: LeaderboardPeriodEnum.default('week'),

  /** Metric to rank by (defaults to 'total') */
  metric: LeaderboardMetricEnum.default('total'),

  /** Maximum entries to return (defaults to 20) */
  limit: z.number().int().positive().max(100).default(20),
});

// =============================================================================
// HELPER CONSTANTS
// =============================================================================

/**
 * Human-readable period names
 */
export const PERIOD_NAMES: Record<z.infer<typeof LeaderboardPeriodEnum>, string> = {
  week: 'This Week',
  month: 'This Month',
};

/**
 * Human-readable metric names
 */
export const METRIC_NAMES: Record<z.infer<typeof LeaderboardMetricEnum>, string> = {
  total: 'All Hours',
  billable: 'Billable Hours',
};

/**
 * Default leaderboard stale time in milliseconds (5 minutes)
 */
export const LEADERBOARD_STALE_TIME = 5 * 60 * 1000;

/**
 * Rank badge thresholds for visual distinction
 */
export const RANK_BADGES = {
  GOLD: 1,
  SILVER: 2,
  BRONZE: 3,
} as const;

// =============================================================================
// INFERRED TYPES
// =============================================================================

/** Leaderboard period type */
export type LeaderboardPeriod = z.infer<typeof LeaderboardPeriodEnum>;

/** Leaderboard metric type */
export type LeaderboardMetric = z.infer<typeof LeaderboardMetricEnum>;

/** Leaderboard entry type */
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

/** Leaderboard entry with avatar */
export type LeaderboardEntryWithAvatar = z.infer<typeof LeaderboardEntryWithAvatarSchema>;

/** Leaderboard response type */
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

/** Leaderboard stats type */
export type LeaderboardStats = z.infer<typeof LeaderboardStatsSchema>;

/** Leaderboard query params type */
export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;
