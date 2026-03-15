/**
 * WorkspaceSettingsSheet Component
 *
 * Bottom sheet for workspace settings.
 * Allows editing name/slug, and provides danger zone for deletion.
 * Links to Members and Invites sections.
 */

import * as React from 'react';
import { useCallback, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
} from 'react-native';

import { Text, Icon, Input, Button, Card } from '@/components/ui';
import { useTheme, spacing, borderRadius, fontSizes } from '@/theme';
import { useUpdateWorkspace, useDeleteWorkspace } from '@/hooks';
import { UpdateWorkspaceSchema } from '@/schemas';
import type { Workspace, WorkspaceRole } from '@/schemas';

/**
 * Validate slug format
 */
function validateSlug(slug: string): string | null {
  if (slug.length < 3) {
    return 'Slug must be at least 3 characters';
  }
  if (slug.length > 50) {
    return 'Slug must be 50 characters or less';
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return 'Slug must contain only lowercase letters, numbers, and hyphens';
  }
  return null;
}

/**
 * Props for WorkspaceSettingsSheet component
 */
export interface WorkspaceSettingsSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** The workspace to edit */
  workspace: Workspace;
  /** Current user's role in the workspace */
  currentUserRole: WorkspaceRole;
  /** Callback to close the sheet */
  onClose: () => void;
  /** Callback when workspace is updated */
  onUpdated?: (workspace: Workspace) => void;
  /** Callback when workspace is deleted */
  onDeleted?: () => void;
  /** Callback to navigate to members section */
  onMembersPress?: () => void;
  /** Callback to navigate to invites section */
  onInvitesPress?: () => void;
}

/**
 * Inner form component that resets when key changes
 */
function WorkspaceSettingsForm({
  workspace,
  currentUserRole,
  onClose,
  onUpdated,
  onDeleted,
  onMembersPress,
  onInvitesPress,
}: Omit<WorkspaceSettingsSheetProps, 'visible'>): React.ReactElement {
  const { colors } = useTheme();

  const isOwner = currentUserRole === 'owner';
  const isAdmin = currentUserRole === 'admin' || isOwner;

  // Form state - initialized from workspace prop
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [nameError, setNameError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  // Compute hasChanges directly from state
  const hasChanges = useMemo(() => {
    return name !== workspace.name || slug !== workspace.slug;
  }, [name, slug, workspace.name, workspace.slug]);

  // Mutations
  const updateWorkspace = useUpdateWorkspace({
    onSuccess: updated => {
      onUpdated?.(updated);
    },
    onError: error => {
      if (error.code === 'SLUG_TAKEN') {
        setSlugError('This slug is already taken.');
      } else {
        setSlugError(error.message);
      }
    },
  });

  const deleteWorkspace = useDeleteWorkspace({
    onSuccess: () => {
      onDeleted?.();
      onClose();
    },
    onError: error => {
      Alert.alert('Delete Failed', error.message, [{ text: 'OK' }]);
    },
  });

  const handleClose = useCallback(() => {
    if (!updateWorkspace.isPending && !deleteWorkspace.isPending) {
      onClose();
    }
  }, [onClose, updateWorkspace.isPending, deleteWorkspace.isPending]);

  const handleNameChange = useCallback((text: string) => {
    setName(text);
    setNameError(null);
  }, []);

  const handleSlugChange = useCallback((text: string) => {
    const cleanedSlug = text.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(cleanedSlug);
    setSlugError(null);
  }, []);

  const handleSave = useCallback(() => {
    // Validate name
    const nameValidation = UpdateWorkspaceSchema.shape.name.safeParse(name);
    if (!nameValidation.success) {
      const issues = nameValidation.error.issues;
      setNameError(issues[0]?.message ?? 'Invalid name');
      return;
    }

    // Validate slug
    const slugValidationError = validateSlug(slug);
    if (slugValidationError) {
      setSlugError(slugValidationError);
      return;
    }

    // Build update data (only changed fields)
    const updateData: { name?: string; slug?: string } = {};
    if (name !== workspace.name) {
      updateData.name = name;
    }
    if (slug !== workspace.slug) {
      updateData.slug = slug;
    }

    if (Object.keys(updateData).length === 0) {
      return;
    }

    updateWorkspace.mutate({ id: workspace.id, data: updateData });
  }, [name, slug, workspace, updateWorkspace]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Workspace',
      `Are you sure you want to permanently delete "${workspace.name}"? This action cannot be undone and will remove all associated data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteWorkspace.mutate(workspace.id),
        },
      ]
    );
  }, [workspace, deleteWorkspace]);

  const isPending = updateWorkspace.isPending || deleteWorkspace.isPending;

  // Memoize danger card style to avoid array style issues
  const dangerCardStyle = useMemo(
    () => StyleSheet.flatten([styles.dangerCard, { borderColor: colors.error }]),
    [colors.error]
  );

  return (
    <>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text variant="heading" style={styles.title}>
          Workspace Settings
        </Text>
        <Pressable
          onPress={handleClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close"
          disabled={isPending}
        >
          <Icon name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Basic Settings */}
        <View style={styles.section}>
          <Text variant="body" bold style={styles.sectionTitle}>
            Basic Information
          </Text>

          <Input
            label="Workspace Name"
            value={name}
            onChangeText={handleNameChange}
            error={nameError ?? undefined}
            disabled={!isAdmin || isPending}
            maxLength={100}
          />

          <Input
            label="Workspace URL"
            value={slug}
            onChangeText={handleSlugChange}
            error={slugError ?? undefined}
            disabled={!isAdmin || isPending}
            maxLength={50}
            autoCapitalize="none"
            autoCorrect={false}
            helperText={slug !== workspace.slug ? `New URL: ${slug}` : undefined}
          />

          {hasChanges && isAdmin && (
            <Button
              variant="primary"
              onPress={handleSave}
              loading={updateWorkspace.isPending}
              disabled={deleteWorkspace.isPending}
              style={styles.saveButton}
            >
              Save Changes
            </Button>
          )}
        </View>

        {/* Navigation Links */}
        <View style={styles.section}>
          <Text variant="body" bold style={styles.sectionTitle}>
            Manage
          </Text>

          {onMembersPress && (
            <Pressable
              onPress={onMembersPress}
              style={({ pressed }) => [
                styles.navLink,
                { backgroundColor: pressed ? colors.surfaceVariant : 'transparent' },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Manage members"
            >
              <Icon name="list" size={20} color={colors.text} />
              <Text variant="body" style={styles.navLinkText}>
                Members
              </Text>
              <Icon name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          )}

          {onInvitesPress && isAdmin && (
            <Pressable
              onPress={onInvitesPress}
              style={({ pressed }) => [
                styles.navLink,
                { backgroundColor: pressed ? colors.surfaceVariant : 'transparent' },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Manage invitations"
            >
              <Icon name="mail" size={20} color={colors.text} />
              <Text variant="body" style={styles.navLinkText}>
                Invitations
              </Text>
              <Icon name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Danger Zone (Owner only) */}
        {isOwner && (
          <View style={styles.section}>
            <Text variant="body" bold style={[styles.sectionTitle, { color: colors.error }]}>
              Danger Zone
            </Text>

            <Card padding="md" style={dangerCardStyle}>
              <Text variant="body" bold style={{ marginBottom: spacing.xs }}>
                Delete Workspace
              </Text>
              <Text variant="caption" color="muted" style={{ marginBottom: spacing.md }}>
                Once you delete a workspace, there is no going back. This will permanently remove
                the workspace and all associated data including projects, time entries, and member
                associations.
              </Text>
              <Button
                variant="danger"
                onPress={handleDelete}
                loading={deleteWorkspace.isPending}
                disabled={updateWorkspace.isPending}
                size="sm"
              >
                Delete Workspace
              </Button>
            </Card>
          </View>
        )}
      </ScrollView>
    </>
  );
}

/**
 * WorkspaceSettingsSheet Component
 *
 * A bottom sheet for managing workspace settings.
 *
 * @example
 * ```tsx
 * <WorkspaceSettingsSheet
 *   visible={settingsVisible}
 *   workspace={activeWorkspace}
 *   currentUserRole="owner"
 *   onClose={() => setSettingsVisible(false)}
 *   onUpdated={(ws) => setActiveWorkspace(ws)}
 *   onDeleted={() => setActiveWorkspace(null)}
 *   onMembersPress={() => navigateToMembers()}
 *   onInvitesPress={() => navigateToInvites()}
 * />
 * ```
 */
export function WorkspaceSettingsSheet({
  visible,
  workspace,
  currentUserRole,
  onClose,
  onUpdated,
  onDeleted,
  onMembersPress,
  onInvitesPress,
}: WorkspaceSettingsSheetProps): React.ReactElement {
  const { colors } = useTheme();

  // Use a key combining workspace id and form key for reset
  const [formKey, setFormKey] = useState(0);

  const handleClose = useCallback(() => {
    onClose();
    setFormKey(k => k + 1);
  }, [onClose]);

  // Include workspace.id in the key to reset when workspace changes
  const compositeKey = `${workspace.id}-${formKey}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleClose} />

        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <WorkspaceSettingsForm
            key={compositeKey}
            workspace={workspace}
            currentUserRole={currentUserRole}
            onClose={handleClose}
            onUpdated={onUpdated}
            onDeleted={onDeleted}
            onMembersPress={onMembersPress}
            onInvitesPress={onInvitesPress}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
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
  content: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  saveButton: {
    marginTop: spacing.sm,
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginHorizontal: -spacing.md,
    borderRadius: borderRadius.md,
  },
  navLinkText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  dangerCard: {
    borderWidth: 1,
  },
});

export default WorkspaceSettingsSheet;
