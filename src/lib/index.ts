/**
 * Library utilities and configurations
 *
 * This module exports all library utilities including:
 * - Supabase client configuration
 * - Environment constants
 * - React Query client configuration
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

// React Query client
export { queryClient, queryKeys, type QueryKeys } from './queryClient';

// Deep linking
export {
  linking,
  linkingPrefixes,
  linkingConfig,
  parseOAuthCallbackUrl,
  isOAuthCallbackUrl,
} from './linking';
export type { RootStackParamList, LinkingConfig } from './linking';

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
