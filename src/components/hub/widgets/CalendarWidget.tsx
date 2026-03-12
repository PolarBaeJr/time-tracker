/**
 * CalendarWidget Component
 *
 * Hub widget displaying today's calendar events, upcoming events,
 * and AI-powered schedule summaries.
 *
 * Supports three sizes:
 * - Small: Event count badge only
 * - Medium: Next event + 2 more events
 * - Large: Full schedule + AI summary
 */

import * as React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { WidgetCard } from '../WidgetCard';
import { Text, Button, Icon } from '@/components/ui';
import { useTheme, spacing, borderRadius } from '@/theme';
import { useTodayEvents, useCalendarConnections } from '@/hooks';
import type { CalendarEvent } from '@/schemas/calendar';
import type { WidgetSize } from '../WidgetRegistry';
import type { MainTabParamList } from '@/navigation/types';

/**
 * CalendarWidget component props
 */
export interface CalendarWidgetProps {
  /** Widget size affects layout and information density */
  size: WidgetSize;
}

type TabNav = BottomTabNavigationProp<MainTabParamList>;

/**
 * Format time for display (e.g., "9:30 AM")
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
 */
function formatTimeRange(startAt: string, endAt: string, isAllDay: boolean): string {
  if (isAllDay) {
    return 'All day';
  }
  return `${formatEventTime(startAt)} - ${formatEventTime(endAt)}`;
}

/**
 * Check if an event is currently happening
 */
function isEventCurrent(event: CalendarEvent): boolean {
  const now = new Date();
  const startAt = new Date(event.start_at);
  const endAt = new Date(event.end_at);
  return startAt <= now && endAt > now;
}

/**
 * Check if an event is the next upcoming event
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
 * EventBadge - Shows "Now" or "Next" badge
 */
function EventBadge({ type, color }: { type: 'now' | 'next'; color: string }): React.ReactElement {
  return (
    <View style={[styles.eventBadge, { backgroundColor: `${color}20` }]}>
      <Text variant="caption" style={[styles.badgeText, { color }]}>
        {type === 'now' ? 'Now' : 'Next'}
      </Text>
    </View>
  );
}

/**
 * EventItem - Single event display
 */
function EventItem({
  event,
  events,
  compact = false,
}: {
  event: CalendarEvent;
  events: CalendarEvent[];
  compact?: boolean;
}): React.ReactElement {
  const { colors } = useTheme();
  const isCurrent = isEventCurrent(event);
  const isNext = isEventNext(event, events);

  return (
    <View style={[styles.eventItem, compact && styles.eventItemCompact]}>
      <View style={styles.eventTimeContainer}>
        <Text
          variant={compact ? 'caption' : 'bodySmall'}
          color="secondary"
          style={styles.eventTime}
        >
          {formatTimeRange(event.start_at, event.end_at, event.is_all_day)}
        </Text>
        {isCurrent && <EventBadge type="now" color={colors.success} />}
        {isNext && !isCurrent && <EventBadge type="next" color={colors.primary} />}
      </View>
      <Text variant={compact ? 'bodySmall' : 'body'} numberOfLines={1} style={styles.eventTitle}>
        {event.title || '(No title)'}
      </Text>
      {!compact && event.location && (
        <View style={styles.eventLocation}>
          <Icon name="location" size={12} color={colors.textMuted} />
          <Text variant="caption" color="muted" numberOfLines={1} style={styles.locationText}>
            {event.location}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * NotConnectedState - Shown when no calendar is connected
 */
function NotConnectedState({
  size,
  onConnect,
}: {
  size: WidgetSize;
  onConnect: () => void;
}): React.ReactElement {
  const { colors } = useTheme();

  if (size === 'small') {
    return (
      <Pressable onPress={onConnect} style={styles.compactContainer}>
        <Icon name="calendar" size={20} color={colors.textMuted} />
      </Pressable>
    );
  }

  return (
    <View style={styles.emptyContainer}>
      <Icon name="calendar" size={32} color={colors.textMuted} />
      <Text variant="bodySmall" color="secondary" style={styles.emptyText}>
        Connect a calendar to see your events
      </Text>
      <Button variant="secondary" size="sm" onPress={onConnect}>
        Connect Calendar
      </Button>
    </View>
  );
}

/**
 * EmptyState - Shown when connected but no events today
 */
function EmptyState({ size }: { size: WidgetSize }): React.ReactElement {
  const { colors } = useTheme();

  if (size === 'small') {
    return (
      <View style={styles.compactContainer}>
        <Text variant="heading">0</Text>
      </View>
    );
  }

  return (
    <View style={styles.emptyContainer}>
      <Icon name="sunny" size={32} color={colors.warning} />
      <Text variant="bodySmall" color="secondary" style={styles.emptyText}>
        No events scheduled for today
      </Text>
    </View>
  );
}

/**
 * CalendarWidget Component
 *
 * Displays today's calendar events with size-responsive layouts.
 * - Small size: Event count only
 * - Medium: Current/next event + 2 more
 * - Large: Full schedule + AI summary
 */
export function CalendarWidget({ size }: CalendarWidgetProps): React.ReactElement {
  const { colors } = useTheme();
  const navigation = useNavigation<TabNav>();

  // Fetch calendar connections to check if connected
  const { data: connections, isLoading: connectionsLoading } = useCalendarConnections();

  // Fetch today's events
  const { data: todayData, isLoading: eventsLoading, error } = useTodayEvents();

  const isConnected = (connections?.length ?? 0) > 0;
  const isLoading = connectionsLoading || (isConnected && eventsLoading);

  const handleNavigateToCalendar = React.useCallback(() => {
    // Navigate to Settings > Calendar for now
    // TODO: Navigate to dedicated Calendar screen when available
    navigation.navigate('Settings');
  }, [navigation]);

  const handleConnect = React.useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  // Not connected state
  if (!isLoading && !isConnected) {
    return (
      <WidgetCard
        title="Calendar"
        icon="calendar"
        size={size}
        loading={false}
        error={null}
        onExpand={handleConnect}
      >
        <NotConnectedState size={size} onConnect={handleConnect} />
      </WidgetCard>
    );
  }

  const events = todayData?.events ?? [];
  const totalEvents = todayData?.total_events ?? 0;
  const currentOrNext = todayData?.current_or_next;

  // Empty state (connected but no events)
  if (!isLoading && !error && events.length === 0) {
    return (
      <WidgetCard
        title="Calendar"
        icon="calendar"
        size={size}
        loading={false}
        error={null}
        onExpand={handleNavigateToCalendar}
      >
        <EmptyState size={size} />
      </WidgetCard>
    );
  }

  // Small size: Event count only
  if (size === 'small') {
    return (
      <WidgetCard
        title="Calendar"
        icon="calendar"
        size={size}
        loading={isLoading}
        error={error ?? null}
        onExpand={handleNavigateToCalendar}
      >
        <Pressable
          onPress={handleNavigateToCalendar}
          style={styles.compactContainer}
          accessibilityRole="button"
          accessibilityLabel={`${totalEvents} events today`}
        >
          <View style={styles.compactRow}>
            {currentOrNext && isEventCurrent(currentOrNext) && (
              <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
            )}
            <Text variant="heading" style={styles.compactCount}>
              {totalEvents}
            </Text>
            <Text variant="caption" color="secondary">
              {totalEvents === 1 ? 'event' : 'events'}
            </Text>
          </View>
        </Pressable>
      </WidgetCard>
    );
  }

  // Medium size: Current/next event + 2 more
  if (size === 'medium') {
    const displayEvents = events.slice(0, 3);

    return (
      <WidgetCard
        title="Calendar"
        icon="calendar"
        size={size}
        loading={isLoading}
        error={error ?? null}
        onExpand={handleNavigateToCalendar}
      >
        <View style={styles.mediumContainer}>
          {displayEvents.map((event, index) => (
            <EventItem key={event.id} event={event} events={events} compact={index > 0} />
          ))}
          {totalEvents > 3 && (
            <Pressable onPress={handleNavigateToCalendar} style={styles.moreEvents}>
              <Text variant="caption" color="primary">
                +{totalEvents - 3} more
              </Text>
            </Pressable>
          )}
        </View>
      </WidgetCard>
    );
  }

  // Large size: Full schedule + AI summary
  const maxDisplayEvents = 6;
  const displayEvents = events.slice(0, maxDisplayEvents);
  const aiSummary = todayData?.ai_summary;

  return (
    <WidgetCard
      title="Calendar"
      icon="calendar"
      size={size}
      loading={isLoading}
      error={error ?? null}
      onExpand={handleNavigateToCalendar}
    >
      <View style={styles.largeContainer}>
        {/* AI Summary Section */}
        {aiSummary && (
          <View style={[styles.aiSummary, { backgroundColor: `${colors.primary}10` }]}>
            <View style={styles.aiSummaryHeader}>
              <Icon name="sparkles" size={14} color={colors.primary} />
              <Text variant="caption" color="primary" style={styles.aiSummaryLabel}>
                AI Summary
              </Text>
            </View>
            <Text variant="bodySmall" color="secondary">
              {aiSummary}
            </Text>
          </View>
        )}

        {/* Events List */}
        <View style={styles.eventsList}>
          <Text variant="caption" color="secondary" style={styles.eventsListHeader}>
            {`Today's Schedule (${totalEvents} ${totalEvents === 1 ? 'event' : 'events'})`}
          </Text>
          {displayEvents.map(event => (
            <EventItem key={event.id} event={event} events={events} />
          ))}
          {totalEvents > maxDisplayEvents && (
            <Pressable onPress={handleNavigateToCalendar} style={styles.moreEvents}>
              <Text variant="caption" color="primary">
                View all {totalEvents} events
              </Text>
              <Icon name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          )}
        </View>
      </View>
    </WidgetCard>
  );
}

const styles = StyleSheet.create({
  compactContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  compactCount: {
    marginLeft: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mediumContainer: {
    minHeight: 80,
    gap: spacing.sm,
  },
  largeContainer: {
    minHeight: 120,
    gap: spacing.md,
  },
  eventItem: {
    gap: spacing.xs / 2,
  },
  eventItemCompact: {
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  eventTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  eventTime: {
    // Time styling handled by Text variant
  },
  eventBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    fontWeight: '600',
  },
  eventTitle: {
    // Title styling handled by Text variant
  },
  eventLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    marginTop: spacing.xs / 2,
  },
  locationText: {
    flex: 1,
  },
  moreEvents: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  aiSummary: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  aiSummaryLabel: {
    fontWeight: '600',
  },
  eventsList: {
    gap: spacing.sm,
  },
  eventsListHeader: {
    marginBottom: spacing.xs,
  },
});

export default CalendarWidget;
