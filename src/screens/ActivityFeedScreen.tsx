/**
 * ActivityFeedScreen
 *
 * Full activity feed screen displaying workspace activity events.
 * Only available when a workspace is active (not in personal mode).
 *
 * Features:
 * - Header with workspace name
 * - Full activity feed list with infinite scroll
 * - Connection status indicator (realtime updates)
 * - Pull-to-refresh support
 * - Empty state when in personal mode
 *
 * USAGE:
 * ```tsx
 * // In navigation (conditionally shown when workspace active)
 * <Tab.Screen name="ActivityFeed" component={ActivityFeedScreen} />
 * ```
 *
 * SECURITY:
 * - All data access is protected by RLS policies
 * - Only workspace members can view activity feed
 */

import * as React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';

import { Text, Icon } from '@/components/ui';
import { ActivityFeedList } from '@/components/activityFeed';
import { useTheme, spacing, colors } from '@/theme';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

// ============================================================================
// TYPES
// ============================================================================

/**
 * ActivityFeedScreen props (from navigation)
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ActivityFeedScreenProps {
  /** No route params needed - screen is standalone */
}

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
        <Icon name="activity" size={48} color={colors.textMuted} />
      </View>
      <Text variant="heading" style={styles.emptyStateTitle}>
        Activity Feed
      </Text>
      <Text variant="body" color="secondary" style={styles.emptyStateText}>
        Switch to a workspace to view team activity and see what your teammates are working on in
        real-time.
      </Text>
      <View style={[styles.hintCard, { backgroundColor: colors.surfaceVariant }]}>
        <Icon name="sparkles" size={20} color={colors.primary} />
        <Text variant="bodySmall" color="secondary" style={styles.hintText}>
          Create or join a workspace from Settings to unlock team features like activity feeds,
          projects, and leaderboards.
        </Text>
      </View>
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * ActivityFeedScreen component
 *
 * Displays workspace activity feed with realtime updates and refresh capabilities.
 * Shows personal mode state when no workspace is active.
 */
export function ActivityFeedScreen(): React.ReactElement {
  const { activeWorkspace, isPersonalMode } = useWorkspaceContext();

  // Show personal mode state if no workspace
  if (isPersonalMode || !activeWorkspace) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text variant="heading">Activity</Text>
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
        <Text variant="heading">Activity</Text>
        <Text variant="bodySmall" color="secondary" numberOfLines={1}>
          {activeWorkspace.name}
        </Text>
      </View>

      {/* Activity Feed Content */}
      <View style={styles.feedContainer}>
        <ActivityFeedList
          workspaceId={activeWorkspace.id}
          showConnectionIndicator={true}
          enableRealtime={true}
          pageSize={20}
          skeletonCount={8}
          emptyTitle="No Activity Yet"
          emptyMessage="Activity from your workspace will appear here as team members track time and complete tasks."
        />
      </View>
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
  feedContainer: {
    flex: 1,
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
});

export default ActivityFeedScreen;
