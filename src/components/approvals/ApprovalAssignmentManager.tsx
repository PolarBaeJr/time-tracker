/**
 * ApprovalAssignmentManager Component
 *
 * Admin view for managing approval assignments within a workspace.
 * Allows adding, editing, and removing member-to-approver assignments.
 *
 * USAGE:
 * ```tsx
 * <ApprovalAssignmentManager workspaceId={workspaceId} />
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only admins/owners can manage assignments
 * - Validates member != approver constraint
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { Text, Card, Button, Icon, Spinner, ErrorState } from '@/components/ui';
import {
  useApprovalAssignments,
  useWorkspaceMembers,
  useSetApprovalAssignment,
  useDeleteApprovalAssignment,
} from '@/hooks';
import { useTheme } from '@/theme';
import { spacing, borderRadius, fontSizes } from '@/theme';
import type { ApprovalAssignmentWithUsers, WorkspaceMemberWithUser } from '@/schemas';

/**
 * Props for ApprovalAssignmentManager component
 */
export interface ApprovalAssignmentManagerProps {
  /** Workspace ID to manage assignments for */
  workspaceId: string;
}

/**
 * Get initials from name or email
 */
function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

/**
 * ApprovalAssignmentManager component
 */
export function ApprovalAssignmentManager({
  workspaceId,
}: ApprovalAssignmentManagerProps): React.ReactElement {
  const { colors } = useTheme();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [selectedApprover, setSelectedApprover] = useState<string | null>(null);

  const {
    data: assignments,
    isLoading: loadingAssignments,
    isRefetching,
    refetch,
    error: assignmentsError,
  } = useApprovalAssignments(workspaceId);

  const { data: members, isLoading: loadingMembers } = useWorkspaceMembers(workspaceId);

  const setAssignment = useSetApprovalAssignment({
    onSuccess: () => {
      setShowAddModal(false);
      setSelectedMember(null);
      setSelectedApprover(null);
    },
    onError: error => {
      const message = error.message || 'Failed to set assignment';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    },
  });

  const deleteAssignment = useDeleteApprovalAssignment({
    onError: error => {
      const message = error.message || 'Failed to remove assignment';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    },
  });

  /**
   * Members without assignments
   */
  const unassignedMembers = useMemo(() => {
    if (!members || !assignments) return [];
    const assignedMemberIds = new Set(assignments.map(a => a.member_user_id));
    return members.filter(m => !assignedMemberIds.has(m.user_id));
  }, [members, assignments]);

  /**
   * Potential approvers (all members except the selected member)
   */
  const potentialApprovers = useMemo(() => {
    if (!members || !selectedMember) return [];
    return members.filter(m => m.user_id !== selectedMember);
  }, [members, selectedMember]);

  /**
   * Handle add assignment
   */
  const handleAddAssignment = useCallback(() => {
    if (!selectedMember || !selectedApprover) return;

    setAssignment.mutate({
      workspaceId,
      member_user_id: selectedMember,
      approver_user_id: selectedApprover,
    });
  }, [selectedMember, selectedApprover, workspaceId, setAssignment]);

  /**
   * Handle delete assignment
   */
  const handleDeleteAssignment = useCallback(
    (assignment: ApprovalAssignmentWithUsers) => {
      const confirmDelete = () => {
        deleteAssignment.mutate({
          assignmentId: assignment.id,
          workspaceId,
        });
      };

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        if (
          window.confirm(
            `Remove approval assignment for ${assignment.member.name || assignment.member.email}?`
          )
        ) {
          confirmDelete();
        }
      } else {
        Alert.alert(
          'Remove Assignment',
          `Remove approval assignment for ${assignment.member.name || assignment.member.email}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: confirmDelete },
          ]
        );
      }
    },
    [workspaceId, deleteAssignment]
  );

  /**
   * Open add modal
   */
  const openAddModal = useCallback(() => {
    setSelectedMember(null);
    setSelectedApprover(null);
    setShowAddModal(true);
  }, []);

  /**
   * Close add modal
   */
  const closeAddModal = useCallback(() => {
    if (!setAssignment.isPending) {
      setShowAddModal(false);
      setSelectedMember(null);
      setSelectedApprover(null);
    }
  }, [setAssignment.isPending]);

  /**
   * Render assignment item
   */
  const renderAssignment = useCallback(
    ({ item: assignment }: { item: ApprovalAssignmentWithUsers }) => {
      const isDeleting = deleteAssignment.isPending;

      return (
        <Card padding="md" style={styles.assignmentCard}>
          <View style={styles.assignmentContent}>
            {/* Member */}
            <View style={styles.userRow}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>
                  {getInitials(assignment.member.name, assignment.member.email)}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text variant="body" bold numberOfLines={1}>
                  {assignment.member.name || assignment.member.email}
                </Text>
                <Text variant="caption" color="secondary" numberOfLines={1}>
                  Member
                </Text>
              </View>
            </View>

            {/* Arrow */}
            <Icon name="chevron-forward" size={20} color={colors.textMuted} />

            {/* Approver */}
            <View style={styles.userRow}>
              <View style={[styles.avatar, { backgroundColor: colors.success }]}>
                <Text style={styles.avatarText}>
                  {getInitials(assignment.approver.name, assignment.approver.email)}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text variant="body" bold numberOfLines={1}>
                  {assignment.approver.name || assignment.approver.email}
                </Text>
                <Text variant="caption" color="secondary" numberOfLines={1}>
                  Approver
                </Text>
              </View>
            </View>

            {/* Delete button */}
            <Pressable
              style={styles.deleteButton}
              onPress={() => handleDeleteAssignment(assignment)}
              disabled={isDeleting}
              accessibilityRole="button"
              accessibilityLabel={`Remove assignment for ${assignment.member.name || assignment.member.email}`}
            >
              <Icon name="trash" size={18} color={colors.error} />
            </Pressable>
          </View>
        </Card>
      );
    },
    [colors, handleDeleteAssignment, deleteAssignment.isPending]
  );

  /**
   * Render member option for selection
   */
  const renderMemberOption = useCallback(
    (member: WorkspaceMemberWithUser, isSelected: boolean, onSelect: () => void) => (
      <Pressable
        key={member.user_id}
        style={[
          styles.memberOption,
          { backgroundColor: colors.surface },
          isSelected && { backgroundColor: colors.surfaceVariant },
        ]}
        onPress={onSelect}
        accessibilityRole="radio"
        accessibilityState={{ checked: isSelected }}
      >
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>
            {getInitials(member.user?.name ?? null, member.user?.email ?? '')}
          </Text>
        </View>
        <View style={styles.memberOptionInfo}>
          <Text variant="body" numberOfLines={1}>
            {member.user?.name || member.user?.email || 'Unknown User'}
          </Text>
          <Text variant="caption" color="secondary" numberOfLines={1}>
            {member.role}
          </Text>
        </View>
        {isSelected && <Icon name="check" size={20} color={colors.primary} />}
      </Pressable>
    ),
    [colors]
  );

  // Loading state
  if (loadingAssignments || loadingMembers) {
    return (
      <View style={styles.centerContainer}>
        <Spinner size="large" />
        <Text variant="body" color="secondary" style={styles.loadingText}>
          Loading assignments...
        </Text>
      </View>
    );
  }

  // Error state
  if (assignmentsError) {
    return (
      <ErrorState
        title="Failed to Load"
        message={assignmentsError.message || 'Could not load assignments'}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with add button */}
      <View style={styles.header}>
        <Text variant="heading">Approval Assignments</Text>
        <Button
          variant="primary"
          size="sm"
          onPress={openAddModal}
          disabled={unassignedMembers.length === 0}
        >
          Add Assignment
        </Button>
      </View>

      {/* Assignments list */}
      {!assignments || assignments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="check-square" size={48} color={colors.textMuted} />
          <Text variant="heading" style={styles.emptyTitle}>
            No Assignments
          </Text>
          <Text variant="body" color="secondary" style={styles.emptyDescription}>
            Add approval assignments to enable the approval workflow
          </Text>
          <Button variant="primary" onPress={openAddModal} style={styles.emptyButton}>
            Add Assignment
          </Button>
        </View>
      ) : (
        <FlatList
          data={assignments}
          keyExtractor={item => item.id}
          renderItem={renderAssignment}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Add assignment modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={closeAddModal}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            {/* Modal header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text variant="heading" style={styles.modalTitle}>
                Add Assignment
              </Text>
              <Pressable
                onPress={closeAddModal}
                style={styles.modalCloseButton}
                disabled={setAssignment.isPending}
                accessibilityRole="button"
                accessibilityLabel="Close modal"
              >
                <Icon name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            {/* Step 1: Select member */}
            <View style={styles.modalSection}>
              <Text variant="body" bold style={styles.sectionLabel}>
                1. Select Member
              </Text>
              <View style={styles.optionsList}>
                {unassignedMembers.length === 0 ? (
                  <Text variant="body" color="muted" style={styles.noOptions}>
                    All members have been assigned
                  </Text>
                ) : (
                  unassignedMembers.map(member =>
                    renderMemberOption(member, selectedMember === member.user_id, () =>
                      setSelectedMember(member.user_id)
                    )
                  )
                )}
              </View>
            </View>

            {/* Step 2: Select approver */}
            {selectedMember && (
              <View style={styles.modalSection}>
                <Text variant="body" bold style={styles.sectionLabel}>
                  2. Select Approver
                </Text>
                <View style={styles.optionsList}>
                  {potentialApprovers.map(member =>
                    renderMemberOption(member, selectedApprover === member.user_id, () =>
                      setSelectedApprover(member.user_id)
                    )
                  )}
                </View>
              </View>
            )}

            {/* Footer */}
            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <Button variant="ghost" onPress={closeAddModal} disabled={setAssignment.isPending}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onPress={handleAddAssignment}
                loading={setAssignment.isPending}
                disabled={!selectedMember || !selectedApprover || setAssignment.isPending}
              >
                Add Assignment
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  listContent: {
    padding: spacing.md,
  },
  separator: {
    height: spacing.sm,
  },
  assignmentCard: {
    // Card styles
  },
  assignmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
  },
  deleteButton: {
    padding: spacing.sm,
    marginLeft: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: fontSizes.lg,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalSection: {
    padding: spacing.lg,
    paddingBottom: 0,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
  },
  optionsList: {
    maxHeight: 200,
  },
  noOptions: {
    textAlign: 'center',
    padding: spacing.lg,
  },
  memberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  memberOptionInfo: {
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: spacing.lg,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptyDescription: {
    marginTop: spacing.sm,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyButton: {
    marginTop: spacing.md,
  },
});

export default ApprovalAssignmentManager;
