/**
 * MemberList Component
 *
 * Displays workspace members with role badges.
 * Admins can change roles and remove members.
 * Owner is highlighted and cannot be modified.
 */

import * as React from 'react';
import { useCallback, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  type ListRenderItemInfo,
  RefreshControl,
  Pressable,
  Modal,
  Alert,
} from 'react-native';

import { Card, Text, Button, Spinner, Icon } from '@/components/ui';
import { RolePicker } from './RolePicker';
import { useTheme, spacing, borderRadius, fontSizes } from '@/theme';
import { useUpdateMemberRole, useRemoveMember } from '@/hooks';
import type { WorkspaceMemberWithUser, WorkspaceRole } from '@/schemas';

/**
 * Role badge component
 */
function RoleBadge({ role }: { role: WorkspaceRole }): React.ReactElement {
  const { colors } = useTheme();

  const getBadgeStyle = () => {
    switch (role) {
      case 'owner':
        return { backgroundColor: colors.primary, textColor: colors.text };
      case 'admin':
        return { backgroundColor: colors.surfaceVariant, textColor: colors.primary };
      case 'member':
      default:
        return { backgroundColor: colors.surfaceVariant, textColor: colors.textSecondary };
    }
  };

  const { backgroundColor, textColor } = getBadgeStyle();

  return (
    <View style={[styles.roleBadge, { backgroundColor }]}>
      <Text variant="caption" bold style={{ color: textColor }}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Text>
    </View>
  );
}

/**
 * Props for individual member card
 */
interface MemberCardProps {
  member: WorkspaceMemberWithUser;
  canManage: boolean;
  onRoleChange?: (member: WorkspaceMemberWithUser) => void;
  onRemove?: (member: WorkspaceMemberWithUser) => void;
}

/**
 * Individual member card component
 */
function MemberCard({
  member,
  canManage,
  onRoleChange,
  onRemove,
}: MemberCardProps): React.ReactElement {
  const { colors } = useTheme();
  const isOwner = member.role === 'owner';
  const displayName = member.user.name || member.user.email;
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <Card padding="md" elevation="sm" style={styles.card}>
      <View style={styles.cardContent}>
        {/* Avatar */}
        <View
          style={[
            styles.avatar,
            { backgroundColor: isOwner ? colors.primary : colors.surfaceVariant },
          ]}
        >
          <Text variant="body" bold style={{ color: isOwner ? colors.text : colors.textSecondary }}>
            {initials}
          </Text>
        </View>

        {/* Member info */}
        <View style={styles.memberInfo}>
          <View style={styles.nameRow}>
            <Text variant="body" bold style={{ flex: 1 }} numberOfLines={1}>
              {member.user.name || 'Unnamed User'}
            </Text>
            <RoleBadge role={member.role} />
          </View>
          <Text variant="caption" color="muted" numberOfLines={1}>
            {member.user.email}
          </Text>
        </View>

        {/* Actions for non-owners when user can manage */}
        {canManage && !isOwner && (
          <View style={styles.actions}>
            {onRoleChange && (
              <Pressable
                onPress={() => onRoleChange(member)}
                style={styles.actionButton}
                accessibilityRole="button"
                accessibilityLabel="Change role"
              >
                <Icon name="edit" size={18} color={colors.textMuted} />
              </Pressable>
            )}
            {onRemove && (
              <Pressable
                onPress={() => onRemove(member)}
                style={styles.actionButton}
                accessibilityRole="button"
                accessibilityLabel="Remove member"
              >
                <Icon name="trash" size={18} color={colors.error} />
              </Pressable>
            )}
          </View>
        )}

        {/* Owner indicator */}
        {isOwner && (
          <View style={styles.ownerIndicator}>
            <Icon name="star" size={16} color={colors.primary} />
          </View>
        )}
      </View>
    </Card>
  );
}

/**
 * Role change modal component
 */
function RoleChangeModal({
  visible,
  member,
  onClose,
  onConfirm,
  isPending,
}: {
  visible: boolean;
  member: WorkspaceMemberWithUser | null;
  onClose: () => void;
  onConfirm: (role: WorkspaceRole) => void;
  isPending: boolean;
}): React.ReactElement {
  const { colors } = useTheme();
  const [selectedRole, setSelectedRole] = useState<WorkspaceRole>(member?.role ?? 'member');

  // Reset selected role when member changes
  React.useEffect(() => {
    if (member) {
      setSelectedRole(member.role);
    }
  }, [member]);

  const handleConfirm = useCallback(() => {
    onConfirm(selectedRole);
  }, [selectedRole, onConfirm]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />

        <View style={[styles.roleModal, { backgroundColor: colors.surface }]}>
          <Text variant="heading" style={styles.modalTitle}>
            Change Role
          </Text>

          {member && (
            <Text variant="body" color="secondary" style={styles.modalSubtitle}>
              {member.user.name || member.user.email}
            </Text>
          )}

          <View style={styles.rolePickerContainer}>
            <RolePicker value={selectedRole} onChange={setSelectedRole} disabled={isPending} />
          </View>

          <View style={styles.modalActions}>
            <Button
              variant="ghost"
              onPress={onClose}
              disabled={isPending}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onPress={handleConfirm}
              loading={isPending}
              disabled={selectedRole === member?.role}
              style={styles.modalButton}
            >
              Update Role
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Props for MemberList component
 */
export interface MemberListProps {
  /** Workspace ID */
  workspaceId: string;
  /** Array of members to display */
  members: WorkspaceMemberWithUser[];
  /** Whether members are currently loading */
  isLoading?: boolean;
  /** Current user's role in the workspace */
  currentUserRole: WorkspaceRole;
  /** Current user's ID */
  currentUserId: string;
  /** Callback for pull-to-refresh */
  onRefresh?: () => void;
  /** Whether a refresh is in progress */
  refreshing?: boolean;
  /** Callback when member is updated */
  onMemberUpdated?: () => void;
  /** Callback when member is removed */
  onMemberRemoved?: () => void;
}

/**
 * Empty state component
 */
function EmptyState(): React.ReactElement {
  return (
    <View style={styles.emptyState}>
      <Text variant="heading" center style={styles.emptyTitle}>
        No Members
      </Text>
      <Text variant="body" color="secondary" center style={styles.emptyText}>
        This workspace does not have any members yet.
      </Text>
    </View>
  );
}

/**
 * MemberList Component
 *
 * Displays workspace members with role management capabilities.
 *
 * @example
 * ```tsx
 * <MemberList
 *   workspaceId={workspace.id}
 *   members={members}
 *   isLoading={isLoading}
 *   currentUserRole="admin"
 *   currentUserId={user.id}
 *   onRefresh={refetch}
 *   refreshing={isRefetching}
 *   onMemberUpdated={() => showToast('Role updated')}
 *   onMemberRemoved={() => showToast('Member removed')}
 * />
 * ```
 */
export function MemberList({
  workspaceId,
  members,
  isLoading = false,
  currentUserRole,
  currentUserId,
  onRefresh,
  refreshing = false,
  onMemberUpdated,
  onMemberRemoved,
}: MemberListProps): React.ReactElement {
  const { colors } = useTheme();

  // Modal state
  const [roleModalMember, setRoleModalMember] = useState<WorkspaceMemberWithUser | null>(null);

  // Mutations
  const updateRole = useUpdateMemberRole({
    onSuccess: () => {
      setRoleModalMember(null);
      onMemberUpdated?.();
    },
    onError: error => {
      Alert.alert('Error', error.message, [{ text: 'OK' }]);
    },
  });

  const removeMember = useRemoveMember({
    onSuccess: () => {
      onMemberRemoved?.();
    },
    onError: error => {
      Alert.alert('Error', error.message, [{ text: 'OK' }]);
    },
  });

  // Check if current user can manage members (admin or owner)
  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';

  const handleRoleChange = useCallback((member: WorkspaceMemberWithUser) => {
    setRoleModalMember(member);
  }, []);

  const handleRoleConfirm = useCallback(
    (role: WorkspaceRole) => {
      if (roleModalMember) {
        updateRole.mutate({
          memberId: roleModalMember.id,
          workspaceId,
          role,
        });
      }
    },
    [roleModalMember, workspaceId, updateRole]
  );

  const handleRemove = useCallback(
    (member: WorkspaceMemberWithUser) => {
      // Prevent removing self
      if (member.user_id === currentUserId) {
        Alert.alert('Cannot Remove', 'You cannot remove yourself. Use "Leave Workspace" instead.', [
          { text: 'OK' },
        ]);
        return;
      }

      const displayName = member.user.name || member.user.email;
      Alert.alert(
        'Remove Member',
        `Are you sure you want to remove ${displayName} from this workspace?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              removeMember.mutate({
                memberId: member.id,
                workspaceId,
              });
            },
          },
        ]
      );
    },
    [currentUserId, workspaceId, removeMember]
  );

  // Sort members: owner first, then admins, then members
  const sortedMembers = React.useMemo(() => {
    return [...members].sort((a, b) => {
      const roleOrder = { owner: 0, admin: 1, member: 2 };
      const orderA = roleOrder[a.role] ?? 3;
      const orderB = roleOrder[b.role] ?? 3;
      return orderA - orderB;
    });
  }, [members]);

  // Render individual member item
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<WorkspaceMemberWithUser>) => (
      <MemberCard
        member={item}
        canManage={canManage}
        onRoleChange={handleRoleChange}
        onRemove={handleRemove}
      />
    ),
    [canManage, handleRoleChange, handleRemove]
  );

  // Key extractor for FlatList
  const keyExtractor = useCallback((item: WorkspaceMemberWithUser) => item.id, []);

  // Loading state
  if (isLoading && members.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Spinner size="large" message="Loading members..." />
      </View>
    );
  }

  // Empty state
  if (!isLoading && members.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      <FlatList
        data={sortedMembers}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
        ListHeaderComponent={
          <Text variant="caption" color="muted" style={styles.listHeader}>
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </Text>
        }
      />

      <RoleChangeModal
        visible={roleModalMember !== null}
        member={roleModalMember}
        onClose={() => setRoleModalMember(null)}
        onConfirm={handleRoleConfirm}
        isPending={updateRole.isPending}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  listHeader: {
    marginBottom: spacing.sm,
  },
  separator: {
    height: spacing.sm,
  },
  card: {},
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  memberInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    marginLeft: spacing.sm,
  },
  actionButton: {
    padding: spacing.sm,
  },
  ownerIndicator: {
    marginLeft: spacing.sm,
    padding: spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    marginBottom: spacing.md,
  },
  emptyText: {
    maxWidth: 280,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  roleModal: {
    width: '85%',
    maxWidth: 400,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSizes.lg,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    marginBottom: spacing.lg,
  },
  rolePickerContainer: {
    marginBottom: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});

export default MemberList;
