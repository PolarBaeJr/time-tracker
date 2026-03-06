/**
 * Supabase client - Main entry point with platform detection
 *
 * This module automatically selects the appropriate Supabase client
 * based on the current platform:
 * - Native (iOS/Android): Uses SecureStore for secure token storage
 * - Web: Uses localStorage for token storage
 *
 * USAGE:
 * ```typescript
 * import { supabase } from '@/lib/supabase';
 *
 * // Auth operations
 * const { data, error } = await supabase.auth.signInWithOAuth({
 *   provider: 'google',
 * });
 *
 * // Database queries
 * const { data: entries } = await supabase
 *   .from('time_entries')
 *   .select('*');
 *
 * // Realtime subscriptions
 * supabase
 *   .channel('timers')
 *   .on('postgres_changes', { event: '*', schema: 'public', table: 'active_timers' }, handler)
 *   .subscribe();
 * ```
 *
 * SECURITY NOTES:
 * - The Supabase anon key is safe for client-side use
 * - All data access is protected by Row Level Security (RLS) policies
 * - Tokens are stored securely using platform-appropriate storage
 * - Auth state is automatically refreshed before expiry
 */

import { Platform } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';

// Re-export config and validation utilities
export { config, validateConfig } from './constants';

/**
 * Platform-specific Supabase client
 *
 * The appropriate client is loaded based on the platform at runtime.
 * This allows for optimal token storage on each platform:
 * - Native: expo-secure-store (Keychain/EncryptedSharedPreferences)
 * - Web: localStorage
 */
let supabase: SupabaseClient;

if (Platform.OS === 'web') {
  // Web platform - use localStorage
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { supabase: webClient } = require('./supabase.web');
  supabase = webClient;
} else {
  // Native platforms (iOS, Android) - use SecureStore
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { supabase: nativeClient } = require('./supabase.native');
  supabase = nativeClient;
}

export { supabase };
export default supabase;

/**
 * Type exports for convenience
 * These are re-exported so consumers don't need to import from @supabase/supabase-js directly
 */
export type {
  SupabaseClient,
  Session,
  User,
  AuthError,
  AuthChangeEvent,
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
