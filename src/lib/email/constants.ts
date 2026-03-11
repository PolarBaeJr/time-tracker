/**
 * OAuth configuration constants for email providers
 *
 * Environment variables are used for client IDs to allow different
 * configurations per environment without code changes.
 *
 * SECURITY NOTES:
 * - Client IDs are safe for client-side use (public values)
 * - Client secrets are NOT stored here - OAuth PKCE flow doesn't require them
 * - Access tokens should be encrypted before storage
 */

// Gmail OAuth Configuration
export const GMAIL_CONFIG = {
  CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
  SCOPES: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' '),
  AUTHORIZE_URL: 'https://accounts.google.com/o/oauth2/v2/auth',
  TOKEN_URL: 'https://oauth2.googleapis.com/token',
  API_BASE: 'https://gmail.googleapis.com/gmail/v1',
} as const;

// Microsoft Outlook OAuth Configuration
export const OUTLOOK_EMAIL_CONFIG = {
  CLIENT_ID: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID || '',
  SCOPES: [
    'https://graph.microsoft.com/Mail.Read',
    'https://graph.microsoft.com/User.Read',
    'offline_access',
  ].join(' '),
  AUTHORIZE_URL: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  TOKEN_URL: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  API_BASE: 'https://graph.microsoft.com/v1.0',
} as const;

// Default IMAP ports
export const IMAP_DEFAULTS = {
  SSL_PORT: 993,
  STARTTLS_PORT: 143,
} as const;

// Sync configuration
export const EMAIL_SYNC_CONFIG = {
  MAX_MESSAGES_PER_SYNC: 50,
  SYNC_COOLDOWN_MS: 5 * 60 * 1000, // 5 minutes
  MAX_SNIPPET_LENGTH: 200,
} as const;

// Type exports for config objects
export type GmailConfig = typeof GMAIL_CONFIG;
export type OutlookEmailConfig = typeof OUTLOOK_EMAIL_CONFIG;
export type ImapDefaults = typeof IMAP_DEFAULTS;
export type EmailSyncConfig = typeof EMAIL_SYNC_CONFIG;
