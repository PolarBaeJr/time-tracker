/**
 * Deep Link Handler Hook for OAuth Callbacks
 *
 * This hook handles incoming deep links, specifically OAuth callback URLs.
 * It implements the PKCE flow by exchanging the authorization code for a session.
 *
 * SECURITY:
 * - NEVER passes tokens directly in callback URLs
 * - Uses Supabase's exchangeCodeForSession() for secure token exchange
 * - The authorization code is a one-time use code that expires quickly
 *
 * USAGE:
 * ```typescript
 * import { useDeepLink } from '@/hooks';
 *
 * function AuthCallbackScreen() {
 *   const { isProcessing, error, handleDeepLink } = useDeepLink({
 *     onSuccess: () => {
 *       // Navigate to main app
 *       navigation.replace('Main');
 *     },
 *     onError: (error) => {
 *       // Show error and navigate to login
 *       Alert.alert('Sign in failed', error.message);
 *       navigation.replace('Login');
 *     },
 *   });
 *
 *   useEffect(() => {
 *     // Handle the callback URL from route params or initial URL
 *     const url = route.params?.url;
 *     if (url) {
 *       handleDeepLink(url);
 *     }
 *   }, [route.params?.url]);
 *
 *   if (isProcessing) {
 *     return <LoadingScreen message="Completing sign in..." />;
 *   }
 *
 *   return <ErrorScreen error={error} />;
 * }
 * ```
 *
 * @see docs/DEEP_LINKING.md for setup instructions
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { supabase } from '@/lib';
import { isOAuthCallbackUrl, parseOAuthCallbackUrl } from '@/lib/linking';

/**
 * Error class for deep link handling errors
 */
export class DeepLinkError extends Error {
  code?: string;
  originalError?: Error;

  constructor(message: string, code?: string, originalError?: Error) {
    super(message);
    this.name = 'DeepLinkError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Options for the useDeepLink hook
 */
export interface UseDeepLinkOptions {
  /**
   * Callback when OAuth exchange succeeds
   * Called after the authorization code is exchanged for a session
   */
  onSuccess?: () => void;

  /**
   * Callback when OAuth exchange fails
   * Called when the code exchange fails or the callback URL contains an error
   */
  onError?: (error: DeepLinkError) => void;

  /**
   * Whether to automatically handle the initial URL on mount
   * @default true
   */
  handleInitialUrl?: boolean;

  /**
   * Whether to subscribe to incoming URLs while the component is mounted
   * @default true
   */
  subscribeToUrls?: boolean;
}

/**
 * Result of the useDeepLink hook
 */
export interface UseDeepLinkResult {
  /**
   * Whether an OAuth exchange is currently in progress
   */
  isProcessing: boolean;

  /**
   * The last error that occurred, if any
   */
  error: DeepLinkError | null;

  /**
   * Clear the error state
   */
  clearError: () => void;

  /**
   * Manually handle a deep link URL
   * Use this when you receive a URL from navigation params
   *
   * @param url - The deep link URL to handle
   * @returns Promise that resolves when handling is complete
   */
  handleDeepLink: (url: string) => Promise<void>;
}

/**
 * Hook to handle deep links and OAuth callbacks
 *
 * This hook:
 * 1. Listens for incoming deep links (on native)
 * 2. Handles OAuth callback URLs by exchanging the code for a session
 * 3. Provides status and error state for UI feedback
 *
 * @param options - Configuration options
 * @returns Object with processing state and handler functions
 */
export function useDeepLink(options: UseDeepLinkOptions = {}): UseDeepLinkResult {
  const {
    onSuccess,
    onError,
    handleInitialUrl = true,
    subscribeToUrls = true,
  } = options;

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<DeepLinkError | null>(null);

  // Track if we've already processed a URL to avoid duplicate processing
  const processedUrlsRef = useRef<Set<string>>(new Set());
  const isProcessingRef = useRef(false);

  /**
   * Clear the error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Exchange an authorization code for a session
   *
   * This is the critical security step in the PKCE flow.
   * The code is exchanged server-side for tokens, preventing token interception.
   *
   * @param code - The authorization code from the OAuth callback
   */
  const exchangeCodeForSession = useCallback(async (code: string): Promise<void> => {
    try {
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        throw new DeepLinkError(
          exchangeError.message || 'Failed to exchange authorization code',
          'EXCHANGE_FAILED',
          exchangeError
        );
      }

      if (!data.session) {
        throw new DeepLinkError(
          'No session returned from code exchange',
          'NO_SESSION'
        );
      }

      // Success! The auth state change listener in AuthContext will update the UI
      onSuccess?.();
    } catch (err) {
      const deepLinkError =
        err instanceof DeepLinkError
          ? err
          : new DeepLinkError(
              err instanceof Error ? err.message : 'Unknown error during code exchange',
              'UNKNOWN',
              err instanceof Error ? err : undefined
            );

      setError(deepLinkError);
      onError?.(deepLinkError);
      throw deepLinkError;
    }
  }, [onSuccess, onError]);

  /**
   * Handle a deep link URL
   *
   * If the URL is an OAuth callback, extract the code and exchange it for a session.
   * If the URL contains an error, create an appropriate error state.
   *
   * @param url - The deep link URL to handle
   */
  const handleDeepLink = useCallback(async (url: string): Promise<void> => {
    // Skip if we've already processed this URL
    if (processedUrlsRef.current.has(url)) {
      return;
    }

    // Skip if we're already processing a URL
    if (isProcessingRef.current) {
      return;
    }

    // Check if this is an OAuth callback
    if (!isOAuthCallbackUrl(url)) {
      // Not an OAuth callback - let React Navigation handle it
      return;
    }

    // Mark as processing
    processedUrlsRef.current.add(url);
    isProcessingRef.current = true;
    setIsProcessing(true);
    setError(null);

    try {
      const { code, error: oauthError, errorDescription } = parseOAuthCallbackUrl(url);

      // Check for OAuth errors in the callback URL
      if (oauthError) {
        throw new DeepLinkError(
          errorDescription || oauthError || 'OAuth authentication failed',
          `OAUTH_${oauthError.toUpperCase()}`
        );
      }

      // Ensure we have an authorization code
      if (!code) {
        throw new DeepLinkError(
          'No authorization code in callback URL',
          'NO_CODE'
        );
      }

      // Exchange the code for a session
      await exchangeCodeForSession(code);
    } catch (err) {
      // Error already handled in exchangeCodeForSession
      if (!(err instanceof DeepLinkError)) {
        const deepLinkError = new DeepLinkError(
          err instanceof Error ? err.message : 'Failed to handle OAuth callback',
          'HANDLE_FAILED',
          err instanceof Error ? err : undefined
        );
        setError(deepLinkError);
        onError?.(deepLinkError);
      }
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  }, [exchangeCodeForSession, onError]);

  // Handle initial URL on mount
  useEffect(() => {
    if (!handleInitialUrl) {
      return;
    }

    const checkInitialUrl = async (): Promise<void> => {
      try {
        // On web, check the current URL
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const url = window.location.href;
          if (isOAuthCallbackUrl(url)) {
            await handleDeepLink(url);

            // Clean up the URL after handling (remove query params)
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
          }
          return;
        }

        // On native, check the initial URL
        const url = await Linking.getInitialURL();
        if (url && isOAuthCallbackUrl(url)) {
          await handleDeepLink(url);
        }
      } catch (err) {
        console.warn('[useDeepLink] Failed to check initial URL:', err);
      }
    };

    void checkInitialUrl();
  }, [handleInitialUrl, handleDeepLink]);

  // Subscribe to incoming URLs on native
  useEffect(() => {
    if (!subscribeToUrls || Platform.OS === 'web') {
      return;
    }

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (isOAuthCallbackUrl(url)) {
        void handleDeepLink(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [subscribeToUrls, handleDeepLink]);

  return {
    isProcessing,
    error,
    clearError,
    handleDeepLink,
  };
}

export default useDeepLink;
