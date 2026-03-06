import { z } from 'zod';

/**
 * User Schema - Entity schema for query responses
 *
 * Represents a user record from the public.users table.
 * This schema is used for validating data received from the database.
 */
export const UserSchema = z.object({
  /** UUID primary key, references auth.users(id) */
  id: z.string().uuid(),

  /** User's email address from OAuth provider */
  email: z.string().email(),

  /** User's display name (optional, from OAuth profile) */
  name: z.string().nullable(),

  /** IANA timezone identifier (e.g., 'America/New_York') */
  timezone: z.string().default('UTC'),

  /** Day of week to start weeks on (0=Sunday, 1=Monday, ..., 6=Saturday) */
  week_start_day: z.number().int().min(0).max(6).default(1),

  /** Whether the user has completed initial settings setup */
  onboarding_complete: z.boolean().default(false),

  /** Timestamp when user record was created */
  created_at: z.string().datetime({ offset: true }).optional(),

  /** Timestamp when user record was last updated */
  updated_at: z.string().datetime({ offset: true }).optional(),
});

/**
 * Update User Schema - Mutation schema for updating user settings
 *
 * EXCLUDES server-managed fields: id, email, created_at, updated_at
 * Only includes fields the user can modify through settings.
 */
export const UpdateUserSchema = z.object({
  /** User's display name */
  name: z.string().min(1).max(100).optional(),

  /** IANA timezone identifier */
  timezone: z.string().min(1).max(100).optional(),

  /** Day of week to start weeks on (0=Sunday through 6=Saturday) */
  week_start_day: z.number().int().min(0).max(6).optional(),

  /** Whether the user has completed initial settings setup */
  onboarding_complete: z.boolean().optional(),
});

// Inferred TypeScript types
export type User = z.infer<typeof UserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
