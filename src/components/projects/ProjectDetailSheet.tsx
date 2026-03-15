/**
 * ProjectDetailSheet Component
 *
 * Bottom sheet displaying project details with edit capabilities,
 * member list, and archive/delete actions for authorized users.
 *
 * USAGE:
 * ```tsx
 * <ProjectDetailSheet
 *   project={selectedProject}
 *   visible={showDetail}
 *   onClose={() => setShowDetail(false)}
 *   onEdit={() => openEditModal()}
 *   onMembersPress={() => openMembersView()}
 * />
 * ```
 *
 * SECURITY:
 * - Only project creator or admin can edit/archive/delete
 * - RLS policies enforce permissions on the backend
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Modal, Pressable, Platform, ScrollView, Alert } from 'react-native';
import { Text, Button, Icon, Input, ColorPicker, Spinner } from '@/components/ui';
import { useProject, useUpdateProject, useArchiveProject, useDeleteProject } from '@/hooks';
import { useTheme } from '@/theme';
import { spacing, fontSizes, borderRadius } from '@/theme';
import type { ProjectWithStats } from '@/schemas';

/**
 * Props for ProjectDetailSheet component
 */
export interface ProjectDetailSheetProps {
  /** Project to display (can be partial, will fetch full details) */
  project: ProjectWithStats | null;
  /** Whether the sheet is visible */
  visible: boolean;
  /** Callback when sheet is closed */
  onClose: () => void;
  /** Callback when members section is pressed */
  onMembersPress?: (projectId: string) => void;
  /** Callback when add member is pressed */
  onAddMemberPress?: (projectId: string) => void;
  /** Workspace ID for mutations */
  workspaceId: string;
}

/**
 * Show a confirmation dialog
 */
function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  destructive = false
): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: destructive ? 'Delete' : 'Confirm',
      style: destructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ]);
}

/**
 * ProjectDetailSheet component for viewing and editing project details
 */
export function ProjectDetailSheet({
  project,
  visible,
  onClose,
  onMembersPress,
  onAddMemberPress,
  workspaceId,
}: ProjectDetailSheetProps): React.ReactElement {
  const { colors } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Extract project id for stable dependencies
  const projectId = project?.id;

  // Fetch full project details
  const {
    data: projectDetails,
    isLoading,
    refetch,
  } = useProject(project?.id ?? '', {
    enabled: visible && !!project?.id,
  });

  // Determine if user can edit (owner/admin)
  const canEdit = useMemo(() => {
    const role = project?.current_user_role;
    return role === 'owner' || role === 'admin';
  }, [project?.current_user_role]);

  // Mutation hooks
  const updateProject = useUpdateProject({
    onSuccess: () => {
      setIsEditing(false);
      void refetch();
    },
    onError: error => {
      const message = error.message || 'Failed to update project';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    },
  });

  const archiveProject = useArchiveProject({
    onSuccess: () => {
      onClose();
    },
    onError: error => {
      const message = error.message || 'Failed to archive project';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    },
  });

  const deleteProject = useDeleteProject({
    onSuccess: () => {
      onClose();
    },
    onError: error => {
      const message = error.message || 'Failed to delete project';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    },
  });

  /**
   * Start editing mode
   */
  const handleStartEdit = useCallback(() => {
    if (!projectDetails) return;
    setEditName(projectDetails.name);
    setEditColor(projectDetails.color);
    setEditDescription(projectDetails.description ?? '');
    setIsEditing(true);
  }, [projectDetails]);

  /**
   * Cancel editing
   */
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  /**
   * Save edits
   */
  const handleSaveEdit = useCallback(() => {
    if (!projectId) return;

    updateProject.mutate({
      id: projectId,
      workspaceId,
      data: {
        name: editName.trim(),
        color: editColor,
        description: editDescription.trim() || null,
      },
    });
  }, [projectId, workspaceId, updateProject, editName, editColor, editDescription]);

  /**
   * Handle archive action
   */
  const handleArchive = useCallback(() => {
    if (!projectId) return;

    confirmAction(
      'Archive Project',
      'Archived projects will be hidden from the active list but can be restored later.',
      () => {
        archiveProject.mutate({ id: projectId, workspaceId });
      }
    );
  }, [projectId, workspaceId, archiveProject]);

  /**
   * Handle delete action
   */
  const handleDelete = useCallback(() => {
    if (!projectId) return;

    confirmAction(
      'Delete Project',
      'This will permanently delete the project and remove all members. Time entries will be preserved but unlinked from this project. This action cannot be undone.',
      () => {
        deleteProject.mutate({ id: projectId, workspaceId });
      },
      true
    );
  }, [projectId, workspaceId, deleteProject]);

  /**
   * Handle close
   */
  const handleClose = useCallback(() => {
    setIsEditing(false);
    onClose();
  }, [onClose]);

  // Loading state
  const isSubmitting =
    updateProject.isPending || archiveProject.isPending || deleteProject.isPending;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text variant="heading" style={styles.title}>
              {isEditing ? 'Edit Project' : 'Project Details'}
            </Text>
            <Pressable
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
              disabled={isSubmitting}
            >
              <Icon name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <Spinner message="Loading project..." />
              </View>
            ) : projectDetails ? (
              <>
                {isEditing ? (
                  // Edit form
                  <>
                    <Input
                      label="Project Name"
                      value={editName}
                      onChangeText={setEditName}
                      maxLength={100}
                      disabled={isSubmitting}
                    />
                    <ColorPicker label="Project Color" value={editColor} onChange={setEditColor} />
                    <Input
                      label="Description"
                      value={editDescription}
                      onChangeText={setEditDescription}
                      multiline
                      maxLength={1000}
                      disabled={isSubmitting}
                    />
                  </>
                ) : (
                  // View mode
                  <>
                    {/* Project header */}
                    <View style={styles.projectHeader}>
                      <View
                        style={[styles.colorIndicator, { backgroundColor: projectDetails.color }]}
                      />
                      <View style={styles.projectHeaderInfo}>
                        <Text variant="headingSmall">{projectDetails.name}</Text>
                        {projectDetails.is_archived && (
                          <View
                            style={[
                              styles.archivedBadge,
                              { backgroundColor: colors.surfaceVariant },
                            ]}
                          >
                            <Text variant="caption" color="muted">
                              Archived
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Description */}
                    {projectDetails.description && (
                      <View style={styles.section}>
                        <Text variant="label" color="muted" style={styles.sectionLabel}>
                          Description
                        </Text>
                        <Text variant="body">{projectDetails.description}</Text>
                      </View>
                    )}

                    {/* Members section */}
                    <Pressable
                      style={[styles.membersSection, { borderColor: colors.border }]}
                      onPress={() => onMembersPress?.(projectDetails.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`View ${projectDetails.members?.length ?? 0} members`}
                    >
                      <View style={styles.membersSectionContent}>
                        <Text variant="label" color="muted">
                          Members
                        </Text>
                        <Text variant="body">{projectDetails.members?.length ?? 0} members</Text>
                      </View>
                      <Text color="muted" style={styles.chevron}>
                        {'>'}
                      </Text>
                    </Pressable>

                    {/* Add member button */}
                    {canEdit && (
                      <Button
                        variant="outline"
                        onPress={() => onAddMemberPress?.(projectDetails.id)}
                        style={styles.addMemberButton}
                      >
                        Add Member
                      </Button>
                    )}

                    {/* Edit button */}
                    {canEdit && !projectDetails.is_archived && (
                      <Button
                        variant="secondary"
                        onPress={handleStartEdit}
                        style={styles.editButton}
                      >
                        Edit Project
                      </Button>
                    )}

                    {/* Danger zone */}
                    {canEdit && (
                      <View style={[styles.dangerZone, { borderColor: colors.error }]}>
                        <Text variant="label" color="error" style={styles.dangerTitle}>
                          Danger Zone
                        </Text>
                        {!projectDetails.is_archived && (
                          <Button
                            variant="ghost"
                            onPress={handleArchive}
                            loading={archiveProject.isPending}
                            disabled={isSubmitting}
                            style={styles.dangerButton}
                          >
                            Archive Project
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          onPress={handleDelete}
                          loading={deleteProject.isPending}
                          disabled={isSubmitting}
                          style={styles.dangerButton}
                        >
                          Delete Project
                        </Button>
                      </View>
                    )}
                  </>
                )}
              </>
            ) : (
              <View style={styles.errorContainer}>
                <Text variant="body" color="error" center>
                  Failed to load project details
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer for edit mode */}
          {isEditing && (
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <Button variant="ghost" onPress={handleCancelEdit} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onPress={handleSaveEdit}
                loading={updateProject.isPending}
                disabled={!editName.trim() || isSubmitting}
              >
                Save Changes
              </Button>
            </View>
          )}
        </View>
      </View>
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
    maxHeight: '90%',
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
  body: {
    flex: 1,
    maxHeight: 500,
  },
  bodyContent: {
    padding: spacing.lg,
  },
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  errorContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  colorIndicator: {
    width: 6,
    height: 48,
    borderRadius: borderRadius.sm,
    marginRight: spacing.md,
  },
  projectHeaderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  archivedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    marginBottom: spacing.xs,
  },
  membersSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: spacing.md,
  },
  membersSectionContent: {
    flex: 1,
  },
  chevron: {
    fontSize: 20,
  },
  addMemberButton: {
    marginBottom: spacing.sm,
  },
  editButton: {
    marginBottom: spacing.lg,
  },
  dangerZone: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  dangerTitle: {
    marginBottom: spacing.md,
  },
  dangerButton: {
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: spacing.lg,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
});

export default ProjectDetailSheet;
