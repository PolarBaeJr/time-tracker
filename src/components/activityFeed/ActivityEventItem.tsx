/**
 * ActivityEventItem Component
 *
 * Displays a single activity event in the feed with avatar, description,
 * and relative timestamp.
 *
 * Features:
 * - User avatar with initials
 * - Event description based on type
 * - Relative timestamp ("5m ago")
 * - Different styling per event type
 * - Tap to navigate (e.g., to entry detail)
 *
 * USAGE:
 * ```tsx
 * import { ActivityEventItem } from '@/components/activityFeed';
 *
 * <ActivityEventItem
 *   event={activityEvent}
 *   onPress={() => navigateToEntry(event.payload.entry_id)}
 * />
 * ```
 */

import * as React from 'react';
import { View, StyleSheet, TouchableOpacity, type ViewStyle, type StyleProp } from 'react-native';

import { Text, Skeleton, Icon } from '@/components/ui';
import { useTheme, spacing } from '@/theme';
import { type ActivityEventWithActor, EVENT_TYPE_CATEGORIES } from '@/schemas';

import { ActivityEventAvatar, ActivityEventAvatarSkeleton } from './ActivityEventAvatar';
import { ActivityEventDescription, getEventDescriptionText } from './ActivityEventDescription';

/**
 * ActivityEventItem component props
 */
export interface ActivityEventItemProps {
  /** The activity event to display */
  event: ActivityEventWithActor;
  /** Callback when event is pressed */
  onPress?: (event: ActivityEventWithActor) => void;
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Format timestamp to relative time string
 */
function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const eventTime = new Date(timestamp).getTime();
  const diffMs = now - eventTime;

  // Convert to seconds
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) {
    return 'Just now';
  }

  // Convert to minutes
  const diffMin = Math.floor(diffSec / 60);

  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }

  // Convert to hours
  const diffHours = Math.floor(diffMin / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  // Convert to days
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  // Convert to weeks
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffWeeks < 4) {
    return `${diffWeeks}w ago`;
  }

  // Show date for older events
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Get event category for styling
 */
type EventCategory = 'timer' | 'entries' | 'goals' | 'members' | 'projects';

function getEventCategory(eventType: string): EventCategory {
  for (const [category, types] of Object.entries(EVENT_TYPE_CATEGORIES)) {
    if ((types as readonly string[]).includes(eventType)) {
      return category as EventCategory;
    }
  }
  return 'entries'; // Default fallback
}

/**
 * Get icon name for event type
 */
function getEventIcon(eventType: string): string {
  switch (eventType) {
    case 'timer_started':
      return 'play';
    case 'timer_stopped':
      return 'pause';
    case 'entry_logged':
      return 'clock';
    case 'entry_approved':
      return 'check-circle';
    case 'entry_rejected':
      return 'x-circle';
    case 'member_joined':
      return 'user-plus';
    case 'member_left':
      return 'user-minus';
    case 'member_role_changed':
      return 'shield';
    case 'project_created':
      return 'folder-plus';
    case 'project_member_added':
      return 'user-plus';
    case 'goal_created':
      return 'target';
    case 'goal_completed':
      return 'award';
    default:
      return 'activity';
  }
}

/**
 * ActivityEventItem Component
 *
 * Renders a single event in the activity feed with avatar, description,
 * and timestamp.
 */
export function ActivityEventItem({
  event,
  onPress,
  compact = false,
  style,
  testID,
}: ActivityEventItemProps): React.ReactElement {
  const { colors } = useTheme();

  // Get event metadata
  const relativeTime = React.useMemo(
    () => formatRelativeTime(event.created_at),
    [event.created_at]
  );

  const eventCategory = React.useMemo(() => getEventCategory(event.event_type), [event.event_type]);

  const eventIcon = React.useMemo(() => getEventIcon(event.event_type), [event.event_type]);

  const accessibilityLabel = React.useMemo(
    () =>
      `${getEventDescriptionText(event.event_type, event.actor.name, event.payload)}, ${relativeTime}`,
    [event, relativeTime]
  );

  // Category-based accent colors
  const categoryColors: Record<EventCategory, string> = {
    timer: colors.warning,
    entries: colors.primary,
    goals: colors.success,
    members: colors.secondary, // Use secondary as info color
    projects: colors.primaryVariant,
  };

  const accentColor = categoryColors[eventCategory];

  const content = (
    <View
      style={[
        styles.container,
        compact ? styles.containerCompact : undefined,
        { borderLeftColor: accentColor },
        style,
      ]}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    >
      {/* Avatar */}
      <ActivityEventAvatar
        name={event.actor.name}
        email={event.actor.email}
        size={compact ? 32 : 40}
      />

      {/* Content */}
      <View style={styles.content}>
        {/* Description */}
        <ActivityEventDescription
          eventType={event.event_type}
          actorName={event.actor.name}
          payload={event.payload}
          compact={compact}
        />

        {/* Timestamp and Icon */}
        <View style={styles.metaRow}>
          <Icon name={eventIcon as never} size={compact ? 12 : 14} color={accentColor} />
          <Text variant="caption" color="muted" style={styles.timestamp}>
            {relativeTime}
          </Text>
        </View>
      </View>
    </View>
  );

  // Wrap in TouchableOpacity if onPress provided
  if (onPress) {
    return (
      <TouchableOpacity
        onPress={() => onPress(event)}
        activeOpacity={0.7}
        accessibilityRole="button"
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

/**
 * ActivityEventItemSkeleton Component
 *
 * Loading placeholder for activity event item.
 */
export interface ActivityEventItemSkeletonProps {
  /** Whether to show in compact mode */
  compact?: boolean;
}

export function ActivityEventItemSkeleton({
  compact = false,
}: ActivityEventItemSkeletonProps): React.ReactElement {
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* Avatar skeleton */}
      <ActivityEventAvatarSkeleton size={compact ? 32 : 40} />

      {/* Content skeleton */}
      <View style={styles.content}>
        <Skeleton variant="text" width="90%" height={compact ? 12 : 14} />
        <View style={styles.skeletonMeta}>
          <Skeleton variant="text" width={60} height={compact ? 10 : 12} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingLeft: spacing.md + 2, // Account for border
    borderLeftWidth: 3,
    gap: spacing.sm,
  },
  containerCompact: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingLeft: spacing.sm + 2,
    gap: spacing.xs,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  timestamp: {
    // Styling handled by Text component
  },
  skeletonMeta: {
    marginTop: spacing.xs,
  },
});

export default ActivityEventItem;
