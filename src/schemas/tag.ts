import { z } from 'zod';

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Tag Schema - Entity schema for query responses
 */
export const TagSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1).max(50),
  color: z.string().regex(HEX_COLOR_REGEX, 'Must be a valid hex color (e.g., #6366f1)'),
  created_at: z.string().datetime({ offset: true }),
});

/**
 * Create Tag Schema - Mutation schema for creating new tags
 *
 * EXCLUDES server-managed fields: id, user_id, created_at
 */
export const CreateTagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name must be 50 characters or less'),
  color: z.string().regex(HEX_COLOR_REGEX, 'Must be a valid hex color (e.g., #6366f1)'),
});

/**
 * Update Tag Schema - Mutation schema for updating existing tags
 */
export const UpdateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(HEX_COLOR_REGEX, 'Must be a valid hex color (e.g., #6366f1)').optional(),
});

/**
 * TimeEntryTag Schema - Junction table row
 */
export const TimeEntryTagSchema = z.object({
  time_entry_id: z.string().uuid(),
  tag_id: z.string().uuid(),
});

// Inferred TypeScript types
export type Tag = z.infer<typeof TagSchema>;
export type CreateTagInput = z.infer<typeof CreateTagSchema>;
export type UpdateTagInput = z.infer<typeof UpdateTagSchema>;
export type TimeEntryTag = z.infer<typeof TimeEntryTagSchema>;
