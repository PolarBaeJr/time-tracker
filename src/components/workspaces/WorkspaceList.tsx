/**
 * WorkspaceList Component
 *
 * Displays a list of workspaces the user belongs to.
 * Shows role badges and provides actions like Open, Leave, and Settings.
 * Supports pull-to-refresh.
 */

import * as React from 'react';
import { useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  type ListRenderItemInfo,
  RefreshControl,
  Alert,
} from 'react-native';

import { Card, Text, Button, Spinner, Icon } from '@/components/ui';
import { useTheme, spacing, borderRadius } from '@/theme';
import type { WorkspaceWithMemberCount, WorkspaceRole } from '@/schemas';

/**
 * Role badge component
 */
function RoleBadge({ role }: { role: WorkspaceRole }): React.ReactElement {
  const { colors } = useTheme();

  const getBadgeStyle = () => {
    switch (role) {
      case 'owner':
        return { backgroundColor: colors.primary, textColor: colors.text };
      case 'admin':
        return { backgroundColor: colors.surfaceVariant, textColor: colors.primary };
      case 'member':
      default:
        return { backgroundColor: colors.surfaceVariant, textColor: colors.textSecondary };
    }
  };

  const { backgroundColor, textColor } = getBadgeStyle();

  return (
    <View style={[styles.roleBadge, { backgroundColor }]}>
      <Text variant="caption" bold style={{ color: textColor }}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Text>
    </View>
  );
}

/**
 * Props for individual workspace card
 */
interface WorkspaceCardProps {
  workspace: WorkspaceWithMemberCount;
  onOpen: (workspace: WorkspaceWithMemberCount) => void;
  onLeave?: (workspace: WorkspaceWithMemberCount) => void;
  onSettings?: (workspace: WorkspaceWithMemberCount) => void;
}

/**
 * Individual workspace card component
 */
function WorkspaceCard({
  workspace,
  onOpen,
  onLeave,
  onSettings,
}: WorkspaceCardProps): React.ReactElement {
  const { colors } = useTheme();
  const isOwner = workspace.current_user_role === 'owner';
  const isAdmin = workspace.current_user_role === 'admin' || isOwner;

  const handleOpen = useCallback(() => {
    onOpen(workspace);
  }, [workspace, onOpen]);

  const handleLeave = useCallback(() => {
    if (isOwner) {
      Alert.alert(
        'Cannot Leave',
        'As the owner, you cannot leave this workspace. Transfer ownership or delete the workspace instead.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Leave Workspace',
      `Are you sure you want to leave "${workspace.name}"? You will lose access to all shared data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => onLeave?.(workspace),
        },
      ]
    );
  }, [workspace, isOwner, onLeave]);

  const handleSettings = useCallback(() => {
    onSettings?.(workspace);
  }, [workspace, onSettings]);

  return (
    <Card
      pressable
      onPress={handleOpen}
      padding="md"
      elevation="sm"
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`${workspace.name} workspace, ${workspace.current_user_role ?? 'member'}`}
    >
      <View style={styles.cardContent}>
        {/* Workspace icon/avatar */}
        <View style={[styles.workspaceAvatar, { backgroundColor: colors.primary }]}>
          <Text variant="heading" style={{ color: colors.text }}>
            {workspace.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Workspace info */}
        <View style={styles.workspaceInfo}>
          <View style={styles.nameRow}>
            <Text variant="body" bold style={{ flex: 1 }}>
              {workspace.name}
            </Text>
            {workspace.current_user_role && <RoleBadge role={workspace.current_user_role} />}
          </View>

          <View style={styles.metaRow}>
            <Icon name="list" size={14} color={colors.textMuted} />
            <Text variant="caption" color="muted" style={{ marginLeft: spacing.xs }}>
              {workspace.member_count ?? 0}{' '}
              {(workspace.member_count ?? 0) === 1 ? 'member' : 'members'}
            </Text>
          </View>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <Button variant="primary" size="sm" onPress={handleOpen} style={styles.actionButton}>
          Open
        </Button>

        {isAdmin && onSettings && (
          <Button variant="outline" size="sm" onPress={handleSettings} style={styles.actionButton}>
            Settings
          </Button>
        )}

        {!isOwner && onLeave && (
          <Button variant="ghost" size="sm" onPress={handleLeave} style={styles.actionButton}>
            Leave
          </Button>
        )}
      </View>
    </Card>
  );
}

/**
 * Props for WorkspaceList component
 */
export interface WorkspaceListProps {
  /** Array of workspaces to display */
  workspaces: WorkspaceWithMemberCount[];
  /** Whether workspaces are currently loading */
  isLoading?: boolean;
  /** Callback when a workspace is selected to open */
  onOpen: (workspace: WorkspaceWithMemberCount) => void;
  /** Callback when user wants to leave a workspace */
  onLeave?: (workspace: WorkspaceWithMemberCount) => void;
  /** Callback when user wants to access workspace settings */
  onSettings?: (workspace: WorkspaceWithMemberCount) => void;
  /** Callback to create a new workspace */
  onCreate?: () => void;
  /** Callback for pull-to-refresh */
  onRefresh?: () => void;
  /** Whether a refresh is in progress */
  refreshing?: boolean;
}

/**
 * Empty state component when no workspaces exist
 */
function EmptyState({ onCreate }: { onCreate?: () => void }): React.ReactElement {
  return (
    <View style={styles.emptyState}>
      <Text variant="heading" center style={styles.emptyTitle}>
        No Workspaces Yet
      </Text>
      <Text variant="body" color="secondary" center style={styles.emptyText}>
        Workspaces let you collaborate with your team. Create one to start tracking time together.
      </Text>
      {onCreate && (
        <Button variant="primary" onPress={onCreate} style={styles.emptyButton}>
          Create Your First Workspace
        </Button>
      )}
    </View>
  );
}

/**
 * WorkspaceList Component
 *
 * Displays a list of workspaces with role badges and actions.
 *
 * @example
 * ```tsx
 * <WorkspaceList
 *   workspaces={workspaces}
 *   isLoading={isLoading}
 *   onOpen={(ws) => setActiveWorkspace(ws)}
 *   onLeave={(ws) => leaveWorkspace(ws.id)}
 *   onSettings={(ws) => navigateToSettings(ws)}
 *   onCreate={() => setCreateModalVisible(true)}
 *   onRefresh={refetch}
 *   refreshing={isRefetching}
 * />
 * ```
 */
export function WorkspaceList({
  workspaces,
  isLoading = false,
  onOpen,
  onLeave,
  onSettings,
  onCreate,
  onRefresh,
  refreshing = false,
}: WorkspaceListProps): React.ReactElement {
  const { colors } = useTheme();

  // Render individual workspace item
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<WorkspaceWithMemberCount>) => (
      <WorkspaceCard workspace={item} onOpen={onOpen} onLeave={onLeave} onSettings={onSettings} />
    ),
    [onOpen, onLeave, onSettings]
  );

  // Key extractor for FlatList
  const keyExtractor = useCallback((item: WorkspaceWithMemberCount) => item.id, []);

  // Loading state
  if (isLoading && workspaces.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Spinner size="large" message="Loading workspaces..." />
      </View>
    );
  }

  // Empty state
  if (!isLoading && workspaces.length === 0) {
    return <EmptyState onCreate={onCreate} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={workspaces}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
        ListFooterComponent={
          onCreate ? (
            <Button variant="outline" onPress={onCreate} style={styles.createButton}>
              <View style={styles.createButtonContent}>
                <Icon name="add" size={18} color={colors.primary} />
                <Text variant="body" style={{ marginLeft: spacing.xs, color: colors.primary }}>
                  Create Workspace
                </Text>
              </View>
            </Button>
          ) : null
        }
      />
    </View>
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
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  separator: {
    height: spacing.sm,
  },
  card: {},
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workspaceAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  workspaceInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    marginBottom: spacing.md,
  },
  emptyText: {
    marginBottom: spacing.lg,
    maxWidth: 280,
  },
  emptyButton: {
    minWidth: 200,
  },
  createButton: {
    marginTop: spacing.md,
  },
  createButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default WorkspaceList;
