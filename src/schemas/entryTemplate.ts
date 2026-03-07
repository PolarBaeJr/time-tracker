import { z } from 'zod';

/**
 * Entry Template Schema - Entity schema for query responses
 */
export const EntryTemplateSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  category_id: z.string().uuid().nullable(),
  notes: z.string().default(''),
  duration_seconds: z.number().int().min(0),
  is_billable: z.boolean(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

/**
 * Create Entry Template Schema - Mutation schema for creating new templates
 *
 * EXCLUDES server-managed fields: id, user_id, created_at, updated_at
 */
export const CreateEntryTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  category_id: z.string().uuid().nullable().default(null),
  notes: z.string().default(''),
  duration_seconds: z.number().int().min(0).default(0),
  is_billable: z.boolean().default(false),
});

/**
 * Update Entry Template Schema - Mutation schema for updating templates, all fields optional
 */
export const UpdateEntryTemplateSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .optional(),
  category_id: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
  duration_seconds: z.number().int().min(0).optional(),
  is_billable: z.boolean().optional(),
});

// Inferred TypeScript types
export type EntryTemplate = z.infer<typeof EntryTemplateSchema>;
export type CreateEntryTemplateInput = z.infer<typeof CreateEntryTemplateSchema>;
export type UpdateEntryTemplateInput = z.infer<typeof UpdateEntryTemplateSchema>;
