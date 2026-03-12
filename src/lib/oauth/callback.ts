/**
 * OAuth Callback Handlers for Email and Calendar Integrations
 *
 * This module provides unified callback handling for all OAuth providers:
 * - Gmail (email)
 * - Outlook (email)
 * - Google Calendar
 * - Outlook Calendar
 *
 * Follows the same pattern as Spotify OAuth handling in navigation/index.tsx
 */

import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { queryClient, queryKeys } from '@/lib/queryClient';
import { exchangeGmailCodeForTokens, exchangeOutlookCodeForTokens } from '@/lib/email/oauth';
import {
  exchangeGoogleCalendarCodeForTokens,
  exchangeOutlookCalendarCodeForTokens,
} from '@/lib/calendar/oauth';
import { encryptApiKey } from '@/lib/crypto';

// ============================================================================
// TYPES
// ============================================================================

export type OAuthCallbackType = 'gmail' | 'outlook_email' | 'google_calendar' | 'outlook_calendar';

export interface OAuthCallbackResult {
  success: boolean;
  type: OAuthCallbackType;
  error?: string;
  connectionId?: string;
  emailAddress?: string;
}

// ============================================================================
// DEBUG LOGGING
// ============================================================================

/**
 * Debug logging for OAuth flow.
 * Only logs in development mode and sanitizes sensitive data.
 */
function oauthDebug(type: string, step: string, data?: unknown) {
  if (process.env.NODE_ENV === 'production') return;

  let sanitizedData = data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    sanitizedData = { ...obj };
    // Redact sensitive fields
    for (const key of ['code', 'state', 'access_token', 'refresh_token', 'codeVerifier']) {
      if (key in obj) {
        (sanitizedData as Record<string, unknown>)[key] = '[REDACTED]';
      }
    }
    // Redact URL parameters
    if ('url' in obj && typeof obj.url === 'string') {
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
  }
  console.log(`[OAuth:${type}] ${step}`, sanitizedData ?? '');
}

// ============================================================================
// URL DETECTION
// ============================================================================

/**
 * Detect which OAuth callback type a URL matches
 */
export function detectOAuthCallbackType(url: string): OAuthCallbackType | null {
  if (url.includes('/email/gmail/callback')) return 'gmail';
  if (url.includes('/email/outlook/callback')) return 'outlook_email';
  // Calendar uses a shared callback URL, check provider from sessionStorage
  if (url.includes('/calendar/callback')) {
    const provider = sessionStorage.getItem('calendar_provider');
    if (provider === 'google') return 'google_calendar';
    if (provider === 'outlook') return 'outlook_calendar';
    // Fallback: try to detect from state or default to google
    return 'google_calendar';
  }
  if (url.includes('/calendar/google/callback')) return 'google_calendar';
  if (url.includes('/calendar/outlook/callback')) return 'outlook_calendar';
  return null;
}

/**
 * Check if a URL is any OAuth callback
 */
export function isOAuthCallback(url: string): boolean {
  return detectOAuthCallbackType(url) !== null;
}

// ============================================================================
// CALLBACK HANDLERS
// ============================================================================

/**
 * Parse URL parameters from an OAuth callback URL
 */
function parseCallbackParams(url: string): {
  code: string | null;
  state: string | null;
  error: string | null;
  errorDescription: string | null;
} {
  const queryString = url.split('?')[1]?.split('#')[0] ?? '';
  const params = new URLSearchParams(queryString);
  return {
    code: params.get('code'),
    state: params.get('state'),
    error: params.get('error'),
    errorDescription: params.get('error_description'),
  };
}

/**
 * Handle Gmail OAuth callback
 */
async function handleGmailCallback(code: string): Promise<OAuthCallbackResult> {
  const codeVerifier = sessionStorage.getItem('gmail_code_verifier');
  const redirectUri = sessionStorage.getItem('gmail_redirect_uri');
  const savedState = sessionStorage.getItem('gmail_oauth_state');

  oauthDebug('gmail', 'callback_start', {
    hasVerifier: !!codeVerifier,
    hasRedirectUri: !!redirectUri,
    hasSavedState: !!savedState,
  });

  if (!codeVerifier || !redirectUri) {
    return {
      success: false,
      type: 'gmail',
      error: 'Missing OAuth state. Please try connecting again.',
    };
  }

  try {
    oauthDebug('gmail', 'exchanging_tokens');
    const tokens = await exchangeGmailCodeForTokens({
      code,
      codeVerifier,
      redirectUri,
    });
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Wait for auth session
    const userId = await waitForAuthSession();
    if (!userId) {
      return { success: false, type: 'gmail', error: 'Not authenticated' };
    }

    // Fetch user's email from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userInfoResponse.ok) {
      return {
        success: false,
        type: 'gmail',
        error: 'Failed to fetch Google user info',
      };
    }
    const userInfo = await userInfoResponse.json();
    const emailAddress = userInfo.email;

    if (!emailAddress) {
      return {
        success: false,
        type: 'gmail',
        error: 'Could not retrieve email address from Google',
      };
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = await encryptApiKey(tokens.access_token, userId);
    const encryptedRefreshToken = await encryptApiKey(tokens.refresh_token, userId);

    // Upsert into email_connections
    const { data, error } = await supabase
      .from('email_connections')
      .upsert(
        {
          user_id: userId,
          provider: 'gmail',
          email_address: emailAddress,
          access_token_encrypted: encryptedAccessToken,
          refresh_token_encrypted: encryptedRefreshToken,
          expires_at: expiresAt,
          is_active: true,
          sync_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,email_address' }
      )
      .select('id')
      .single();

    if (error) {
      return { success: false, type: 'gmail', error: error.message };
    }

    // Clean up session storage
    sessionStorage.removeItem('gmail_code_verifier');
    sessionStorage.removeItem('gmail_oauth_state');
    sessionStorage.removeItem('gmail_redirect_uri');

    // Invalidate queries
    await queryClient.invalidateQueries({
      queryKey: queryKeys.emailConnections,
    });

    oauthDebug('gmail', 'complete', { emailAddress });
    return {
      success: true,
      type: 'gmail',
      connectionId: data.id,
      emailAddress,
    };
  } catch (err) {
    oauthDebug('gmail', 'error', { message: String(err) });
    return { success: false, type: 'gmail', error: String(err) };
  }
}

/**
 * Handle Outlook Email OAuth callback
 */
async function handleOutlookEmailCallback(code: string): Promise<OAuthCallbackResult> {
  const codeVerifier = sessionStorage.getItem('outlook_code_verifier');
  const redirectUri = sessionStorage.getItem('outlook_redirect_uri');

  oauthDebug('outlook_email', 'callback_start', {
    hasVerifier: !!codeVerifier,
    hasRedirectUri: !!redirectUri,
  });

  if (!codeVerifier || !redirectUri) {
    return {
      success: false,
      type: 'outlook_email',
      error: 'Missing OAuth state. Please try connecting again.',
    };
  }

  try {
    oauthDebug('outlook_email', 'exchanging_tokens');
    const tokens = await exchangeOutlookCodeForTokens({
      code,
      codeVerifier,
      redirectUri,
    });
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Wait for auth session
    const userId = await waitForAuthSession();
    if (!userId) {
      return {
        success: false,
        type: 'outlook_email',
        error: 'Not authenticated',
      };
    }

    // Fetch user's email from Microsoft Graph
    const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userInfoResponse.ok) {
      return {
        success: false,
        type: 'outlook_email',
        error: 'Failed to fetch Microsoft user info',
      };
    }
    const userInfo = await userInfoResponse.json();
    const emailAddress = userInfo.mail || userInfo.userPrincipalName;

    if (!emailAddress) {
      return {
        success: false,
        type: 'outlook_email',
        error: 'Could not retrieve email address from Microsoft',
      };
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = await encryptApiKey(tokens.access_token, userId);
    const encryptedRefreshToken = await encryptApiKey(tokens.refresh_token, userId);

    // Upsert into email_connections
    const { data, error } = await supabase
      .from('email_connections')
      .upsert(
        {
          user_id: userId,
          provider: 'outlook',
          email_address: emailAddress,
          access_token_encrypted: encryptedAccessToken,
          refresh_token_encrypted: encryptedRefreshToken,
          expires_at: expiresAt,
          is_active: true,
          sync_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,email_address' }
      )
      .select('id')
      .single();

    if (error) {
      return { success: false, type: 'outlook_email', error: error.message };
    }

    // Clean up session storage
    sessionStorage.removeItem('outlook_code_verifier');
    sessionStorage.removeItem('outlook_oauth_state');
    sessionStorage.removeItem('outlook_redirect_uri');

    // Invalidate queries
    await queryClient.invalidateQueries({
      queryKey: queryKeys.emailConnections,
    });

    oauthDebug('outlook_email', 'complete', { emailAddress });
    return {
      success: true,
      type: 'outlook_email',
      connectionId: data.id,
      emailAddress,
    };
  } catch (err) {
    oauthDebug('outlook_email', 'error', { message: String(err) });
    return { success: false, type: 'outlook_email', error: String(err) };
  }
}

/**
 * Handle Google Calendar OAuth callback
 */
async function handleGoogleCalendarCallback(code: string): Promise<OAuthCallbackResult> {
  const codeVerifier = sessionStorage.getItem('calendar_code_verifier');
  const redirectUri = sessionStorage.getItem('calendar_redirect_uri');

  oauthDebug('google_calendar', 'callback_start', {
    hasVerifier: !!codeVerifier,
    hasRedirectUri: !!redirectUri,
  });

  if (!codeVerifier || !redirectUri) {
    return {
      success: false,
      type: 'google_calendar',
      error: 'Missing OAuth state. Please try connecting again.',
    };
  }

  try {
    oauthDebug('google_calendar', 'exchanging_tokens');
    const tokens = await exchangeGoogleCalendarCodeForTokens({
      code,
      codeVerifier,
      redirectUri,
    });
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Wait for auth session
    const userId = await waitForAuthSession();
    if (!userId) {
      return {
        success: false,
        type: 'google_calendar',
        error: 'Not authenticated',
      };
    }

    // Fetch user's email from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    let emailAddress = 'unknown@calendar';
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      emailAddress = userInfo.email || emailAddress;
    }

    // Insert into calendar_connections
    const { data, error } = await supabase
      .from('calendar_connections')
      .insert({
        user_id: userId,
        provider: 'google',
        email_address: emailAddress,
        access_token_encrypted: tokens.access_token, // Note: Calendar uses different storage pattern
        refresh_token_encrypted: tokens.refresh_token,
        expires_at: expiresAt,
        is_active: true,
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, type: 'google_calendar', error: error.message };
    }

    // Clean up session storage
    sessionStorage.removeItem('calendar_code_verifier');
    sessionStorage.removeItem('calendar_oauth_state');
    sessionStorage.removeItem('calendar_redirect_uri');
    sessionStorage.removeItem('calendar_provider');

    // Invalidate queries
    await queryClient.invalidateQueries({
      queryKey: queryKeys.calendarConnections,
    });

    oauthDebug('google_calendar', 'complete', { emailAddress });
    return {
      success: true,
      type: 'google_calendar',
      connectionId: data.id,
      emailAddress,
    };
  } catch (err) {
    oauthDebug('google_calendar', 'error', { message: String(err) });
    return { success: false, type: 'google_calendar', error: String(err) };
  }
}

/**
 * Handle Outlook Calendar OAuth callback
 */
async function handleOutlookCalendarCallback(code: string): Promise<OAuthCallbackResult> {
  const codeVerifier = sessionStorage.getItem('calendar_code_verifier');
  const redirectUri = sessionStorage.getItem('calendar_redirect_uri');

  oauthDebug('outlook_calendar', 'callback_start', {
    hasVerifier: !!codeVerifier,
    hasRedirectUri: !!redirectUri,
  });

  if (!codeVerifier || !redirectUri) {
    return {
      success: false,
      type: 'outlook_calendar',
      error: 'Missing OAuth state. Please try connecting again.',
    };
  }

  try {
    oauthDebug('outlook_calendar', 'exchanging_tokens');
    const tokens = await exchangeOutlookCalendarCodeForTokens({
      code,
      codeVerifier,
      redirectUri,
    });
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Wait for auth session
    const userId = await waitForAuthSession();
    if (!userId) {
      return {
        success: false,
        type: 'outlook_calendar',
        error: 'Not authenticated',
      };
    }

    // Fetch user's email from Microsoft Graph
    const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    let emailAddress = 'unknown@calendar';
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      emailAddress = userInfo.mail || userInfo.userPrincipalName || emailAddress;
    }

    // Insert into calendar_connections
    const { data, error } = await supabase
      .from('calendar_connections')
      .insert({
        user_id: userId,
        provider: 'outlook',
        email_address: emailAddress,
        access_token_encrypted: tokens.access_token,
        refresh_token_encrypted: tokens.refresh_token,
        expires_at: expiresAt,
        is_active: true,
      })
      .select('id')
      .single();

    if (error) {
      return {
        success: false,
        type: 'outlook_calendar',
        error: error.message,
      };
    }

    // Clean up session storage
    sessionStorage.removeItem('calendar_code_verifier');
    sessionStorage.removeItem('calendar_oauth_state');
    sessionStorage.removeItem('calendar_redirect_uri');
    sessionStorage.removeItem('calendar_provider');

    // Invalidate queries
    await queryClient.invalidateQueries({
      queryKey: queryKeys.calendarConnections,
    });

    oauthDebug('outlook_calendar', 'complete', { emailAddress });
    return {
      success: true,
      type: 'outlook_calendar',
      connectionId: data.id,
      emailAddress,
    };
  } catch (err) {
    oauthDebug('outlook_calendar', 'error', { message: String(err) });
    return { success: false, type: 'outlook_calendar', error: String(err) };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Wait for auth session to be available (with timeout)
 */
async function waitForAuthSession(): Promise<string | null> {
  // Try getSession first (reads from localStorage, available immediately)
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session?.user?.id) {
    return sessionData.session.user.id;
  }

  // If session not ready yet, wait for onAuthStateChange
  return new Promise<string | null>(resolve => {
    const timeout = setTimeout(() => resolve(null), 10000);
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
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Main OAuth callback handler.
 * Detects callback type from URL and routes to appropriate handler.
 *
 * @param url - The callback URL
 * @returns true if the URL was handled, false otherwise
 */
export function handleOAuthCallback(url: string): boolean {
  const callbackType = detectOAuthCallbackType(url);
  if (!callbackType) return false;

  oauthDebug(callbackType, 'callback_hit', { url });

  const { code, state, error, errorDescription } = parseCallbackParams(url);

  // Handle OAuth errors
  if (error) {
    oauthDebug(callbackType, 'oauth_error', { error, errorDescription });
    // TODO: Show user-friendly error message
    console.error(`OAuth error: ${error} - ${errorDescription}`);
    return true;
  }

  if (!code) {
    oauthDebug(callbackType, 'no_code_in_url');
    return true;
  }

  // Verify state matches (if state was used)
  const savedState = getStateKeyForType(callbackType);
  if (savedState) {
    const storedState = sessionStorage.getItem(savedState);
    if (state && storedState && state !== storedState) {
      oauthDebug(callbackType, 'state_mismatch');
      console.error('OAuth state mismatch - possible CSRF attack');
      return true;
    }
  }

  // Fire and forget - async handler
  void (async () => {
    let result: OAuthCallbackResult;

    switch (callbackType) {
      case 'gmail':
        result = await handleGmailCallback(code);
        break;
      case 'outlook_email':
        result = await handleOutlookEmailCallback(code);
        break;
      case 'google_calendar':
        result = await handleGoogleCalendarCallback(code);
        break;
      case 'outlook_calendar':
        result = await handleOutlookCalendarCallback(code);
        break;
      default:
        return;
    }

    if (!result.success) {
      console.error(`OAuth callback failed: ${result.error}`);
      // TODO: Show user-friendly error notification
    }
  })();

  return true;
}

/**
 * Get the session storage key for state validation based on callback type
 */
function getStateKeyForType(type: OAuthCallbackType): string | null {
  switch (type) {
    case 'gmail':
      return 'gmail_oauth_state';
    case 'outlook_email':
      return 'outlook_oauth_state';
    case 'google_calendar':
    case 'outlook_calendar':
      return 'calendar_oauth_state';
    default:
      return null;
  }
}

// ============================================================================
// ELECTRON IPC HANDLERS
// ============================================================================

/**
 * Setup Electron IPC listeners for OAuth callbacks.
 * Call this once at app initialization.
 */
export function setupElectronOAuthListeners(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!window.desktop) return;

  // Generic OAuth callback handler for all providers
  if (window.desktop.onOAuthCallback) {
    window.desktop.onOAuthCallback((url: string) => {
      oauthDebug('electron', 'ipc_callback', { url });
      handleOAuthCallback(url);
    });
  }
}

/**
 * Process callback URL at module load time for web.
 * Returns true if a callback was handled.
 */
export function processWebCallback(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;

  const url = window.location.href;
  if (handleOAuthCallback(url)) {
    // Clean the URL so React Navigation doesn't try to parse the callback path
    window.history.replaceState(null, '', '/');
    return true;
  }
  return false;
}
