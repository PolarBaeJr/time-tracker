import { z } from 'zod';

/**
 * Shared Dashboard Schemas - Validation schemas for shareable analytics views
 *
 * Share a read-only interactive view of Hub/analytics with others.
 * Anyone with the link can view (no auth required).
 * Viewers can change date range and filters but cannot edit.
 */

// =============================================================================
// ENTITY SCHEMAS
// =============================================================================

/**
 * Shared Dashboard Schema - Entity schema for query responses
 *
 * Represents a shareable dashboard configuration.
 */
export const SharedDashboardSchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),

  /** UUID of the user who created the shared dashboard */
  user_id: z.string().uuid(),

  /**
   * UUID of the workspace (nullable)
   * If set, shows workspace analytics; otherwise shows personal analytics
   */
  workspace_id: z.string().uuid().nullable(),

  /**
   * Unique shareable token (UUID format)
   * Used in the public URL: /shared/:token
   */
  token: z.string().uuid(),

  /** Dashboard title for display (1-100 characters) */
  title: z.string().min(1).max(100),

  /** Whether the share link is currently active */
  is_active: z.boolean().default(true),

  /**
   * Optional expiration timestamp
   * If set, the link becomes invalid after this time
   */
  expires_at: z.string().datetime({ offset: true }).nullable(),

  /** Timestamp when shared dashboard was created */
  created_at: z.string().datetime({ offset: true }),
});

/**
 * Shared Dashboard With Stats Schema - Includes usage statistics
 *
 * Used for the dashboard management list.
 */
export const SharedDashboardWithStatsSchema = SharedDashboardSchema.extend({
  /** Number of times the link has been accessed */
  view_count: z.number().int().nonnegative().optional(),

  /** Last time the link was accessed */
  last_viewed_at: z.string().datetime({ offset: true }).nullable().optional(),

  /** Workspace name if linked to a workspace */
  workspace_name: z.string().nullable().optional(),
});

// =============================================================================
// DATA SCHEMAS (for public viewing)
// =============================================================================

/**
 * Daily Total Schema - Single day's tracking total
 */
export const DailyTotalSchema = z.object({
  /** Date in YYYY-MM-DD format */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  /** Total seconds tracked on this day */
  total_seconds: z.number().int().nonnegative(),
});

/**
 * Category Breakdown Schema - Time breakdown by category
 */
export const CategoryBreakdownSchema = z.object({
  /** Category ID */
  category_id: z.string().uuid().nullable(),

  /** Category name (or "Uncategorized") */
  category_name: z.string(),

  /** Category color */
  category_color: z.string(),

  /** Total seconds in this category */
  total_seconds: z.number().int().nonnegative(),

  /** Percentage of total time */
  percentage: z.number().min(0).max(100),
});

/**
 * Top Project Schema - Project with most time logged
 */
export const TopProjectSchema = z.object({
  /** Project ID */
  project_id: z.string().uuid(),

  /** Project name */
  project_name: z.string(),

  /** Project color */
  project_color: z.string(),

  /** Total seconds on this project */
  total_seconds: z.number().int().nonnegative(),

  /** Percentage of total time */
  percentage: z.number().min(0).max(100),
});

/**
 * Shared Dashboard Data Schema - Analytics data for public viewing
 *
 * This is the data structure returned by the shared-dashboard Edge Function.
 * Contains aggregate data only - no individual entries or PII.
 */
export const SharedDashboardDataSchema = z.object({
  /** Dashboard title */
  title: z.string(),

  /** Owner's name (optional, for attribution) */
  owner_name: z.string().nullable().optional(),

  /** Whether this is workspace data or personal data */
  is_workspace: z.boolean(),

  /** Workspace name if applicable */
  workspace_name: z.string().nullable().optional(),

  /** Date range for the data */
  date_range: z.object({
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
  }),

  /** Summary statistics */
  summary: z.object({
    /** Total hours this week */
    total_hours_week: z.number().nonnegative(),

    /** Total hours this month */
    total_hours_month: z.number().nonnegative(),

    /** Average hours per day (in the date range) */
    avg_hours_per_day: z.number().nonnegative(),

    /** Number of days with entries */
    days_tracked: z.number().int().nonnegative(),
  }),

  /** Daily totals for the past 30 days */
  daily_totals: z.array(DailyTotalSchema),

  /** Category breakdown */
  category_breakdown: z.array(CategoryBreakdownSchema),

  /** Top projects (workspace only) */
  top_projects: z.array(TopProjectSchema).optional(),

  /** Generated timestamp */
  generated_at: z.string().datetime({ offset: true }),
});

// =============================================================================
// MUTATION SCHEMAS
// =============================================================================

/**
 * Create Shared Dashboard Schema - Input for creating share links
 *
 * EXCLUDES server-managed fields: id, user_id, token, is_active, created_at
 */
export const CreateSharedDashboardSchema = z.object({
  /** Dashboard title for display */
  title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),

  /**
   * Workspace ID (optional)
   * If set, shares workspace analytics; otherwise shares personal analytics
   */
  workspace_id: z.string().uuid().nullable().optional(),

  /**
   * Optional expiration time
   * If not set, the link never expires
   */
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
});

/**
 * Update Shared Dashboard Schema - Input for updating share link settings
 *
 * All fields optional for partial updates.
 */
export const UpdateSharedDashboardSchema = z.object({
  /** Update dashboard title */
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title must be 100 characters or less')
    .optional(),

  /** Update expiration time */
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),

  /** Activate or deactivate the share link */
  is_active: z.boolean().optional(),
});

/**
 * Shared Dashboard View Query Schema - Query params for public view
 */
export const SharedDashboardViewQuerySchema = z.object({
  /** Date range start (optional, defaults to 30 days ago) */
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),

  /** Date range end (optional, defaults to today) */
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

/**
 * Created Shared Dashboard Response - Returned after creating a share link
 */
export const CreatedSharedDashboardResponseSchema = SharedDashboardSchema.extend({
  /** Full shareable URL */
  share_url: z.string().url(),
});

// =============================================================================
// INFERRED TYPES
// =============================================================================

/** Shared dashboard type */
export type SharedDashboard = z.infer<typeof SharedDashboardSchema>;

/** Shared dashboard with stats */
export type SharedDashboardWithStats = z.infer<typeof SharedDashboardWithStatsSchema>;

/** Daily total type */
export type DailyTotal = z.infer<typeof DailyTotalSchema>;

/** Category breakdown type */
export type CategoryBreakdown = z.infer<typeof CategoryBreakdownSchema>;

/** Top project type */
export type TopProject = z.infer<typeof TopProjectSchema>;

/** Shared dashboard data (public view) */
export type SharedDashboardData = z.infer<typeof SharedDashboardDataSchema>;

/** Input type for creating shared dashboards */
export type CreateSharedDashboardInput = z.infer<typeof CreateSharedDashboardSchema>;

/** Input type for updating shared dashboards */
export type UpdateSharedDashboardInput = z.infer<typeof UpdateSharedDashboardSchema>;

/** Query params for shared dashboard view */
export type SharedDashboardViewQuery = z.infer<typeof SharedDashboardViewQuerySchema>;

/** Created shared dashboard response */
export type CreatedSharedDashboardResponse = z.infer<typeof CreatedSharedDashboardResponseSchema>;
