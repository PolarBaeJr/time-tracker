/**
 * ActivityFeedList Component
 *
 * Full activity feed display with infinite scroll, pull to refresh,
 * empty state, and realtime connection indicator.
 *
 * Features:
 * - Virtualized list of events for performance
 * - Load more on scroll (infinite pagination)
 * - Pull to refresh
 * - Empty state when no events
 * - Realtime connection indicator (connected/reconnecting)
 * - Loading skeleton state
 * - Error state handling
 *
 * USAGE:
 * ```tsx
 * import { ActivityFeedList } from '@/components/activityFeed';
 *
 * <ActivityFeedList
 *   workspaceId={workspace.id}
 *   onEventPress={(event) => handleEventPress(event)}
 * />
 * ```
 */

import * as React from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  type ListRenderItem,
} from 'react-native';

import { Text, Icon } from '@/components/ui';
import { ConnectionIndicator } from '@/components/timer/ConnectionIndicator';
import { useTheme, spacing } from '@/theme';
import {
  useActivityFeed,
  useActivityFeedRealtime,
  type UseActivityFeedOptions,
} from '@/hooks/useActivityFeed';
import { type ActivityEventWithActor } from '@/schemas';

import { ActivityEventItem, ActivityEventItemSkeleton } from './ActivityEventItem';

/**
 * ActivityFeedList component props
 */
export interface ActivityFeedListProps {
  /** Workspace ID to fetch events for */
  workspaceId: string;
  /** Callback when an event is pressed */
  onEventPress?: (event: ActivityEventWithActor) => void;
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Whether to show the connection indicator */
  showConnectionIndicator?: boolean;
  /** Maximum number of skeleton items to show while loading */
  skeletonCount?: number;
  /** Override the default page size */
  pageSize?: number;
  /** Filter by event types */
  eventTypes?: string[];
  /** Custom empty state message */
  emptyMessage?: string;
  /** Custom empty state title */
  emptyTitle?: string;
  /** Header component */
  ListHeaderComponent?: React.ComponentType | React.ReactElement;
  /** Whether to enable realtime subscriptions (default: true) */
  enableRealtime?: boolean;
}

/**
 * Empty state component
 */
interface EmptyStateProps {
  title?: string;
  message?: string;
}

function EmptyState({
  title = 'No Activity Yet',
  message = 'Activity from your workspace will appear here as team members track time.',
}: EmptyStateProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.emptyContainer}>
      <Icon name="clock" size={48} color={colors.textMuted} />
      <Text variant="body" color="secondary" style={styles.emptyTitle}>
        {title}
      </Text>
      <Text variant="caption" color="muted" style={styles.emptyText}>
        {message}
      </Text>
    </View>
  );
}

/**
 * Loading skeleton component
 */
interface LoadingSkeletonProps {
  count: number;
  compact?: boolean;
}

function LoadingSkeleton({ count, compact }: LoadingSkeletonProps): React.ReactElement {
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <ActivityEventItemSkeleton key={index} compact={compact} />
      ))}
    </View>
  );
}

/**
 * Error state component
 */
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

function ErrorState({ message }: ErrorStateProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.errorContainer}>
      <Icon name="alert-circle" size={32} color={colors.error} />
      <Text variant="body" color="error" style={styles.errorText}>
        {message}
      </Text>
    </View>
  );
}

/**
 * Footer component for loading more indicator
 */
interface ListFooterProps {
  isLoading: boolean;
  hasMore: boolean;
}

function ListFooter({ isLoading, hasMore }: ListFooterProps): React.ReactElement | null {
  const { colors } = useTheme();

  if (!hasMore && !isLoading) {
    return (
      <View style={styles.footerContainer}>
        <Text variant="caption" color="muted">
          You&apos;ve reached the end
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.footerContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text variant="caption" color="secondary" style={styles.footerText}>
          Loading more...
        </Text>
      </View>
    );
  }

  return null;
}

/**
 * ActivityFeedList Component
 *
 * Renders a paginated, realtime activity feed for a workspace.
 */
export function ActivityFeedList({
  workspaceId,
  onEventPress,
  compact = false,
  showConnectionIndicator = true,
  skeletonCount = 5,
  pageSize = 20,
  eventTypes,
  emptyMessage,
  emptyTitle,
  ListHeaderComponent,
  enableRealtime = true,
}: ActivityFeedListProps): React.ReactElement {
  const { colors } = useTheme();

  // Fetch activity feed with infinite pagination
  const feedOptions: UseActivityFeedOptions = React.useMemo(
    () => ({
      pageSize,
      eventTypes,
    }),
    [pageSize, eventTypes]
  );

  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefetching,
  } = useActivityFeed(workspaceId, feedOptions);

  // Subscribe to realtime updates
  const { connectionStatus } = useActivityFeedRealtime(workspaceId, {
    enabled: enableRealtime,
  });

  // Flatten all pages into a single list
  const events = React.useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.events);
  }, [data]);

  // Render individual event item
  const renderItem: ListRenderItem<ActivityEventWithActor> = React.useCallback(
    ({ item }) => <ActivityEventItem event={item} onPress={onEventPress} compact={compact} />,
    [onEventPress, compact]
  );

  // Key extractor
  const keyExtractor = React.useCallback((item: ActivityEventWithActor) => item.id, []);

  // Item separator
  const ItemSeparator = React.useCallback(
    () => <View style={[styles.separator, { backgroundColor: colors.border }]} />,
    [colors.border]
  );

  // Handle load more
  const handleEndReached = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle refresh
  const handleRefresh = React.useCallback(() => {
    refetch();
  }, [refetch]);

  // Render header with connection indicator
  const renderHeader = React.useCallback(() => {
    return (
      <View>
        {showConnectionIndicator && (
          <View style={styles.connectionRow}>
            <ConnectionIndicator status={connectionStatus} />
          </View>
        )}
        {ListHeaderComponent &&
          (typeof ListHeaderComponent === 'function' ? (
            <ListHeaderComponent />
          ) : (
            ListHeaderComponent
          ))}
      </View>
    );
  }, [showConnectionIndicator, connectionStatus, ListHeaderComponent]);

  // Render footer with loading indicator
  const renderFooter = React.useCallback(() => {
    return <ListFooter isLoading={isFetchingNextPage} hasMore={hasNextPage ?? false} />;
  }, [isFetchingNextPage, hasNextPage]);

  // Render loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        {showConnectionIndicator && (
          <View style={styles.connectionRow}>
            <ConnectionIndicator status="disconnected" />
          </View>
        )}
        <LoadingSkeleton count={skeletonCount} compact={compact} />
      </View>
    );
  }

  // Render error state
  if (error) {
    return (
      <View style={styles.container}>
        <ErrorState
          message={error instanceof Error ? error.message : 'Failed to load activity'}
          onRetry={handleRefresh}
        />
      </View>
    );
  }

  // Render empty state
  if (events.length === 0) {
    return (
      <View style={styles.container}>
        {showConnectionIndicator && (
          <View style={styles.connectionRow}>
            <ConnectionIndicator status={connectionStatus} />
          </View>
        )}
        <EmptyState title={emptyTitle} message={emptyMessage} />
      </View>
    );
  }

  // Render activity feed
  return (
    <FlatList
      data={events}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={renderHeader}
      ListFooterComponent={renderFooter}
      ItemSeparatorComponent={ItemSeparator}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
  connectionRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  separator: {
    height: 1,
    marginLeft: spacing.md + 40 + spacing.sm, // Align with content (avatar offset)
  },
  skeletonContainer: {
    paddingVertical: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  footerText: {
    // Styling handled by Text component
  },
});

export default ActivityFeedList;
