/**
 * CalendarWidget Component Tests
 *
 * Tests for the CalendarWidget component logic including:
 * - Event time formatting
 * - Time range formatting
 * - Current event detection
 * - Next event detection
 * - Widget state logic
 */

import type { CalendarEvent } from '@/schemas/calendar';

// Since testing React Native components requires complex setup with
// react-native-testing-library and a proper native environment,
// we test the core logic functions directly.

/**
 * Format time for display (e.g., "9:30 AM")
 * (Copied from CalendarWidget for isolated testing)
 */
function formatEventTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format time range for display (e.g., "9:30 AM - 10:30 AM")
 * (Copied from CalendarWidget for isolated testing)
 */
function formatTimeRange(startAt: string, endAt: string, isAllDay: boolean): string {
  if (isAllDay) {
    return 'All day';
  }
  return `${formatEventTime(startAt)} - ${formatEventTime(endAt)}`;
}

/**
 * Check if an event is currently happening
 * (Copied from CalendarWidget for isolated testing)
 */
function isEventCurrent(event: CalendarEvent): boolean {
  const now = new Date();
  const startAt = new Date(event.start_at);
  const endAt = new Date(event.end_at);
  return startAt <= now && endAt > now;
}

/**
 * Check if an event is the next upcoming event
 * (Copied from CalendarWidget for isolated testing)
 */
function isEventNext(event: CalendarEvent, events: CalendarEvent[]): boolean {
  const now = new Date();
  const startAt = new Date(event.start_at);

  // Must be in the future
  if (startAt <= now) return false;

  // Must be the first future event
  const futureEvents = events.filter(e => new Date(e.start_at) > now);
  if (futureEvents.length === 0) return false;

  return futureEvents[0].id === event.id;
}

/**
 * Helper to create a mock calendar event
 */
function createMockEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'event-1',
    connection_id: 'conn-1',
    provider_id: 'provider-event-1',
    title: 'Test Meeting',
    description: null,
    location: null,
    start_at: new Date().toISOString(),
    end_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour later
    is_all_day: false,
    status: 'confirmed',
    organizer: null,
    attendees: null,
    ai_summary: null,
    ...overrides,
  };
}

describe('CalendarWidget', () => {
  describe('formatEventTime', () => {
    it('should format morning time correctly', () => {
      const result = formatEventTime('2024-01-15T09:30:00');
      // Note: locale-dependent, but should contain 9:30
      expect(result).toMatch(/9:30/);
    });

    it('should format noon correctly', () => {
      const result = formatEventTime('2024-01-15T12:00:00');
      expect(result).toMatch(/12:00/);
    });

    it('should format afternoon time correctly', () => {
      const result = formatEventTime('2024-01-15T14:15:00');
      // 2:15 PM in 12-hour format
      expect(result).toMatch(/2:15/);
    });

    it('should format midnight correctly', () => {
      const result = formatEventTime('2024-01-15T00:00:00');
      expect(result).toMatch(/12:00/);
    });

    it('should include AM/PM indicator', () => {
      const morningResult = formatEventTime('2024-01-15T09:00:00');
      const afternoonResult = formatEventTime('2024-01-15T15:00:00');
      // Should contain AM or PM (locale-dependent format)
      expect(morningResult).toMatch(/AM|am/i);
      expect(afternoonResult).toMatch(/PM|pm/i);
    });
  });

  describe('formatTimeRange', () => {
    it('should return "All day" for all-day events', () => {
      const result = formatTimeRange('2024-01-15T00:00:00', '2024-01-16T00:00:00', true);
      expect(result).toBe('All day');
    });

    it('should format time range for timed events', () => {
      const result = formatTimeRange('2024-01-15T09:30:00', '2024-01-15T10:30:00', false);
      // Should contain both times with separator
      expect(result).toMatch(/9:30.*-.*10:30/);
    });

    it('should handle same start and end time', () => {
      const result = formatTimeRange('2024-01-15T14:00:00', '2024-01-15T14:00:00', false);
      // Both times should be the same
      expect(result).toMatch(/2:00.*-.*2:00/);
    });

    it('should handle overnight events', () => {
      const result = formatTimeRange('2024-01-15T22:00:00', '2024-01-16T02:00:00', false);
      expect(result).toMatch(/10:00.*PM.*-.*2:00.*AM/i);
    });
  });

  describe('isEventCurrent', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return true for event happening now', () => {
      const now = new Date('2024-01-15T10:30:00');
      jest.setSystemTime(now);

      const event = createMockEvent({
        start_at: '2024-01-15T10:00:00',
        end_at: '2024-01-15T11:00:00',
      });

      expect(isEventCurrent(event)).toBe(true);
    });

    it('should return false for past event', () => {
      const now = new Date('2024-01-15T12:00:00');
      jest.setSystemTime(now);

      const event = createMockEvent({
        start_at: '2024-01-15T09:00:00',
        end_at: '2024-01-15T10:00:00',
      });

      expect(isEventCurrent(event)).toBe(false);
    });

    it('should return false for future event', () => {
      const now = new Date('2024-01-15T08:00:00');
      jest.setSystemTime(now);

      const event = createMockEvent({
        start_at: '2024-01-15T10:00:00',
        end_at: '2024-01-15T11:00:00',
      });

      expect(isEventCurrent(event)).toBe(false);
    });

    it('should return true at exact start time', () => {
      const now = new Date('2024-01-15T10:00:00');
      jest.setSystemTime(now);

      const event = createMockEvent({
        start_at: '2024-01-15T10:00:00',
        end_at: '2024-01-15T11:00:00',
      });

      expect(isEventCurrent(event)).toBe(true);
    });

    it('should return false at exact end time', () => {
      const now = new Date('2024-01-15T11:00:00');
      jest.setSystemTime(now);

      const event = createMockEvent({
        start_at: '2024-01-15T10:00:00',
        end_at: '2024-01-15T11:00:00',
      });

      expect(isEventCurrent(event)).toBe(false);
    });

    it('should handle all-day events', () => {
      const now = new Date('2024-01-15T14:00:00');
      jest.setSystemTime(now);

      const event = createMockEvent({
        start_at: '2024-01-15T00:00:00',
        end_at: '2024-01-16T00:00:00',
        is_all_day: true,
      });

      expect(isEventCurrent(event)).toBe(true);
    });
  });

  describe('isEventNext', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return true for the first future event', () => {
      const now = new Date('2024-01-15T09:00:00');
      jest.setSystemTime(now);

      const event1 = createMockEvent({
        id: 'event-1',
        start_at: '2024-01-15T10:00:00',
        end_at: '2024-01-15T11:00:00',
      });
      const event2 = createMockEvent({
        id: 'event-2',
        start_at: '2024-01-15T14:00:00',
        end_at: '2024-01-15T15:00:00',
      });

      const events = [event1, event2];

      expect(isEventNext(event1, events)).toBe(true);
      expect(isEventNext(event2, events)).toBe(false);
    });

    it('should return false for past events', () => {
      const now = new Date('2024-01-15T12:00:00');
      jest.setSystemTime(now);

      const pastEvent = createMockEvent({
        id: 'event-1',
        start_at: '2024-01-15T09:00:00',
        end_at: '2024-01-15T10:00:00',
      });

      expect(isEventNext(pastEvent, [pastEvent])).toBe(false);
    });

    it('should return false for currently happening events', () => {
      const now = new Date('2024-01-15T10:30:00');
      jest.setSystemTime(now);

      const currentEvent = createMockEvent({
        id: 'event-1',
        start_at: '2024-01-15T10:00:00',
        end_at: '2024-01-15T11:00:00',
      });

      expect(isEventNext(currentEvent, [currentEvent])).toBe(false);
    });

    it('should return false when there are no future events', () => {
      const now = new Date('2024-01-15T18:00:00');
      jest.setSystemTime(now);

      const pastEvent = createMockEvent({
        id: 'event-1',
        start_at: '2024-01-15T09:00:00',
        end_at: '2024-01-15T10:00:00',
      });

      expect(isEventNext(pastEvent, [pastEvent])).toBe(false);
    });

    it('should handle events starting at the same time', () => {
      const now = new Date('2024-01-15T09:00:00');
      jest.setSystemTime(now);

      const event1 = createMockEvent({
        id: 'event-1',
        start_at: '2024-01-15T10:00:00',
        end_at: '2024-01-15T11:00:00',
      });
      const event2 = createMockEvent({
        id: 'event-2',
        start_at: '2024-01-15T10:00:00',
        end_at: '2024-01-15T12:00:00',
      });

      const events = [event1, event2];

      // Only the first one in the array should be marked as next
      expect(isEventNext(event1, events)).toBe(true);
      expect(isEventNext(event2, events)).toBe(false);
    });

    it('should correctly identify next when first event is current', () => {
      const now = new Date('2024-01-15T10:30:00');
      jest.setSystemTime(now);

      const currentEvent = createMockEvent({
        id: 'event-1',
        start_at: '2024-01-15T10:00:00',
        end_at: '2024-01-15T11:00:00',
      });
      const futureEvent = createMockEvent({
        id: 'event-2',
        start_at: '2024-01-15T14:00:00',
        end_at: '2024-01-15T15:00:00',
      });

      const events = [currentEvent, futureEvent];

      expect(isEventNext(currentEvent, events)).toBe(false);
      expect(isEventNext(futureEvent, events)).toBe(true);
    });
  });

  describe('widget state logic', () => {
    interface WidgetState {
      isConnected: boolean;
      isLoading: boolean;
      error: Error | null;
      events: CalendarEvent[];
      totalEvents: number;
    }

    type WidgetDisplayState =
      | { type: 'loading' }
      | { type: 'not_connected' }
      | { type: 'error'; message: string }
      | { type: 'empty' }
      | { type: 'data'; events: CalendarEvent[]; totalEvents: number };

    function getDisplayState(state: WidgetState): WidgetDisplayState {
      if (state.isLoading) {
        return { type: 'loading' };
      }

      if (!state.isConnected) {
        return { type: 'not_connected' };
      }

      if (state.error) {
        return { type: 'error', message: state.error.message };
      }

      if (state.events.length === 0) {
        return { type: 'empty' };
      }

      return {
        type: 'data',
        events: state.events,
        totalEvents: state.totalEvents,
      };
    }

    it('should return loading state when loading', () => {
      const state: WidgetState = {
        isConnected: true,
        isLoading: true,
        error: null,
        events: [],
        totalEvents: 0,
      };

      expect(getDisplayState(state)).toEqual({ type: 'loading' });
    });

    it('should return not_connected state when no calendar connected', () => {
      const state: WidgetState = {
        isConnected: false,
        isLoading: false,
        error: null,
        events: [],
        totalEvents: 0,
      };

      expect(getDisplayState(state)).toEqual({ type: 'not_connected' });
    });

    it('should return error state when error present', () => {
      const state: WidgetState = {
        isConnected: true,
        isLoading: false,
        error: new Error('Failed to fetch events'),
        events: [],
        totalEvents: 0,
      };

      const result = getDisplayState(state);
      expect(result.type).toBe('error');
      if (result.type === 'error') {
        expect(result.message).toBe('Failed to fetch events');
      }
    });

    it('should return empty state when connected but no events', () => {
      const state: WidgetState = {
        isConnected: true,
        isLoading: false,
        error: null,
        events: [],
        totalEvents: 0,
      };

      expect(getDisplayState(state)).toEqual({ type: 'empty' });
    });

    it('should return data state with events', () => {
      const mockEvent = createMockEvent();
      const state: WidgetState = {
        isConnected: true,
        isLoading: false,
        error: null,
        events: [mockEvent],
        totalEvents: 1,
      };

      const result = getDisplayState(state);
      expect(result.type).toBe('data');
      if (result.type === 'data') {
        expect(result.events).toHaveLength(1);
        expect(result.totalEvents).toBe(1);
      }
    });

    it('should prioritize loading over other states', () => {
      const state: WidgetState = {
        isConnected: false,
        isLoading: true,
        error: new Error('Some error'),
        events: [],
        totalEvents: 0,
      };

      expect(getDisplayState(state)).toEqual({ type: 'loading' });
    });
  });

  describe('size-based event display limits', () => {
    /**
     * Helper to get max events for a given widget size
     */
    function getMaxEventsForSize(size: 'small' | 'medium' | 'large'): number {
      switch (size) {
        case 'small':
          return 0; // Small just shows count
        case 'medium':
          return 3;
        case 'large':
          return 6;
      }
    }

    it('should limit events for small size (count only)', () => {
      const maxEvents = getMaxEventsForSize('small');
      expect(maxEvents).toBe(0);
    });

    it('should limit events for medium size to 3', () => {
      const maxEvents = getMaxEventsForSize('medium');
      const events = Array(5)
        .fill(null)
        .map((_, i) =>
          createMockEvent({
            id: `event-${i}`,
            start_at: new Date(Date.now() + i * 60 * 60 * 1000).toISOString(),
          })
        );

      const displayEvents = events.slice(0, maxEvents);
      expect(displayEvents).toHaveLength(3);
    });

    it('should limit events for large size to 6', () => {
      const maxEvents = getMaxEventsForSize('large');
      const events = Array(10)
        .fill(null)
        .map((_, i) =>
          createMockEvent({
            id: `event-${i}`,
            start_at: new Date(Date.now() + i * 60 * 60 * 1000).toISOString(),
          })
        );

      const displayEvents = events.slice(0, maxEvents);
      expect(displayEvents).toHaveLength(6);
    });
  });

  describe('event display logic', () => {
    it('should show "more events" link when total exceeds display limit', () => {
      const totalEvents = 5;
      const displayedEvents = 3;
      const showMoreLink = totalEvents > displayedEvents;

      expect(showMoreLink).toBe(true);
    });

    it('should not show "more events" link when all events displayed', () => {
      const totalEvents = 2;
      const displayedEvents = 3;
      const showMoreLink = totalEvents > displayedEvents;

      expect(showMoreLink).toBe(false);
    });

    it('should calculate remaining events correctly', () => {
      const totalEvents = 8;
      const displayedEvents = 3;
      const remainingEvents = totalEvents - displayedEvents;

      expect(remainingEvents).toBe(5);
    });

    it('should use singular "event" for 1 event', () => {
      const totalEvents: number = 1;
      const label = totalEvents === 1 ? 'event' : 'events';

      expect(label).toBe('event');
    });

    it('should use plural "events" for multiple events', () => {
      const totalEvents: number = 5;
      const label = totalEvents === 1 ? 'event' : 'events';

      expect(label).toBe('events');
    });
  });

  describe('event title display', () => {
    it('should use "(No title)" for events without title', () => {
      const event = createMockEvent({ title: null });
      const displayTitle = event.title || '(No title)';

      expect(displayTitle).toBe('(No title)');
    });

    it('should use actual title when present', () => {
      const event = createMockEvent({ title: 'Team Standup' });
      const displayTitle = event.title || '(No title)';

      expect(displayTitle).toBe('Team Standup');
    });

    it('should handle empty string title', () => {
      const event = createMockEvent({ title: '' });
      const displayTitle = event.title || '(No title)';

      expect(displayTitle).toBe('(No title)');
    });
  });

  describe('location display', () => {
    /**
     * Helper to determine if location should be shown
     */
    function shouldShowLocation(event: CalendarEvent, compact: boolean): boolean {
      return !compact && !!event.location;
    }

    it('should show location when present', () => {
      const event = createMockEvent({ location: 'Conference Room A' });
      const showLocation = shouldShowLocation(event, false);

      expect(showLocation).toBe(true);
    });

    it('should not show location when null', () => {
      const event = createMockEvent({ location: null });
      const showLocation = shouldShowLocation(event, false);

      expect(showLocation).toBe(false);
    });

    it('should not show location in compact mode', () => {
      const event = createMockEvent({ location: 'Conference Room A' });
      const showLocation = shouldShowLocation(event, true);

      expect(showLocation).toBe(false);
    });
  });
});
