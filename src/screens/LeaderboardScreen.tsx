/**
 * LeaderboardScreen
 *
 * Full leaderboard screen displaying workspace member rankings.
 * Only available when a workspace is active (not in personal mode).
 *
 * Features:
 * - Header with workspace name
 * - Period and metric filters
 * - Full leaderboard list with all members
 * - Pull-to-refresh support
 * - Empty state when in personal mode
 *
 * USAGE:
 * ```tsx
 * // In navigation (conditionally shown when workspace active)
 * <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
 * ```
 *
 * SECURITY:
 * - All data access is protected by RLS policies
 * - Only workspace members can view leaderboard
 */

import * as React from 'react';
import { View, ScrollView, RefreshControl, StyleSheet } from 'react-native';

import { Text, Icon } from '@/components/ui';
import { LeaderboardList } from '@/components/leaderboard';
import { useTheme, spacing, colors } from '@/theme';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { queryClient } from '@/lib/queryClient';
import type { LeaderboardPeriod, LeaderboardMetric } from '@/schemas';

// ============================================================================
// TYPES
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LeaderboardScreenProps {}

// ============================================================================
// PERSONAL MODE STATE
// ============================================================================

/**
 * Empty state shown when no workspace is active
 */
function PersonalModeState(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.emptyStateContainer}>
      <View style={[styles.emptyStateIcon, { backgroundColor: colors.surfaceVariant }]}>
        <Icon name="bar-chart" size={48} color={colors.textMuted} />
      </View>
      <Text variant="heading" style={styles.emptyStateTitle}>
        Leaderboard
      </Text>
      <Text variant="body" color="secondary" style={styles.emptyStateText}>
        Switch to a workspace to view team leaderboards and see how you rank against other members.
      </Text>
      <View style={[styles.hintCard, { backgroundColor: colors.surfaceVariant }]}>
        <Icon name="sparkles" size={20} color={colors.primary} />
        <Text variant="bodySmall" color="secondary" style={styles.hintText}>
          Create or join a workspace from Settings to unlock team features like leaderboards,
          projects, and activity feeds.
        </Text>
      </View>
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * LeaderboardScreen component
 *
 * Displays workspace leaderboard with filtering and refresh capabilities.
 * Shows personal mode state when no workspace is active.
 */
export function LeaderboardScreen(): React.ReactElement {
  const { colors } = useTheme();
  const { activeWorkspace, isPersonalMode } = useWorkspaceContext();

  // Filter state
  const [period, setPeriod] = React.useState<LeaderboardPeriod>('week');
  const [metric, setMetric] = React.useState<LeaderboardMetric>('total');

  // Refresh state
  const [refreshing, setRefreshing] = React.useState(false);

  // Handle pull-to-refresh
  const handleRefresh = React.useCallback(async () => {
    if (!activeWorkspace) return;

    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({
        queryKey: ['leaderboard', activeWorkspace.id],
      });
    } finally {
      setRefreshing(false);
    }
  }, [activeWorkspace]);

  // Show personal mode state if no workspace
  if (isPersonalMode || !activeWorkspace) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text variant="heading">Leaderboard</Text>
        </View>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <PersonalModeState />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="heading">Leaderboard</Text>
        <Text variant="bodySmall" color="secondary" numberOfLines={1}>
          {activeWorkspace.name}
        </Text>
      </View>

      {/* Leaderboard Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContentWithData}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <LeaderboardList
          workspaceId={activeWorkspace.id}
          period={period}
          metric={metric}
          onPeriodChange={setPeriod}
          onMetricChange={setMetric}
        />

        {/* Bottom spacing for tab bar */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
  },
  scrollContentWithData: {
    paddingBottom: spacing.lg,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl * 2,
  },
  emptyStateIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyStateTitle: {
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: 12,
    gap: spacing.sm,
    maxWidth: 320,
  },
  hintText: {
    flex: 1,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
});

export default LeaderboardScreen;
