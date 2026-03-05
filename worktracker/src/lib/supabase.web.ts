/**
 * Supabase client configuration for web platform
 *
 * Uses localStorage for token storage (browser standard).
 * This is the standard approach for web applications.
 *
 * SECURITY NOTES:
 * - localStorage is accessible to JavaScript (potential XSS vulnerability)
 * - Ensure proper Content Security Policy (CSP) headers
 * - Tokens are automatically refreshed before expiry
 * - Consider httpOnly cookies for production if XSS is a major concern
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { config } from './constants';

/**
 * Custom storage adapter for Supabase auth using localStorage
 *
 * Wraps localStorage to match the async interface expected by Supabase.
 * Includes error handling for cases where localStorage is unavailable
 * (e.g., private browsing mode in some browsers).
 */
const localStorageAdapter = {
  /**
   * Retrieve a value from localStorage
   */
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return null;
      }
      return window.localStorage.getItem(key);
    } catch (error) {
      // localStorage may throw in private browsing mode
      console.error(`[localStorage] Error reading key "${key}":`, error);
      return null;
    }
  },

  /**
   * Store a value in localStorage
   */
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      window.localStorage.setItem(key, value);
    } catch (error) {
      // localStorage may throw if storage quota is exceeded
      console.error(`[localStorage] Error writing key "${key}":`, error);
      throw error; // Re-throw to let Supabase handle the auth failure
    }
  },

  /**
   * Remove a value from localStorage
   */
  removeItem: async (key: string): Promise<void> => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      window.localStorage.removeItem(key);
    } catch (error) {
      // Log error but don't throw - treat as successful removal
      console.error(`[localStorage] Error deleting key "${key}":`, error);
    }
  },
};

/**
 * Supabase client instance for web platform
 *
 * Configured with:
 * - PKCE auth flow (standard for OAuth in browsers)
 * - Automatic token refresh
 * - Persistent sessions using localStorage
 * - URL session detection for OAuth redirects
 */
export const supabase: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseAnonKey,
  {
    auth: {
      // PKCE (Proof Key for Code Exchange) is the standard for browser apps
      // It's required for Google OAuth and other providers
      flowType: 'pkce',

      // Automatically refresh the session before it expires
      autoRefreshToken: true,

      // Persist the session to localStorage
      persistSession: true,

      // Use our custom localStorage adapter
      storage: localStorageAdapter,

      // Enable URL detection for OAuth callback handling
      // When user returns from OAuth provider, Supabase extracts tokens from URL
      detectSessionInUrl: true,
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
