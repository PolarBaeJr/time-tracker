/**
 * WorkspacesScreen
 *
 * Screen for managing workspaces the user belongs to.
 * Shows a list of workspaces with actions (Open, Settings, Leave) and
 * a FAB for creating new workspaces.
 *
 * Features:
 * - WorkspaceList with role badges and actions
 * - PendingInvitesBanner at top for pending invitations
 * - CreateWorkspaceModal for creating new workspaces
 * - Pull-to-refresh support
 * - Proper loading/error states
 *
 * SECURITY:
 * - All data access is protected by RLS policies
 * - Only workspace members can view their workspaces
 *
 * USAGE:
 * ```tsx
 * // In navigation
 * <Stack.Screen name="Workspaces" component={WorkspacesScreen} />
 * ```
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Text, Icon, Spinner } from '@/components/ui';
import { WorkspaceList, CreateWorkspaceModal, PendingInvitesBanner } from '@/components/workspaces';
import { useTheme, spacing, borderRadius } from '@/theme';
import { useWorkspacesQuery } from '@/hooks';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks';
import type { RootStackParamList } from '@/navigation/types';
import type { WorkspaceWithMemberCount, Workspace } from '@/schemas';

// ============================================================================
// TYPES
// ============================================================================

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * WorkspacesScreen props (from navigation)
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WorkspacesScreenProps {
  /** No route params needed */
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * WorkspacesScreen component
 *
 * Main screen for workspace management. Shows all workspaces the user
 * belongs to with options to open, leave, or access settings.
 */
export function WorkspacesScreen(): React.ReactElement {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { setActiveWorkspace } = useWorkspaceContext();

  // Modal state
  const [createModalVisible, setCreateModalVisible] = useState(false);

  // Fetch workspaces with member count
  const {
    data: workspaces = [],
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useWorkspacesQuery({
    enabled: !!user?.id,
  });

  // Handle opening a workspace (set as active)
  const handleOpenWorkspace = useCallback(
    (workspace: WorkspaceWithMemberCount) => {
      // Convert WorkspaceWithMemberCount to Workspace for context
      const workspaceForContext: Workspace = {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        owner_id: workspace.owner_id,
        created_at: workspace.created_at,
      };
      setActiveWorkspace(workspaceForContext);
      navigation.goBack();
    },
    [setActiveWorkspace, navigation]
  );

  // Handle navigating to workspace settings
  const handleWorkspaceSettings = useCallback(
    (workspace: WorkspaceWithMemberCount) => {
      navigation.navigate('WorkspaceSettings', { workspaceId: workspace.id });
    },
    [navigation]
  );

  // Handle creating a new workspace
  const handleOpenCreateModal = useCallback(() => {
    setCreateModalVisible(true);
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    setCreateModalVisible(false);
  }, []);

  const handleWorkspaceCreated = useCallback(
    (workspace: { id: string; name: string; slug: string }) => {
      // Refetch workspaces to include the new one
      refetch();
      // Optionally set the new workspace as active
      setActiveWorkspace({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        owner_id: user?.id ?? '',
        created_at: new Date().toISOString(),
      });
    },
    [refetch, setActiveWorkspace, user?.id]
  );

  // Handle invite accepted
  const handleInviteAccepted = useCallback(
    (workspaceId: string) => {
      refetch();
      // Find and set the accepted workspace as active
      const acceptedWorkspace = workspaces.find(w => w.id === workspaceId);
      if (acceptedWorkspace) {
        handleOpenWorkspace(acceptedWorkspace);
      }
    },
    [refetch, workspaces, handleOpenWorkspace]
  );

  // Handle invite declined
  const handleInviteDeclined = useCallback(() => {
    // Just refetch to update the invite count if needed
    refetch();
  }, [refetch]);

  // Handle pull-to-refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Loading state
  if (isLoading && workspaces.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text variant="heading" style={styles.headerTitle}>
            Workspaces
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <Spinner size="large" message="Loading workspaces..." />
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && workspaces.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text variant="heading" style={styles.headerTitle}>
            Workspaces
          </Text>
        </View>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color={colors.error} />
          <Text variant="body" color="error" style={styles.errorText}>
            {error.message || 'Failed to load workspaces'}
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Retry loading workspaces"
          >
            <Text variant="body" style={{ color: colors.text }}>
              Retry
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text variant="heading" style={styles.headerTitle}>
          Workspaces
        </Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Pending Invites Banner */}
        <View style={styles.bannerContainer}>
          <PendingInvitesBanner
            onAccepted={handleInviteAccepted}
            onDeclined={handleInviteDeclined}
          />
        </View>

        {/* Workspace List */}
        <WorkspaceList
          workspaces={workspaces}
          isLoading={isLoading}
          onOpen={handleOpenWorkspace}
          onSettings={handleWorkspaceSettings}
          onCreate={handleOpenCreateModal}
          onRefresh={handleRefresh}
          refreshing={isRefetching}
        />
      </View>

      {/* FAB for creating workspace */}
      <Pressable
        onPress={handleOpenCreateModal}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Create new workspace"
      >
        <Icon name="add" size={28} color={colors.text} />
      </Pressable>

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        visible={createModalVisible}
        onClose={handleCloseCreateModal}
        onSuccess={handleWorkspaceCreated}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorText: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  content: {
    flex: 1,
  },
  bannerContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default WorkspacesScreen;
