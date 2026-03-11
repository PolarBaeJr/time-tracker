/**
 * Navigation Module
 *
 * Exports the main navigation components and types for the app.
 * Provides a NavigationContainer wrapper with theme integration.
 */

import * as React from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { Linking, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { exchangeCodeForTokens } from '@/lib/spotify';
import { queryClient, queryKeys } from '@/lib/queryClient';
import { useTheme } from '@/theme';

import { RootNavigator } from './RootNavigator';

// Re-export navigation components
export { RootNavigator } from './RootNavigator';
export { MainTabs } from './MainTabs';

// Re-export types
export * from './types';

/**
 * Navigation Provider Props
 */
interface NavigationProviderProps {
  children?: React.ReactNode;
}

/**
 * Navigation Provider Component
 *
 * Wraps the app with NavigationContainer and applies the custom theme.
 * Should be used at the root of the app inside AuthProvider.
 */
/**
 * Handle auth callback deep links before React Navigation sees them.
 *
 * On web: extracts the PKCE code and exchanges it for a session.
 * On native: only intercepts the URL to prevent navigation confusion.
 *   The code exchange is handled by AuthContext via openAuthSessionAsync,
 *   so we must NOT exchange again here (PKCE codes are single-use).
 */
/**
 * Handle Spotify OAuth callback.
 * Extracts the authorization code from the URL, exchanges it for tokens,
 * stores the connection in the database, and navigates to settings.
 */
/**
 * Debug logging for Spotify OAuth flow.
 * In development only - sanitizes sensitive data to prevent leaking auth tokens.
 */
function spotifyDebug(step: string, data?: unknown) {
  // Only log in development mode
  if (process.env.NODE_ENV === 'production') return;

  // Sanitize data to remove sensitive fields before logging
  let sanitizedData = data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    sanitizedData = { ...obj };
    // Remove or redact sensitive fields
    if ('url' in obj && typeof obj.url === 'string') {
      // Redact code and state parameters from URLs
      try {
        const url = new URL(obj.url, 'https://placeholder.com');
        if (url.searchParams.has('code')) {
          url.searchParams.set('code', '[REDACTED]');
        }
        if (url.searchParams.has('state')) {
          url.searchParams.set('state', '[REDACTED]');
        }
        (sanitizedData as Record<string, unknown>).url = url.pathname + url.search;
      } catch {
        (sanitizedData as Record<string, unknown>).url = '[URL REDACTED]';
      }
    }
    // Redact other sensitive fields
    for (const key of ['code', 'state', 'access_token', 'refresh_token', 'codeVerifier']) {
      if (key in obj) {
        (sanitizedData as Record<string, unknown>)[key] = '[REDACTED]';
      }
    }
  }
  // Only log to console, never persist to localStorage (to prevent sensitive data exposure)
  console.log(`[Spotify] ${step}`, sanitizedData ?? '');
}

function handleSpotifyCallback(url: string): boolean {
  if (!url.includes('/spotify/callback')) return false;

  spotifyDebug('callback_hit', { url });

  const queryString = url.split('?')[1]?.split('#')[0] ?? '';
  const params = new URLSearchParams(queryString);
  const code = params.get('code');
  const state = params.get('state');

  if (!code) {
    spotifyDebug('no_code_in_url');
    return true;
  }

  spotifyDebug('code_found', { codeLen: code.length, state });

  // Verify state matches
  const savedState = sessionStorage.getItem('spotify_oauth_state');
  if (state && savedState && state !== savedState) {
    spotifyDebug('state_mismatch', { expected: savedState, got: state });
    return true;
  }

  const codeVerifier = sessionStorage.getItem('spotify_code_verifier');
  const redirectUri = sessionStorage.getItem('spotify_redirect_uri');

  spotifyDebug('session_storage', {
    hasVerifier: !!codeVerifier,
    hasRedirectUri: !!redirectUri,
    redirectUri,
  });

  if (!codeVerifier || !redirectUri) {
    spotifyDebug('missing_session_storage');
    return true;
  }

  // Exchange code for tokens (fire-and-forget, async)
  // Wait for auth session to be restored on page reload before storing tokens
  void (async () => {
    try {
      spotifyDebug('exchanging_tokens');
      const tokens = await exchangeCodeForTokens({ code, codeVerifier, redirectUri });
      spotifyDebug('tokens_received', {
        hasAccess: !!tokens.access_token,
        hasRefresh: !!tokens.refresh_token,
        expiresIn: tokens.expires_in,
      });
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Try getSession first (reads from localStorage, available immediately)
      let userId: string | undefined;
      const { data: sessionData } = await supabase.auth.getSession();
      userId = sessionData?.session?.user?.id;
      spotifyDebug('get_session', { userId: userId ?? 'none' });

      // If session not ready yet, wait for onAuthStateChange
      if (!userId) {
        spotifyDebug('waiting_for_auth');
        userId = await new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Auth timeout')), 10000);
          const {
            data: { subscription },
          } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user?.id) {
              clearTimeout(timeout);
              subscription.unsubscribe();
              resolve(session.user.id);
            }
          });
        });
        spotifyDebug('auth_resolved', { userId });
      }

      if (!userId) throw new Error('Not authenticated');

      spotifyDebug('upserting', { userId });
      const { error } = await supabase.from('spotify_connections').upsert(
        {
          user_id: userId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

      if (error) {
        spotifyDebug('upsert_error', { message: error.message, code: error.code });
        throw new Error(error.message);
      }

      spotifyDebug('upsert_success');

      // Clean up session storage
      sessionStorage.removeItem('spotify_code_verifier');
      sessionStorage.removeItem('spotify_oauth_state');
      sessionStorage.removeItem('spotify_redirect_uri');

      // Invalidate the query cache so the UI picks up the new connection
      await queryClient.invalidateQueries({ queryKey: queryKeys.spotifyConnection });
      spotifyDebug('complete');
    } catch (err) {
      spotifyDebug('error', { message: String(err), stack: (err as Error)?.stack });
    }
  })();

  return true;
}

function handleAuthCallback(url: string): boolean {
  if (!url.includes('/auth/callback')) return false;

  const queryString = url.split('?')[1]?.split('#')[0] ?? '';
  const params = new URLSearchParams(queryString);
  const code = params.get('code');

  if (code) {
    if (Platform.OS === 'web') {
      // Web: always exchange here
      void supabase.auth.exchangeCodeForSession(code);
    } else {
      // Native: only exchange if this is a cold start (getInitialURL path).
      // When openAuthSessionAsync is active, IT handles the exchange and
      // this subscribe handler won't fire. But if the app was killed and
      // relaunched via the deep link, we need to exchange here.
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) {
          void supabase.auth.exchangeCodeForSession(code);
        }
      });
    }
  }

  return true;
}

// Handle Spotify and auth callbacks immediately on web page load,
// BEFORE React Navigation mounts (getInitialURL in linking config
// is not reliably called on React Native Web).
let webCallbackHandled = false;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const url = window.location.href;
  spotifyDebug('module_init', { url });
  if (handleSpotifyCallback(url) || handleAuthCallback(url)) {
    webCallbackHandled = true;
    // Clean the URL so React Navigation doesn't try to parse the callback path
    window.history.replaceState(null, '', '/');
  }

  // Electron: listen for Spotify PKCE callback via IPC
  if (window.desktop?.onSpotifyCallback) {
    window.desktop.onSpotifyCallback((code: string, state: string) => {
      spotifyDebug('electron_ipc_callback', { codeLen: code.length });
      // Build a synthetic URL so handleSpotifyCallback can process it
      let syntheticUrl = `/spotify/callback?code=${encodeURIComponent(code)}`;
      if (state) syntheticUrl += `&state=${encodeURIComponent(state)}`;
      handleSpotifyCallback(syntheticUrl);
    });
  }
}

const linking = {
  prefixes:
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? [window.location.origin]
      : ['worktracker://'],
  config: {
    screens: {
      Login: 'login',
      Setup: 'setup',
      Main: {
        path: '',
        screens: {
          Timer: 'timer',
          History: 'history',
          Analytics: 'analytics',
          Categories: 'categories',
          Settings: 'settings',
        },
      },
      EntryEdit: 'entry/:entryId',
    },
  },
  async getInitialURL() {
    // On web, callbacks are already handled at module scope above
    if (webCallbackHandled) return null;
    const url = await Linking.getInitialURL();
    if (url && handleSpotifyCallback(url)) return null;
    if (url && handleAuthCallback(url)) return null;
    return url;
  },
  subscribe(listener: (url: string) => void) {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (handleSpotifyCallback(url)) return;
      if (!handleAuthCallback(url)) {
        listener(url);
      }
    });
    return () => subscription.remove();
  },
};

export function NavigationProvider({ children }: NavigationProviderProps): React.ReactElement {
  const { colors, isDark } = useTheme();

  const navigationTheme: NavigationTheme = React.useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      dark: isDark,
      colors: {
        ...(isDark ? DarkTheme : DefaultTheme).colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.primary,
      },
    }),
    [colors, isDark]
  );

  return (
    <NavigationContainer theme={navigationTheme} linking={linking}>
      {children ?? <RootNavigator />}
    </NavigationContainer>
  );
}

export default NavigationProvider;
