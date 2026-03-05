/**
 * Library utilities and configurations
 *
 * This module exports all library utilities including:
 * - Supabase client configuration
 * - Environment constants
 */

// Supabase client and types
export {
  supabase,
  config,
  validateConfig,
} from './supabase';

export type {
  SupabaseClient,
  Session,
  User,
  AuthError,
  AuthChangeEvent,
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from './supabase';
