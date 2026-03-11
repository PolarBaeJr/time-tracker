/**
 * Gmail Service Layer
 *
 * Wrapper for the Gmail API providing methods to fetch user profile,
 * list messages, and retrieve individual message details.
 *
 * Uses the Gmail API v1: https://developers.google.com/gmail/api/reference/rest
 */

import type { EmailMessage } from '@/schemas/email';
import { EMAIL_SYNC_CONFIG } from './constants';
import { gmailApiFetch } from './oauth';

// ============================================================================
// Gmail API Types
// ============================================================================

/**
 * Gmail API header format
 */
export interface GmailHeader {
  name: string;
  value: string;
}

/**
 * Gmail API message part payload
 */
export interface GmailMessagePartPayload {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: {
    size: number;
    data?: string;
  };
  parts?: GmailMessagePartPayload[];
}

/**
 * Gmail API message format
 * See: https://developers.google.com/gmail/api/reference/rest/v1/users.messages
 */
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: GmailMessagePartPayload;
  sizeEstimate?: number;
  historyId?: string;
  internalDate?: string;
}

/**
 * Gmail API message list response
 * See: https://developers.google.com/gmail/api/reference/rest/v1/users.messages/list
 */
export interface GmailMessageList {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

/**
 * Gmail API user profile response
 * See: https://developers.google.com/gmail/api/reference/rest/v1/users/getProfile
 */
export interface GmailProfile {
  emailAddress: string;
  messagesTotal?: number;
  threadsTotal?: number;
  historyId?: string;
}

// ============================================================================
// Gmail Service Class
// ============================================================================

/**
 * GmailService - Gmail API wrapper class
 *
 * Provides methods to interact with the Gmail API using a provided access token.
 * All methods handle API errors and throw descriptive error messages.
 *
 * @example
 * ```typescript
 * const service = new GmailService(accessToken);
 * const email = await service.getUserEmail();
 * const messages = await service.listMessages({ maxResults: 10 });
 * ```
 */
export class GmailService {
  private accessToken: string;

  /**
   * Create a new GmailService instance
   *
   * @param accessToken - Valid Gmail OAuth access token
   */
  constructor(accessToken: string) {
    if (!accessToken) {
      throw new Error('Access token is required');
    }
    this.accessToken = accessToken;
  }

  /**
   * Get the user's email address from their Gmail profile
   *
   * @returns The user's email address
   * @throws Error if the API request fails
   */
  async getUserEmail(): Promise<string> {
    const response = await gmailApiFetch(this.accessToken, '/users/me/profile');

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get Gmail profile: ${errorText}`);
    }

    const profile: GmailProfile = await response.json();
    return profile.emailAddress;
  }

  /**
   * List messages in the user's mailbox
   *
   * @param options.maxResults - Maximum number of messages to return (default: 50, max: 500)
   * @param options.labelIds - Only return messages with these label IDs (e.g., ['INBOX'])
   * @param options.pageToken - Page token from previous response for pagination
   * @returns List of message IDs and pagination info
   */
  async listMessages(
    options: {
      maxResults?: number;
      labelIds?: string[];
      pageToken?: string;
    } = {}
  ): Promise<GmailMessageList> {
    const params = new URLSearchParams();

    const maxResults = Math.min(options.maxResults ?? 50, 500);
    params.set('maxResults', maxResults.toString());

    if (options.labelIds && options.labelIds.length > 0) {
      options.labelIds.forEach(id => params.append('labelIds', id));
    }

    if (options.pageToken) {
      params.set('pageToken', options.pageToken);
    }

    const response = await gmailApiFetch(
      this.accessToken,
      `/users/me/messages?${params.toString()}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list Gmail messages: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get a single message by ID
   *
   * @param messageId - The message ID to retrieve
   * @param format - Message format: 'minimal' (IDs only), 'full' (parsed), or 'raw' (RFC2822)
   * @returns The full message data
   */
  async getMessage(
    messageId: string,
    format: 'minimal' | 'full' | 'raw' = 'full'
  ): Promise<GmailMessage> {
    const params = new URLSearchParams({ format });

    const response = await gmailApiFetch(
      this.accessToken,
      `/users/me/messages/${messageId}?${params.toString()}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get Gmail message ${messageId}: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Batch get multiple messages by ID
   *
   * Note: Gmail API doesn't have a true batch endpoint, so this fetches
   * messages in parallel using Promise.all. For large numbers of messages,
   * consider rate limiting.
   *
   * @param messageIds - Array of message IDs to retrieve
   * @param format - Message format (default: 'full')
   * @returns Array of messages in the same order as input IDs
   */
  async batchGetMessages(
    messageIds: string[],
    format: 'minimal' | 'full' | 'raw' = 'full'
  ): Promise<GmailMessage[]> {
    if (messageIds.length === 0) {
      return [];
    }

    // Limit concurrent requests to avoid rate limiting
    const BATCH_SIZE = 10;
    const results: GmailMessage[] = [];

    for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
      const batch = messageIds.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(id => this.getMessage(id, format)));
      results.push(...batchResults);
    }

    return results;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse Gmail API headers into a structured object
 *
 * @param headers - Array of Gmail headers
 * @returns Object with subject, from, and date fields
 */
export function parseHeaders(headers: GmailHeader[]): {
  subject: string;
  from: string;
  date: string;
} {
  const result = {
    subject: '',
    from: '',
    date: '',
  };

  for (const header of headers) {
    const name = header.name.toLowerCase();
    switch (name) {
      case 'subject':
        result.subject = header.value;
        break;
      case 'from':
        result.from = header.value;
        break;
      case 'date':
        result.date = header.value;
        break;
    }
  }

  return result;
}

/**
 * Extract the sender's email address from a From header value
 *
 * @param fromHeader - The From header value (e.g., "John Doe <john@example.com>")
 * @returns The email address portion
 */
export function extractEmailFromHeader(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  if (match) {
    return match[1];
  }
  // If no angle brackets, assume the whole thing is an email
  return fromHeader.trim();
}

/**
 * Extract the sender's display name from a From header value
 *
 * @param fromHeader - The From header value (e.g., "John Doe <john@example.com>")
 * @returns The display name, or null if not present
 */
export function extractNameFromHeader(fromHeader: string): string | null {
  const match = fromHeader.match(/^"?([^"<]+)"?\s*</);
  if (match) {
    return match[1].trim();
  }
  // Check if there's no angle brackets (just an email)
  if (!fromHeader.includes('<')) {
    return null;
  }
  return null;
}

/**
 * Extract a snippet from a Gmail message
 *
 * @param message - The Gmail message
 * @param maxLength - Maximum snippet length (default from config)
 * @returns The snippet string, truncated if necessary
 */
export function extractSnippet(
  message: GmailMessage,
  maxLength: number = EMAIL_SYNC_CONFIG.MAX_SNIPPET_LENGTH
): string {
  const snippet = message.snippet ?? '';
  if (snippet.length <= maxLength) {
    return snippet;
  }
  return snippet.slice(0, maxLength - 3) + '...';
}

/**
 * Parse the internal date (milliseconds since epoch) to ISO string
 *
 * @param internalDate - Gmail's internalDate field (ms since epoch)
 * @returns ISO 8601 datetime string
 */
export function parseInternalDate(internalDate: string | undefined): string {
  if (!internalDate) {
    return new Date().toISOString();
  }
  const ms = parseInt(internalDate, 10);
  return new Date(ms).toISOString();
}

/**
 * Transform a Gmail API message to our EmailMessage schema
 *
 * Converts Gmail API response format to our application's EmailMessage type.
 * Requires a full message (not minimal format) with payload and headers.
 *
 * @param message - Gmail API message object
 * @param connectionId - UUID of the email connection this message belongs to
 * @returns EmailMessage object ready for database storage
 */
export function parseGmailMessage(
  message: GmailMessage,
  connectionId: string
): Omit<EmailMessage, 'id'> {
  const headers = message.payload?.headers ?? [];
  const parsedHeaders = parseHeaders(headers);
  const fromEmail = extractEmailFromHeader(parsedHeaders.from);
  const fromName = extractNameFromHeader(parsedHeaders.from);

  return {
    connection_id: connectionId,
    provider_id: message.id,
    subject: parsedHeaders.subject || null,
    sender: fromEmail,
    sender_name: fromName,
    received_at: parseInternalDate(message.internalDate),
    snippet: extractSnippet(message),
    is_read: !message.labelIds?.includes('UNREAD'),
    is_starred: message.labelIds?.includes('STARRED') ?? false,
    labels: message.labelIds ?? [],
    ai_summary: null, // Populated later by AI summarization
  };
}
