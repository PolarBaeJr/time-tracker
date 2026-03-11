/**
 * Email OAuth PKCE helpers and API wrappers for Gmail and Outlook
 *
 * Implements the OAuth 2.0 PKCE flow for secure email provider authentication.
 * PKCE (Proof Key for Code Exchange) is used for public clients and doesn't
 * require client secrets.
 */

import { GMAIL_CONFIG, OUTLOOK_EMAIL_CONFIG } from './constants';

/**
 * OAuth tokens returned from token exchange or refresh
 */
export type OAuthTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

/**
 * Generate a random code verifier for PKCE (128 characters)
 *
 * The code verifier is a cryptographically random string used to correlate
 * the authorization request to the token request.
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(96);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 128);
}

/**
 * Generate a code challenge from a verifier using SHA256 + base64url
 *
 * The code challenge is sent in the authorization request and the verifier
 * is sent in the token request to prove the same client made both requests.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  // Convert to base64url: replace + with -, / with _, and remove trailing =
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Build Gmail OAuth authorization URL with PKCE params
 *
 * @param options.codeChallenge - PKCE code challenge (SHA256 hash of verifier)
 * @param options.redirectUri - URI to redirect to after authorization
 * @param options.state - Opaque value to maintain state between request and callback
 */
export function buildGmailAuthorizeUrl({
  codeChallenge,
  redirectUri,
  state,
}: {
  codeChallenge: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: GMAIL_CONFIG.CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: GMAIL_CONFIG.SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    state,
    access_type: 'offline', // Request refresh token
    prompt: 'consent', // Force consent to get refresh token
  });
  return `${GMAIL_CONFIG.AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Build Outlook Email OAuth authorization URL with PKCE params
 *
 * @param options.codeChallenge - PKCE code challenge (SHA256 hash of verifier)
 * @param options.redirectUri - URI to redirect to after authorization
 * @param options.state - Opaque value to maintain state between request and callback
 */
export function buildOutlookEmailAuthorizeUrl({
  codeChallenge,
  redirectUri,
  state,
}: {
  codeChallenge: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: OUTLOOK_EMAIL_CONFIG.CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: OUTLOOK_EMAIL_CONFIG.SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    state,
    response_mode: 'query',
  });
  return `${OUTLOOK_EMAIL_CONFIG.AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange Gmail authorization code for access and refresh tokens
 *
 * @param options.code - Authorization code from OAuth callback
 * @param options.codeVerifier - PKCE code verifier (must match challenge)
 * @param options.redirectUri - Same redirect URI used in authorization request
 * @throws Error if token exchange fails
 */
export async function exchangeGmailCodeForTokens({
  code,
  codeVerifier,
  redirectUri,
}: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<OAuthTokens> {
  const response = await fetch(GMAIL_CONFIG.TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GMAIL_CONFIG.CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Gmail token exchange failed: ${errorData}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  };
}

/**
 * Exchange Outlook authorization code for access and refresh tokens
 *
 * @param options.code - Authorization code from OAuth callback
 * @param options.codeVerifier - PKCE code verifier (must match challenge)
 * @param options.redirectUri - Same redirect URI used in authorization request
 * @throws Error if token exchange fails
 */
export async function exchangeOutlookCodeForTokens({
  code,
  codeVerifier,
  redirectUri,
}: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<OAuthTokens> {
  const response = await fetch(OUTLOOK_EMAIL_CONFIG.TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: OUTLOOK_EMAIL_CONFIG.CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      scope: OUTLOOK_EMAIL_CONFIG.SCOPES,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Outlook token exchange failed: ${errorData}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  };
}

/**
 * Refresh Gmail access token using refresh token
 *
 * @param refreshToken - The refresh token obtained from initial authorization
 * @throws Error if token refresh fails (e.g., token revoked)
 */
export async function refreshGmailToken(refreshToken: string): Promise<OAuthTokens> {
  const response = await fetch(GMAIL_CONFIG.TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GMAIL_CONFIG.CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Gmail token refresh failed: ${errorData}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    // Gmail may not return a new refresh token, keep the old one
    refresh_token: data.refresh_token || refreshToken,
    expires_in: data.expires_in,
  };
}

/**
 * Refresh Outlook access token using refresh token
 *
 * @param refreshToken - The refresh token obtained from initial authorization
 * @throws Error if token refresh fails (e.g., token revoked)
 */
export async function refreshOutlookToken(refreshToken: string): Promise<OAuthTokens> {
  const response = await fetch(OUTLOOK_EMAIL_CONFIG.TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: OUTLOOK_EMAIL_CONFIG.CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: OUTLOOK_EMAIL_CONFIG.SCOPES,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Outlook token refresh failed: ${errorData}`);
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
 * Wrapper for Gmail API calls with authentication
 *
 * @param accessToken - Valid Gmail access token
 * @param path - API path (e.g., '/users/me/messages')
 * @param options - Additional fetch options
 * @returns Response object from the API call
 */
export async function gmailApiFetch(
  accessToken: string,
  path: string,
  options?: RequestInit
): Promise<Response> {
  return fetch(`${GMAIL_CONFIG.API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options?.headers,
    },
  });
}

/**
 * Wrapper for Outlook/Microsoft Graph API calls with authentication
 *
 * @param accessToken - Valid Outlook access token
 * @param path - API path (e.g., '/me/messages')
 * @param options - Additional fetch options
 * @returns Response object from the API call
 */
export async function outlookApiFetch(
  accessToken: string,
  path: string,
  options?: RequestInit
): Promise<Response> {
  return fetch(`${OUTLOOK_EMAIL_CONFIG.API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options?.headers,
    },
  });
}
