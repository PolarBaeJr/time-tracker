import { z } from 'zod';

/**
 * Entry Comment Schema - Entity schema for query responses
 */
export const EntryCommentSchema = z.object({
  id: z.string().uuid(),
  time_entry_id: z.string().uuid(),
  user_id: z.string().uuid(),
  content: z.string().min(1).max(2000),
  created_at: z.string().datetime({ offset: true }),
});

/**
 * Create Entry Comment Schema - Mutation schema for creating new comments
 *
 * EXCLUDES server-managed fields: id, user_id, created_at
 */
export const CreateEntryCommentSchema = z.object({
  time_entry_id: z.string().uuid(),
  content: z
    .string()
    .min(1, 'Comment is required')
    .max(2000, 'Comment must be 2000 characters or less'),
});

// Inferred TypeScript types
export type EntryComment = z.infer<typeof EntryCommentSchema>;
export type CreateEntryCommentInput = z.infer<typeof CreateEntryCommentSchema>;
