/**
 * OAuth configuration constants for calendar providers
 *
 * Environment variables are used for client IDs to allow different
 * configurations per environment without code changes.
 *
 * SECURITY NOTES:
 * - Client IDs are safe for client-side use (public values)
 * - Client secrets are NOT stored here - OAuth PKCE flow doesn't require them
 * - Access tokens should be encrypted before storage
 */

// Google Calendar OAuth Configuration
export const GOOGLE_CALENDAR_CONFIG = {
  CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
  SCOPES: [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' '),
  AUTHORIZE_URL: 'https://accounts.google.com/o/oauth2/v2/auth',
  TOKEN_URL: 'https://oauth2.googleapis.com/token',
  API_BASE: 'https://www.googleapis.com/calendar/v3',
} as const;

// Microsoft Outlook Calendar OAuth Configuration
export const OUTLOOK_CALENDAR_CONFIG = {
  CLIENT_ID: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID || '',
  SCOPES: [
    'https://graph.microsoft.com/Calendars.Read',
    'https://graph.microsoft.com/User.Read',
    'offline_access',
  ].join(' '),
  AUTHORIZE_URL: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  TOKEN_URL: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  API_BASE: 'https://graph.microsoft.com/v1.0',
} as const;

// Sync configuration
export const CALENDAR_SYNC_CONFIG = {
  MAX_EVENTS_PER_SYNC: 100,
  SYNC_COOLDOWN_MS: 5 * 60 * 1000, // 5 minutes
  DEFAULT_LOOKAHEAD_DAYS: 14,
} as const;

// Type exports for config objects
export type GoogleCalendarConfig = typeof GOOGLE_CALENDAR_CONFIG;
export type OutlookCalendarConfig = typeof OUTLOOK_CALENDAR_CONFIG;
export type CalendarSyncConfig = typeof CALENDAR_SYNC_CONFIG;
