/**
 * Google Calendar Service Layer
 *
 * Wrapper for the Google Calendar API providing methods to fetch user profile,
 * list calendars, and retrieve calendar events.
 *
 * Uses the Google Calendar API v3: https://developers.google.com/calendar/api/v3/reference
 */

import type { CalendarEvent, EventAttendee, EventStatus } from '@/schemas/calendar';
import { CALENDAR_SYNC_CONFIG } from './constants';
import { googleCalendarApiFetch } from './oauth';

// ============================================================================
// Google Calendar API Types
// ============================================================================

/**
 * Google Calendar API date/time format
 * See: https://developers.google.com/calendar/api/v3/reference/events
 */
export interface GoogleDateTime {
  /** Combined date-time value (RFC3339) - for timed events */
  dateTime?: string;
  /** Date value only (YYYY-MM-DD) - for all-day events */
  date?: string;
  /** Timezone (IANA format, e.g., 'America/New_York') */
  timeZone?: string;
}

/**
 * Google Calendar API attendee format
 */
export interface GoogleAttendee {
  /** Attendee's email address */
  email: string;
  /** Attendee's display name */
  displayName?: string;
  /** Whether this attendee is the organizer */
  organizer?: boolean;
  /** Whether this is the current user */
  self?: boolean;
  /** Response status: 'needsAction', 'declined', 'tentative', 'accepted' */
  responseStatus?: string;
  /** Whether the attendee is optional */
  optional?: boolean;
}

/**
 * Google Calendar API event format
 * See: https://developers.google.com/calendar/api/v3/reference/events
 */
export interface GoogleEvent {
  /** Event ID */
  id: string;
  /** Event status: 'confirmed', 'tentative', 'cancelled' */
  status?: string;
  /** Event title/summary */
  summary?: string;
  /** Event description */
  description?: string;
  /** Event location */
  location?: string;
  /** Event start time */
  start: GoogleDateTime;
  /** Event end time */
  end: GoogleDateTime;
  /** Event organizer */
  organizer?: {
    email: string;
    displayName?: string;
    self?: boolean;
  };
  /** List of attendees */
  attendees?: GoogleAttendee[];
  /** Recurrence rules (RRULE format) */
  recurrence?: string[];
  /** For recurring events, the ID of the recurring event */
  recurringEventId?: string;
  /** When the event was created */
  created?: string;
  /** When the event was last updated */
  updated?: string;
  /** HTML link to the event in Google Calendar */
  htmlLink?: string;
  /** ICalendar UID */
  iCalUID?: string;
}

/**
 * Google Calendar API event list response
 * See: https://developers.google.com/calendar/api/v3/reference/events/list
 */
export interface GoogleEventList {
  /** List of events */
  items?: GoogleEvent[];
  /** Token for next page of results */
  nextPageToken?: string;
  /** Sync token for incremental sync */
  nextSyncToken?: string;
  /** Summary of the calendar */
  summary?: string;
  /** Timezone of the calendar */
  timeZone?: string;
}

/**
 * Google Calendar API calendar format
 * See: https://developers.google.com/calendar/api/v3/reference/calendarList
 */
export interface GoogleCalendar {
  /** Calendar ID */
  id: string;
  /** Calendar summary/title */
  summary: string;
  /** Calendar description */
  description?: string;
  /** Calendar location */
  location?: string;
  /** Calendar timezone */
  timeZone?: string;
  /** Whether this is the primary calendar */
  primary?: boolean;
  /** Access role for this calendar */
  accessRole?: 'freeBusyReader' | 'reader' | 'writer' | 'owner';
  /** Background color for this calendar */
  backgroundColor?: string;
  /** Foreground color for this calendar */
  foregroundColor?: string;
}

/**
 * Google Calendar API calendar list response
 * See: https://developers.google.com/calendar/api/v3/reference/calendarList/list
 */
export interface GoogleCalendarList {
  /** List of calendars */
  items?: GoogleCalendar[];
  /** Token for next page of results */
  nextPageToken?: string;
  /** Sync token for incremental sync */
  nextSyncToken?: string;
}

/**
 * Google userinfo response for getting email
 */
interface GoogleUserInfo {
  email: string;
  verified_email?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

// ============================================================================
// Google Calendar Service Class
// ============================================================================

/**
 * GoogleCalendarService - Google Calendar API wrapper class
 *
 * Provides methods to interact with the Google Calendar API using a provided access token.
 * All methods handle API errors and throw descriptive error messages.
 *
 * @example
 * ```typescript
 * const service = new GoogleCalendarService(accessToken);
 * const email = await service.getUserEmail();
 * const calendars = await service.listCalendars();
 * const events = await service.listEvents('primary', { maxResults: 10 });
 * ```
 */
export class GoogleCalendarService {
  private accessToken: string;

  /**
   * Create a new GoogleCalendarService instance
   *
   * @param accessToken - Valid Google Calendar OAuth access token
   */
  constructor(accessToken: string) {
    if (!accessToken) {
      throw new Error('Access token is required');
    }
    this.accessToken = accessToken;
  }

  /**
   * Get the user's email address from their Google profile
   *
   * Uses the userinfo endpoint since Calendar API doesn't expose user email directly.
   *
   * @returns The user's email address
   * @throws Error if the API request fails
   */
  async getUserEmail(): Promise<string> {
    // Use Google OAuth2 userinfo endpoint
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get Google user info: ${errorText}`);
    }

    const userInfo: GoogleUserInfo = await response.json();
    return userInfo.email;
  }

  /**
   * List all calendars the user has access to
   *
   * @returns List of calendars with their metadata
   * @throws Error if the API request fails
   */
  async listCalendars(): Promise<GoogleCalendarList> {
    const response = await googleCalendarApiFetch(this.accessToken, '/users/me/calendarList');

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list calendars: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get the user's primary calendar
   *
   * @returns The primary calendar, or throws if not found
   * @throws Error if the API request fails or no primary calendar exists
   */
  async getPrimaryCalendar(): Promise<GoogleCalendar> {
    const response = await googleCalendarApiFetch(
      this.accessToken,
      '/users/me/calendarList/primary'
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get primary calendar: ${errorText}`);
    }

    return response.json();
  }

  /**
   * List events in a calendar
   *
   * @param calendarId - Calendar ID (use 'primary' for the user's primary calendar)
   * @param options.timeMin - Lower bound for event start time (RFC3339)
   * @param options.timeMax - Upper bound for event start time (RFC3339)
   * @param options.maxResults - Maximum number of events to return (default: 100, max: 2500)
   * @param options.pageToken - Token for pagination from previous response
   * @returns List of events with pagination info
   * @throws Error if the API request fails
   */
  async listEvents(
    calendarId: string,
    options: {
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
      pageToken?: string;
    } = {}
  ): Promise<GoogleEventList> {
    const params = new URLSearchParams();

    // Set time bounds
    if (options.timeMin) {
      params.set('timeMin', options.timeMin);
    }
    if (options.timeMax) {
      params.set('timeMax', options.timeMax);
    }

    // Set max results (clamp to API limit)
    const maxResults = Math.min(
      options.maxResults ?? CALENDAR_SYNC_CONFIG.MAX_EVENTS_PER_SYNC,
      2500
    );
    params.set('maxResults', maxResults.toString());

    // Pagination
    if (options.pageToken) {
      params.set('pageToken', options.pageToken);
    }

    // Always get single events (expand recurring events)
    params.set('singleEvents', 'true');

    // Order by start time
    params.set('orderBy', 'startTime');

    const encodedCalendarId = encodeURIComponent(calendarId);
    const response = await googleCalendarApiFetch(
      this.accessToken,
      `/calendars/${encodedCalendarId}/events?${params.toString()}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list events from calendar ${calendarId}: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get a single event by ID
   *
   * @param calendarId - Calendar ID
   * @param eventId - Event ID to retrieve
   * @returns The event data
   * @throws Error if the API request fails
   */
  async getEvent(calendarId: string, eventId: string): Promise<GoogleEvent> {
    const encodedCalendarId = encodeURIComponent(calendarId);
    const encodedEventId = encodeURIComponent(eventId);

    const response = await googleCalendarApiFetch(
      this.accessToken,
      `/calendars/${encodedCalendarId}/events/${encodedEventId}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get event ${eventId}: ${errorText}`);
    }

    return response.json();
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse a Google DateTime to ISO 8601 string
 *
 * Handles both all-day events (date field only) and timed events (dateTime field).
 *
 * @param dateTime - Google DateTime object
 * @returns ISO 8601 datetime string
 */
export function parseDateTime(dateTime: GoogleDateTime): string {
  if (dateTime.dateTime) {
    // Timed event - already in RFC3339 format
    return dateTime.dateTime;
  }

  if (dateTime.date) {
    // All-day event - convert date to start of day in UTC
    // Format: YYYY-MM-DD -> YYYY-MM-DDT00:00:00.000Z
    return `${dateTime.date}T00:00:00.000Z`;
  }

  // Fallback to current time if neither is set
  return new Date().toISOString();
}

/**
 * Check if an event is an all-day event
 *
 * @param event - Google Calendar event
 * @returns True if the event is all-day
 */
export function isAllDayEvent(event: GoogleEvent): boolean {
  // If start has date but not dateTime, it's an all-day event
  return !event.start.dateTime && !!event.start.date;
}

/**
 * Map Google Calendar status to our EventStatus type
 *
 * @param googleStatus - Google Calendar event status
 * @returns Normalized EventStatus or null
 */
export function mapEventStatus(googleStatus: string | undefined): EventStatus | null {
  if (!googleStatus) {
    return null;
  }

  switch (googleStatus.toLowerCase()) {
    case 'confirmed':
      return 'confirmed';
    case 'tentative':
      return 'tentative';
    case 'cancelled':
      return 'cancelled';
    default:
      return null;
  }
}

/**
 * Parse Google Calendar attendees to our EventAttendee type
 *
 * @param attendees - Google Calendar attendees array
 * @returns Array of EventAttendee objects
 */
export function parseAttendees(attendees: GoogleAttendee[] | undefined): EventAttendee[] | null {
  if (!attendees || attendees.length === 0) {
    return null;
  }

  return attendees.map(attendee => ({
    email: attendee.email,
    name: attendee.displayName,
    status: attendee.responseStatus ?? 'needsAction',
  }));
}

/**
 * Transform a Google Calendar API event to our CalendarEvent schema
 *
 * Converts Google Calendar API response format to our application's CalendarEvent type.
 *
 * @param event - Google Calendar API event object
 * @param connectionId - UUID of the calendar connection this event belongs to
 * @returns CalendarEvent object ready for database storage (without id)
 */
export function parseGoogleEvent(
  event: GoogleEvent,
  connectionId: string
): Omit<CalendarEvent, 'id'> {
  return {
    connection_id: connectionId,
    provider_id: event.id,
    title: event.summary ?? null,
    description: event.description ?? null,
    location: event.location ?? null,
    start_at: parseDateTime(event.start),
    end_at: parseDateTime(event.end),
    is_all_day: isAllDayEvent(event),
    status: mapEventStatus(event.status),
    organizer: event.organizer?.email ?? null,
    attendees: parseAttendees(event.attendees),
    ai_summary: null, // Populated later by AI summarization
  };
}

/**
 * Get default date range for calendar sync
 *
 * @param lookaheadDays - Number of days to look ahead (default from config)
 * @returns Object with start and end ISO datetime strings
 */
export function getDefaultDateRange(
  lookaheadDays: number = CALENDAR_SYNC_CONFIG.DEFAULT_LOOKAHEAD_DAYS
): { timeMin: string; timeMax: string } {
  const now = new Date();
  const end = new Date();
  end.setDate(end.getDate() + lookaheadDays);

  return {
    timeMin: now.toISOString(),
    timeMax: end.toISOString(),
  };
}
