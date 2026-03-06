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
export { storage, secureStorage } from './storage';
export {
  createActiveTimerSubscription,
  getReconnectDelayMs,
  isValidActiveTimerRealtimePayload,
  normalizeActiveTimerRealtimePayload,
} from './realtime';

export type {
  SupabaseClient,
  Session,
  User,
  AuthError,
  AuthChangeEvent,
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from './supabase';
export type { SecureStorage, Storage } from './storage';
export type {
  ActiveTimerConnectionStatus,
  ActiveTimerRealtimeClient,
  ActiveTimerRealtimeEventType,
  ActiveTimerRealtimePayload,
  ActiveTimerSubscriptionHandle,
  CreateActiveTimerSubscriptionOptions,
} from './realtime';
