/**
 * ProjectPicker Component
 *
 * Dropdown/sheet for selecting a project from the active workspace.
 * Used in timer and quick entry for associating time entries with projects.
 *
 * USAGE:
 * ```tsx
 * <ProjectPicker
 *   workspaceId={workspaceId}
 *   value={selectedProjectId}
 *   onChange={(projectId) => setSelectedProjectId(projectId)}
 *   allowNoProject
 * />
 * ```
 *
 * SECURITY:
 * - Only shows projects the user is a member of
 * - RLS policies enforce visibility on the backend
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  type ListRenderItemInfo,
} from 'react-native';
import { Text, Spinner, Card } from '@/components/ui';
import { useProjects } from '@/hooks';
import { useTheme } from '@/theme';
import { spacing, borderRadius } from '@/theme';
import type { ProjectWithStats } from '@/schemas';

/**
 * Props for ProjectPicker component
 */
export interface ProjectPickerProps {
  /** Workspace ID to fetch projects from */
  workspaceId: string;
  /** Currently selected project ID */
  value: string | null;
  /** Callback when project is selected */
  onChange: (projectId: string | null) => void;
  /** Allow selecting "No Project" option */
  allowNoProject?: boolean;
  /** Label for no project option */
  noProjectLabel?: string;
  /** Placeholder text when no project is selected */
  placeholder?: string;
  /** Whether the picker is disabled */
  disabled?: boolean;
}

/**
 * Project option row component
 */
interface ProjectOptionProps {
  project: ProjectWithStats | null;
  selected: boolean;
  onSelect: () => void;
  noProjectLabel?: string;
}

function ProjectOption({
  project,
  selected,
  onSelect,
  noProjectLabel,
}: ProjectOptionProps): React.ReactElement {
  const { colors } = useTheme();

  const isNoProject = project === null;
  const name = isNoProject ? (noProjectLabel ?? 'No Project') : project.name;

  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [
        styles.option,
        selected && { backgroundColor: colors.surfaceVariant },
        pressed && { backgroundColor: colors.overlayLight },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={name}
    >
      {/* Color indicator */}
      {project ? (
        <View style={[styles.colorIndicator, { backgroundColor: project.color }]} />
      ) : (
        <View style={[styles.colorIndicator, { backgroundColor: colors.border }]} />
      )}

      {/* Project name */}
      <Text
        variant="body"
        numberOfLines={1}
        style={styles.optionName}
        color={isNoProject ? 'muted' : undefined}
      >
        {name}
      </Text>

      {/* Selection indicator */}
      {selected && (
        <Text variant="body" color="primary">
          ✓
        </Text>
      )}
    </Pressable>
  );
}

/**
 * Trigger button component for the picker
 */
interface PickerTriggerProps {
  selectedProject: ProjectWithStats | null;
  placeholder: string;
  noProjectLabel: string;
  disabled: boolean;
  onPress: () => void;
}

function PickerTrigger({
  selectedProject,
  placeholder,
  noProjectLabel: _noProjectLabel,
  disabled,
  onPress,
}: PickerTriggerProps): React.ReactElement {
  const { colors } = useTheme();

  const displayText = selectedProject ? selectedProject.name : placeholder;

  const displayColor = selectedProject?.color ?? colors.border;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.trigger,
        { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
        pressed && { backgroundColor: colors.overlayLight },
        disabled && styles.triggerDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Select project. Current: ${displayText}`}
      accessibilityState={{ disabled }}
    >
      {/* Color indicator */}
      <View style={[styles.triggerColor, { backgroundColor: displayColor }]} />

      {/* Text */}
      <Text
        variant="body"
        numberOfLines={1}
        style={styles.triggerText}
        color={selectedProject ? undefined : 'muted'}
      >
        {displayText}
      </Text>

      {/* Dropdown arrow */}
      <Text variant="body" color="muted">
        ▼
      </Text>
    </Pressable>
  );
}

/**
 * ProjectPicker component for selecting projects in time entries
 */
export function ProjectPicker({
  workspaceId,
  value,
  onChange,
  allowNoProject = true,
  noProjectLabel = 'No Project',
  placeholder = 'Select project...',
  disabled = false,
}: ProjectPickerProps): React.ReactElement {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch projects the user is a member of
  const { data: projects, isLoading } = useProjects(workspaceId, {
    enabled: !!workspaceId,
    memberOnly: true,
    includeArchived: false,
  });

  // Find the currently selected project
  const selectedProject = useMemo(() => {
    if (!value || !projects) return null;
    return projects.find(p => p.id === value) ?? null;
  }, [value, projects]);

  /**
   * Handle opening the picker
   */
  const handleOpen = useCallback(() => {
    if (disabled || isLoading) return;
    setIsOpen(true);
  }, [disabled, isLoading]);

  /**
   * Handle closing the picker
   */
  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  /**
   * Handle project selection
   */
  const handleSelect = useCallback(
    (projectId: string | null) => {
      onChange(projectId);
      setIsOpen(false);
    },
    [onChange]
  );

  /**
   * Render project option
   */
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ProjectWithStats | null>) => (
      <ProjectOption
        project={item}
        selected={item === null ? value === null : item.id === value}
        onSelect={() => handleSelect(item?.id ?? null)}
        noProjectLabel={noProjectLabel}
      />
    ),
    [value, handleSelect, noProjectLabel]
  );

  /**
   * Key extractor
   */
  const keyExtractor = useCallback((item: ProjectWithStats | null) => item?.id ?? 'no-project', []);

  // Build list data with optional "No Project" option
  const listData = useMemo(() => {
    const data: (ProjectWithStats | null)[] = [];
    if (allowNoProject) {
      data.push(null);
    }
    if (projects) {
      data.push(...projects);
    }
    return data;
  }, [allowNoProject, projects]);

  return (
    <>
      {/* Trigger button */}
      <PickerTrigger
        selectedProject={selectedProject}
        placeholder={placeholder}
        noProjectLabel={noProjectLabel}
        disabled={disabled || isLoading}
        onPress={handleOpen}
      />

      {/* Picker modal */}
      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={handleClose}>
        <Pressable
          style={[styles.overlay, { backgroundColor: colors.overlay }]}
          onPress={handleClose}
        >
          <View style={styles.modalContainer}>
            <Card padding="none" elevation="lg" style={styles.picker}>
              {/* Header */}
              <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <Text variant="label">Select Project</Text>
              </View>

              {/* Loading state */}
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <Spinner />
                </View>
              ) : listData.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text variant="body" color="secondary" center>
                    No projects available
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={listData}
                  renderItem={renderItem}
                  keyExtractor={keyExtractor}
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                />
              )}

              {/* Cancel button */}
              <Pressable
                onPress={handleClose}
                style={[styles.cancelButton, { borderTopColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text variant="body" color="primary" center>
                  Cancel
                </Text>
              </Pressable>
            </Card>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Trigger styles
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  triggerDisabled: {
    opacity: 0.5,
  },
  triggerColor: {
    width: 12,
    height: 12,
    borderRadius: borderRadius.sm,
  },
  triggerText: {
    flex: 1,
  },

  // Modal styles
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 320,
  },
  picker: {
    overflow: 'hidden',
    maxHeight: 400,
  },
  header: {
    padding: spacing.md,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  list: {
    maxHeight: 280,
  },
  listContent: {
    paddingVertical: spacing.xs,
  },

  // Option styles
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  colorIndicator: {
    width: 16,
    height: 16,
    borderRadius: borderRadius.sm,
  },
  optionName: {
    flex: 1,
  },

  // Footer styles
  cancelButton: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
  },
});

export default ProjectPicker;
