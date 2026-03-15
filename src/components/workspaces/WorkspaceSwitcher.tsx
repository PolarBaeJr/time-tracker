/**
 * WorkspaceSwitcher Component
 *
 * A dropdown/sheet for switching between workspaces.
 * Shows the current workspace and allows selecting a different one.
 * Includes "Personal" option for non-collaborative mode.
 */

import * as React from 'react';
import { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';

import { Text, Icon, Button, Spinner, Card } from '@/components/ui';
import { useTheme, spacing, borderRadius, fontSizes } from '@/theme';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import type { Workspace } from '@/schemas';

/**
 * Props for WorkspaceSwitcher component
 */
export interface WorkspaceSwitcherProps {
  /** Callback when "Create Workspace" is pressed */
  onCreatePress?: () => void;
  /** Callback when workspace settings is pressed (for active workspace) */
  onSettingsPress?: (workspace: Workspace) => void;
  /** Render as compact button (for header/sidebar) */
  compact?: boolean;
}

/**
 * Individual workspace option in the list
 */
function WorkspaceOption({
  workspace,
  isActive,
  onPress,
  onSettingsPress,
}: {
  workspace: Workspace | null;
  isActive: boolean;
  onPress: () => void;
  onSettingsPress?: () => void;
}): React.ReactElement {
  const { colors } = useTheme();
  const isPersonal = workspace === null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={isPersonal ? 'Personal workspace' : workspace.name}
      style={({ pressed }) => [
        styles.workspaceOption,
        {
          backgroundColor: isActive ? colors.surfaceVariant : 'transparent',
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.workspaceOptionContent}>
        {/* Icon/Avatar */}
        <View
          style={[
            styles.workspaceIcon,
            { backgroundColor: isPersonal ? colors.surfaceVariant : colors.primary },
          ]}
        >
          <Text
            variant="body"
            bold
            style={{ color: isPersonal ? colors.textSecondary : colors.text }}
          >
            {isPersonal ? 'P' : workspace.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Name and indicator */}
        <View style={styles.workspaceInfo}>
          <Text variant="body" bold={isActive}>
            {isPersonal ? 'Personal' : workspace.name}
          </Text>
          {isPersonal && (
            <Text variant="caption" color="muted">
              Non-collaborative mode
            </Text>
          )}
        </View>

        {/* Active check or settings button */}
        {isActive ? <Icon name="check" size={20} color={colors.primary} /> : null}
      </View>

      {/* Settings button for non-personal workspaces when active */}
      {isActive && !isPersonal && onSettingsPress && (
        <Pressable
          onPress={onSettingsPress}
          style={styles.settingsButton}
          accessibilityRole="button"
          accessibilityLabel={`Settings for ${workspace.name}`}
        >
          <Icon name="settings" size={18} color={colors.textMuted} />
        </Pressable>
      )}
    </Pressable>
  );
}

/**
 * WorkspaceSwitcher Component
 *
 * A component for switching between workspaces. Can be rendered as a compact
 * button that opens a modal, or as a full list view.
 *
 * @example
 * ```tsx
 * // Compact mode for header/sidebar
 * <WorkspaceSwitcher
 *   compact
 *   onCreatePress={() => setCreateModalVisible(true)}
 *   onSettingsPress={(ws) => navigateToSettings(ws)}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Full list mode
 * <WorkspaceSwitcher
 *   onCreatePress={() => setCreateModalVisible(true)}
 * />
 * ```
 */
export function WorkspaceSwitcher({
  onCreatePress,
  onSettingsPress,
  compact = false,
}: WorkspaceSwitcherProps): React.ReactElement {
  const { colors } = useTheme();
  const {
    activeWorkspace,
    setActiveWorkspace,
    workspaces,
    isLoading,
    isPersonalMode,
    hasWorkspaces,
  } = useWorkspaceContext();

  const [modalVisible, setModalVisible] = useState(false);

  const handleOpenModal = useCallback(() => {
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  const handleSelectWorkspace = useCallback(
    (workspace: Workspace | null) => {
      setActiveWorkspace(workspace);
      setModalVisible(false);
    },
    [setActiveWorkspace]
  );

  const handleSettingsPress = useCallback(
    (workspace: Workspace) => {
      setModalVisible(false);
      onSettingsPress?.(workspace);
    },
    [onSettingsPress]
  );

  const handleCreatePress = useCallback(() => {
    setModalVisible(false);
    onCreatePress?.();
  }, [onCreatePress]);

  // Render the modal content
  const renderModalContent = () => (
    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
      {/* Header */}
      <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
        <Text variant="heading" style={styles.modalTitle}>
          Switch Workspace
        </Text>
        <Pressable
          onPress={handleCloseModal}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Icon name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      {/* Workspace list */}
      <ScrollView style={styles.workspaceList} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Spinner size="large" message="Loading workspaces..." />
          </View>
        ) : (
          <>
            {/* Personal option */}
            <WorkspaceOption
              workspace={null}
              isActive={isPersonalMode}
              onPress={() => handleSelectWorkspace(null)}
            />

            {/* Divider if there are workspaces */}
            {hasWorkspaces && <View style={[styles.divider, { backgroundColor: colors.border }]} />}

            {/* Workspace options */}
            {workspaces.map(workspace => (
              <WorkspaceOption
                key={workspace.id}
                workspace={workspace}
                isActive={activeWorkspace?.id === workspace.id}
                onPress={() => handleSelectWorkspace(workspace)}
                onSettingsPress={onSettingsPress ? () => handleSettingsPress(workspace) : undefined}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* Create workspace button */}
      {onCreatePress && (
        <View style={styles.createButtonContainer}>
          <Button variant="primary" onPress={handleCreatePress}>
            <View style={styles.createButtonContent}>
              <Icon name="add" size={18} color={colors.text} />
              <Text variant="body" bold style={{ marginLeft: spacing.xs }}>
                Create Workspace
              </Text>
            </View>
          </Button>
        </View>
      )}
    </View>
  );

  // Compact mode: render a button that opens modal
  if (compact) {
    return (
      <>
        <Pressable
          onPress={handleOpenModal}
          accessibilityRole="button"
          accessibilityLabel={`Current workspace: ${isPersonalMode ? 'Personal' : activeWorkspace?.name}`}
          accessibilityHint="Double tap to switch workspaces"
          style={({ pressed }) => [
            styles.compactButton,
            { backgroundColor: colors.surfaceVariant, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <View
            style={[
              styles.compactIcon,
              { backgroundColor: isPersonalMode ? colors.surface : colors.primary },
            ]}
          >
            <Text
              variant="caption"
              bold
              style={{ color: isPersonalMode ? colors.textSecondary : colors.text }}
            >
              {isPersonalMode ? 'P' : activeWorkspace?.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text variant="body" bold style={styles.compactText} numberOfLines={1}>
            {isPersonalMode ? 'Personal' : activeWorkspace?.name}
          </Text>
          <Icon name="chevron-down" size={16} color={colors.textMuted} />
        </Pressable>

        <Modal
          visible={modalVisible}
          transparent
          animationType="slide"
          onRequestClose={handleCloseModal}
        >
          <KeyboardAvoidingView
            style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Pressable style={styles.modalBackdrop} onPress={handleCloseModal} />
            {renderModalContent()}
          </KeyboardAvoidingView>
        </Modal>
      </>
    );
  }

  // Full mode: render the list directly
  return (
    <Card padding="none" elevation="sm">
      <View style={styles.fullModeContainer}>
        <Text variant="heading" style={styles.fullModeTitle}>
          Workspaces
        </Text>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Spinner size="large" message="Loading workspaces..." />
          </View>
        ) : (
          <>
            {/* Personal option */}
            <WorkspaceOption
              workspace={null}
              isActive={isPersonalMode}
              onPress={() => handleSelectWorkspace(null)}
            />

            {/* Divider if there are workspaces */}
            {hasWorkspaces && <View style={[styles.divider, { backgroundColor: colors.border }]} />}

            {/* Workspace options */}
            {workspaces.map(workspace => (
              <WorkspaceOption
                key={workspace.id}
                workspace={workspace}
                isActive={activeWorkspace?.id === workspace.id}
                onPress={() => handleSelectWorkspace(workspace)}
                onSettingsPress={onSettingsPress ? () => handleSettingsPress(workspace) : undefined}
              />
            ))}
          </>
        )}

        {/* Create workspace button */}
        {onCreatePress && (
          <View style={styles.createButtonContainer}>
            <Button variant="outline" onPress={onCreatePress}>
              <View style={styles.createButtonContent}>
                <Icon name="add" size={18} color={colors.primary} />
                <Text variant="body" bold style={{ marginLeft: spacing.xs, color: colors.primary }}>
                  Create Workspace
                </Text>
              </View>
            </Button>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // Compact mode styles
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    minWidth: 120,
    maxWidth: 200,
  },
  compactIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  compactText: {
    flex: 1,
    marginRight: spacing.xs,
  },

  // Modal styles
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
  closeButton: {
    padding: spacing.xs,
  },

  // Workspace list styles
  workspaceList: {
    maxHeight: 400,
  },
  workspaceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  workspaceOptionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  workspaceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  workspaceInfo: {
    flex: 1,
  },
  settingsButton: {
    padding: spacing.sm,
    marginLeft: spacing.sm,
  },

  // Divider
  divider: {
    height: 1,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
  },

  // Loading
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Create button
  createButtonContainer: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  createButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Full mode styles
  fullModeContainer: {
    paddingVertical: spacing.md,
  },
  fullModeTitle: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
});

export default WorkspaceSwitcher;
