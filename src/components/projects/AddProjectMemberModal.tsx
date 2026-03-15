/**
 * AddProjectMemberModal Component
 *
 * Modal for adding members to a project. Allows selecting workspace members
 * who are not yet project members and assigning them a role.
 *
 * USAGE:
 * ```tsx
 * <AddProjectMemberModal
 *   visible={showAddMember}
 *   projectId={projectId}
 *   workspaceId={workspaceId}
 *   onClose={() => setShowAddMember(false)}
 *   onSuccess={() => handleMemberAdded()}
 * />
 * ```
 *
 * SECURITY:
 * - Only project creator or admin can add members
 * - RLS policies enforce permissions on the backend
 * - Can only add users who are workspace members
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  FlatList,
  Alert,
  type ListRenderItemInfo,
} from 'react-native';
import { Text, Button, Icon, Spinner } from '@/components/ui';
import { RolePicker } from './RolePicker';
import { useWorkspaceMembers, useProjectMembers, useAddProjectMember } from '@/hooks';
import { useTheme } from '@/theme';
import { spacing, fontSizes, borderRadius } from '@/theme';
import type { WorkspaceMemberWithUser } from '@/schemas';

/** Role type for project members (excludes 'owner') */
type ProjectMemberRole = 'admin' | 'member';

/**
 * Props for AddProjectMemberModal component
 */
export interface AddProjectMemberModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Project ID to add members to */
  projectId: string;
  /** Workspace ID to get available members from */
  workspaceId: string;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when member is successfully added */
  onSuccess?: () => void;
}

/**
 * Member selection row component
 */
interface MemberSelectRowProps {
  member: WorkspaceMemberWithUser;
  selected: boolean;
  onSelect: () => void;
}

function MemberSelectRow({ member, selected, onSelect }: MemberSelectRowProps): React.ReactElement {
  const { colors } = useTheme();
  const displayName = member.user.name || member.user.email;

  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [
        styles.memberRow,
        selected && { backgroundColor: colors.surfaceVariant },
        pressed && { backgroundColor: colors.overlayLight },
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`Add ${displayName}`}
    >
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: colors.surfaceVariant }]}>
        <Text variant="body" bold>
          {displayName.charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Member info */}
      <View style={styles.memberInfo}>
        <Text variant="body" numberOfLines={1}>
          {displayName}
        </Text>
        <Text variant="caption" color="muted" numberOfLines={1}>
          {member.user.email}
        </Text>
      </View>

      {/* Selection indicator */}
      <View
        style={[
          styles.checkbox,
          { borderColor: colors.border },
          selected && { backgroundColor: colors.primary, borderColor: colors.primary },
        ]}
      >
        {selected && (
          <Text variant="caption" style={styles.checkmark}>
            ✓
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/**
 * AddProjectMemberModal component for adding members to a project
 */
export function AddProjectMemberModal({
  visible,
  projectId,
  workspaceId,
  onClose,
  onSuccess,
}: AddProjectMemberModalProps): React.ReactElement {
  const { colors } = useTheme();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<ProjectMemberRole>('member');
  const [showRolePicker, setShowRolePicker] = useState(false);

  // Fetch workspace members
  const { data: workspaceMembers, isLoading: loadingWorkspaceMembers } = useWorkspaceMembers(
    workspaceId,
    {
      enabled: visible && !!workspaceId,
    }
  );

  // Fetch current project members to exclude them
  const { data: projectMembers, isLoading: loadingProjectMembers } = useProjectMembers(projectId, {
    enabled: visible && !!projectId,
  });

  // Filter available members (workspace members who are not project members)
  const availableMembers = useMemo(() => {
    if (!workspaceMembers || !projectMembers) return [];

    const projectMemberUserIds = new Set(projectMembers.map(pm => pm.user_id));
    return workspaceMembers.filter(wm => !projectMemberUserIds.has(wm.user_id));
  }, [workspaceMembers, projectMembers]);

  // Add member mutation
  const addMember = useAddProjectMember({
    onSuccess: () => {
      setSelectedUserId(null);
      setSelectedRole('member');
      onClose();
      onSuccess?.();
    },
    onError: error => {
      const message = error.message || 'Failed to add member';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    },
  });

  /**
   * Handle member selection
   */
  const handleSelectMember = useCallback((userId: string) => {
    setSelectedUserId(prev => (prev === userId ? null : userId));
  }, []);

  /**
   * Handle role selection
   */
  const handleRoleSelect = useCallback((role: 'admin' | 'member' | 'owner') => {
    // Exclude owner as it's not valid for project members
    if (role !== 'owner') {
      setSelectedRole(role);
    }
    setShowRolePicker(false);
  }, []);

  /**
   * Handle add member submission
   */
  const handleSubmit = useCallback(() => {
    if (!selectedUserId) return;

    addMember.mutate({
      projectId,
      user_id: selectedUserId,
      role: selectedRole,
    });
  }, [projectId, selectedUserId, selectedRole, addMember]);

  /**
   * Handle close
   */
  const handleClose = useCallback(() => {
    if (addMember.isPending) return;
    setSelectedUserId(null);
    setSelectedRole('member');
    onClose();
  }, [addMember.isPending, onClose]);

  /**
   * Render member item
   */
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<WorkspaceMemberWithUser>) => (
      <MemberSelectRow
        member={item}
        selected={selectedUserId === item.user_id}
        onSelect={() => handleSelectMember(item.user_id)}
      />
    ),
    [selectedUserId, handleSelectMember]
  );

  /**
   * Key extractor
   */
  const keyExtractor = useCallback((item: WorkspaceMemberWithUser) => item.id, []);

  const isLoading = loadingWorkspaceMembers || loadingProjectMembers;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text variant="heading" style={styles.title}>
              Add Member
            </Text>
            <Pressable
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
              disabled={addMember.isPending}
            >
              <Icon name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {/* Content */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Spinner message="Loading members..." />
            </View>
          ) : availableMembers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text variant="body" color="secondary" center>
                All workspace members are already in this project.
              </Text>
            </View>
          ) : (
            <>
              {/* Role selection */}
              <View style={[styles.roleSection, { borderBottomColor: colors.border }]}>
                <Text variant="label" color="muted">
                  Role for new member
                </Text>
                <Pressable
                  onPress={() => setShowRolePicker(true)}
                  style={[styles.roleSelector, { backgroundColor: colors.surfaceVariant }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Selected role: ${selectedRole}, tap to change`}
                >
                  <Text variant="body" style={styles.roleText}>
                    {selectedRole}
                  </Text>
                  <Text variant="body" color="muted">
                    ▼
                  </Text>
                </Pressable>
              </View>

              {/* Member list */}
              <View style={styles.listHeader}>
                <Text variant="label" color="muted">
                  Select a workspace member
                </Text>
              </View>

              <FlatList
                data={availableMembers}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                style={styles.list}
              />
            </>
          )}

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Button variant="ghost" onPress={handleClose} disabled={addMember.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onPress={handleSubmit}
              loading={addMember.isPending}
              disabled={!selectedUserId || addMember.isPending}
            >
              Add Member
            </Button>
          </View>
        </View>
      </View>

      {/* Role picker modal */}
      {showRolePicker && (
        <RolePicker
          value={selectedRole}
          onChange={handleRoleSelect}
          onClose={() => setShowRolePicker(false)}
          excludeOwner
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: fontSizes.lg,
  },
  closeButton: {
    padding: spacing.xs,
  },
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  roleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  roleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  roleText: {
    textTransform: 'capitalize',
  },
  listHeader: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  list: {
    maxHeight: 300,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: spacing.lg,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
});

export default AddProjectMemberModal;
