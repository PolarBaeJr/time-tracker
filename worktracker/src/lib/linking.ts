/**
 * Deep Linking Configuration for React Navigation
 *
 * This module provides the linking configuration for handling deep links
 * and universal links in the WorkTracker app. It supports:
 *
 * 1. Custom URL scheme: worktracker://
 * 2. Universal links: https://worktracker.app/
 *
 * USAGE:
 * ```typescript
 * import { linking } from '@/lib/linking';
 * import { NavigationContainer } from '@react-navigation/native';
 *
 * function App() {
 *   return (
 *     <NavigationContainer linking={linking}>
 *       <Navigator />
 *     </NavigationContainer>
 *   );
 * }
 * ```
 *
 * OAUTH CALLBACK FLOW:
 * 1. User taps "Sign in with Google" -> opens browser
 * 2. After Google auth, Supabase redirects to worktracker://auth/callback?code=...
 * 3. This config routes to the AuthCallback screen
 * 4. useDeepLink hook exchanges the code for a session
 *
 * @see docs/DEEP_LINKING.md for iOS and Android setup instructions
 */

import { Platform, Linking } from 'react-native';

/**
 * Type definition for the root navigation param list
 * This should match the actual navigation structure when navigation is implemented
 */
export type RootStackParamList = {
  Login: undefined;
  AuthCallback: { code?: string; error?: string; error_description?: string };
  Main: undefined;
  EntryEdit: { entryId: string };
};

/**
 * Linking configuration type compatible with React Navigation.
 * Defined locally to avoid requiring @react-navigation/native as a dependency.
 * When React Navigation is installed, this can be replaced with:
 * import type { LinkingOptions } from '@react-navigation/native';
 */
export interface LinkingConfig<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ParamList extends object = object,
> {
  prefixes: string[];
  config?: {
    screens: Record<string, unknown>;
  };
  getInitialURL?: () => Promise<string | null>;
  subscribe?: (listener: (url: string) => void) => () => void;
}

/**
 * URL prefixes that the app responds to
 *
 * - worktracker:// - Custom URL scheme for native deep links
 * - https://worktracker.app - Universal links for both web and native
 */
export const linkingPrefixes = [
  'worktracker://',
  'https://worktracker.app',
];

/**
 * Screen mapping configuration
 *
 * Maps URL paths to screen names and extracts parameters.
 * The path structure follows REST conventions where possible.
 */
export const linkingConfig = {
  screens: {
    // OAuth callback handler
    // Matches: worktracker://auth/callback?code=...
    // Matches: https://worktracker.app/auth/callback?code=...
    AuthCallback: {
      path: 'auth/callback',
      // Parse query parameters from the OAuth callback URL
      // The code parameter is the authorization code from the OAuth provider
      parse: {
        code: (code: string) => code,
        error: (error: string) => error,
        error_description: (desc: string) => desc,
      },
    },

    // Login screen (no params)
    Login: 'login',

    // Main app (tabs)
    Main: {
      path: '',
      screens: {
        // These will be populated when tab navigation is implemented
        Timer: 'timer',
        History: 'history',
        Analytics: 'analytics',
        Categories: 'categories',
        Goals: 'goals',
        Settings: 'settings',
      },
    },

    // Entry edit modal
    // Matches: worktracker://entry/:entryId
    EntryEdit: {
      path: 'entry/:entryId',
      parse: {
        entryId: (entryId: string) => entryId,
      },
    },
  },
};

/**
 * Get the initial URL that launched the app
 *
 * On native platforms, this returns the URL that was used to open the app
 * if it was opened via a deep link. On web, it returns the current URL.
 *
 * @returns The initial URL or null if the app wasn't opened via deep link
 */
async function getInitialURL(): Promise<string | null> {
  // On web, check the current URL for OAuth callback
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const url = window.location.href;
    // Only return if it's an auth callback
    if (url.includes('/auth/callback')) {
      return url;
    }
    return null;
  }

  // On native, get the URL that opened the app
  const url = await Linking.getInitialURL();
  return url;
}

/**
 * Subscribe to incoming deep links
 *
 * This is called when the app is already running and receives a deep link.
 * On native, this happens when the app is opened via a URL while running.
 *
 * @param listener - Callback function that receives the URL
 * @returns Cleanup function to remove the listener
 */
function subscribe(listener: (url: string) => void): () => void {
  // On web, we don't need to subscribe to URL changes
  // The initial URL handling is sufficient
  if (Platform.OS === 'web') {
    return () => {};
  }

  // On native, listen for incoming URLs
  const subscription = Linking.addEventListener('url', ({ url }) => {
    listener(url);
  });

  return () => {
    subscription.remove();
  };
}

/**
 * Complete linking configuration for React Navigation
 *
 * This configuration enables:
 * - Deep linking via custom URL scheme (worktracker://)
 * - Universal links (https://worktracker.app/)
 * - OAuth callback handling
 * - Navigation to specific screens via URLs
 */
export const linking: LinkingConfig<RootStackParamList> = {
  prefixes: linkingPrefixes,
  config: linkingConfig,
  getInitialURL,
  subscribe,
};

/**
 * Parse an OAuth callback URL to extract parameters
 *
 * @param url - The callback URL from OAuth provider
 * @returns Object containing the parsed parameters
 *
 * @example
 * ```typescript
 * const params = parseOAuthCallbackUrl('worktracker://auth/callback?code=abc123');
 * // { code: 'abc123', error: undefined, error_description: undefined }
 * ```
 */
export function parseOAuthCallbackUrl(url: string): {
  code: string | null;
  error: string | null;
  errorDescription: string | null;
} {
  try {
    // Handle both custom scheme and https URLs
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    return {
      code: params.get('code'),
      error: params.get('error'),
      errorDescription: params.get('error_description'),
    };
  } catch (error) {
    console.warn('[linking] Failed to parse OAuth callback URL:', error);
    return {
      code: null,
      error: null,
      errorDescription: null,
    };
  }
}

/**
 * Check if a URL is an OAuth callback URL
 *
 * @param url - The URL to check
 * @returns True if the URL is an OAuth callback
 */
export function isOAuthCallbackUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname === '/auth/callback' || urlObj.pathname.endsWith('/auth/callback');
  } catch {
    // For custom schemes like worktracker://auth/callback
    return url.includes('/auth/callback');
  }
}

export default linking;
