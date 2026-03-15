/**
 * ProjectMemberList Component
 *
 * Displays a list of project members with roles and actions.
 * Supports role changes and member removal for authorized users.
 *
 * USAGE:
 * ```tsx
 * <ProjectMemberList
 *   projectId={projectId}
 *   currentUserRole="admin"
 *   onAddMember={() => openAddMemberModal()}
 * />
 * ```
 *
 * SECURITY:
 * - Only project creator or admin can change roles or remove members
 * - Owner cannot be removed or have their role changed
 * - RLS policies enforce permissions on the backend
 */

import * as React from 'react';
import { useCallback, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  type ListRenderItemInfo,
} from 'react-native';
import { Card, Text, Button, Spinner } from '@/components/ui';
import { RolePicker } from './RolePicker';
import { useProjectMembers, useUpdateProjectMemberRole, useRemoveProjectMember } from '@/hooks';
import { useTheme } from '@/theme';
import { spacing, borderRadius } from '@/theme';
import type { ProjectMemberWithUser, WorkspaceRole } from '@/schemas';

/**
 * Props for ProjectMemberList component
 */
export interface ProjectMemberListProps {
  /** Project ID to fetch members for */
  projectId: string;
  /** Current user's role in the project */
  currentUserRole?: WorkspaceRole;
  /** Callback when add member is pressed */
  onAddMember?: () => void;
  /** Whether to show the add member button */
  showAddButton?: boolean;
}

/**
 * Show a confirmation dialog
 */
function confirmRemove(memberName: string, onConfirm: () => void): void {
  const message = `Are you sure you want to remove ${memberName} from this project?`;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(message)) {
      onConfirm();
    }
    return;
  }

  Alert.alert('Remove Member', message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: onConfirm },
  ]);
}

/**
 * Individual member row component
 */
interface MemberRowProps {
  member: ProjectMemberWithUser;
  canManage: boolean;
  isUpdating: boolean;
  onRoleChange: (memberId: string, role: WorkspaceRole) => void;
  onRemove: (member: ProjectMemberWithUser) => void;
}

function MemberRow({
  member,
  canManage,
  isUpdating,
  onRoleChange,
  onRemove,
}: MemberRowProps): React.ReactElement {
  const { colors } = useTheme();
  const [showRolePicker, setShowRolePicker] = useState(false);

  const isOwner = member.role === 'owner';
  const displayName = member.user.name || member.user.email;

  const handleRolePress = useCallback(() => {
    if (!canManage || isOwner) return;
    setShowRolePicker(true);
  }, [canManage, isOwner]);

  const handleRoleSelect = useCallback(
    (role: WorkspaceRole) => {
      setShowRolePicker(false);
      if (role !== member.role) {
        onRoleChange(member.id, role);
      }
    },
    [member.id, member.role, onRoleChange]
  );

  const handleRemove = useCallback(() => {
    confirmRemove(displayName, () => {
      onRemove(member);
    });
  }, [member, displayName, onRemove]);

  return (
    <Card padding="md" elevation="sm" style={styles.memberCard}>
      <View style={styles.memberRow}>
        {/* Avatar placeholder */}
        <View style={[styles.avatar, { backgroundColor: colors.surfaceVariant }]}>
          <Text variant="body" bold>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Member info */}
        <View style={styles.memberInfo}>
          <Text variant="body" bold numberOfLines={1}>
            {displayName}
          </Text>
          <Text variant="caption" color="muted" numberOfLines={1}>
            {member.user.email}
          </Text>
        </View>

        {/* Role badge/picker */}
        <Pressable
          onPress={handleRolePress}
          disabled={!canManage || isOwner || isUpdating}
          style={[
            styles.roleBadge,
            { backgroundColor: colors.surfaceVariant },
            isOwner && styles.ownerBadge,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Role: ${member.role}${canManage && !isOwner ? ', tap to change' : ''}`}
        >
          <Text variant="caption" color={isOwner ? 'primary' : 'secondary'} style={styles.roleText}>
            {member.role}
          </Text>
          {canManage && !isOwner && (
            <Text variant="caption" color="muted">
              {' '}
              ▼
            </Text>
          )}
        </Pressable>

        {/* Remove button */}
        {canManage && !isOwner && (
          <Button
            variant="ghost"
            size="sm"
            onPress={handleRemove}
            disabled={isUpdating}
            style={styles.removeButton}
          >
            Remove
          </Button>
        )}
      </View>

      {/* Role picker dropdown */}
      {showRolePicker && (
        <RolePicker
          value={member.role}
          onChange={handleRoleSelect}
          onClose={() => setShowRolePicker(false)}
          excludeOwner
        />
      )}
    </Card>
  );
}

/**
 * Empty state component
 */
function EmptyState({
  onAddMember,
  canManage,
}: {
  onAddMember?: () => void;
  canManage: boolean;
}): React.ReactElement {
  return (
    <View style={styles.emptyState}>
      <Text variant="body" color="secondary" center>
        No members in this project yet.
      </Text>
      {canManage && onAddMember && (
        <Button variant="primary" onPress={onAddMember} style={styles.emptyAddButton}>
          Add First Member
        </Button>
      )}
    </View>
  );
}

/**
 * ProjectMemberList component for displaying and managing project members
 */
export function ProjectMemberList({
  projectId,
  currentUserRole,
  onAddMember,
  showAddButton = true,
}: ProjectMemberListProps): React.ReactElement {
  const { colors } = useTheme();

  const {
    data: members,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useProjectMembers(projectId, {
    enabled: !!projectId,
  });

  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  // Check if current user can manage members
  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';

  // Mutation hooks
  const updateRole = useUpdateProjectMemberRole({
    onSuccess: () => {
      setUpdatingMemberId(null);
      void refetch();
    },
    onError: error => {
      setUpdatingMemberId(null);
      const message = error.message || 'Failed to update role';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    },
  });

  const removeMember = useRemoveProjectMember({
    onSuccess: () => {
      setUpdatingMemberId(null);
      void refetch();
    },
    onError: (error, _memberId) => {
      setUpdatingMemberId(null);
      const message = error.message || 'Failed to remove member';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    },
  });

  /**
   * Handle role change
   */
  const handleRoleChange = useCallback(
    (memberId: string, role: WorkspaceRole) => {
      setUpdatingMemberId(memberId);
      updateRole.mutate({
        memberId,
        projectId,
        role,
      });
    },
    [projectId, updateRole]
  );

  /**
   * Handle member removal
   */
  const handleRemove = useCallback(
    (member: ProjectMemberWithUser) => {
      setUpdatingMemberId(member.id);
      removeMember.mutate({
        memberId: member.id,
        projectId,
      });
    },
    [projectId, removeMember]
  );

  /**
   * Render individual member item
   */
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ProjectMemberWithUser>) => (
      <MemberRow
        member={item}
        canManage={canManage}
        isUpdating={updatingMemberId === item.id}
        onRoleChange={handleRoleChange}
        onRemove={handleRemove}
      />
    ),
    [canManage, updatingMemberId, handleRoleChange, handleRemove]
  );

  /**
   * Key extractor
   */
  const keyExtractor = useCallback((item: ProjectMemberWithUser) => item.id, []);

  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  // Loading state
  if (isLoading && !members) {
    return (
      <View style={styles.loadingContainer}>
        <Spinner size="large" message="Loading members..." />
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text variant="body" color="error" center>
          Failed to load members
        </Text>
        <Button variant="outline" size="sm" onPress={handleRefresh} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  // Empty state
  if (!members || members.length === 0) {
    return <EmptyState onAddMember={onAddMember} canManage={canManage} />;
  }

  return (
    <View style={styles.container}>
      {/* Header with add button */}
      {showAddButton && canManage && (
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text variant="label" color="muted">
            {members.length} {members.length === 1 ? 'Member' : 'Members'}
          </Text>
          <Button variant="primary" size="sm" onPress={onAddMember}>
            Add Member
          </Button>
        </View>
      )}

      {/* Member list */}
      <FlatList
        data={members}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        onRefresh={handleRefresh}
        refreshing={isRefetching}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
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
    padding: spacing.xl,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  retryButton: {
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  separator: {
    height: spacing.sm,
  },
  memberCard: {
    // Card styles
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  memberInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  ownerBadge: {
    // Owner badge styling
  },
  roleText: {
    textTransform: 'capitalize',
  },
  removeButton: {
    minWidth: 60,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyAddButton: {
    marginTop: spacing.lg,
  },
});

export default ProjectMemberList;
