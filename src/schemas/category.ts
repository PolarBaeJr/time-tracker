import { z } from 'zod';

/**
 * Hex color regex pattern for validation
 * Matches 6-character hex colors with # prefix (e.g., #FF5733)
 */
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Category Schema - Entity schema for query responses
 *
 * Represents a user-defined category for organizing time entries.
 * Categories are fully user-created with no pre-seeded defaults.
 */
export const CategorySchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),

  /** UUID of the owning user (server-managed via auth.uid()) */
  user_id: z.string().uuid(),

  /** Category name (1-100 characters) */
  name: z.string().min(1).max(100),

  /** Hex color code for visual identification (e.g., #6366F1) */
  color: z.string().regex(HEX_COLOR_REGEX, 'Must be a valid hex color (e.g., #FF5733)'),

  /**
   * User-defined category type/classification (1-50 characters)
   * Examples: 'work', 'hobby', 'class', 'exercise', or any custom value
   */
  type: z.string().min(1).max(50),

  /** Hourly rate for billable entries (null if not set) */
  hourly_rate: z.number().nullable().optional(),

  /** Timestamp when category was created */
  created_at: z.string().datetime({ offset: true }),
});

/**
 * Create Category Schema - Mutation schema for creating new categories
 *
 * EXCLUDES server-managed fields: id, user_id, created_at
 * These are set by the database using DEFAULT values and RLS.
 */
export const CreateCategorySchema = z.object({
  /** Category name (required, 1-100 characters) */
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),

  /** Hex color code (required, e.g., #6366F1) */
  color: z.string().regex(HEX_COLOR_REGEX, 'Must be a valid hex color (e.g., #FF5733)'),

  /**
   * Category type/classification (required, 1-50 characters)
   * User-defined value like 'work', 'hobby', 'class', etc.
   */
  type: z.string().min(1, 'Type is required').max(50, 'Type must be 50 characters or less'),

  /** Hourly rate for billable entries (null if not set) */
  hourly_rate: z.number().nullable().optional(),
});

/**
 * Update Category Schema - Mutation schema for updating existing categories
 *
 * EXCLUDES server-managed fields: id, user_id, created_at
 * All fields are optional for partial updates.
 */
export const UpdateCategorySchema = z.object({
  /** Category name (1-100 characters) */
  name: z.string().min(1).max(100).optional(),

  /** Hex color code (e.g., #6366F1) */
  color: z.string().regex(HEX_COLOR_REGEX, 'Must be a valid hex color (e.g., #FF5733)').optional(),

  /** Category type/classification (1-50 characters) */
  type: z.string().min(1).max(50).optional(),

  /** Hourly rate for billable entries (null if not set) */
  hourly_rate: z.number().nullable().optional(),
});

/**
 * Category ID Schema - For validating category_id references in other entities
 *
 * Use this when validating category_id in timer or time entry operations,
 * NOT CreateCategorySchema which is for category entity creation.
 */
export const CategoryIdSchema = z.string().uuid().nullable().optional();

// Inferred TypeScript types
export type Category = z.infer<typeof CategorySchema>;
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
