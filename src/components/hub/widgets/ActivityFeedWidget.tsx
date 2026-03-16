/**
 * ActivityFeedWidget Component
 *
 * Compact hub widget displaying the latest activity events from the workspace.
 * Supports small (3 events), medium (5 events), and large (5 events with more detail) sizes.
 * Provides real-time updates and "View All" navigation to full feed.
 *
 * USAGE:
 * ```tsx
 * import { ActivityFeedWidget } from '@/components/hub/widgets';
 *
 * <ActivityFeedWidget size="medium" />
 * ```
 */

import * as React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { WidgetCard } from '../WidgetCard';
import { Text, Icon } from '@/components/ui';
import {
  ActivityEventItem,
  ActivityEventItemSkeleton,
} from '@/components/activityFeed/ActivityEventItem';
import { useTheme, spacing } from '@/theme';
import { useActivityFeed, useActivityFeedRealtime } from '@/hooks/useActivityFeed';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import type { WidgetSize } from '../WidgetRegistry';
import type { MainTabParamList } from '@/navigation/types';
import type { ActivityEventWithActor } from '@/schemas';

/**
 * ActivityFeedWidget component props
 */
export interface ActivityFeedWidgetProps {
  /** Widget size affects layout and number of events shown */
  size: WidgetSize;
}

type TabNav = BottomTabNavigationProp<MainTabParamList>;

/**
 * Get number of events to show based on widget size
 */
function getEventCount(size: WidgetSize): number {
  switch (size) {
    case 'small':
      return 3;
    case 'medium':
    case 'large':
      return 5;
  }
}

/**
 * Compact event row for small widget size
 */
interface CompactEventProps {
  event: ActivityEventWithActor;
}

/**
 * Format relative time from timestamp
 */
function formatRelativeTimeCompact(timestamp: string): string {
  const now = Date.now();
  const eventTime = new Date(timestamp).getTime();
  const diffMs = now - eventTime;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

function CompactEvent({ event }: CompactEventProps): React.ReactElement {
  const { colors } = useTheme();

  // Format relative time (computed outside render for purity)
  const relativeTime = formatRelativeTimeCompact(event.created_at);

  // Get actor initials
  const initials = React.useMemo(() => {
    const name = event.actor.name || event.actor.email || '?';
    return name.charAt(0).toUpperCase();
  }, [event.actor]);

  // Get short description
  const description = React.useMemo(() => {
    switch (event.event_type) {
      case 'timer_started':
        return 'started timer';
      case 'timer_stopped':
        return 'stopped timer';
      case 'entry_logged':
        return 'logged entry';
      case 'entry_approved':
        return 'approved entry';
      case 'entry_rejected':
        return 'rejected entry';
      case 'member_joined':
        return 'joined workspace';
      case 'member_left':
        return 'left workspace';
      case 'goal_created':
        return 'created goal';
      case 'goal_completed':
        return 'completed goal';
      case 'project_created':
        return 'created project';
      default:
        return 'activity';
    }
  }, [event.event_type]);

  const avatarStyle = React.useMemo(
    () => [styles.compactAvatar, { backgroundColor: colors.primary + '20' }],
    [colors.primary]
  );
  const initialsStyle = React.useMemo(() => ({ color: colors.primary }), [colors.primary]);

  return (
    <View style={styles.compactEvent}>
      <View style={avatarStyle}>
        <Text variant="caption" style={[styles.initialsText, initialsStyle]}>
          {initials}
        </Text>
      </View>
      <Text variant="caption" numberOfLines={1} style={styles.compactName}>
        {event.actor.name || 'Someone'}
      </Text>
      <Text variant="caption" color="muted" numberOfLines={1}>
        {description}
      </Text>
      <Text variant="caption" color="muted" style={styles.compactTime}>
        {relativeTime}
      </Text>
    </View>
  );
}

/**
 * Loading skeleton for compact events
 */
function CompactSkeleton({ count }: { count: number }): React.ReactElement {
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: count }).map((_, i) => (
        <ActivityEventItemSkeleton key={i} compact />
      ))}
    </View>
  );
}

/**
 * Empty state for no workspace selected
 */
function NoWorkspaceState(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.emptyContainer}>
      <Icon name="activity" size={24} color={colors.textMuted} />
      <Text variant="caption" color="muted" style={styles.emptyText}>
        Select a workspace to view activity
      </Text>
    </View>
  );
}

/**
 * Empty state for no activity
 */
function NoActivityState(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.emptyContainer}>
      <Icon name="activity" size={24} color={colors.textMuted} />
      <Text variant="caption" color="muted" style={styles.emptyText}>
        No recent activity
      </Text>
    </View>
  );
}

/**
 * Connection status indicator
 */
interface ConnectionBadgeProps {
  status: 'connected' | 'reconnecting' | 'disconnected';
}

function ConnectionBadge({ status }: ConnectionBadgeProps): React.ReactElement | null {
  const { colors } = useTheme();

  if (status === 'connected') {
    return null; // Don't show badge when connected
  }

  const color = status === 'reconnecting' ? colors.warning : colors.error;
  const text = status === 'reconnecting' ? 'Reconnecting...' : 'Offline';

  return (
    <View style={[styles.connectionBadge, { backgroundColor: color + '20' }]}>
      <View style={[styles.connectionDot, { backgroundColor: color }]} />
      <Text variant="caption" style={{ color }}>
        {text}
      </Text>
    </View>
  );
}

/**
 * ActivityFeedWidget Component
 *
 * Displays a compact view of recent activity events with real-time updates.
 * Supports small, medium, and large sizes with appropriate layouts.
 */
export function ActivityFeedWidget({ size }: ActivityFeedWidgetProps): React.ReactElement {
  const { colors } = useTheme();
  const navigation = useNavigation<TabNav>();

  // Get current workspace from context
  const { activeWorkspace } = useWorkspaceContext();
  const workspaceId = activeWorkspace?.id ?? null;

  // Number of events to show
  const eventCount = getEventCount(size);

  // Fetch activity feed
  const { data, isLoading, error } = useActivityFeed(workspaceId ?? '', {
    pageSize: eventCount,
    enabled: !!workspaceId,
  });

  // Subscribe to realtime updates
  const { connectionStatus } = useActivityFeedRealtime(workspaceId ?? '', {
    enabled: !!workspaceId,
  });

  // Get events from first page
  const events = React.useMemo(() => {
    if (!data?.pages?.[0]?.events) return [];
    return data.pages[0].events.slice(0, eventCount);
  }, [data, eventCount]);

  // Handle navigation to full activity feed
  const handleViewAll = React.useCallback(() => {
    navigation.navigate('ActivityFeed');
  }, [navigation]);

  // Render compact view for small size
  if (size === 'small') {
    return (
      <WidgetCard
        title="Activity"
        icon="activity"
        size={size}
        loading={isLoading}
        error={error ?? null}
        onExpand={workspaceId ? handleViewAll : undefined}
      >
        {!workspaceId ? (
          <NoWorkspaceState />
        ) : events.length === 0 ? (
          <NoActivityState />
        ) : (
          <Pressable
            onPress={handleViewAll}
            style={styles.compactContainer}
            accessibilityRole="button"
            accessibilityLabel="View full activity feed"
          >
            {events.map(event => (
              <CompactEvent key={event.id} event={event} />
            ))}
          </Pressable>
        )}
      </WidgetCard>
    );
  }

  // Render full view for medium/large size
  return (
    <WidgetCard
      title="Activity"
      icon="activity"
      size={size}
      loading={isLoading}
      error={error ?? null}
      onExpand={workspaceId ? handleViewAll : undefined}
    >
      {!workspaceId ? (
        <NoWorkspaceState />
      ) : events.length === 0 ? (
        <NoActivityState />
      ) : (
        <View style={styles.fullContainer}>
          {/* Connection Status (if not connected) */}
          <ConnectionBadge status={connectionStatus} />

          {/* Events List */}
          <View style={styles.eventsList}>
            {events.map(event => (
              <ActivityEventItem key={event.id} event={event} compact={size === 'medium'} />
            ))}
          </View>

          {/* View All Link */}
          <Pressable
            onPress={handleViewAll}
            style={styles.viewAllButton}
            accessibilityRole="button"
            accessibilityLabel="View full activity feed"
          >
            <Text variant="caption" color="primary">
              View All
            </Text>
            <Icon name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        </View>
      )}
    </WidgetCard>
  );
}

const styles = StyleSheet.create({
  compactContainer: {
    minHeight: 60,
    justifyContent: 'center',
  },
  compactEvent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    gap: spacing.xs,
  },
  compactAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactName: {
    flex: 1,
    fontWeight: '500',
  },
  initialsText: {
    fontSize: 10,
    fontWeight: '600',
  },
  compactTime: {
    minWidth: 20,
    textAlign: 'right',
  },
  fullContainer: {
    minHeight: 100,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  eventsList: {
    gap: spacing.xs,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  emptyText: {
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  skeletonContainer: {
    gap: spacing.xs,
  },
});

export default ActivityFeedWidget;
