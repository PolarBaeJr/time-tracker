/**
 * LeaderboardWidget Component
 *
 * Compact hub widget displaying the top 3 leaderboard entries.
 * Shows period label and provides "View All" navigation.
 *
 * USAGE:
 * ```tsx
 * import { LeaderboardWidget } from '@/components/hub/widgets';
 *
 * <LeaderboardWidget size="medium" />
 * ```
 */

import * as React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { WidgetCard } from '../WidgetCard';
import { Text, Icon } from '@/components/ui';
import {
  LeaderboardEntry,
  LeaderboardEntrySkeleton,
} from '@/components/leaderboard/LeaderboardEntry';
import { useTheme, spacing, borderRadius } from '@/theme';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { PERIOD_NAMES, type LeaderboardPeriod } from '@/schemas';
import type { WidgetSize } from '../WidgetRegistry';
import type { MainTabParamList } from '@/navigation/types';

/**
 * LeaderboardWidget component props
 */
export interface LeaderboardWidgetProps {
  /** Widget size affects layout and information density */
  size: WidgetSize;
}

type TabNav = BottomTabNavigationProp<MainTabParamList>;

/**
 * Compact leaderboard entry for small widget
 */
interface CompactEntryProps {
  rank: number;
  name: string;
  duration: string;
  isCurrentUser?: boolean;
}

function CompactEntry({
  rank,
  name,
  duration,
  isCurrentUser = false,
}: CompactEntryProps): React.ReactElement {
  const { colors } = useTheme();

  // Medal emoji for top 3
  const medal = rank === 1 ? '\u{1F947}' : rank === 2 ? '\u{1F948}' : '\u{1F949}';

  return (
    <View
      style={[
        styles.compactEntry,
        isCurrentUser && {
          backgroundColor: `${colors.primary}15`,
          borderRadius: borderRadius.sm,
        },
      ]}
    >
      <Text style={styles.medal}>{medal}</Text>
      <Text
        variant="caption"
        numberOfLines={1}
        style={[styles.compactName, isCurrentUser && { color: colors.primary, fontWeight: '600' }]}
      >
        {name}
      </Text>
      <Text variant="caption" color="secondary">
        {duration}
      </Text>
    </View>
  );
}

/**
 * Loading skeleton for compact entries
 */
function CompactSkeleton(): React.ReactElement {
  return (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3].map(i => (
        <LeaderboardEntrySkeleton key={i} compact />
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
      <Icon name="bar-chart" size={24} color={colors.textMuted} />
      <Text variant="caption" color="muted" style={styles.emptyText}>
        Select a workspace to view leaderboard
      </Text>
    </View>
  );
}

/**
 * Empty state for no data
 */
function NoDataState(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.emptyContainer}>
      <Icon name="bar-chart" size={24} color={colors.textMuted} />
      <Text variant="caption" color="muted" style={styles.emptyText}>
        No activity this week
      </Text>
    </View>
  );
}

/**
 * Format seconds to compact duration string
 */
function formatCompactDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

/**
 * LeaderboardWidget Component
 *
 * Displays a compact top 3 leaderboard view with period label.
 * Supports small, medium, and large sizes with appropriate layouts.
 */
export function LeaderboardWidget({ size }: LeaderboardWidgetProps): React.ReactElement {
  const { colors } = useTheme();
  const navigation = useNavigation<TabNav>();

  // Get current workspace from context
  const { activeWorkspace } = useWorkspaceContext();
  const workspaceId = activeWorkspace?.id ?? null;

  // Fixed to weekly leaderboard for widget
  const period: LeaderboardPeriod = 'week';

  // Fetch leaderboard data
  const {
    data: leaderboard,
    isLoading,
    error,
  } = useLeaderboard(workspaceId, {
    period,
    metric: 'total',
    enabled: !!workspaceId,
  });

  // Get top 3 entries
  const topThree = React.useMemo(() => {
    if (!leaderboard?.entries) return [];
    return leaderboard.entries.slice(0, 3);
  }, [leaderboard]);

  // Get leader's seconds for progress calculation
  const leaderSeconds = topThree[0]?.total_seconds ?? 0;

  // Handle navigation to full leaderboard
  const handleViewAll = React.useCallback(() => {
    // Navigate to leaderboard screen (assuming it's in Analytics or a dedicated tab)
    // For now, navigate to Analytics which should have a leaderboard section
    navigation.navigate('Analytics');
  }, [navigation]);

  // Render compact view for small size
  if (size === 'small') {
    return (
      <WidgetCard
        title="Leaderboard"
        icon="bar-chart"
        size={size}
        loading={isLoading}
        error={error ?? null}
        onExpand={handleViewAll}
      >
        {!workspaceId ? (
          <NoWorkspaceState />
        ) : topThree.length === 0 ? (
          <NoDataState />
        ) : (
          <Pressable
            onPress={handleViewAll}
            style={styles.compactContainer}
            accessibilityRole="button"
            accessibilityLabel="View full leaderboard"
          >
            {topThree.map(entry => (
              <CompactEntry
                key={entry.user_id}
                rank={entry.rank}
                name={entry.name}
                duration={formatCompactDuration(entry.total_seconds)}
                isCurrentUser={entry.is_current_user}
              />
            ))}
          </Pressable>
        )}
      </WidgetCard>
    );
  }

  // Render full view for medium/large size
  return (
    <WidgetCard
      title="Leaderboard"
      icon="bar-chart"
      size={size}
      loading={isLoading}
      error={error ?? null}
      onExpand={handleViewAll}
    >
      {!workspaceId ? (
        <NoWorkspaceState />
      ) : topThree.length === 0 ? (
        <NoDataState />
      ) : (
        <View style={styles.fullContainer}>
          {/* Period Label */}
          <View style={[styles.periodBadge, { backgroundColor: colors.surfaceVariant }]}>
            <Text variant="caption" color="secondary">
              {PERIOD_NAMES[period]}
            </Text>
          </View>

          {/* Top 3 Entries */}
          <View style={styles.entriesList}>
            {topThree.map(entry => (
              <LeaderboardEntry
                key={entry.user_id}
                entry={entry}
                leaderSeconds={leaderSeconds}
                isCurrentUser={entry.is_current_user}
                showProgress={size === 'large'}
                compact={size === 'medium'}
              />
            ))}
          </View>

          {/* View All Link */}
          <Pressable
            onPress={handleViewAll}
            style={styles.viewAllButton}
            accessibilityRole="button"
            accessibilityLabel="View full leaderboard"
          >
            <Text variant="caption" style={{ color: colors.primary }}>
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
  compactEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  medal: {
    fontSize: 12,
    marginRight: spacing.xs,
  },
  compactName: {
    flex: 1,
    marginRight: spacing.xs,
  },
  fullContainer: {
    minHeight: 100,
  },
  periodBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  entriesList: {
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

export default LeaderboardWidget;
