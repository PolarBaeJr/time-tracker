/**
 * ProjectsScreen
 *
 * Screen for managing workspace projects. Shows project list with filtering,
 * FAB for creating new projects, and handles project detail sheets.
 *
 * This screen is only shown when a workspace is active (not in personal mode).
 *
 * USAGE:
 * ```tsx
 * import { ProjectsScreen } from '@/screens';
 *
 * // In navigation (conditionally shown when workspace active)
 * <Tab.Screen name="Projects" component={ProjectsScreen} />
 * ```
 *
 * SECURITY:
 * - Only visible when user has an active workspace
 * - RLS policies ensure only workspace projects are shown
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, Icon, Spinner } from '@/components/ui';
import {
  ProjectList,
  CreateProjectModal,
  ProjectDetailSheet,
  AddProjectMemberModal,
} from '@/components/projects';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { useTheme } from '@/theme';
import { spacing, fontSizes, borderRadius } from '@/theme';
import type { ProjectWithStats } from '@/schemas';

/**
 * ProjectsScreen props (from navigation)
 */
export interface ProjectsScreenProps {
  /** Navigation object */
  navigation?: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

/**
 * ProjectsScreen component
 */
export function ProjectsScreen({
  navigation: _navigation,
}: ProjectsScreenProps): React.ReactElement {
  const { colors } = useTheme();
  const { activeWorkspace, isPersonalMode, isLoading: workspaceLoading } = useWorkspaceContext();

  // Modal states
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithStats | null>(null);
  const [detailSheetVisible, setDetailSheetVisible] = useState(false);
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [addMemberProjectId, setAddMemberProjectId] = useState<string | null>(null);

  /**
   * Handle project card press - open detail sheet
   */
  const handleProjectPress = useCallback((project: ProjectWithStats) => {
    setSelectedProject(project);
    setDetailSheetVisible(true);
  }, []);

  /**
   * Handle create button press - open create modal
   */
  const handleCreatePress = useCallback(() => {
    setCreateModalVisible(true);
  }, []);

  /**
   * Handle project created successfully
   */
  const handleProjectCreated = useCallback(() => {
    // The ProjectList will automatically refresh via React Query
    setCreateModalVisible(false);
  }, []);

  /**
   * Handle members press from detail sheet
   */
  const handleMembersPress = useCallback((_projectId: string) => {
    // Could navigate to a dedicated members screen
    // For now, we just show members in the detail sheet
  }, []);

  /**
   * Handle add member press from detail sheet
   */
  const handleAddMemberPress = useCallback((projectId: string) => {
    setAddMemberProjectId(projectId);
    setAddMemberModalVisible(true);
  }, []);

  /**
   * Handle add member success
   */
  const handleMemberAdded = useCallback(() => {
    setAddMemberModalVisible(false);
    setAddMemberProjectId(null);
  }, []);

  /**
   * Close detail sheet
   */
  const handleCloseDetailSheet = useCallback(() => {
    setDetailSheetVisible(false);
    setSelectedProject(null);
  }, []);

  // Loading state while workspace context is initializing
  if (workspaceLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <View style={styles.loadingContainer}>
          <Spinner size="large" message="Loading..." />
        </View>
      </SafeAreaView>
    );
  }

  // Show message if in personal mode (no active workspace)
  if (isPersonalMode || !activeWorkspace) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <View style={styles.personalModeContainer}>
          <Icon name="briefcase" size={64} color={colors.textMuted} />
          <Text variant="heading" center style={styles.personalModeTitle}>
            Projects
          </Text>
          <Text variant="body" color="secondary" center style={styles.personalModeText}>
            Select a workspace to view and manage projects.
          </Text>
          <Text variant="caption" color="muted" center>
            Projects are a collaboration feature available in workspaces.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.headerContent}>
          <Text variant="heading" style={styles.title}>
            Projects
          </Text>
          <Text variant="caption" color="muted" style={styles.workspaceName}>
            {activeWorkspace.name}
          </Text>
        </View>
      </View>

      {/* Project List */}
      <ProjectList
        workspaceId={activeWorkspace.id}
        onProjectPress={handleProjectPress}
        onCreatePress={handleCreatePress}
      />

      {/* Floating Action Button */}
      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={handleCreatePress}
        accessibilityRole="button"
        accessibilityLabel="Create new project"
      >
        <Icon name="add" size={24} color="#FFFFFF" />
      </Pressable>

      {/* Create Project Modal */}
      <CreateProjectModal
        visible={createModalVisible}
        workspaceId={activeWorkspace.id}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={handleProjectCreated}
      />

      {/* Project Detail Sheet */}
      <ProjectDetailSheet
        project={selectedProject}
        visible={detailSheetVisible}
        onClose={handleCloseDetailSheet}
        onMembersPress={handleMembersPress}
        onAddMemberPress={handleAddMemberPress}
        workspaceId={activeWorkspace.id}
      />

      {/* Add Member Modal */}
      {addMemberProjectId && (
        <AddProjectMemberModal
          visible={addMemberModalVisible}
          projectId={addMemberProjectId}
          workspaceId={activeWorkspace.id}
          onClose={() => {
            setAddMemberModalVisible(false);
            setAddMemberProjectId(null);
          }}
          onSuccess={handleMemberAdded}
        />
      )}
    </SafeAreaView>
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
  },
  personalModeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  personalModeTitle: {
    marginTop: spacing.lg,
  },
  personalModeText: {
    maxWidth: 280,
    marginBottom: spacing.sm,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerContent: {
    // Header content layout
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
  },
  workspaceName: {
    marginTop: spacing.xs,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default ProjectsScreen;
