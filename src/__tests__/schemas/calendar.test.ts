/**
 * Calendar Schema Tests
 *
 * Tests all Calendar Zod schemas with valid and invalid inputs.
 * Covers calendar connections, events, sync options, and related schemas.
 */

import {
  CalendarProviderEnum,
  CalendarConnectionSchema,
  CreateCalendarConnectionSchema,
  EventStatusEnum,
  EventAttendeeSchema,
  CalendarEventSchema,
  CalendarEventsListSchema,
  CalendarDateRangeSchema,
  CalendarSyncOptionsSchema,
  CalendarSyncResultSchema,
  TodayEventsSummarySchema,
} from '@/schemas/calendar';

describe('CalendarProviderEnum', () => {
  it('should accept valid providers', () => {
    expect(CalendarProviderEnum.safeParse('google').success).toBe(true);
    expect(CalendarProviderEnum.safeParse('outlook').success).toBe(true);
  });

  it('should reject invalid providers', () => {
    expect(CalendarProviderEnum.safeParse('yahoo').success).toBe(false);
    expect(CalendarProviderEnum.safeParse('icloud').success).toBe(false);
    expect(CalendarProviderEnum.safeParse('').success).toBe(false);
    expect(CalendarProviderEnum.safeParse(null).success).toBe(false);
  });
});

describe('CalendarConnectionSchema', () => {
  const validConnection = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    user_id: '123e4567-e89b-12d3-a456-426614174001',
    provider: 'google',
    calendar_id: 'primary',
    email_address: 'user@example.com',
    is_active: true,
    last_sync_at: '2024-01-15T10:30:00+00:00',
    sync_error: null,
    created_at: '2024-01-01T00:00:00+00:00',
    updated_at: '2024-01-15T10:30:00+00:00',
  };

  it('should accept valid calendar connection', () => {
    const result = CalendarConnectionSchema.safeParse(validConnection);
    expect(result.success).toBe(true);
  });

  it('should accept connection with nullable fields as null', () => {
    const connectionWithNulls = {
      ...validConnection,
      calendar_id: null,
      last_sync_at: null,
      sync_error: null,
    };
    const result = CalendarConnectionSchema.safeParse(connectionWithNulls);
    expect(result.success).toBe(true);
  });

  it('should accept outlook provider', () => {
    const outlookConnection = { ...validConnection, provider: 'outlook' };
    const result = CalendarConnectionSchema.safeParse(outlookConnection);
    expect(result.success).toBe(true);
  });

  it('should reject invalid provider', () => {
    const invalidProvider = { ...validConnection, provider: 'yahoo' };
    const result = CalendarConnectionSchema.safeParse(invalidProvider);
    expect(result.success).toBe(false);
  });

  it('should reject invalid email', () => {
    const invalidEmail = { ...validConnection, email_address: 'not-an-email' };
    const result = CalendarConnectionSchema.safeParse(invalidEmail);
    expect(result.success).toBe(false);
  });

  it('should reject invalid UUID for id', () => {
    const invalidId = { ...validConnection, id: 'not-a-uuid' };
    const result = CalendarConnectionSchema.safeParse(invalidId);
    expect(result.success).toBe(false);
  });

  it('should reject invalid UUID for user_id', () => {
    const invalidUserId = { ...validConnection, user_id: 'not-a-uuid' };
    const result = CalendarConnectionSchema.safeParse(invalidUserId);
    expect(result.success).toBe(false);
  });

  it('should reject invalid datetime format for timestamps', () => {
    const invalidDatetime = { ...validConnection, created_at: 'not-a-datetime' };
    const result = CalendarConnectionSchema.safeParse(invalidDatetime);
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const missingFields = { id: validConnection.id };
    const result = CalendarConnectionSchema.safeParse(missingFields);
    expect(result.success).toBe(false);
  });
});

describe('CreateCalendarConnectionSchema', () => {
  const validInput = {
    provider: 'google',
    access_token: 'ya29.access_token_here',
    refresh_token: '1//refresh_token_here',
    expires_in: 3600,
    email_address: 'user@gmail.com',
  };

  it('should accept valid OAuth connection input', () => {
    const result = CreateCalendarConnectionSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should accept input with optional calendar_id', () => {
    const withCalendarId = { ...validInput, calendar_id: 'primary' };
    const result = CreateCalendarConnectionSchema.safeParse(withCalendarId);
    expect(result.success).toBe(true);
  });

  it('should accept outlook provider', () => {
    const outlookInput = { ...validInput, provider: 'outlook' };
    const result = CreateCalendarConnectionSchema.safeParse(outlookInput);
    expect(result.success).toBe(true);
  });

  it('should reject missing access_token', () => {
    const { access_token, ...missingToken } = validInput;
    const result = CreateCalendarConnectionSchema.safeParse(missingToken);
    expect(result.success).toBe(false);
  });

  it('should reject empty access_token', () => {
    const emptyToken = { ...validInput, access_token: '' };
    const result = CreateCalendarConnectionSchema.safeParse(emptyToken);
    expect(result.success).toBe(false);
  });

  it('should reject missing refresh_token', () => {
    const { refresh_token, ...missingRefresh } = validInput;
    const result = CreateCalendarConnectionSchema.safeParse(missingRefresh);
    expect(result.success).toBe(false);
  });

  it('should reject empty refresh_token', () => {
    const emptyRefresh = { ...validInput, refresh_token: '' };
    const result = CreateCalendarConnectionSchema.safeParse(emptyRefresh);
    expect(result.success).toBe(false);
  });

  it('should reject invalid expires_in (non-positive)', () => {
    const invalidExpires = { ...validInput, expires_in: 0 };
    const result = CreateCalendarConnectionSchema.safeParse(invalidExpires);
    expect(result.success).toBe(false);
  });

  it('should reject negative expires_in', () => {
    const negativeExpires = { ...validInput, expires_in: -100 };
    const result = CreateCalendarConnectionSchema.safeParse(negativeExpires);
    expect(result.success).toBe(false);
  });

  it('should reject invalid email_address', () => {
    const invalidEmail = { ...validInput, email_address: 'not-an-email' };
    const result = CreateCalendarConnectionSchema.safeParse(invalidEmail);
    expect(result.success).toBe(false);
  });

  it('should reject invalid provider', () => {
    const invalidProvider = { ...validInput, provider: 'icloud' };
    const result = CreateCalendarConnectionSchema.safeParse(invalidProvider);
    expect(result.success).toBe(false);
  });
});

describe('EventStatusEnum', () => {
  it('should accept valid statuses', () => {
    expect(EventStatusEnum.safeParse('confirmed').success).toBe(true);
    expect(EventStatusEnum.safeParse('tentative').success).toBe(true);
    expect(EventStatusEnum.safeParse('cancelled').success).toBe(true);
  });

  it('should reject invalid status', () => {
    expect(EventStatusEnum.safeParse('pending').success).toBe(false);
    expect(EventStatusEnum.safeParse('accepted').success).toBe(false);
    expect(EventStatusEnum.safeParse('').success).toBe(false);
    expect(EventStatusEnum.safeParse(null).success).toBe(false);
  });
});

describe('EventAttendeeSchema', () => {
  it('should accept valid attendee', () => {
    const validAttendee = {
      email: 'attendee@example.com',
      name: 'John Doe',
      status: 'accepted',
    };
    const result = EventAttendeeSchema.safeParse(validAttendee);
    expect(result.success).toBe(true);
  });

  it('should accept attendee without optional name', () => {
    const attendeeNoName = {
      email: 'attendee@example.com',
      status: 'needsAction',
    };
    const result = EventAttendeeSchema.safeParse(attendeeNoName);
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const invalidEmail = {
      email: 'not-an-email',
      status: 'accepted',
    };
    const result = EventAttendeeSchema.safeParse(invalidEmail);
    expect(result.success).toBe(false);
  });

  it('should reject missing status', () => {
    const missingStatus = {
      email: 'attendee@example.com',
    };
    const result = EventAttendeeSchema.safeParse(missingStatus);
    expect(result.success).toBe(false);
  });
});

describe('CalendarEventSchema', () => {
  const validEvent = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    connection_id: '123e4567-e89b-12d3-a456-426614174001',
    provider_id: 'google_event_abc123',
    title: 'Team Meeting',
    description: 'Weekly team sync',
    location: 'Conference Room A',
    start_at: '2024-01-15T10:00:00+00:00',
    end_at: '2024-01-15T11:00:00+00:00',
    is_all_day: false,
    status: 'confirmed',
    organizer: 'organizer@example.com',
    attendees: [
      { email: 'attendee1@example.com', name: 'Alice', status: 'accepted' },
      { email: 'attendee2@example.com', status: 'tentative' },
    ],
    ai_summary: null,
  };

  it('should accept valid calendar event', () => {
    const result = CalendarEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });

  it('should accept event with all nullable fields as null', () => {
    const eventWithNulls = {
      ...validEvent,
      title: null,
      description: null,
      location: null,
      status: null,
      organizer: null,
      attendees: null,
      ai_summary: null,
    };
    const result = CalendarEventSchema.safeParse(eventWithNulls);
    expect(result.success).toBe(true);
  });

  it('should accept all-day event', () => {
    const allDayEvent = { ...validEvent, is_all_day: true };
    const result = CalendarEventSchema.safeParse(allDayEvent);
    expect(result.success).toBe(true);
  });

  it('should accept tentative status', () => {
    const tentativeEvent = { ...validEvent, status: 'tentative' };
    const result = CalendarEventSchema.safeParse(tentativeEvent);
    expect(result.success).toBe(true);
  });

  it('should accept cancelled status', () => {
    const cancelledEvent = { ...validEvent, status: 'cancelled' };
    const result = CalendarEventSchema.safeParse(cancelledEvent);
    expect(result.success).toBe(true);
  });

  it('should reject invalid status', () => {
    const invalidStatus = { ...validEvent, status: 'pending' };
    const result = CalendarEventSchema.safeParse(invalidStatus);
    expect(result.success).toBe(false);
  });

  it('should reject invalid datetime for start_at', () => {
    const invalidStart = { ...validEvent, start_at: 'not-a-datetime' };
    const result = CalendarEventSchema.safeParse(invalidStart);
    expect(result.success).toBe(false);
  });

  it('should reject invalid datetime for end_at', () => {
    const invalidEnd = { ...validEvent, end_at: 'not-a-datetime' };
    const result = CalendarEventSchema.safeParse(invalidEnd);
    expect(result.success).toBe(false);
  });

  it('should reject invalid UUID for id', () => {
    const invalidId = { ...validEvent, id: 'not-a-uuid' };
    const result = CalendarEventSchema.safeParse(invalidId);
    expect(result.success).toBe(false);
  });

  it('should reject invalid UUID for connection_id', () => {
    const invalidConnectionId = { ...validEvent, connection_id: 'not-a-uuid' };
    const result = CalendarEventSchema.safeParse(invalidConnectionId);
    expect(result.success).toBe(false);
  });

  it('should parse attendees array correctly', () => {
    const result = CalendarEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.attendees).toHaveLength(2);
      expect(result.data.attendees?.[0].email).toBe('attendee1@example.com');
      expect(result.data.attendees?.[0].name).toBe('Alice');
      expect(result.data.attendees?.[1].name).toBeUndefined();
    }
  });

  it('should reject attendees with invalid email', () => {
    const invalidAttendee = {
      ...validEvent,
      attendees: [{ email: 'not-an-email', status: 'accepted' }],
    };
    const result = CalendarEventSchema.safeParse(invalidAttendee);
    expect(result.success).toBe(false);
  });

  it('should accept empty attendees array', () => {
    const emptyAttendees = { ...validEvent, attendees: [] };
    const result = CalendarEventSchema.safeParse(emptyAttendees);
    expect(result.success).toBe(true);
  });
});

describe('CalendarEventsListSchema', () => {
  const validEvent = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    connection_id: '123e4567-e89b-12d3-a456-426614174001',
    provider_id: 'google_event_abc123',
    title: 'Meeting',
    description: null,
    location: null,
    start_at: '2024-01-15T10:00:00+00:00',
    end_at: '2024-01-15T11:00:00+00:00',
    is_all_day: false,
    status: 'confirmed',
    organizer: null,
    attendees: null,
    ai_summary: null,
  };

  it('should accept valid events list', () => {
    const eventsList = {
      events: [validEvent],
      has_more: false,
    };
    const result = CalendarEventsListSchema.safeParse(eventsList);
    expect(result.success).toBe(true);
  });

  it('should accept events list with pagination', () => {
    const eventsList = {
      events: [validEvent],
      has_more: true,
      next_page_token: 'abc123',
      total_count: 50,
    };
    const result = CalendarEventsListSchema.safeParse(eventsList);
    expect(result.success).toBe(true);
  });

  it('should accept empty events array', () => {
    const emptyList = {
      events: [],
      has_more: false,
    };
    const result = CalendarEventsListSchema.safeParse(emptyList);
    expect(result.success).toBe(true);
  });
});

describe('CalendarDateRangeSchema', () => {
  it('should accept valid date range', () => {
    const dateRange = {
      start: '2024-01-01T00:00:00+00:00',
      end: '2024-01-31T23:59:59+00:00',
    };
    const result = CalendarDateRangeSchema.safeParse(dateRange);
    expect(result.success).toBe(true);
  });

  it('should reject invalid start datetime', () => {
    const invalidStart = {
      start: 'not-a-datetime',
      end: '2024-01-31T23:59:59+00:00',
    };
    const result = CalendarDateRangeSchema.safeParse(invalidStart);
    expect(result.success).toBe(false);
  });

  it('should reject invalid end datetime', () => {
    const invalidEnd = {
      start: '2024-01-01T00:00:00+00:00',
      end: 'not-a-datetime',
    };
    const result = CalendarDateRangeSchema.safeParse(invalidEnd);
    expect(result.success).toBe(false);
  });
});

describe('CalendarSyncOptionsSchema', () => {
  it('should accept valid sync options', () => {
    const options = {
      max_results: 100,
      lookahead_days: 14,
    };
    const result = CalendarSyncOptionsSchema.safeParse(options);
    expect(result.success).toBe(true);
  });

  it('should accept options with date_range', () => {
    const options = {
      max_results: 50,
      date_range: {
        start: '2024-01-01T00:00:00+00:00',
        end: '2024-01-31T23:59:59+00:00',
      },
    };
    const result = CalendarSyncOptionsSchema.safeParse(options);
    expect(result.success).toBe(true);
  });

  it('should apply defaults for missing optional fields', () => {
    const result = CalendarSyncOptionsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.max_results).toBe(100);
      expect(result.data.lookahead_days).toBe(14);
    }
  });

  it('should reject max_results exceeding 250', () => {
    const options = { max_results: 300 };
    const result = CalendarSyncOptionsSchema.safeParse(options);
    expect(result.success).toBe(false);
  });

  it('should reject lookahead_days exceeding 365', () => {
    const options = { lookahead_days: 400 };
    const result = CalendarSyncOptionsSchema.safeParse(options);
    expect(result.success).toBe(false);
  });

  it('should reject non-positive max_results', () => {
    const options = { max_results: 0 };
    const result = CalendarSyncOptionsSchema.safeParse(options);
    expect(result.success).toBe(false);
  });

  it('should reject non-positive lookahead_days', () => {
    const options = { lookahead_days: 0 };
    const result = CalendarSyncOptionsSchema.safeParse(options);
    expect(result.success).toBe(false);
  });
});

describe('CalendarSyncResultSchema', () => {
  it('should accept successful sync result', () => {
    const result = {
      success: true,
      event_count: 25,
      synced_at: '2024-01-15T10:30:00+00:00',
    };
    const parseResult = CalendarSyncResultSchema.safeParse(result);
    expect(parseResult.success).toBe(true);
  });

  it('should accept failed sync result with error', () => {
    const result = {
      success: false,
      event_count: 0,
      error: 'Authentication failed',
      synced_at: '2024-01-15T10:30:00+00:00',
    };
    const parseResult = CalendarSyncResultSchema.safeParse(result);
    expect(parseResult.success).toBe(true);
  });

  it('should reject negative event_count', () => {
    const result = {
      success: true,
      event_count: -1,
      synced_at: '2024-01-15T10:30:00+00:00',
    };
    const parseResult = CalendarSyncResultSchema.safeParse(result);
    expect(parseResult.success).toBe(false);
  });

  it('should reject invalid synced_at datetime', () => {
    const result = {
      success: true,
      event_count: 10,
      synced_at: 'not-a-datetime',
    };
    const parseResult = CalendarSyncResultSchema.safeParse(result);
    expect(parseResult.success).toBe(false);
  });
});

describe('TodayEventsSummarySchema', () => {
  const validEvent = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    connection_id: '123e4567-e89b-12d3-a456-426614174001',
    provider_id: 'google_event_abc123',
    title: 'Meeting',
    description: null,
    location: null,
    start_at: '2024-01-15T10:00:00+00:00',
    end_at: '2024-01-15T11:00:00+00:00',
    is_all_day: false,
    status: 'confirmed',
    organizer: null,
    attendees: null,
    ai_summary: null,
  };

  it('should accept valid today events summary', () => {
    const summary = {
      total_events: 3,
      current_or_next: validEvent,
      events: [validEvent],
      ai_summary: 'You have 3 meetings today.',
    };
    const result = TodayEventsSummarySchema.safeParse(summary);
    expect(result.success).toBe(true);
  });

  it('should accept summary with no current event', () => {
    const summary = {
      total_events: 0,
      current_or_next: null,
      events: [],
      ai_summary: null,
    };
    const result = TodayEventsSummarySchema.safeParse(summary);
    expect(result.success).toBe(true);
  });

  it('should reject negative total_events', () => {
    const summary = {
      total_events: -1,
      current_or_next: null,
      events: [],
      ai_summary: null,
    };
    const result = TodayEventsSummarySchema.safeParse(summary);
    expect(result.success).toBe(false);
  });
});
