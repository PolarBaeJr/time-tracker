/**
 * CreateProjectModal Component
 *
 * Modal form for creating a new project with name, color picker, and description.
 * Validates input and shows loading state during creation.
 *
 * USAGE:
 * ```tsx
 * <CreateProjectModal
 *   visible={showModal}
 *   workspaceId={workspaceId}
 *   onClose={() => setShowModal(false)}
 *   onSuccess={(project) => handleProjectCreated(project)}
 * />
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only workspace members can create projects
 * - Input is validated with Zod schema before submission
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
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
import { Text, Button, Input, Icon, ColorPicker } from '@/components/ui';
import { useCreateProject } from '@/hooks';
import { useTheme } from '@/theme';
import { spacing, fontSizes, borderRadius } from '@/theme';
import { CreateProjectSchema, DEFAULT_PROJECT_COLOR, type Project } from '@/schemas';

/**
 * Props for CreateProjectModal component
 */
export interface CreateProjectModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Workspace ID to create project in */
  workspaceId: string;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when project is successfully created */
  onSuccess?: (project: Project) => void;
}

/**
 * CreateProjectModal component for creating new projects
 */
export function CreateProjectModal({
  visible,
  workspaceId,
  onClose,
  onSuccess,
}: CreateProjectModalProps): React.ReactElement {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_PROJECT_COLOR);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createProject = useCreateProject({
    onSuccess: project => {
      // Reset form
      setName('');
      setColor(DEFAULT_PROJECT_COLOR);
      setDescription('');
      setErrors({});
      onClose();
      onSuccess?.(project);
    },
    onError: error => {
      const message = error.message || 'Failed to create project';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    },
  });

  /**
   * Validate form inputs
   */
  const validateForm = useCallback((): boolean => {
    const result = CreateProjectSchema.safeParse({
      name: name.trim(),
      color,
      description: description.trim() || null,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        const field = issue.path[0]?.toString();
        if (field) {
          fieldErrors[field] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return false;
    }

    setErrors({});
    return true;
  }, [name, color, description]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(() => {
    if (!validateForm()) return;

    createProject.mutate({
      workspaceId,
      name: name.trim(),
      color,
      description: description.trim() || null,
    });
  }, [validateForm, createProject, workspaceId, name, color, description]);

  /**
   * Handle modal close
   */
  const handleClose = useCallback(() => {
    if (createProject.isPending) return;
    setName('');
    setColor(DEFAULT_PROJECT_COLOR);
    setDescription('');
    setErrors({});
    onClose();
  }, [createProject.isPending, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text variant="heading" style={styles.title}>
              Create Project
            </Text>
            <Pressable
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close modal"
              disabled={createProject.isPending}
            >
              <Icon name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {/* Form */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Name input */}
            <Input
              label="Project Name"
              placeholder="Enter project name"
              value={name}
              onChangeText={setName}
              error={errors.name}
              maxLength={100}
              autoFocus
              disabled={createProject.isPending}
            />

            {/* Color picker */}
            <ColorPicker
              label="Project Color"
              value={color}
              onChange={setColor}
              error={errors.color}
            />

            {/* Description input */}
            <Input
              label="Description (optional)"
              placeholder="Brief description of the project"
              value={description}
              onChangeText={setDescription}
              error={errors.description}
              multiline
              maxLength={1000}
              disabled={createProject.isPending}
            />
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Button
              variant="ghost"
              onPress={handleClose}
              disabled={createProject.isPending}
              style={styles.cancelButton}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onPress={handleSubmit}
              loading={createProject.isPending}
              disabled={!name.trim() || createProject.isPending}
              style={styles.submitButton}
            >
              Create Project
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: 400,
  },
  bodyContent: {
    padding: spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: spacing.lg,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  cancelButton: {
    minWidth: 80,
  },
  submitButton: {
    minWidth: 140,
  },
});

export default CreateProjectModal;
