/**
 * Outlook Email Service Layer
 *
 * Microsoft Graph Mail API wrapper for fetching and managing Outlook emails.
 * Uses the authenticated outlookApiFetch function from oauth.ts for all requests.
 *
 * API Reference: https://docs.microsoft.com/en-us/graph/api/resources/mail-api-overview
 */

import { outlookApiFetch } from './oauth';
import { EMAIL_SYNC_CONFIG } from './constants';
import type { EmailMessage } from '@/schemas/email';

// =============================================================================
// MICROSOFT GRAPH API TYPES
// =============================================================================

/**
 * Microsoft Graph email sender information
 */
export interface OutlookEmailAddress {
  emailAddress: {
    name?: string;
    address: string;
  };
}

/**
 * Microsoft Graph message body
 */
export interface OutlookMessageBody {
  contentType: 'text' | 'html';
  content: string;
}

/**
 * Microsoft Graph message object
 * @see https://docs.microsoft.com/en-us/graph/api/resources/message
 */
export interface OutlookMessage {
  id: string;
  subject: string | null;
  bodyPreview: string | null;
  body?: OutlookMessageBody;
  from: OutlookEmailAddress;
  sender?: OutlookEmailAddress;
  receivedDateTime: string;
  isRead: boolean;
  flag: {
    flagStatus: 'notFlagged' | 'flagged' | 'complete';
  };
  importance: 'low' | 'normal' | 'high';
  categories: string[];
  hasAttachments: boolean;
  parentFolderId?: string;
}

/**
 * Microsoft Graph messages list response
 */
export interface OutlookMessageList {
  '@odata.context'?: string;
  '@odata.nextLink'?: string;
  '@odata.count'?: number;
  value: OutlookMessage[];
}

/**
 * Microsoft Graph user profile
 */
export interface OutlookUserProfile {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
}

/**
 * Options for listing messages
 */
export interface ListMessagesOptions {
  /** Maximum number of messages to return (default: 50, max: 1000) */
  top?: number;
  /** OData filter string */
  filter?: string;
  /** OData orderby string (e.g., 'receivedDateTime desc') */
  orderby?: string;
  /** Number of messages to skip (for pagination) */
  skip?: number;
  /** Select specific fields */
  select?: string[];
}

// =============================================================================
// OUTLOOK EMAIL SERVICE CLASS
// =============================================================================

/**
 * OutlookEmailService - Microsoft Graph Mail API wrapper
 *
 * Provides methods for fetching emails and user profile from Outlook/Microsoft 365.
 *
 * @example
 * ```ts
 * const service = new OutlookEmailService(accessToken);
 * const email = await service.getUserEmail();
 * const messages = await service.listMessages({ top: 10 });
 * ```
 */
export class OutlookEmailService {
  private accessToken: string;

  /**
   * Create a new OutlookEmailService instance
   * @param accessToken - Valid Microsoft Graph access token
   */
  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Get the authenticated user's email address
   *
   * Uses the /me endpoint to get the user profile.
   *
   * @returns The user's email address
   * @throws Error if API request fails
   */
  async getUserEmail(): Promise<string> {
    const response = await outlookApiFetch(this.accessToken, '/me', {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get Outlook user profile: ${errorText}`);
    }

    const profile: OutlookUserProfile = await response.json();
    // Microsoft Graph may return mail or userPrincipalName for the email
    const email = profile.mail || profile.userPrincipalName;

    if (!email) {
      throw new Error('Could not determine user email from Outlook profile');
    }

    return email;
  }

  /**
   * List messages from the user's mailbox
   *
   * @param options - Query options for filtering and pagination
   * @returns List of messages with pagination info
   * @throws Error if API request fails
   */
  async listMessages(options: ListMessagesOptions = {}): Promise<OutlookMessageList> {
    const {
      top = EMAIL_SYNC_CONFIG.MAX_MESSAGES_PER_SYNC,
      filter,
      orderby = 'receivedDateTime desc',
      skip,
      select = [
        'id',
        'subject',
        'bodyPreview',
        'from',
        'receivedDateTime',
        'isRead',
        'flag',
        'importance',
        'categories',
        'hasAttachments',
      ],
    } = options;

    const params = new URLSearchParams();
    params.set('$top', String(top));
    params.set('$orderby', orderby);
    params.set('$select', select.join(','));

    if (filter) {
      params.set('$filter', filter);
    }

    if (skip !== undefined && skip > 0) {
      params.set('$skip', String(skip));
    }

    // Request count for pagination info
    params.set('$count', 'true');

    const response = await outlookApiFetch(this.accessToken, `/me/messages?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        ConsistencyLevel: 'eventual', // Required for $count
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list Outlook messages: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get a single message by ID
   *
   * @param messageId - The message ID
   * @returns The message details
   * @throws Error if API request fails
   */
  async getMessage(messageId: string): Promise<OutlookMessage> {
    const response = await outlookApiFetch(
      this.accessToken,
      `/me/messages/${encodeURIComponent(messageId)}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get Outlook message ${messageId}: ${errorText}`);
    }

    return response.json();
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Parse an Outlook message into the app's EmailMessage schema
 *
 * Transforms Microsoft Graph message format to the app's internal format.
 *
 * @param message - Outlook message from the API
 * @returns Parsed email message (without id and connection_id)
 */
export function parseOutlookMessage(
  message: OutlookMessage
): Omit<EmailMessage, 'id' | 'connection_id'> {
  const fromAddress = message.from?.emailAddress;

  return {
    provider_id: message.id,
    subject: message.subject || null,
    sender: fromAddress?.address || 'unknown',
    sender_name: fromAddress?.name || null,
    received_at: message.receivedDateTime,
    snippet: extractSnippet(message, EMAIL_SYNC_CONFIG.MAX_SNIPPET_LENGTH),
    is_read: message.isRead,
    is_starred: message.flag?.flagStatus === 'flagged',
    labels: buildLabels(message),
    ai_summary: null, // Will be filled by AI summarization service
  };
}

/**
 * Extract a snippet from an Outlook message
 *
 * Uses the bodyPreview field which contains the first ~255 characters.
 *
 * @param message - Outlook message
 * @param maxLength - Maximum snippet length
 * @returns Truncated snippet or null
 */
export function extractSnippet(message: OutlookMessage, maxLength: number): string | null {
  const preview = message.bodyPreview;

  if (!preview) {
    return null;
  }

  // Clean up whitespace
  const cleaned = preview.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // Truncate at word boundary if possible
  const truncated = cleaned.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Build labels array from Outlook message properties
 *
 * Microsoft Graph uses different fields for labels/categories:
 * - categories: User-defined categories
 * - importance: high/normal/low
 * - flag: flagged status
 * - hasAttachments: boolean
 *
 * @param message - Outlook message
 * @returns Array of label strings
 */
function buildLabels(message: OutlookMessage): string[] {
  const labels: string[] = [];

  // Add user categories
  if (message.categories && message.categories.length > 0) {
    labels.push(...message.categories);
  }

  // Add importance if high
  if (message.importance === 'high') {
    labels.push('IMPORTANT');
  }

  // Add flagged status
  if (message.flag?.flagStatus === 'flagged') {
    labels.push('FLAGGED');
  }

  // Add attachment indicator
  if (message.hasAttachments) {
    labels.push('HAS_ATTACHMENTS');
  }

  return labels;
}

/**
 * Build OData filter for messages received since a specific date
 *
 * @param since - ISO 8601 datetime string
 * @returns OData filter string
 */
export function buildSinceFilter(since: string): string {
  return `receivedDateTime ge ${since}`;
}

/**
 * Build OData filter for unread messages
 *
 * @returns OData filter string
 */
export function buildUnreadFilter(): string {
  return 'isRead eq false';
}

/**
 * Combine multiple OData filters with AND
 *
 * @param filters - Array of filter strings
 * @returns Combined filter string
 */
export function combineFilters(filters: string[]): string {
  return filters.filter(Boolean).join(' and ');
}
