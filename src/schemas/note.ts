import { z } from 'zod';

/**
 * Note Schema - Entity schema for query responses
 *
 * Represents a user note that can optionally be linked to a category or time entry.
 * Notes support soft delete via deleted_at timestamp and pinning for prioritization.
 */
export const NoteSchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),

  /** UUID of the owning user (server-managed via auth.uid()) */
  user_id: z.string().uuid(),

  /** Note title (required, max 200 characters) */
  title: z.string().max(200),

  /** Note content/body (optional, max 10000 characters) */
  content: z.string().max(10000).nullable(),

  /**
   * UUID of the associated category (nullable)
   * Set to NULL if category is deleted (ON DELETE SET NULL)
   */
  category_id: z.string().uuid().nullable(),

  /**
   * UUID of the associated time entry (nullable)
   * Set to NULL if time entry is deleted (ON DELETE SET NULL)
   */
  time_entry_id: z.string().uuid().nullable(),

  /** Whether this note is pinned to the top of the list */
  pinned: z.boolean().default(false),

  /** Timestamp when note was created (ISO 8601 datetime) */
  created_at: z.string().datetime({ offset: true }),

  /** Timestamp when note was last updated (ISO 8601 datetime) */
  updated_at: z.string().datetime({ offset: true }),

  /** Soft delete timestamp (null if not deleted) */
  deleted_at: z.string().datetime({ offset: true }).nullable().optional(),
});

/**
 * Create Note Schema - Mutation schema for creating new notes
 *
 * EXCLUDES server-managed fields: id, user_id, created_at, updated_at
 * Used for creating new notes.
 */
export const CreateNoteSchema = z.object({
  /** Note title (required, 1-200 characters) */
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),

  /** Note content/body (optional, max 10000 characters) */
  content: z.string().max(10000, 'Content must be 10000 characters or less').nullable().optional(),

  /** UUID of the associated category (optional) */
  category_id: z.string().uuid().nullable().optional(),

  /** UUID of the associated time entry (optional) */
  time_entry_id: z.string().uuid().nullable().optional(),

  /** Whether this note should be pinned (optional, defaults to false) */
  pinned: z.boolean().optional(),
});

/**
 * Update Note Schema - Mutation schema for updating existing notes
 *
 * EXCLUDES server-managed fields: id, user_id, created_at, updated_at
 * All fields are optional for partial updates.
 */
export const UpdateNoteSchema = z.object({
  /** Note title (1-200 characters) */
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less')
    .optional(),

  /** Note content/body (max 10000 characters) */
  content: z.string().max(10000, 'Content must be 10000 characters or less').nullable().optional(),

  /** UUID of the associated category */
  category_id: z.string().uuid().nullable().optional(),

  /** UUID of the associated time entry */
  time_entry_id: z.string().uuid().nullable().optional(),

  /** Whether this note should be pinned */
  pinned: z.boolean().optional(),
});

/**
 * Notes Filter Schema - For filtering notes in queries
 */
export const NotesFilterSchema = z.object({
  /** Search query to match against title and content (case-insensitive) */
  search: z.string().optional(),

  /** Filter by category ID */
  categoryId: z.string().uuid().optional(),

  /** Filter to only show pinned notes */
  pinnedOnly: z.boolean().optional(),

  /** Field to sort by */
  sortBy: z.enum(['created_at', 'updated_at', 'title']).default('created_at'),

  /** Sort order */
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Inferred TypeScript types
export type Note = z.infer<typeof NoteSchema>;
export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;
export type UpdateNoteInput = z.infer<typeof UpdateNoteSchema>;
export type NotesFilter = z.infer<typeof NotesFilterSchema>;
