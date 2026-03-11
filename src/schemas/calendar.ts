import { z } from 'zod';

/**
 * Calendar Schema - Zod schemas for calendar integration
 *
 * Supports Google Calendar (OAuth) and Outlook Calendar (OAuth) providers.
 * Used for storing calendar connections and caching calendar events.
 */

/**
 * Calendar Provider Enum - Supported calendar providers
 */
export const CalendarProviderEnum = z.enum(['google', 'outlook']);

export type CalendarProvider = z.infer<typeof CalendarProviderEnum>;

/**
 * Calendar Connection Schema - Entity schema for query responses
 *
 * Represents a user's calendar connection stored in the calendar_connections table.
 * Sensitive fields (tokens) are NOT included as they should
 * never be returned to the client.
 */
export const CalendarConnectionSchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),

  /** UUID of the owning user */
  user_id: z.string().uuid(),

  /** Calendar provider type */
  provider: CalendarProviderEnum,

  /** Primary calendar ID from the provider (nullable until first sync) */
  calendar_id: z.string().nullable(),

  /** User's email address for this connection */
  email_address: z.string().email(),

  /** Whether this connection is active */
  is_active: z.boolean(),

  /** Timestamp of last successful sync */
  last_sync_at: z.string().datetime({ offset: true }).nullable(),

  /** Error message from last sync attempt (null if successful) */
  sync_error: z.string().nullable(),

  /** Timestamp when connection was created */
  created_at: z.string().datetime({ offset: true }),

  /** Timestamp when connection was last updated */
  updated_at: z.string().datetime({ offset: true }),
});

export type CalendarConnection = z.infer<typeof CalendarConnectionSchema>;

/**
 * Create Calendar Connection Schema - For OAuth connections
 *
 * Used when connecting Google Calendar or Outlook Calendar via OAuth flow.
 * Tokens will be encrypted server-side before storage.
 */
export const CreateCalendarConnectionSchema = z.object({
  /** Calendar provider type */
  provider: CalendarProviderEnum,

  /** OAuth access token */
  access_token: z.string().min(1, 'Access token is required'),

  /** OAuth refresh token for token renewal */
  refresh_token: z.string().min(1, 'Refresh token is required'),

  /** Token expiration time in seconds */
  expires_in: z.number().int().positive('Expiration time must be positive'),

  /** User's email address from OAuth profile */
  email_address: z.string().email('Valid email address is required'),

  /** Optional calendar ID to use (if not specified, primary calendar is used) */
  calendar_id: z.string().optional(),
});

export type CreateCalendarConnectionInput = z.infer<typeof CreateCalendarConnectionSchema>;

/**
 * Event Status Enum - Calendar event status values
 */
export const EventStatusEnum = z.enum(['confirmed', 'tentative', 'cancelled']);

export type EventStatus = z.infer<typeof EventStatusEnum>;

/**
 * Event Attendee Schema - Represents an event attendee
 */
export const EventAttendeeSchema = z.object({
  /** Attendee's email address */
  email: z.string().email(),

  /** Attendee's display name (optional) */
  name: z.string().optional(),

  /** Attendee's response status (e.g., 'accepted', 'declined', 'tentative', 'needsAction') */
  status: z.string(),
});

export type EventAttendee = z.infer<typeof EventAttendeeSchema>;

/**
 * Calendar Event Schema - Entity schema for cached calendar events
 *
 * Represents a calendar event cached from the provider.
 * Events are synced periodically and stored locally for faster access.
 */
export const CalendarEventSchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),

  /** UUID of the associated calendar connection */
  connection_id: z.string().uuid(),

  /** Event ID from the calendar provider (unique per provider) */
  provider_id: z.string(),

  /** Event title (may be null for untitled events) */
  title: z.string().nullable(),

  /** Event description (may be null) */
  description: z.string().nullable(),

  /** Event location (may be null) */
  location: z.string().nullable(),

  /** Event start time (ISO 8601 datetime with timezone) */
  start_at: z.string().datetime({ offset: true }),

  /** Event end time (ISO 8601 datetime with timezone) */
  end_at: z.string().datetime({ offset: true }),

  /** Whether this is an all-day event */
  is_all_day: z.boolean(),

  /** Event status (confirmed, tentative, cancelled) - nullable if unknown */
  status: EventStatusEnum.nullable(),

  /** Event organizer email (may be null) */
  organizer: z.string().nullable(),

  /** List of event attendees (may be null if no attendees or private) */
  attendees: z.array(EventAttendeeSchema).nullable(),

  /** AI-generated summary (null if not yet summarized) */
  ai_summary: z.string().nullable(),
});

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

/**
 * Calendar Events List Schema - For paginated event responses
 */
export const CalendarEventsListSchema = z.object({
  /** Array of calendar events */
  events: z.array(CalendarEventSchema),

  /** Whether there are more events to fetch */
  has_more: z.boolean(),

  /** Token for fetching next page (if has_more is true) */
  next_page_token: z.string().optional(),

  /** Total count of events (if available) */
  total_count: z.number().int().nonnegative().optional(),
});

export type CalendarEventsList = z.infer<typeof CalendarEventsListSchema>;

/**
 * Calendar Date Range Schema - For specifying date ranges in queries
 */
export const CalendarDateRangeSchema = z.object({
  /** Start of date range (ISO 8601 datetime) */
  start: z.string().datetime({ offset: true }),

  /** End of date range (ISO 8601 datetime) */
  end: z.string().datetime({ offset: true }),
});

export type CalendarDateRange = z.infer<typeof CalendarDateRangeSchema>;

/**
 * Calendar Sync Options Schema - Options for syncing calendar events
 */
export const CalendarSyncOptionsSchema = z.object({
  /** Maximum number of events to sync */
  max_results: z.number().int().positive().max(250).default(100),

  /** Date range for events to sync */
  date_range: CalendarDateRangeSchema.optional(),

  /** Number of days to look ahead from today (used if date_range not specified) */
  lookahead_days: z.number().int().positive().max(365).default(14),
});

export type CalendarSyncOptions = z.infer<typeof CalendarSyncOptionsSchema>;

/**
 * Calendar Sync Result Schema - Result of a sync operation
 */
export const CalendarSyncResultSchema = z.object({
  /** Whether sync was successful */
  success: z.boolean(),

  /** Number of events synced */
  event_count: z.number().int().nonnegative(),

  /** Error message if sync failed */
  error: z.string().optional(),

  /** Timestamp of this sync */
  synced_at: z.string().datetime({ offset: true }),
});

export type CalendarSyncResult = z.infer<typeof CalendarSyncResultSchema>;

/**
 * Today Events Summary Schema - Summary of today's events for widgets
 */
export const TodayEventsSummarySchema = z.object({
  /** Total number of events today */
  total_events: z.number().int().nonnegative(),

  /** Events happening now or next */
  current_or_next: CalendarEventSchema.nullable(),

  /** All events for today */
  events: z.array(CalendarEventSchema),

  /** AI-generated summary of today's schedule (if available) */
  ai_summary: z.string().nullable(),
});

export type TodayEventsSummary = z.infer<typeof TodayEventsSummarySchema>;
