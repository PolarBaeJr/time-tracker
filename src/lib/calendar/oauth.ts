/**
 * Calendar OAuth PKCE helpers and API wrappers for Google Calendar and Outlook Calendar
 *
 * Implements the OAuth 2.0 PKCE flow for secure calendar provider authentication.
 * PKCE (Proof Key for Code Exchange) is used for public clients and doesn't
 * require client secrets.
 *
 * Re-exports generateCodeVerifier and generateCodeChallenge from email/oauth.ts
 * for shared PKCE functionality across email and calendar OAuth flows.
 */

import { GOOGLE_CALENDAR_CONFIG, OUTLOOK_CALENDAR_CONFIG } from './constants';

// Re-export PKCE helpers from email/oauth for shared use
export { generateCodeVerifier, generateCodeChallenge, type OAuthTokens } from '../email/oauth';

// Import for internal use
import type { OAuthTokens } from '../email/oauth';

/**
 * Build Google Calendar OAuth authorization URL with PKCE params
 *
 * @param options.codeChallenge - PKCE code challenge (SHA256 hash of verifier)
 * @param options.redirectUri - URI to redirect to after authorization
 * @param options.state - Opaque value to maintain state between request and callback
 */
export function buildGoogleCalendarAuthorizeUrl({
  codeChallenge,
  redirectUri,
  state,
}: {
  codeChallenge: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CALENDAR_CONFIG.CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: GOOGLE_CALENDAR_CONFIG.SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    state,
    access_type: 'offline', // Request refresh token
    prompt: 'consent', // Force consent to get refresh token
  });
  return `${GOOGLE_CALENDAR_CONFIG.AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Build Outlook Calendar OAuth authorization URL with PKCE params
 *
 * @param options.codeChallenge - PKCE code challenge (SHA256 hash of verifier)
 * @param options.redirectUri - URI to redirect to after authorization
 * @param options.state - Opaque value to maintain state between request and callback
 */
export function buildOutlookCalendarAuthorizeUrl({
  codeChallenge,
  redirectUri,
  state,
}: {
  codeChallenge: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: OUTLOOK_CALENDAR_CONFIG.CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: OUTLOOK_CALENDAR_CONFIG.SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    state,
    response_mode: 'query',
  });
  return `${OUTLOOK_CALENDAR_CONFIG.AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange Google Calendar authorization code for access and refresh tokens
 *
 * @param options.code - Authorization code from OAuth callback
 * @param options.codeVerifier - PKCE code verifier (must match challenge)
 * @param options.redirectUri - Same redirect URI used in authorization request
 * @throws Error if token exchange fails
 */
export async function exchangeGoogleCalendarCodeForTokens({
  code,
  codeVerifier,
  redirectUri,
}: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<OAuthTokens> {
  const response = await fetch(GOOGLE_CALENDAR_CONFIG.TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CALENDAR_CONFIG.CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Google Calendar token exchange failed: ${errorData}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  };
}

/**
 * Exchange Outlook Calendar authorization code for access and refresh tokens
 *
 * @param options.code - Authorization code from OAuth callback
 * @param options.codeVerifier - PKCE code verifier (must match challenge)
 * @param options.redirectUri - Same redirect URI used in authorization request
 * @throws Error if token exchange fails
 */
export async function exchangeOutlookCalendarCodeForTokens({
  code,
  codeVerifier,
  redirectUri,
}: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<OAuthTokens> {
  const response = await fetch(OUTLOOK_CALENDAR_CONFIG.TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: OUTLOOK_CALENDAR_CONFIG.CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      scope: OUTLOOK_CALENDAR_CONFIG.SCOPES,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Outlook Calendar token exchange failed: ${errorData}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  };
}

/**
 * Refresh Google Calendar access token using refresh token
 *
 * @param refreshToken - The refresh token obtained from initial authorization
 * @throws Error if token refresh fails (e.g., token revoked)
 */
export async function refreshGoogleCalendarToken(refreshToken: string): Promise<OAuthTokens> {
  const response = await fetch(GOOGLE_CALENDAR_CONFIG.TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CALENDAR_CONFIG.CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Google Calendar token refresh failed: ${errorData}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    // Google may not return a new refresh token, keep the old one
    refresh_token: data.refresh_token || refreshToken,
    expires_in: data.expires_in,
  };
}

/**
 * Refresh Outlook Calendar access token using refresh token
 *
 * @param refreshToken - The refresh token obtained from initial authorization
 * @throws Error if token refresh fails (e.g., token revoked)
 */
export async function refreshOutlookCalendarToken(refreshToken: string): Promise<OAuthTokens> {
  const response = await fetch(OUTLOOK_CALENDAR_CONFIG.TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: OUTLOOK_CALENDAR_CONFIG.CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: OUTLOOK_CALENDAR_CONFIG.SCOPES,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Outlook Calendar token refresh failed: ${errorData}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    // Outlook typically returns a new refresh token
    refresh_token: data.refresh_token || refreshToken,
    expires_in: data.expires_in,
  };
}

/**
 * Wrapper for Google Calendar API calls with authentication
 *
 * @param accessToken - Valid Google Calendar access token
 * @param path - API path (e.g., '/calendars/primary/events')
 * @param options - Additional fetch options
 * @returns Response object from the API call
 */
export async function googleCalendarApiFetch(
  accessToken: string,
  path: string,
  options?: RequestInit
): Promise<Response> {
  return fetch(`${GOOGLE_CALENDAR_CONFIG.API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options?.headers,
    },
  });
}

/**
 * Wrapper for Outlook Calendar/Microsoft Graph API calls with authentication
 *
 * @param accessToken - Valid Outlook access token
 * @param path - API path (e.g., '/me/calendars')
 * @param options - Additional fetch options
 * @returns Response object from the API call
 */
export async function outlookCalendarApiFetch(
  accessToken: string,
  path: string,
  options?: RequestInit
): Promise<Response> {
  return fetch(`${OUTLOOK_CALENDAR_CONFIG.API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options?.headers,
    },
  });
}
