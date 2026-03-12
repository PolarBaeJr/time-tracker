/**
 * Calendar Integration Library
 *
 * This module exports all calendar-related utilities including:
 * - OAuth configuration constants for Google Calendar and Outlook Calendar
 * - PKCE OAuth helpers for authentication flows
 * - Google Calendar API service layer
 * - Outlook Calendar (Microsoft Graph) API service layer
 *
 * @example
 * ```typescript
 * import { GOOGLE_CALENDAR_CONFIG, GoogleCalendarService } from '@/lib/calendar';
 *
 * // Use Google Calendar service
 * const service = new GoogleCalendarService(accessToken);
 * const events = await service.listEvents('primary', { maxResults: 10 });
 * ```
 */

// OAuth configuration constants
export { GOOGLE_CALENDAR_CONFIG, OUTLOOK_CALENDAR_CONFIG, CALENDAR_SYNC_CONFIG } from './constants';

export type { GoogleCalendarConfig, OutlookCalendarConfig, CalendarSyncConfig } from './constants';

// OAuth PKCE helpers and API wrappers
// Note: generateCodeVerifier and generateCodeChallenge are re-exported from email/oauth
export {
  generateCodeVerifier,
  generateCodeChallenge,
  buildGoogleCalendarAuthorizeUrl,
  buildOutlookCalendarAuthorizeUrl,
  exchangeGoogleCalendarCodeForTokens,
  exchangeOutlookCalendarCodeForTokens,
  refreshGoogleCalendarToken,
  refreshOutlookCalendarToken,
  googleCalendarApiFetch,
  outlookCalendarApiFetch,
} from './oauth';

export type { OAuthTokens } from './oauth';

// Google Calendar service layer
export {
  GoogleCalendarService,
  parseDateTime as parseGoogleDateTime,
  isAllDayEvent,
  mapEventStatus as mapGoogleEventStatus,
  parseAttendees as parseGoogleAttendees,
  parseGoogleEvent,
  getDefaultDateRange,
} from './google';

export type {
  GoogleDateTime,
  GoogleAttendee,
  GoogleEvent,
  GoogleEventList,
  GoogleCalendar,
  GoogleCalendarList,
} from './google';

// Outlook Calendar service layer
export {
  OutlookCalendarService,
  parseDateTime as parseOutlookDateTime,
  parseOutlookEvent,
  buildStartAfterFilter,
  buildNotCancelledFilter,
  combineFilters as combineCalendarFilters,
} from './outlook';

export type {
  OutlookDateTime,
  OutlookEmailAddress as OutlookCalendarEmailAddress,
  OutlookAttendee,
  OutlookLocation,
  OutlookCalendarEvent,
  OutlookEventList,
  OutlookCalendar,
  OutlookCalendarList,
  OutlookUserProfile as OutlookCalendarUserProfile,
  ListEventsOptions,
} from './outlook';
