/**
 * CreateShareModal Component
 *
 * Modal form for creating a new shared dashboard link.
 * Includes title input, optional expiry date picker, and workspace selector.
 * Shows the generated link after creation with a copy button.
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
  Alert,
} from 'react-native';
import { Text, Icon, Input, Button } from '@/components/ui';
import { copyToClipboard } from '@/utils/clipboard';
import { useTheme, spacing, borderRadius, fontSizes } from '@/theme';
import { useCreateSharedDashboard, getShareUrl } from '@/hooks/useSharedDashboards';
import { useWorkspacesQuery } from '@/hooks/useWorkspaces';
import { CreateSharedDashboardSchema } from '@/schemas';
import type { WorkspaceWithMemberCount } from '@/schemas';

/**
 * Props for CreateShareModal component
 */
export interface CreateShareModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback when share is successfully created with the share URL */
  onSuccess?: (shareUrl: string) => void;
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get date string for expiry options
 */
function getExpiryDate(days: number | null): string | null {
  if (days === null) return null;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/**
 * Expiry option type
 */
interface ExpiryOption {
  label: string;
  days: number | null;
}

const EXPIRY_OPTIONS: ExpiryOption[] = [
  { label: 'Never', days: null },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

/**
 * Inner form component that resets when modal closes
 */
function CreateShareForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: (shareUrl: string) => void;
}): React.ReactElement {
  const { colors } = useTheme();

  // Form state
  const [title, setTitle] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedExpiryIndex, setSelectedExpiryIndex] = useState(0);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [createdShareUrl, setCreatedShareUrl] = useState<string | null>(null);

  // Fetch workspaces for selector
  const { data: workspaces } = useWorkspacesQuery();

  // Create shared dashboard mutation
  const createMutation = useCreateSharedDashboard({
    onSuccess: dashboard => {
      setCreatedShareUrl(dashboard.share_url);
    },
    onError: error => {
      Alert.alert('Error', error.message);
    },
  });

  const handleClose = useCallback(() => {
    if (!createMutation.isPending) {
      onClose();
    }
  }, [onClose, createMutation.isPending]);

  const handleTitleChange = useCallback((text: string) => {
    setTitle(text);
    setTitleError(null);
  }, []);

  const handleSubmit = useCallback(() => {
    // Validate title
    const titleValidation = CreateSharedDashboardSchema.shape.title.safeParse(title);
    if (!titleValidation.success) {
      const issues = titleValidation.error.issues;
      setTitleError(issues[0]?.message ?? 'Invalid title');
      return;
    }

    // Get expiry date
    const expiresAt = getExpiryDate(EXPIRY_OPTIONS[selectedExpiryIndex].days);

    // Create the shared dashboard
    createMutation.mutate({
      title,
      workspace_id: selectedWorkspaceId,
      expires_at: expiresAt,
    });
  }, [title, selectedWorkspaceId, selectedExpiryIndex, createMutation]);

  const handleCopyLink = useCallback(async () => {
    if (createdShareUrl) {
      const success = await copyToClipboard(createdShareUrl);
      if (success) {
        Alert.alert('Copied', 'Share link copied to clipboard.');
      } else {
        Alert.alert('Error', 'Failed to copy link to clipboard.');
      }
    }
  }, [createdShareUrl]);

  const handleDone = useCallback(() => {
    if (createdShareUrl) {
      onSuccess?.(createdShareUrl);
    }
    onClose();
  }, [createdShareUrl, onSuccess, onClose]);

  // If share was created, show success view
  if (createdShareUrl) {
    return (
      <View style={styles.successContainer}>
        <Icon name="check-circle" size={48} color={colors.success} />
        <Text
          variant="heading"
          style={{ color: colors.text, marginTop: spacing.md, textAlign: 'center' }}
        >
          Share Link Created
        </Text>
        <Text
          variant="body"
          style={{ color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }}
        >
          Anyone with this link can view your analytics dashboard.
        </Text>

        <View
          style={[
            styles.linkContainer,
            { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md },
          ]}
        >
          <Text
            variant="caption"
            numberOfLines={2}
            style={{ color: colors.textSecondary, flex: 1 }}
          >
            {createdShareUrl}
          </Text>
          <Pressable
            style={[
              styles.copyButton,
              { backgroundColor: colors.primary, borderRadius: borderRadius.sm },
            ]}
            onPress={handleCopyLink}
            accessibilityRole="button"
            accessibilityLabel="Copy share link"
          >
            <Icon name="copy" size={16} color={colors.text} />
          </Pressable>
        </View>

        <Button onPress={handleDone} style={{ marginTop: spacing.lg, width: '100%' }}>
          Done
        </Button>
      </View>
    );
  }

  return (
    <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
      {/* Title Input */}
      <View style={styles.field}>
        <Text variant="label" style={{ color: colors.text, marginBottom: spacing.xs }}>
          Dashboard Title
        </Text>
        <Input
          value={title}
          onChangeText={handleTitleChange}
          placeholder="My Analytics Dashboard"
          maxLength={100}
          error={titleError ?? undefined}
          accessibilityLabel="Dashboard title"
        />
        {titleError && (
          <Text variant="caption" style={{ color: colors.error, marginTop: spacing.xs }}>
            {titleError}
          </Text>
        )}
      </View>

      {/* Workspace Selector */}
      {workspaces && workspaces.length > 0 && (
        <View style={styles.field}>
          <Text variant="label" style={{ color: colors.text, marginBottom: spacing.xs }}>
            Data Source
          </Text>
          <Text variant="caption" style={{ color: colors.textMuted, marginBottom: spacing.sm }}>
            Choose which analytics to share
          </Text>

          <Pressable
            style={[
              styles.optionButton,
              {
                backgroundColor:
                  selectedWorkspaceId === null ? colors.primary + '20' : colors.surfaceVariant,
                borderColor: selectedWorkspaceId === null ? colors.primary : colors.border,
                borderRadius: borderRadius.md,
              },
            ]}
            onPress={() => setSelectedWorkspaceId(null)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selectedWorkspaceId === null }}
          >
            <Icon
              name="user"
              size={16}
              color={selectedWorkspaceId === null ? colors.primary : colors.textSecondary}
            />
            <Text
              variant="body"
              style={{
                color: selectedWorkspaceId === null ? colors.primary : colors.text,
                marginLeft: spacing.sm,
              }}
            >
              Personal Analytics
            </Text>
          </Pressable>

          {workspaces.map((workspace: WorkspaceWithMemberCount) => (
            <Pressable
              key={workspace.id}
              style={[
                styles.optionButton,
                {
                  backgroundColor:
                    selectedWorkspaceId === workspace.id
                      ? colors.primary + '20'
                      : colors.surfaceVariant,
                  borderColor:
                    selectedWorkspaceId === workspace.id ? colors.primary : colors.border,
                  borderRadius: borderRadius.md,
                },
              ]}
              onPress={() => setSelectedWorkspaceId(workspace.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedWorkspaceId === workspace.id }}
            >
              <Icon
                name="users"
                size={16}
                color={selectedWorkspaceId === workspace.id ? colors.primary : colors.textSecondary}
              />
              <Text
                variant="body"
                style={{
                  color: selectedWorkspaceId === workspace.id ? colors.primary : colors.text,
                  marginLeft: spacing.sm,
                }}
              >
                {workspace.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Expiry Selector */}
      <View style={styles.field}>
        <Text variant="label" style={{ color: colors.text, marginBottom: spacing.xs }}>
          Link Expiration
        </Text>
        <View style={styles.expiryOptions}>
          {EXPIRY_OPTIONS.map((option, index) => (
            <Pressable
              key={option.label}
              style={[
                styles.expiryButton,
                {
                  backgroundColor:
                    selectedExpiryIndex === index ? colors.primary : colors.surfaceVariant,
                  borderRadius: borderRadius.sm,
                },
              ]}
              onPress={() => setSelectedExpiryIndex(index)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedExpiryIndex === index }}
            >
              <Text
                variant="caption"
                style={{
                  color: selectedExpiryIndex === index ? colors.text : colors.textSecondary,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Submit Button */}
      <Button
        onPress={handleSubmit}
        disabled={createMutation.isPending || !title.trim()}
        style={{ marginTop: spacing.lg }}
      >
        {createMutation.isPending ? 'Creating...' : 'Create Share Link'}
      </Button>
    </ScrollView>
  );
}

/**
 * CreateShareModal component
 *
 * Modal for creating new shared dashboard links.
 */
export function CreateShareModal({
  visible,
  onClose,
  onSuccess,
}: CreateShareModalProps): React.ReactElement {
  const { colors } = useTheme();

  // Reset form when modal closes by using key
  const [formKey, setFormKey] = useState(0);

  const handleClose = useCallback(() => {
    onClose();
    // Reset form for next open
    setFormKey(prev => prev + 1);
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerLeft} />
          <Text variant="heading" style={{ color: colors.text }}>
            Create Share Link
          </Text>
          <Pressable
            style={styles.closeButton}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Icon name="x" size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* Form */}
        <CreateShareForm key={formKey} onClose={handleClose} onSuccess={onSuccess} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    width: 40,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  form: {
    flex: 1,
  },
  formContent: {
    padding: spacing.md,
  },
  field: {
    marginBottom: spacing.lg,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  expiryOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  expiryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginTop: spacing.lg,
    width: '100%',
  },
  copyButton: {
    padding: spacing.sm,
    marginLeft: spacing.sm,
  },
});
