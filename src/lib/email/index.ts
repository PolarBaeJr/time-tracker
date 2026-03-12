/**
 * Email Integration Library
 *
 * This module exports all email-related utilities including:
 * - OAuth configuration constants for Gmail and Outlook
 * - PKCE OAuth helpers for authentication flows
 * - Gmail API service layer
 * - Outlook (Microsoft Graph) API service layer
 *
 * @example
 * ```typescript
 * import { GMAIL_CONFIG, GmailService, buildGmailAuthorizeUrl } from '@/lib/email';
 *
 * // Build OAuth authorization URL
 * const authUrl = buildGmailAuthorizeUrl({ codeChallenge, redirectUri, state });
 *
 * // Use Gmail service
 * const service = new GmailService(accessToken);
 * const messages = await service.listMessages({ maxResults: 10 });
 * ```
 */

// OAuth configuration constants
export { GMAIL_CONFIG, OUTLOOK_EMAIL_CONFIG, IMAP_DEFAULTS, EMAIL_SYNC_CONFIG } from './constants';

export type { GmailConfig, OutlookEmailConfig, ImapDefaults, EmailSyncConfig } from './constants';

// OAuth PKCE helpers and API wrappers
export {
  generateCodeVerifier,
  generateCodeChallenge,
  buildGmailAuthorizeUrl,
  buildOutlookEmailAuthorizeUrl,
  exchangeGmailCodeForTokens,
  exchangeOutlookCodeForTokens,
  refreshGmailToken,
  refreshOutlookToken,
  gmailApiFetch,
  outlookApiFetch,
} from './oauth';

export type { OAuthTokens } from './oauth';

// Gmail service layer
export {
  GmailService,
  parseHeaders,
  extractEmailFromHeader,
  extractNameFromHeader,
  extractSnippet as extractGmailSnippet,
  parseInternalDate,
  parseGmailMessage,
} from './gmail';

export type {
  GmailHeader,
  GmailMessagePartPayload,
  GmailMessage,
  GmailMessageList,
  GmailProfile,
} from './gmail';

// Outlook email service layer
export {
  OutlookEmailService,
  parseOutlookMessage,
  extractSnippet as extractOutlookSnippet,
  buildSinceFilter,
  buildUnreadFilter,
  combineFilters as combineEmailFilters,
} from './outlook';

export type {
  OutlookEmailAddress,
  OutlookMessageBody,
  OutlookMessage,
  OutlookMessageList,
  OutlookUserProfile,
  ListMessagesOptions,
} from './outlook';
