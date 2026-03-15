/**
 * LeaderboardList Component
 *
 * Full leaderboard display with filters, entries list, loading states,
 * and empty state handling.
 *
 * Features:
 * - Header with LeaderboardFilters
 * - List of LeaderboardEntry components
 * - Loading skeleton state
 * - Empty state when no data
 * - Current user's rank shown at bottom if not in top 20
 *
 * USAGE:
 * ```tsx
 * import { LeaderboardList } from '@/components/leaderboard';
 *
 * <LeaderboardList
 *   workspaceId={workspace.id}
 *   period="week"
 *   metric="total"
 *   onPeriodChange={setPeriod}
 *   onMetricChange={setMetric}
 * />
 * ```
 */

import * as React from 'react';
import { View, FlatList, StyleSheet, type ListRenderItem } from 'react-native';

import { Text, Icon, Card } from '@/components/ui';
import { useTheme, spacing, borderRadius } from '@/theme';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import {
  type LeaderboardPeriod,
  type LeaderboardMetric,
  type LeaderboardEntry as LeaderboardEntryType,
  PERIOD_NAMES,
} from '@/schemas';

import { LeaderboardFilters } from './LeaderboardFilters';
import { LeaderboardEntry, LeaderboardEntrySkeleton } from './LeaderboardEntry';

/**
 * LeaderboardList component props
 */
export interface LeaderboardListProps {
  /** Workspace ID to fetch leaderboard for */
  workspaceId: string;
  /** Currently selected period */
  period: LeaderboardPeriod;
  /** Currently selected metric */
  metric: LeaderboardMetric;
  /** Callback when period changes */
  onPeriodChange: (period: LeaderboardPeriod) => void;
  /** Callback when metric changes */
  onMetricChange: (metric: LeaderboardMetric) => void;
  /** User's week_start_day preference */
  weekStartDay?: number;
  /** Hide the filters header */
  hideFilters?: boolean;
  /** Maximum entries to show (default: 20) */
  maxEntries?: number;
}

/**
 * Empty state component
 */
interface EmptyStateProps {
  period: LeaderboardPeriod;
}

function EmptyState({ period }: EmptyStateProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.emptyContainer}>
      <Icon name="bar-chart" size={48} color={colors.textMuted} />
      <Text variant="body" color="secondary" style={styles.emptyTitle}>
        No Activity Yet
      </Text>
      <Text variant="caption" color="muted" style={styles.emptyText}>
        Track time on workspace projects to appear on the {PERIOD_NAMES[period].toLowerCase()}{' '}
        leaderboard.
      </Text>
    </View>
  );
}

/**
 * Loading skeleton component
 */
function LoadingSkeleton(): React.ReactElement {
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: 5 }).map((_, index) => (
        <LeaderboardEntrySkeleton key={index} />
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
      <Icon name="alert" size={32} color={colors.error} />
      <Text variant="body" color="error" style={styles.errorText}>
        {message}
      </Text>
    </View>
  );
}

/**
 * Separator between current user's entry and the main list
 */
function CurrentUserSeparator(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.separatorContainer}>
      <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
      <Text variant="caption" color="secondary" style={styles.separatorText}>
        Your Rank
      </Text>
      <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
    </View>
  );
}

/**
 * LeaderboardList Component
 *
 * Renders a complete leaderboard with filters, entries, and states.
 */
export function LeaderboardList({
  workspaceId,
  period,
  metric,
  onPeriodChange,
  onMetricChange,
  weekStartDay = 1,
  hideFilters = false,
  maxEntries = 20,
}: LeaderboardListProps): React.ReactElement {
  const { colors } = useTheme();

  // Fetch leaderboard data
  const {
    data: leaderboard,
    isLoading,
    error,
    refetch,
  } = useLeaderboard(workspaceId, {
    period,
    metric,
    weekStartDay,
  });

  // Get leader's seconds for progress calculation
  const leaderSeconds = React.useMemo(() => {
    if (!leaderboard?.entries.length) return 0;
    return leaderboard.entries[0].total_seconds;
  }, [leaderboard]);

  // Limit entries if maxEntries specified
  const displayedEntries = React.useMemo(() => {
    if (!leaderboard?.entries) return [];
    return leaderboard.entries.slice(0, maxEntries);
  }, [leaderboard, maxEntries]);

  // Check if current user is outside the displayed list
  const showCurrentUserSeparate = React.useMemo(() => {
    if (!leaderboard?.current_user_entry) return false;
    const isInDisplayed = displayedEntries.some(
      e => e.user_id === leaderboard.current_user_entry?.user_id
    );
    return !isInDisplayed;
  }, [leaderboard, displayedEntries]);

  // Render individual entry
  const renderEntry: ListRenderItem<LeaderboardEntryType> = React.useCallback(
    ({ item }) => (
      <LeaderboardEntry
        entry={item}
        leaderSeconds={leaderSeconds}
        isCurrentUser={item.is_current_user}
      />
    ),
    [leaderSeconds]
  );

  // Key extractor
  const keyExtractor = React.useCallback((item: LeaderboardEntryType) => item.user_id, []);

  // Render loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        {!hideFilters && (
          <View style={styles.header}>
            <LeaderboardFilters
              period={period}
              metric={metric}
              onPeriodChange={onPeriodChange}
              onMetricChange={onMetricChange}
              disabled
            />
          </View>
        )}
        <LoadingSkeleton />
      </View>
    );
  }

  // Render error state
  if (error) {
    return (
      <View style={styles.container}>
        {!hideFilters && (
          <View style={styles.header}>
            <LeaderboardFilters
              period={period}
              metric={metric}
              onPeriodChange={onPeriodChange}
              onMetricChange={onMetricChange}
            />
          </View>
        )}
        <ErrorState
          message={error instanceof Error ? error.message : 'Failed to load leaderboard'}
          onRetry={refetch}
        />
      </View>
    );
  }

  // Render empty state
  if (!displayedEntries.length) {
    return (
      <View style={styles.container}>
        {!hideFilters && (
          <View style={styles.header}>
            <LeaderboardFilters
              period={period}
              metric={metric}
              onPeriodChange={onPeriodChange}
              onMetricChange={onMetricChange}
            />
          </View>
        )}
        <EmptyState period={period} />
      </View>
    );
  }

  // Render leaderboard
  return (
    <View style={styles.container}>
      {!hideFilters && (
        <View style={styles.header}>
          <LeaderboardFilters
            period={period}
            metric={metric}
            onPeriodChange={onPeriodChange}
            onMetricChange={onMetricChange}
          />
        </View>
      )}

      {/* Stats Summary */}
      <View style={[styles.statsRow, { borderBottomColor: colors.border }]}>
        <View style={styles.stat}>
          <Text variant="caption" color="secondary">
            Participants
          </Text>
          <Text variant="label">{leaderboard?.total_participants ?? 0}</Text>
        </View>
        <View style={styles.stat}>
          <Text variant="caption" color="secondary">
            Period
          </Text>
          <Text variant="label">{PERIOD_NAMES[period]}</Text>
        </View>
      </View>

      {/* Entries List */}
      <FlatList
        data={displayedEntries}
        renderItem={renderEntry}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
      />

      {/* Current User Entry (if not in top list) */}
      {showCurrentUserSeparate && leaderboard?.current_user_entry && (
        <View style={styles.currentUserSection}>
          <CurrentUserSeparator />
          <LeaderboardEntry
            entry={leaderboard.current_user_entry}
            leaderSeconds={leaderSeconds}
            isCurrentUser
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.lg,
  },
  stat: {
    alignItems: 'center',
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  itemSeparator: {
    height: spacing.xs,
  },
  skeletonContainer: {
    paddingVertical: spacing.sm,
  },
  emptyContainer: {
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
  currentUserSection: {
    borderTopWidth: 1,
    paddingTop: spacing.sm,
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  separatorLine: {
    flex: 1,
    height: 1,
  },
  separatorText: {
    marginHorizontal: spacing.sm,
  },
});

export default LeaderboardList;
