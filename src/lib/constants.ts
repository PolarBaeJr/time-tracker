/**
 * Environment constants for the WorkTracker app
 *
 * Uses expo-constants to safely access environment variables.
 * Values are loaded from .env files via Expo's built-in dotenv support.
 *
 * SECURITY NOTES:
 * - Never commit .env files with real credentials
 * - SUPABASE_ANON_KEY is safe for client-side use (public key)
 * - All sensitive operations are protected by RLS policies
 */

import Constants from 'expo-constants';

/**
 * Interface for type-safe environment variable access
 */
interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

/**
 * Get environment variable with validation
 * Throws helpful error in development if required variables are missing
 */
function getEnvVar(key: string): string {
  const value = Constants.expoConfig?.extra?.[key] ?? process.env[key] ?? '';

  if (!value && __DEV__) {
    console.warn(
      `[WorkTracker] Missing environment variable: ${key}. ` +
        'Make sure to create a .env file with required variables. ' +
        'See .env.example for reference.'
    );
  }

  return value;
}

/**
 * Validates a URL string
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * App configuration loaded from environment variables
 *
 * USAGE:
 * ```typescript
 * import { config } from '@/lib/constants';
 * console.log(config.supabaseUrl);
 * ```
 */
export const config: AppConfig = {
  supabaseUrl: getEnvVar('SUPABASE_URL'),
  supabaseAnonKey: getEnvVar('SUPABASE_ANON_KEY'),
};

/**
 * Validates that all required environment variables are set and valid
 * Call this early in app initialization to fail fast if misconfigured
 *
 * @throws Error if required configuration is missing or invalid
 */
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.supabaseUrl) {
    errors.push('SUPABASE_URL is required');
  } else if (!isValidUrl(config.supabaseUrl)) {
    errors.push('SUPABASE_URL must be a valid URL');
  }

  if (!config.supabaseAnonKey) {
    errors.push('SUPABASE_ANON_KEY is required');
  } else if (config.supabaseAnonKey.length < 100) {
    // JWT tokens are typically 150+ characters
    errors.push('SUPABASE_ANON_KEY appears to be invalid (too short)');
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}\n\n` +
        'Please check your .env file. See .env.example for required variables.'
    );
  }
}
