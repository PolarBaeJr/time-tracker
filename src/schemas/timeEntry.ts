import { z } from 'zod';

/**
 * Time Entry Schema - Entity schema for query responses
 *
 * Represents a completed time tracking entry with start/end times and duration.
 * Time entries are created when the timer is stopped or via manual entry.
 */
export const EntryTypeEnum = z.enum(['work', 'break', 'long_break']);

export const TimeEntrySchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),

  /** UUID of the owning user (server-managed via auth.uid()) */
  user_id: z.string().uuid(),

  /**
   * UUID of the associated category (nullable)
   * Set to NULL if category is deleted (ON DELETE SET NULL)
   */
  category_id: z.string().uuid().nullable(),

  /** Start timestamp of the time entry (ISO 8601 datetime) */
  start_at: z.string().datetime({ offset: true }),

  /**
   * End timestamp of the time entry (ISO 8601 datetime)
   * Nullable for entries created from active timers before they're stopped
   */
  end_at: z.string().datetime({ offset: true }).nullable(),

  /** Duration in seconds (non-negative integer) */
  duration_seconds: z.number().int().nonnegative(),

  /** Optional notes/description for the entry (max 1000 characters) */
  notes: z.string().max(1000).nullable(),

  /** Type of entry: work, break, or long_break */
  entry_type: EntryTypeEnum.default('work'),

  /** Whether this entry is billable */
  is_billable: z.boolean().default(false),

  /** Soft delete timestamp (null if not deleted) */
  deleted_at: z.string().datetime({ offset: true }).nullable().optional(),

  /** Timestamp when entry was created */
  created_at: z.string().datetime({ offset: true }),

  /** Timestamp when entry was last updated */
  updated_at: z.string().datetime({ offset: true }),
});

/**
 * Create Time Entry Schema - Mutation schema for creating new entries
 *
 * EXCLUDES server-managed fields: id, user_id, created_at, updated_at
 * Used for manual time entry creation.
 */
export const CreateTimeEntrySchema = z
  .object({
    /** UUID of the associated category (optional) */
    category_id: z.string().uuid().nullable().optional(),

    /** Start timestamp (ISO 8601 datetime, required) */
    start_at: z.string().datetime({ offset: true }),

    /** End timestamp (ISO 8601 datetime, optional for ongoing entries) */
    end_at: z.string().datetime({ offset: true }).nullable().optional(),

    /** Duration in seconds (non-negative integer, required) */
    duration_seconds: z.number().int().nonnegative(),

    /** Optional notes/description (max 1000 characters) */
    notes: z.string().max(1000).nullable().optional(),

    /** Whether this entry is billable */
    is_billable: z.boolean().optional(),
  })
  .refine(
    data => {
      // If both start_at and end_at are provided, end_at must be after start_at
      if (data.start_at && data.end_at) {
        return new Date(data.end_at) > new Date(data.start_at);
      }
      return true;
    },
    {
      message: 'End time must be after start time',
      path: ['end_at'],
    }
  )
  .refine(
    data => {
      // Duration must be positive for completed entries
      return data.duration_seconds > 0;
    },
    {
      message: 'Duration must be greater than 0',
      path: ['duration_seconds'],
    }
  )
  .refine(
    data => {
      // Start time should not be in the future
      return new Date(data.start_at) <= new Date();
    },
    {
      message: 'Start time cannot be in the future',
      path: ['start_at'],
    }
  );

/**
 * Update Time Entry Schema - Mutation schema for updating existing entries
 *
 * EXCLUDES server-managed fields: id, user_id, created_at, updated_at
 * All fields are optional for partial updates.
 */
export const UpdateTimeEntrySchema = z
  .object({
    /** UUID of the associated category */
    category_id: z.string().uuid().nullable().optional(),

    /** Start timestamp (ISO 8601 datetime) */
    start_at: z.string().datetime({ offset: true }).optional(),

    /** End timestamp (ISO 8601 datetime) */
    end_at: z.string().datetime({ offset: true }).nullable().optional(),

    /** Duration in seconds (non-negative integer) */
    duration_seconds: z.number().int().nonnegative().optional(),

    /** Notes/description (max 1000 characters) */
    notes: z.string().max(1000).nullable().optional(),

    /** Whether this entry is billable */
    is_billable: z.boolean().optional(),
  })
  .refine(
    data => {
      // If both start_at and end_at are provided, end_at must be after start_at
      if (data.start_at && data.end_at) {
        return new Date(data.end_at) > new Date(data.start_at);
      }
      return true;
    },
    {
      message: 'End time must be after start time',
      path: ['end_at'],
    }
  );

// Inferred TypeScript types
export type EntryType = z.infer<typeof EntryTypeEnum>;
export type TimeEntry = z.infer<typeof TimeEntrySchema>;
export type CreateTimeEntryInput = z.infer<typeof CreateTimeEntrySchema>;
export type UpdateTimeEntryInput = z.infer<typeof UpdateTimeEntrySchema>;

/**
 * Time Entry Filters Schema - For filtering time entries in queries
 */
export const TimeEntryFiltersSchema = z.object({
  /** Filter by date range start (inclusive) */
  dateStart: z.string().datetime({ offset: true }).optional(),

  /** Filter by date range end (inclusive) */
  dateEnd: z.string().datetime({ offset: true }).optional(),

  /** Filter by category ID */
  categoryId: z.string().uuid().nullable().optional(),

  /** Search in notes field */
  searchNotes: z.string().optional(),

  /** Minimum duration in seconds */
  minDuration: z.number().int().nonnegative().optional(),

  /** Maximum duration in seconds */
  maxDuration: z.number().int().nonnegative().optional(),

  /** Filter by entry types */
  entryTypes: z.array(EntryTypeEnum).optional(),

  /** Sort field */
  sortBy: z.enum(['date', 'duration', 'entry_type']).optional(),

  /** Sort order */
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type TimeEntryFilters = z.infer<typeof TimeEntryFiltersSchema>;
