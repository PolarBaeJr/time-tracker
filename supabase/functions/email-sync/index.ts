/**
 * Edge Function: email-sync
 *
 * Syncs emails from connected Gmail or Outlook accounts.
 * Handles token refresh, rate limiting, and message caching.
 *
 * Authentication: Requires valid Supabase JWT
 * Method: POST
 * Body: { connectionId: string }
 * Returns: { success: boolean, message_count: number, synced_at: string } or { error: string }
 *
 * Error Handling:
 * - Invalid token: Sets sync_error, returns error
 * - Rate limit: Returns error with retry-after
 * - Network error: Sets sync_error, returns error
 * - IMAP: Returns error (IMAP sync handled separately)
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptApiKey, isEncryptionConfigured } from '../_shared/crypto.ts';
import {
  corsHeaders,
  handleCorsPreflightRequest,
  jsonResponse,
  errorResponse,
} from '../_shared/cors.ts';

// =============================================================================
// CONSTANTS
// =============================================================================

const EMAIL_SYNC_CONFIG = {
  MAX_MESSAGES_PER_SYNC: 50,
  SYNC_COOLDOWN_MS: 5 * 60 * 1000, // 5 minutes
  MAX_SNIPPET_LENGTH: 200,
} as const;

const GMAIL_CONFIG = {
  TOKEN_URL: 'https://oauth2.googleapis.com/token',
  API_BASE: 'https://gmail.googleapis.com/gmail/v1',
  CLIENT_ID: Deno.env.get('GOOGLE_CLIENT_ID') || '',
} as const;

const OUTLOOK_CONFIG = {
  TOKEN_URL: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  API_BASE: 'https://graph.microsoft.com/v1.0',
  CLIENT_ID: Deno.env.get('MICROSOFT_CLIENT_ID') || '',
  SCOPES:
    'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read offline_access',
} as const;

// =============================================================================
// TYPES
// =============================================================================

interface EmailConnection {
  id: string;
  user_id: string;
  provider: 'gmail' | 'outlook' | 'imap';
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  expires_at: string | null;
  email_address: string;
  is_active: boolean;
  last_sync_at: string | null;
  sync_error: string | null;
}

interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    headers?: GmailHeader[];
  };
  internalDate?: string;
}

interface GmailMessageList {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
}

interface OutlookMessage {
  id: string;
  subject: string | null;
  bodyPreview: string | null;
  from: {
    emailAddress: {
      name?: string;
      address: string;
    };
  };
  receivedDateTime: string;
  isRead: boolean;
  flag: {
    flagStatus: 'notFlagged' | 'flagged' | 'complete';
  };
  importance: 'low' | 'normal' | 'high';
  categories: string[];
  hasAttachments: boolean;
}

interface OutlookMessageList {
  '@odata.nextLink'?: string;
  value: OutlookMessage[];
}

interface EmailMessageRow {
  connection_id: string;
  provider_id: string;
  subject: string | null;
  sender: string;
  sender_name: string | null;
  received_at: string;
  snippet: string | null;
  is_read: boolean;
  is_starred: boolean;
  labels: string[];
  ai_summary: string | null;
}

// =============================================================================
// OAUTH TOKEN HELPERS
// =============================================================================

/**
 * Refresh Gmail access token using refresh token
 */
async function refreshGmailToken(refreshToken: string): Promise<OAuthTokens> {
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
    refresh_token: data.refresh_token || refreshToken,
    expires_in: data.expires_in,
  };
}

/**
 * Refresh Outlook access token using refresh token
 */
async function refreshOutlookToken(refreshToken: string): Promise<OAuthTokens> {
  const response = await fetch(OUTLOOK_CONFIG.TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: OUTLOOK_CONFIG.CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: OUTLOOK_CONFIG.SCOPES,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Outlook token refresh failed: ${errorData}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_in: data.expires_in,
  };
}

// =============================================================================
// GMAIL API HELPERS
// =============================================================================

/**
 * Fetch wrapper for Gmail API
 */
async function gmailApiFetch(accessToken: string, path: string): Promise<Response> {
  return fetch(`${GMAIL_CONFIG.API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

/**
 * List Gmail messages
 */
async function listGmailMessages(
  accessToken: string,
  maxResults: number
): Promise<GmailMessageList> {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    labelIds: 'INBOX',
  });

  const response = await gmailApiFetch(accessToken, `/users/me/messages?${params}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list Gmail messages: ${errorText}`);
  }

  return response.json();
}

/**
 * Get a single Gmail message with full details
 */
async function getGmailMessage(accessToken: string, messageId: string): Promise<GmailMessage> {
  const response = await gmailApiFetch(accessToken, `/users/me/messages/${messageId}?format=full`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get Gmail message ${messageId}: ${errorText}`);
  }

  return response.json();
}

/**
 * Parse Gmail headers
 */
function parseGmailHeaders(headers: GmailHeader[]): { subject: string; from: string } {
  let subject = '';
  let from = '';

  for (const header of headers) {
    const name = header.name.toLowerCase();
    if (name === 'subject') subject = header.value;
    else if (name === 'from') from = header.value;
  }

  return { subject, from };
}

/**
 * Extract email address from From header
 */
function extractEmailFromHeader(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return match ? match[1] : fromHeader.trim();
}

/**
 * Extract name from From header
 */
function extractNameFromHeader(fromHeader: string): string | null {
  const match = fromHeader.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : null;
}

/**
 * Parse Gmail message to EmailMessageRow
 */
function parseGmailMessage(message: GmailMessage, connectionId: string): EmailMessageRow {
  const headers = message.payload?.headers ?? [];
  const parsed = parseGmailHeaders(headers);

  return {
    connection_id: connectionId,
    provider_id: message.id,
    subject: parsed.subject || null,
    sender: extractEmailFromHeader(parsed.from),
    sender_name: extractNameFromHeader(parsed.from),
    received_at: message.internalDate
      ? new Date(parseInt(message.internalDate, 10)).toISOString()
      : new Date().toISOString(),
    snippet: truncateSnippet(message.snippet || null),
    is_read: !message.labelIds?.includes('UNREAD'),
    is_starred: message.labelIds?.includes('STARRED') ?? false,
    labels: message.labelIds ?? [],
    ai_summary: null,
  };
}

/**
 * Sync Gmail messages
 */
async function syncGmailMessages(
  accessToken: string,
  connectionId: string,
  maxMessages: number
): Promise<EmailMessageRow[]> {
  // List message IDs
  const messageList = await listGmailMessages(accessToken, maxMessages);

  if (!messageList.messages || messageList.messages.length === 0) {
    return [];
  }

  // Fetch full messages in batches of 10
  const BATCH_SIZE = 10;
  const messages: EmailMessageRow[] = [];

  for (let i = 0; i < messageList.messages.length; i += BATCH_SIZE) {
    const batch = messageList.messages.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async ({ id }) => {
        const fullMessage = await getGmailMessage(accessToken, id);
        return parseGmailMessage(fullMessage, connectionId);
      })
    );
    messages.push(...batchResults);
  }

  return messages;
}

// =============================================================================
// OUTLOOK API HELPERS
// =============================================================================

/**
 * Fetch wrapper for Outlook/Microsoft Graph API
 */
async function outlookApiFetch(
  accessToken: string,
  path: string,
  options?: RequestInit
): Promise<Response> {
  return fetch(`${OUTLOOK_CONFIG.API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
}

/**
 * List Outlook messages
 */
async function listOutlookMessages(
  accessToken: string,
  maxResults: number
): Promise<OutlookMessageList> {
  const params = new URLSearchParams({
    $top: String(maxResults),
    $orderby: 'receivedDateTime desc',
    $select:
      'id,subject,bodyPreview,from,receivedDateTime,isRead,flag,importance,categories,hasAttachments',
  });

  const response = await outlookApiFetch(accessToken, `/me/messages?${params}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list Outlook messages: ${errorText}`);
  }

  return response.json();
}

/**
 * Build labels array from Outlook message
 */
function buildOutlookLabels(message: OutlookMessage): string[] {
  const labels: string[] = [];

  if (message.categories?.length > 0) {
    labels.push(...message.categories);
  }

  if (message.importance === 'high') {
    labels.push('IMPORTANT');
  }

  if (message.flag?.flagStatus === 'flagged') {
    labels.push('FLAGGED');
  }

  if (message.hasAttachments) {
    labels.push('HAS_ATTACHMENTS');
  }

  return labels;
}

/**
 * Parse Outlook message to EmailMessageRow
 */
function parseOutlookMessage(message: OutlookMessage, connectionId: string): EmailMessageRow {
  const fromAddress = message.from?.emailAddress;

  return {
    connection_id: connectionId,
    provider_id: message.id,
    subject: message.subject || null,
    sender: fromAddress?.address || 'unknown',
    sender_name: fromAddress?.name || null,
    received_at: message.receivedDateTime,
    snippet: truncateSnippet(message.bodyPreview),
    is_read: message.isRead,
    is_starred: message.flag?.flagStatus === 'flagged',
    labels: buildOutlookLabels(message),
    ai_summary: null,
  };
}

/**
 * Sync Outlook messages
 */
async function syncOutlookMessages(
  accessToken: string,
  connectionId: string,
  maxMessages: number
): Promise<EmailMessageRow[]> {
  const messageList = await listOutlookMessages(accessToken, maxMessages);

  return messageList.value.map(msg => parseOutlookMessage(msg, connectionId));
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Truncate snippet to max length
 */
function truncateSnippet(snippet: string | null): string | null {
  if (!snippet) return null;

  const cleaned = snippet.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= EMAIL_SYNC_CONFIG.MAX_SNIPPET_LENGTH) {
    return cleaned;
  }

  return cleaned.slice(0, EMAIL_SYNC_CONFIG.MAX_SNIPPET_LENGTH - 3) + '...';
}

/**
 * Check if sync is within cooldown period
 */
function isWithinCooldown(lastSyncAt: string | null): boolean {
  if (!lastSyncAt) return false;

  const lastSync = new Date(lastSyncAt).getTime();
  const now = Date.now();

  return now - lastSync < EMAIL_SYNC_CONFIG.SYNC_COOLDOWN_MS;
}

/**
 * Check if token is expired or about to expire (within 5 minutes)
 */
function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;

  const expiry = new Date(expiresAt).getTime();
  const now = Date.now();
  const bufferMs = 5 * 60 * 1000; // 5 minute buffer

  return now >= expiry - bufferMs;
}

/**
 * Update connection with new tokens and expiry
 */
async function updateConnectionTokens(
  supabase: SupabaseClient,
  connectionId: string,
  userId: string,
  tokens: OAuthTokens
): Promise<void> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Encrypt the new tokens
  const encryptedAccessToken = await import('../_shared/crypto.ts').then(m =>
    m.encryptApiKey(tokens.access_token, userId)
  );
  const encryptedRefreshToken = await import('../_shared/crypto.ts').then(m =>
    m.encryptApiKey(tokens.refresh_token, userId)
  );

  const { error } = await supabase
    .from('email_connections')
    .update({
      access_token_encrypted: encryptedAccessToken,
      refresh_token_encrypted: encryptedRefreshToken,
      expires_at: expiresAt,
    })
    .eq('id', connectionId);

  if (error) {
    throw new Error(`Failed to update tokens: ${error.message}`);
  }
}

/**
 * Update connection sync status
 * Silently handles the case where connection was deleted during sync
 */
async function updateSyncStatus(
  supabase: SupabaseClient,
  connectionId: string,
  error: string | null
): Promise<boolean> {
  // First check if connection still exists to avoid confusing errors
  if (!(await connectionExists(supabase, connectionId))) {
    console.log(`Connection ${connectionId} was deleted, skipping status update`);
    return false;
  }

  const { error: updateError } = await supabase
    .from('email_connections')
    .update({
      last_sync_at: error ? undefined : new Date().toISOString(),
      sync_error: error,
    })
    .eq('id', connectionId);

  if (updateError) {
    // Connection may have been deleted between check and update
    console.warn('Failed to update sync status:', updateError.message);
    return false;
  }

  return true;
}

/**
 * Check if connection still exists (race condition protection)
 */
async function connectionExists(supabase: SupabaseClient, connectionId: string): Promise<boolean> {
  const { data } = await supabase
    .from('email_connections')
    .select('id')
    .eq('id', connectionId)
    .maybeSingle();

  return data !== null;
}

/**
 * Upsert email messages to database
 * Returns null if connection was deleted during sync (race condition)
 */
async function upsertMessages(
  supabase: SupabaseClient,
  connectionId: string,
  messages: EmailMessageRow[]
): Promise<number | null> {
  if (messages.length === 0) return 0;

  // Check if connection still exists before upserting
  // This handles the race condition where user disconnects during sync
  if (!(await connectionExists(supabase, connectionId))) {
    console.log(`Connection ${connectionId} was deleted during sync, skipping upsert`);
    return null;
  }

  const { error, data } = await supabase
    .from('email_messages')
    .upsert(messages, {
      onConflict: 'connection_id,provider_id',
      ignoreDuplicates: false,
    })
    .select('id');

  if (error) {
    // Handle FK violation - connection was deleted between check and upsert
    if (error.code === '23503' || error.message.includes('foreign key')) {
      console.log(`Connection ${connectionId} was deleted during sync (FK violation)`);
      return null;
    }
    throw new Error(`Failed to upsert messages: ${error.message}`);
  }

  return data?.length ?? 0;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Check encryption is configured
    if (!isEncryptionConfigured()) {
      console.error('ENCRYPTION_KEY not configured');
      return errorResponse('Server encryption not configured', 500);
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401);
    }

    // Create Supabase client with user's auth token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Parse request body
    const body = await req.json();
    const connectionId = body.connectionId;

    if (!connectionId || typeof connectionId !== 'string') {
      return errorResponse('Missing or invalid connectionId in request body', 400);
    }

    // Validate connectionId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(connectionId)) {
      return errorResponse('Invalid connectionId format', 400);
    }

    // Fetch the email connection
    const { data: connection, error: connectionError } = await supabase
      .from('email_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (connectionError || !connection) {
      return errorResponse('Email connection not found', 404);
    }

    const emailConnection = connection as EmailConnection;

    // Verify user owns this connection
    if (emailConnection.user_id !== user.id) {
      return errorResponse('Unauthorized access to email connection', 403);
    }

    // Check if connection is active
    if (!emailConnection.is_active) {
      return errorResponse('Email connection is not active', 400);
    }

    // Check for IMAP provider - not supported in this function
    if (emailConnection.provider === 'imap') {
      return errorResponse('IMAP sync is not supported in this endpoint', 400);
    }

    // Check sync cooldown
    if (isWithinCooldown(emailConnection.last_sync_at)) {
      const cooldownRemaining = Math.ceil(
        (EMAIL_SYNC_CONFIG.SYNC_COOLDOWN_MS -
          (Date.now() - new Date(emailConnection.last_sync_at!).getTime())) /
          1000
      );
      return jsonResponse(
        {
          success: false,
          error: `Sync cooldown in effect. Please wait ${cooldownRemaining} seconds.`,
          retryAfter: cooldownRemaining,
        },
        429
      );
    }

    // Verify tokens exist
    if (!emailConnection.access_token_encrypted || !emailConnection.refresh_token_encrypted) {
      await updateSyncStatus(supabase, connectionId, 'Missing OAuth tokens');
      return errorResponse('Missing OAuth tokens', 400);
    }

    // Decrypt tokens
    let accessToken: string;
    let refreshToken: string;

    try {
      accessToken = await decryptApiKey(emailConnection.access_token_encrypted, user.id);
      refreshToken = await decryptApiKey(emailConnection.refresh_token_encrypted, user.id);
    } catch (decryptError) {
      await updateSyncStatus(supabase, connectionId, 'Failed to decrypt tokens');
      return errorResponse('Failed to decrypt tokens', 500);
    }

    // Check if tokens need refresh
    if (isTokenExpired(emailConnection.expires_at)) {
      console.log(`Refreshing tokens for connection ${connectionId}`);

      try {
        const newTokens =
          emailConnection.provider === 'gmail'
            ? await refreshGmailToken(refreshToken)
            : await refreshOutlookToken(refreshToken);

        // Update tokens in database
        await updateConnectionTokens(supabase, connectionId, user.id, newTokens);

        // Use the new access token
        accessToken = newTokens.access_token;
        refreshToken = newTokens.refresh_token;
      } catch (refreshError) {
        const errorMessage =
          refreshError instanceof Error ? refreshError.message : 'Token refresh failed';
        await updateSyncStatus(supabase, connectionId, errorMessage);

        // Check if it's a revoked token error
        if (
          errorMessage.includes('invalid_grant') ||
          errorMessage.includes('Token has been revoked')
        ) {
          return errorResponse('OAuth token has been revoked. Please reconnect your email.', 401);
        }

        return errorResponse(`Token refresh failed: ${errorMessage}`, 500);
      }
    }

    // Sync messages based on provider
    let messages: EmailMessageRow[];

    try {
      messages =
        emailConnection.provider === 'gmail'
          ? await syncGmailMessages(
              accessToken,
              connectionId,
              EMAIL_SYNC_CONFIG.MAX_MESSAGES_PER_SYNC
            )
          : await syncOutlookMessages(
              accessToken,
              connectionId,
              EMAIL_SYNC_CONFIG.MAX_MESSAGES_PER_SYNC
            );
    } catch (syncError) {
      const errorMessage = syncError instanceof Error ? syncError.message : 'Sync failed';
      await updateSyncStatus(supabase, connectionId, errorMessage);

      // Check for rate limiting
      if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
        return jsonResponse(
          {
            success: false,
            error: 'Rate limited by email provider. Please try again later.',
            retryAfter: 60,
          },
          429
        );
      }

      // Check for auth errors
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        return errorResponse('OAuth token invalid. Please reconnect your email.', 401);
      }

      return errorResponse(`Sync failed: ${errorMessage}`, 500);
    }

    // Upsert messages to database
    let messageCount: number | null;

    try {
      messageCount = await upsertMessages(supabase, connectionId, messages);
    } catch (upsertError) {
      const errorMessage = upsertError instanceof Error ? upsertError.message : 'Database error';
      await updateSyncStatus(supabase, connectionId, errorMessage);
      return errorResponse(`Failed to save messages: ${errorMessage}`, 500);
    }

    // Handle race condition: connection was deleted during sync
    if (messageCount === null) {
      return jsonResponse({
        success: false,
        error: 'Email connection was disconnected during sync',
        disconnected: true,
      });
    }

    // Update sync status (success)
    await updateSyncStatus(supabase, connectionId, null);

    return jsonResponse({
      success: true,
      message_count: messageCount,
      synced_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Email sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Email sync failed: ${message}`, 500);
  }
});
