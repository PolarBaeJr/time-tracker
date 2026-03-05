/**
 * Supabase client configuration for native platforms (iOS/Android)
 *
 * Uses expo-secure-store for secure token storage.
 * SecureStore uses Keychain on iOS and Encrypted SharedPreferences on Android.
 *
 * SECURITY NOTES:
 * - Tokens are stored securely in platform-specific encrypted storage
 * - SecureStore has a 2KB limit per value (sufficient for JWT tokens)
 * - Auth state is automatically refreshed when the app resumes
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import { config } from './constants';

/**
 * Custom storage adapter for Supabase auth using SecureStore
 *
 * Implements the Storage interface required by @supabase/supabase-js.
 * All methods are async and use SecureStore's encrypted storage.
 */
const secureStoreAdapter = {
  /**
   * Retrieve a value from secure storage
   */
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      // Log error but don't throw - return null as if key doesn't exist
      console.error(`[SecureStore] Error reading key "${key}":`, error);
      return null;
    }
  },

  /**
   * Store a value in secure storage
   */
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      // SecureStore has a 2KB limit per value
      // JWT tokens are typically under this limit, but log if it fails
      console.error(`[SecureStore] Error writing key "${key}":`, error);
      throw error; // Re-throw to let Supabase handle the auth failure
    }
  },

  /**
   * Remove a value from secure storage
   */
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      // Log error but don't throw - treat as successful removal
      console.error(`[SecureStore] Error deleting key "${key}":`, error);
    }
  },
};

/**
 * Supabase client instance for native platforms
 *
 * Configured with:
 * - PKCE auth flow (more secure for mobile apps)
 * - Automatic token refresh
 * - Persistent sessions using SecureStore
 * - URL detection disabled (not needed on native)
 */
export const supabase: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseAnonKey,
  {
    auth: {
      // PKCE (Proof Key for Code Exchange) is more secure for public clients
      // It prevents authorization code interception attacks
      flowType: 'pkce',

      // Automatically refresh the session before it expires
      autoRefreshToken: true,

      // Persist the session to SecureStore
      persistSession: true,

      // Use our custom SecureStore adapter
      storage: secureStoreAdapter,

      // Disable URL detection (not applicable for native apps)
      detectSessionInUrl: false,
    },

    // Enable realtime subscriptions
    realtime: {
      params: {
        // Include auth token in realtime connections
        eventsPerSecond: 10,
      },
    },
  }
);

export default supabase;
