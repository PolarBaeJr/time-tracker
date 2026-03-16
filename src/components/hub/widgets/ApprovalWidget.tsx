/**
 * ApprovalWidget Component
 *
 * Hub widget displaying pending approvals count for approvers and
 * pending submissions count for members. Provides quick navigation
 * to the Approval screen.
 *
 * USAGE:
 * ```tsx
 * import { ApprovalWidget } from '@/components/hub/widgets';
 *
 * <ApprovalWidget size="medium" />
 * ```
 */

import * as React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { WidgetCard } from '../WidgetCard';
import { Text, Icon } from '@/components/ui';
import { useTheme, spacing, borderRadius } from '@/theme';
import { usePendingApprovals, useMySubmissions } from '@/hooks/useApprovals';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import type { WidgetSize } from '../WidgetRegistry';
import type { MainTabParamList } from '@/navigation/types';

/**
 * ApprovalWidget component props
 */
export interface ApprovalWidgetProps {
  /** Widget size affects layout and information density */
  size: WidgetSize;
}

type TabNav = BottomTabNavigationProp<MainTabParamList>;

/**
 * Format count for display with limit
 */
function formatCount(count: number): string {
  if (count > 99) {
    return '99+';
  }
  return String(count);
}

/**
 * Empty state for no workspace selected
 */
function NoWorkspaceState(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.emptyContainer}>
      <Icon name="checkmark-circle" size={24} color={colors.textMuted} />
      <Text variant="caption" color="muted" style={styles.emptyText}>
        Select a workspace to view approvals
      </Text>
    </View>
  );
}

/**
 * All caught up state (no pending items)
 */
function AllCaughtUpState(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.emptyContainer}>
      <Icon name="checkmark-circle" size={24} color={colors.success} />
      <Text variant="caption" color="muted" style={styles.emptyText}>
        All caught up!
      </Text>
    </View>
  );
}

/**
 * Approval item preview for medium/large widgets
 */
interface ApprovalPreviewProps {
  type: 'pending' | 'submitted';
  count: number;
  onPress: () => void;
}

function ApprovalPreview({ type, count, onPress }: ApprovalPreviewProps): React.ReactElement {
  const { colors } = useTheme();

  const icon = type === 'pending' ? 'time' : 'send';
  const label =
    type === 'pending'
      ? count === 1
        ? 'entry pending your approval'
        : 'entries pending your approval'
      : count === 1
        ? 'of your entries pending review'
        : 'of your entries pending review';

  return (
    <Pressable
      onPress={onPress}
      style={[styles.previewItem, { borderBottomColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${count} ${label}`}
    >
      <View style={[styles.previewIcon, { backgroundColor: `${colors.primary}15` }]}>
        <Icon name={icon} size={16} color={colors.primary} />
      </View>
      <View style={styles.previewContent}>
        <Text variant="label">{count}</Text>
        <Text variant="caption" color="secondary" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Icon name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

/**
 * ApprovalWidget Component
 *
 * Displays approval status information based on widget size:
 * - Small: Count badge only
 * - Medium: Count with brief description
 * - Large: Count with list preview of pending items
 *
 * Shows different information based on user role:
 * - Approvers see entries pending their approval
 * - Members see their entries pending review
 */
export function ApprovalWidget({ size }: ApprovalWidgetProps): React.ReactElement {
  const { colors } = useTheme();
  const navigation = useNavigation<TabNav>();

  // Get current workspace from context
  const { activeWorkspace } = useWorkspaceContext();
  const workspaceId = activeWorkspace?.id ?? null;

  // Fetch pending approvals (for approvers)
  const {
    data: pendingApprovals,
    isLoading: pendingLoading,
    error: pendingError,
  } = usePendingApprovals(workspaceId ?? '', {
    enabled: !!workspaceId,
  });

  // Fetch user's submitted entries pending review
  const {
    data: mySubmissions,
    isLoading: submissionsLoading,
    error: submissionsError,
  } = useMySubmissions(workspaceId ?? '', {
    enabled: !!workspaceId,
    statuses: ['submitted'],
  });

  const isLoading = pendingLoading || submissionsLoading;
  const error = pendingError ?? submissionsError ?? null;

  // Calculate counts
  const pendingCount = pendingApprovals?.length ?? 0;
  const submittedCount = mySubmissions?.length ?? 0;
  const totalCount = pendingCount + submittedCount;

  // Determine if user is an approver (has pending approvals to review)
  const isApprover = pendingCount > 0;

  // Handle navigation to approval screen
  const handleNavigateToApproval = React.useCallback(() => {
    navigation.navigate('Approval');
  }, [navigation]);

  // Render compact view for small size
  if (size === 'small') {
    return (
      <WidgetCard
        title="Approvals"
        icon="checkmark-circle"
        size={size}
        loading={isLoading}
        error={error}
        onExpand={workspaceId ? handleNavigateToApproval : undefined}
      >
        {!workspaceId ? (
          <NoWorkspaceState />
        ) : totalCount === 0 ? (
          <Pressable
            onPress={handleNavigateToApproval}
            style={styles.compactContainer}
            accessibilityRole="button"
            accessibilityLabel="No pending approvals"
          >
            <Icon name="checkmark-circle" size={24} color={colors.success} />
          </Pressable>
        ) : (
          <Pressable
            onPress={handleNavigateToApproval}
            style={styles.compactContainer}
            accessibilityRole="button"
            accessibilityLabel={`${totalCount} pending approvals`}
          >
            <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
              <Text variant="label" style={styles.countBadgeText}>
                {formatCount(totalCount)}
              </Text>
            </View>
          </Pressable>
        )}
      </WidgetCard>
    );
  }

  // Render full view for medium/large size
  return (
    <WidgetCard
      title="Approvals"
      icon="checkmark-circle"
      size={size}
      loading={isLoading}
      error={error}
      onExpand={workspaceId ? handleNavigateToApproval : undefined}
    >
      {!workspaceId ? (
        <NoWorkspaceState />
      ) : totalCount === 0 ? (
        <AllCaughtUpState />
      ) : (
        <View style={styles.fullContainer}>
          {/* Pending Approvals (for approvers) */}
          {pendingCount > 0 && (
            <ApprovalPreview
              type="pending"
              count={pendingCount}
              onPress={handleNavigateToApproval}
            />
          )}

          {/* User's Submitted Entries */}
          {submittedCount > 0 && (
            <ApprovalPreview
              type="submitted"
              count={submittedCount}
              onPress={handleNavigateToApproval}
            />
          )}

          {/* View All Link (for large size) */}
          {size === 'large' && (
            <Pressable
              onPress={handleNavigateToApproval}
              style={styles.viewAllButton}
              accessibilityRole="button"
              accessibilityLabel="View all approvals"
            >
              <Text variant="caption" style={{ color: colors.primary }}>
                View All
              </Text>
              <Icon name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          )}
        </View>
      )}
    </WidgetCard>
  );
}

const styles = StyleSheet.create({
  compactContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 28,
    alignItems: 'center',
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  fullContainer: {
    minHeight: 80,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  previewIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  previewContent: {
    flex: 1,
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
});

export default ApprovalWidget;
