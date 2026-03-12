/**
 * Outlook Calendar Service Layer
 *
 * Microsoft Graph Calendar API wrapper for fetching and managing Outlook calendar events.
 * Uses the authenticated outlookCalendarApiFetch function from oauth.ts for all requests.
 *
 * API Reference: https://docs.microsoft.com/en-us/graph/api/resources/calendar
 */

import { outlookCalendarApiFetch } from './oauth';
import { CALENDAR_SYNC_CONFIG } from './constants';
import type { CalendarEvent, EventAttendee, EventStatus } from '@/schemas/calendar';

// =============================================================================
// MICROSOFT GRAPH CALENDAR API TYPES
// =============================================================================

/**
 * Microsoft Graph date/time representation
 * @see https://docs.microsoft.com/en-us/graph/api/resources/datetimetimezone
 */
export interface OutlookDateTime {
  /** The date and time (e.g., '2024-01-15T09:00:00.0000000') */
  dateTime: string;
  /** IANA timezone identifier (e.g., 'America/Los_Angeles') */
  timeZone: string;
}

/**
 * Microsoft Graph email address object
 */
export interface OutlookEmailAddress {
  name?: string;
  address: string;
}

/**
 * Microsoft Graph attendee object
 * @see https://docs.microsoft.com/en-us/graph/api/resources/attendee
 */
export interface OutlookAttendee {
  type: 'required' | 'optional' | 'resource';
  status: {
    response:
      | 'none'
      | 'organizer'
      | 'tentativelyAccepted'
      | 'accepted'
      | 'declined'
      | 'notResponded';
    time?: string;
  };
  emailAddress: OutlookEmailAddress;
}

/**
 * Microsoft Graph location object
 * @see https://docs.microsoft.com/en-us/graph/api/resources/location
 */
export interface OutlookLocation {
  displayName?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    countryOrRegion?: string;
    postalCode?: string;
  };
}

/**
 * Microsoft Graph calendar event object
 * @see https://docs.microsoft.com/en-us/graph/api/resources/event
 */
export interface OutlookCalendarEvent {
  id: string;
  subject: string | null;
  bodyPreview: string | null;
  body?: {
    contentType: 'text' | 'html';
    content: string;
  };
  start: OutlookDateTime;
  end: OutlookDateTime;
  isAllDay: boolean;
  isCancelled: boolean;
  showAs: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown';
  importance: 'low' | 'normal' | 'high';
  sensitivity: 'normal' | 'personal' | 'private' | 'confidential';
  organizer?: {
    emailAddress: OutlookEmailAddress;
  };
  attendees?: OutlookAttendee[];
  location?: OutlookLocation;
  locations?: OutlookLocation[];
  webLink?: string;
  onlineMeetingUrl?: string | null;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
}

/**
 * Microsoft Graph calendar events list response
 */
export interface OutlookEventList {
  '@odata.context'?: string;
  '@odata.nextLink'?: string;
  '@odata.count'?: number;
  value: OutlookCalendarEvent[];
}

/**
 * Microsoft Graph calendar object
 * @see https://docs.microsoft.com/en-us/graph/api/resources/calendar
 */
export interface OutlookCalendar {
  id: string;
  name: string;
  color: string;
  isDefaultCalendar: boolean;
  canEdit: boolean;
  canShare: boolean;
  canViewPrivateItems: boolean;
  owner?: OutlookEmailAddress;
}

/**
 * Microsoft Graph calendars list response
 */
export interface OutlookCalendarList {
  '@odata.context'?: string;
  '@odata.nextLink'?: string;
  value: OutlookCalendar[];
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
 * Options for listing calendar events
 */
export interface ListEventsOptions {
  /** Start of date range (ISO 8601 datetime) */
  startDateTime?: string;
  /** End of date range (ISO 8601 datetime) */
  endDateTime?: string;
  /** Maximum number of events to return (default: 100, max: 1000) */
  top?: number;
  /** OData filter string */
  filter?: string;
  /** OData orderby string (e.g., 'start/dateTime') */
  orderby?: string;
  /** Select specific fields */
  select?: string[];
}

// =============================================================================
// OUTLOOK CALENDAR SERVICE CLASS
// =============================================================================

/**
 * OutlookCalendarService - Microsoft Graph Calendar API wrapper
 *
 * Provides methods for fetching calendars and events from Outlook/Microsoft 365.
 *
 * @example
 * ```ts
 * const service = new OutlookCalendarService(accessToken);
 * const email = await service.getUserEmail();
 * const calendars = await service.listCalendars();
 * const events = await service.listEvents('calendar-id', {
 *   startDateTime: '2024-01-01T00:00:00Z',
 *   endDateTime: '2024-01-31T23:59:59Z',
 * });
 * ```
 */
export class OutlookCalendarService {
  private accessToken: string;

  /**
   * Create a new OutlookCalendarService instance
   * @param accessToken - Valid Microsoft Graph access token with Calendar.Read scope
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
    const response = await outlookCalendarApiFetch(this.accessToken, '/me', {
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
   * List all calendars for the authenticated user
   *
   * @returns List of calendars
   * @throws Error if API request fails
   */
  async listCalendars(): Promise<OutlookCalendarList> {
    const response = await outlookCalendarApiFetch(this.accessToken, '/me/calendars', {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list Outlook calendars: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get the user's primary (default) calendar
   *
   * @returns The primary calendar
   * @throws Error if API request fails
   */
  async getPrimaryCalendar(): Promise<OutlookCalendar> {
    const response = await outlookCalendarApiFetch(this.accessToken, '/me/calendar', {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get primary Outlook calendar: ${errorText}`);
    }

    return response.json();
  }

  /**
   * List events from a specific calendar
   *
   * Uses the calendarView endpoint when date range is specified for proper
   * handling of recurring events.
   *
   * @param calendarId - The calendar ID (use 'primary' or specific calendar ID)
   * @param options - Query options for filtering and pagination
   * @returns List of events with pagination info
   * @throws Error if API request fails
   */
  async listEvents(calendarId: string, options: ListEventsOptions = {}): Promise<OutlookEventList> {
    const {
      startDateTime,
      endDateTime,
      top = CALENDAR_SYNC_CONFIG.MAX_EVENTS_PER_SYNC,
      filter,
      orderby = 'start/dateTime',
      select = [
        'id',
        'subject',
        'bodyPreview',
        'start',
        'end',
        'isAllDay',
        'isCancelled',
        'showAs',
        'importance',
        'sensitivity',
        'organizer',
        'attendees',
        'location',
        'locations',
        'webLink',
        'onlineMeetingUrl',
      ],
    } = options;

    const params = new URLSearchParams();
    params.set('$top', String(top));
    params.set('$orderby', orderby);
    params.set('$select', select.join(','));

    if (filter) {
      params.set('$filter', filter);
    }

    // Determine the endpoint based on whether date range is specified
    let endpoint: string;

    if (startDateTime && endDateTime) {
      // Use calendarView for date range queries (handles recurring events)
      params.set('startDateTime', startDateTime);
      params.set('endDateTime', endDateTime);

      // Calendar view endpoint for a specific calendar
      if (calendarId === 'primary') {
        endpoint = `/me/calendar/calendarView?${params.toString()}`;
      } else {
        endpoint = `/me/calendars/${encodeURIComponent(calendarId)}/calendarView?${params.toString()}`;
      }
    } else {
      // Use events endpoint for listing without date range
      if (calendarId === 'primary') {
        endpoint = `/me/calendar/events?${params.toString()}`;
      } else {
        endpoint = `/me/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
      }
    }

    const response = await outlookCalendarApiFetch(this.accessToken, endpoint, {
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'outlook.timezone="UTC"', // Request times in UTC
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list Outlook calendar events: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get a single event by ID
   *
   * @param calendarId - The calendar ID (use 'primary' or specific calendar ID)
   * @param eventId - The event ID
   * @returns The event details
   * @throws Error if API request fails
   */
  async getEvent(calendarId: string, eventId: string): Promise<OutlookCalendarEvent> {
    let endpoint: string;

    if (calendarId === 'primary') {
      endpoint = `/me/calendar/events/${encodeURIComponent(eventId)}`;
    } else {
      endpoint = `/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
    }

    const response = await outlookCalendarApiFetch(this.accessToken, endpoint, {
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'outlook.timezone="UTC"',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get Outlook event ${eventId}: ${errorText}`);
    }

    return response.json();
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Parse an Outlook DateTime to ISO 8601 string
 *
 * Microsoft Graph returns dateTime and timeZone separately.
 * This function combines them into a proper ISO 8601 datetime.
 *
 * @param dt - Outlook DateTime object
 * @returns ISO 8601 datetime string with timezone
 */
export function parseDateTime(dt: OutlookDateTime): string {
  // Microsoft Graph returns dateTime without timezone suffix
  // The timezone is specified separately
  const { dateTime, timeZone } = dt;

  // If timeZone is UTC, append Z
  if (timeZone === 'UTC' || timeZone === 'Etc/UTC') {
    // Remove any fractional seconds beyond milliseconds and append Z
    const normalized = dateTime.replace(/(\.\d{3})\d*/, '$1');
    return normalized.endsWith('Z') ? normalized : `${normalized}Z`;
  }

  // For other timezones, we need to convert to ISO 8601 with offset
  // The dateTime is in the specified timezone, but we'll store as-is
  // and let the client handle timezone display
  // For simplicity, we treat the dateTime as if it's in the specified timezone
  // A more robust solution would use a timezone library like date-fns-tz

  // For now, append a marker that this is local time in the specified timezone
  // Most calendar UIs will handle this appropriately
  const normalized = dateTime.replace(/(\.\d{3})\d*/, '$1');

  // If it already has a Z or offset, return as-is
  if (/[Z+-]\d{2}:\d{2}$/.test(normalized) || normalized.endsWith('Z')) {
    return normalized;
  }

  // Otherwise, this is a local datetime in the specified timezone
  // Return with Z for UTC storage (this is a simplification)
  // In production, you'd want proper timezone conversion
  return `${normalized}Z`;
}

/**
 * Map Outlook attendee status to app schema status
 *
 * @param response - Outlook attendee response status
 * @returns Normalized status string
 */
function mapAttendeeStatus(response: OutlookAttendee['status']['response']): string {
  switch (response) {
    case 'accepted':
      return 'accepted';
    case 'declined':
      return 'declined';
    case 'tentativelyAccepted':
      return 'tentative';
    case 'organizer':
      return 'accepted';
    case 'none':
    case 'notResponded':
    default:
      return 'needsAction';
  }
}

/**
 * Map Outlook event status to app schema EventStatus
 *
 * @param event - Outlook calendar event
 * @returns Event status or null
 */
function mapEventStatus(event: OutlookCalendarEvent): EventStatus | null {
  if (event.isCancelled) {
    return 'cancelled';
  }

  switch (event.showAs) {
    case 'tentative':
      return 'tentative';
    case 'busy':
    case 'oof':
    case 'workingElsewhere':
      return 'confirmed';
    case 'free':
    case 'unknown':
    default:
      return 'confirmed';
  }
}

/**
 * Extract location string from Outlook location objects
 *
 * @param event - Outlook calendar event
 * @returns Location string or null
 */
function extractLocation(event: OutlookCalendarEvent): string | null {
  // First check primary location
  if (event.location?.displayName) {
    return event.location.displayName;
  }

  // Then check locations array
  if (event.locations && event.locations.length > 0) {
    const locationNames = event.locations.map(loc => loc.displayName).filter(Boolean);
    if (locationNames.length > 0) {
      return locationNames.join(', ');
    }
  }

  // Check for online meeting URL
  if (event.onlineMeetingUrl) {
    return event.onlineMeetingUrl;
  }

  return null;
}

/**
 * Parse Outlook attendees to app schema format
 *
 * @param attendees - Outlook attendees array
 * @returns Array of EventAttendee objects or null
 */
function parseAttendees(attendees: OutlookAttendee[] | undefined): EventAttendee[] | null {
  if (!attendees || attendees.length === 0) {
    return null;
  }

  return attendees.map(attendee => ({
    email: attendee.emailAddress.address,
    name: attendee.emailAddress.name,
    status: mapAttendeeStatus(attendee.status.response),
  }));
}

/**
 * Parse an Outlook calendar event into the app's CalendarEvent schema
 *
 * Transforms Microsoft Graph event format to the app's internal format.
 *
 * @param event - Outlook calendar event from the API
 * @returns Parsed calendar event (without id and connection_id)
 */
export function parseOutlookEvent(
  event: OutlookCalendarEvent
): Omit<CalendarEvent, 'id' | 'connection_id'> {
  return {
    provider_id: event.id,
    title: event.subject || null,
    description: event.bodyPreview || null,
    location: extractLocation(event),
    start_at: parseDateTime(event.start),
    end_at: parseDateTime(event.end),
    is_all_day: event.isAllDay,
    status: mapEventStatus(event),
    organizer: event.organizer?.emailAddress?.address || null,
    attendees: parseAttendees(event.attendees),
    ai_summary: null, // Will be filled by AI summarization service
  };
}

/**
 * Build OData filter for events starting after a specific date
 *
 * @param since - ISO 8601 datetime string
 * @returns OData filter string
 */
export function buildStartAfterFilter(since: string): string {
  return `start/dateTime ge '${since}'`;
}

/**
 * Build OData filter for non-cancelled events
 *
 * @returns OData filter string
 */
export function buildNotCancelledFilter(): string {
  return 'isCancelled eq false';
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
