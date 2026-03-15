/**
 * CreateWorkspaceModal Component
 *
 * Modal form for creating a new workspace.
 * Includes name input with auto-generated slug.
 * Validates slug format and uniqueness.
 */

import * as React from 'react';
import { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';

import { Text, Icon, Input, Button } from '@/components/ui';
import { useTheme, spacing, borderRadius, fontSizes } from '@/theme';
import { useCreateWorkspace } from '@/hooks';
import { CreateWorkspaceSchema } from '@/schemas';

/**
 * Props for CreateWorkspaceModal component
 */
export interface CreateWorkspaceModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback when workspace is successfully created */
  onSuccess?: (workspace: { id: string; name: string; slug: string }) => void;
}

/**
 * Generate a slug from a workspace name
 * - Lowercase
 * - Replace spaces and special chars with hyphens
 * - Remove consecutive hyphens
 * - Trim hyphens from start/end
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

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
 * Inner form component that resets when key changes
 */
function CreateWorkspaceForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: (workspace: { id: string; name: string; slug: string }) => void;
}): React.ReactElement {
  const { colors } = useTheme();

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  // Create workspace mutation
  const createWorkspace = useCreateWorkspace({
    onSuccess: workspace => {
      onSuccess?.(workspace);
      onClose();
    },
    onError: error => {
      // Handle specific errors
      if (error.code === 'SLUG_TAKEN') {
        setSlugError('This slug is already taken. Please choose a different one.');
      } else {
        setSlugError(error.message);
      }
    },
  });

  const handleClose = useCallback(() => {
    if (!createWorkspace.isPending) {
      onClose();
    }
  }, [onClose, createWorkspace.isPending]);

  const handleNameChange = useCallback(
    (text: string) => {
      setName(text);
      setNameError(null);
      // Auto-generate slug unless manually edited
      if (!slugManuallyEdited) {
        setSlug(generateSlug(text));
      }
    },
    [slugManuallyEdited]
  );

  const handleSlugChange = useCallback((text: string) => {
    setSlugManuallyEdited(true);
    setSlugError(null);
    // Enforce slug format as user types
    const cleanedSlug = text.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(cleanedSlug);
  }, []);

  const handleSubmit = useCallback(() => {
    // Validate name
    const nameValidation = CreateWorkspaceSchema.shape.name.safeParse(name);
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

    const slugValidation = CreateWorkspaceSchema.shape.slug.safeParse(slug);
    if (!slugValidation.success) {
      const issues = slugValidation.error.issues;
      setSlugError(issues[0]?.message ?? 'Invalid slug');
      return;
    }

    // Submit
    createWorkspace.mutate({ name: nameValidation.data, slug: slugValidation.data });
  }, [name, slug, createWorkspace]);

  return (
    <>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text variant="heading" style={styles.title}>
          Create Workspace
        </Text>
        <Pressable
          onPress={handleClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close"
          disabled={createWorkspace.isPending}
        >
          <Icon name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      {/* Form */}
      <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
        {/* Name input */}
        <Input
          label="Workspace Name"
          placeholder="My Team Workspace"
          value={name}
          onChangeText={handleNameChange}
          error={nameError ?? undefined}
          disabled={createWorkspace.isPending}
          autoFocus
          maxLength={100}
          accessibilityLabel="Workspace name"
        />

        {/* Slug input */}
        <Input
          label="Workspace URL"
          placeholder="my-team-workspace"
          value={slug}
          onChangeText={handleSlugChange}
          error={slugError ?? undefined}
          disabled={createWorkspace.isPending}
          maxLength={50}
          autoCapitalize="none"
          autoCorrect={false}
          helperText={
            slug.length >= 3
              ? `Your workspace will be available at: ${slug}`
              : 'Minimum 3 characters'
          }
          accessibilityLabel="Workspace URL slug"
        />

        {/* Info text */}
        <View style={[styles.infoBox, { backgroundColor: colors.surfaceVariant }]}>
          <Icon name="alert" size={16} color={colors.textMuted} />
          <Text variant="caption" color="muted" style={styles.infoText}>
            You will be the owner of this workspace with full administrative control. You can invite
            team members after creating the workspace.
          </Text>
        </View>
      </ScrollView>

      {/* Footer with buttons */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Button
          variant="ghost"
          onPress={handleClose}
          disabled={createWorkspace.isPending}
          style={styles.footerButton}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onPress={handleSubmit}
          loading={createWorkspace.isPending}
          disabled={!name.trim() || slug.length < 3}
          style={styles.footerButton}
        >
          Create Workspace
        </Button>
      </View>
    </>
  );
}

/**
 * CreateWorkspaceModal Component
 *
 * A modal for creating new workspaces with name and slug inputs.
 *
 * @example
 * ```tsx
 * <CreateWorkspaceModal
 *   visible={createModalVisible}
 *   onClose={() => setCreateModalVisible(false)}
 *   onSuccess={(ws) => {
 *     setActiveWorkspace(ws);
 *     showToast('Workspace created!');
 *   }}
 * />
 * ```
 */
export function CreateWorkspaceModal({
  visible,
  onClose,
  onSuccess,
}: CreateWorkspaceModalProps): React.ReactElement {
  const { colors } = useTheme();

  // Use a key to force re-mount of form when modal opens
  // This resets all form state without using effects
  const [formKey, setFormKey] = useState(0);

  const handleClose = useCallback(() => {
    onClose();
    // Increment key to reset form on next open
    setFormKey(k => k + 1);
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleClose} />

        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <CreateWorkspaceForm key={formKey} onClose={handleClose} onSuccess={onSuccess} />
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
  form: {
    padding: spacing.lg,
  },
  infoBox: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  infoText: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.lg,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  footerButton: {
    flex: 1,
  },
});

export default CreateWorkspaceModal;
