/**
 * ApprovalScreen
 *
 * Screen for managing time entry approvals with two tabs:
 * - Pending: For approvers to review and approve/reject submitted entries
 * - My Submissions: For users to see their submitted entries and status
 *
 * This screen is only shown when a workspace is active.
 *
 * USAGE:
 * ```tsx
 * import { ApprovalScreen } from '@/screens';
 *
 * // In navigation (conditionally shown when workspace active)
 * <Tab.Screen name="Approval" component={ApprovalScreen} />
 * ```
 *
 * SECURITY:
 * - Only visible when user has an active workspace
 * - RLS policies ensure users only see relevant entries
 * - Approvers see entries assigned to them
 * - Members see their own submissions
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, Icon, Spinner } from '@/components/ui';
import { ApprovalQueue, SubmissionList, ApprovalActionSheet } from '@/components/approvals';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { usePendingApprovals, useApproveEntries, useRejectEntries, useToast } from '@/hooks';
import { useTheme } from '@/theme';
import { spacing, fontSizes, borderRadius } from '@/theme';
import type { TimeEntryWithApprovalAndUser } from '@/schemas';

/**
 * Tab type for ApprovalScreen
 */
type ApprovalTab = 'pending' | 'submissions';

/**
 * ApprovalScreen props (from navigation)
 */
export interface ApprovalScreenProps {
  /** Navigation object */
  navigation?: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

/**
 * ApprovalScreen component
 */
export function ApprovalScreen({
  navigation: _navigation,
}: ApprovalScreenProps): React.ReactElement {
  const { colors } = useTheme();
  const { activeWorkspace, isPersonalMode, isLoading: workspaceLoading } = useWorkspaceContext();
  const { success: showSuccessToast, error: showErrorToast } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<ApprovalTab>('pending');

  // Action sheet state
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);

  // Fetch pending approvals for badge count
  const { data: pendingApprovals } = usePendingApprovals(activeWorkspace?.id ?? '', {
    enabled: !!activeWorkspace?.id,
  });

  const pendingCount = pendingApprovals?.length ?? 0;

  // Approval/rejection mutations
  const approveEntries = useApproveEntries({
    onSuccess: () => {
      showSuccessToast('Entries approved successfully');
      setActionSheetVisible(false);
      setSelectedEntryIds([]);
    },
    onError: error => {
      showErrorToast(error.message || 'Failed to approve entries');
    },
  });

  const rejectEntries = useRejectEntries({
    onSuccess: () => {
      showSuccessToast('Entries rejected');
      setActionSheetVisible(false);
      setSelectedEntryIds([]);
    },
    onError: error => {
      showErrorToast(error.message || 'Failed to reject entries');
    },
  });

  /**
   * Handle approve action from ApprovalQueue
   */
  const handleApprove = useCallback((entryIds: string[]) => {
    setSelectedEntryIds(entryIds);
    setActionSheetVisible(true);
  }, []);

  /**
   * Handle reject action from ApprovalQueue
   */
  const handleReject = useCallback((entryIds: string[]) => {
    setSelectedEntryIds(entryIds);
    setActionSheetVisible(true);
  }, []);

  /**
   * Handle confirm approve from action sheet
   */
  const handleConfirmApprove = useCallback(
    (note?: string) => {
      if (!activeWorkspace?.id || selectedEntryIds.length === 0) return;
      approveEntries.mutate({
        workspaceId: activeWorkspace.id,
        entry_ids: selectedEntryIds,
        approval_note: note,
      });
    },
    [activeWorkspace, selectedEntryIds, approveEntries]
  );

  /**
   * Handle confirm reject from action sheet
   */
  const handleConfirmReject = useCallback(
    (note: string) => {
      if (!activeWorkspace?.id || selectedEntryIds.length === 0) return;
      rejectEntries.mutate({
        workspaceId: activeWorkspace.id,
        entry_ids: selectedEntryIds,
        approval_note: note,
      });
    },
    [activeWorkspace, selectedEntryIds, rejectEntries]
  );

  /**
   * Handle entry press from lists
   */
  const handleEntryPress = useCallback((_entry: TimeEntryWithApprovalAndUser) => {
    // Could navigate to entry detail view
    // For now, no action needed as entries are view-only once submitted
  }, []);

  // Tab data
  const tabs = useMemo(
    () => [
      {
        key: 'pending' as ApprovalTab,
        label: 'Pending',
        badgeCount: pendingCount,
      },
      {
        key: 'submissions' as ApprovalTab,
        label: 'My Submissions',
        badgeCount: 0,
      },
    ],
    [pendingCount]
  );

  // Loading state while workspace context is initializing
  if (workspaceLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <View style={styles.loadingContainer}>
          <Spinner size="large" message="Loading..." />
        </View>
      </SafeAreaView>
    );
  }

  // Show message if in personal mode (no active workspace)
  if (isPersonalMode || !activeWorkspace) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <View style={styles.personalModeContainer}>
          <Icon name="check-square" size={64} color={colors.textMuted} />
          <Text variant="heading" center style={styles.personalModeTitle}>
            Approvals
          </Text>
          <Text variant="body" color="secondary" center style={styles.personalModeText}>
            Select a workspace to view and manage approvals.
          </Text>
          <Text variant="caption" color="muted" center>
            Approvals are a collaboration feature available in workspaces.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.headerContent}>
          <Text variant="heading" style={styles.title}>
            Approvals
          </Text>
          <Text variant="caption" color="muted" style={styles.workspaceName}>
            {activeWorkspace.name}
          </Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View
        style={[
          styles.tabBar,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        {tabs.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tab, isActive && { borderBottomColor: colors.primary }]}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.label} tab${tab.badgeCount > 0 ? `, ${tab.badgeCount} items` : ''}`}
            >
              <Text
                variant="body"
                style={[
                  styles.tabLabel,
                  { color: isActive ? colors.primary : colors.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
              {tab.badgeCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.badgeText}>
                    {tab.badgeCount > 99 ? '99+' : tab.badgeCount}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {activeTab === 'pending' && (
          <ApprovalQueue
            workspaceId={activeWorkspace.id}
            onApprove={handleApprove}
            onReject={handleReject}
            onEntryPress={handleEntryPress}
          />
        )}
        {activeTab === 'submissions' && (
          <SubmissionList workspaceId={activeWorkspace.id} onEntryPress={handleEntryPress} />
        )}
      </View>

      {/* Approval Action Sheet */}
      <ApprovalActionSheet
        visible={actionSheetVisible}
        entryCount={selectedEntryIds.length}
        isLoading={approveEntries.isPending || rejectEntries.isPending}
        onApprove={handleConfirmApprove}
        onReject={handleConfirmReject}
        onClose={() => {
          setActionSheetVisible(false);
          setSelectedEntryIds([]);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  personalModeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  personalModeTitle: {
    marginTop: spacing.lg,
  },
  personalModeText: {
    maxWidth: 280,
    marginBottom: spacing.sm,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerContent: {
    // Header content layout
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
  },
  workspaceName: {
    marginTop: spacing.xs,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: spacing.xs,
  },
  tabLabel: {
    fontWeight: '600',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
});

export default ApprovalScreen;
