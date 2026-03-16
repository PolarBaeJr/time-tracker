/**
 * SharedDashboardManager Component
 *
 * Displays a list of user's shared dashboard links with management actions.
 * Shows title, status, expiry, and provides copy link and revoke actions.
 * Integrates with CreateShareModal for creating new shares.
 */

import * as React from 'react';
import { useCallback, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  type ListRenderItemInfo,
  RefreshControl,
  Alert,
  Pressable,
} from 'react-native';
import { Card, Text, Button, Spinner, Icon } from '@/components/ui';
import { copyToClipboard } from '@/utils/clipboard';
import { useTheme, spacing, borderRadius, fontSizes } from '@/theme';
import {
  useSharedDashboards,
  useRevokeSharedDashboard,
  getShareUrl,
  isSharedDashboardValid,
} from '@/hooks/useSharedDashboards';
import type { SharedDashboardWithStats } from '@/schemas';
import { CreateShareModal } from './CreateShareModal';

/**
 * Props for SharedDashboardManager component
 */
export interface SharedDashboardManagerProps {
  /** Whether the manager is disabled */
  disabled?: boolean;
  /** Callback when a share link is created */
  onShareCreated?: (shareUrl: string) => void;
}

/**
 * Status badge component for shared dashboard
 */
function StatusBadge({
  isActive,
  expiresAt,
}: {
  isActive: boolean;
  expiresAt: string | null;
}): React.ReactElement {
  const { colors } = useTheme();

  // Check if expired
  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;

  const getStatus = () => {
    if (!isActive) {
      return { label: 'Revoked', color: colors.error };
    }
    if (isExpired) {
      return { label: 'Expired', color: colors.warning };
    }
    return { label: 'Active', color: colors.success };
  };

  const { label, color } = getStatus();

  return (
    <View style={[styles.statusBadge, { backgroundColor: color + '20' }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text variant="caption" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Props for individual dashboard item
 */
interface DashboardItemProps {
  dashboard: SharedDashboardWithStats;
  onCopyLink: (dashboard: SharedDashboardWithStats) => void;
  onRevoke: (dashboard: SharedDashboardWithStats) => void;
  disabled?: boolean;
}

/**
 * Individual shared dashboard item component
 */
function DashboardItem({
  dashboard,
  onCopyLink,
  onRevoke,
  disabled,
}: DashboardItemProps): React.ReactElement {
  const { colors } = useTheme();
  const isValid = isSharedDashboardValid(dashboard);

  const handleCopyLink = useCallback(() => {
    onCopyLink(dashboard);
  }, [dashboard, onCopyLink]);

  const handleRevoke = useCallback(() => {
    Alert.alert(
      'Revoke Share Link',
      'This will disable the share link. Anyone with the link will no longer be able to view the dashboard.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => onRevoke(dashboard),
        },
      ]
    );
  }, [dashboard, onRevoke]);

  // Format expiry date
  const formatExpiry = (expiresAt: string | null): string => {
    if (!expiresAt) return 'Never expires';
    const date = new Date(expiresAt);
    return `Expires ${date.toLocaleDateString()}`;
  };

  // Format created date
  const formatCreated = (createdAt: string): string => {
    const date = new Date(createdAt);
    return `Created ${date.toLocaleDateString()}`;
  };

  return (
    <Card style={styles.dashboardCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text variant="body" bold numberOfLines={1} style={styles.cardTitle}>
            {dashboard.title}
          </Text>
          <StatusBadge isActive={dashboard.is_active} expiresAt={dashboard.expires_at} />
        </View>

        {dashboard.workspace_name && (
          <View style={styles.workspaceRow}>
            <Icon name="users" size={12} color={colors.textMuted} />
            <Text variant="caption" style={{ color: colors.textMuted, marginLeft: 4 }}>
              {dashboard.workspace_name}
            </Text>
          </View>
        )}

        <View style={styles.metaRow}>
          <Text variant="caption" style={{ color: colors.textSecondary }}>
            {formatCreated(dashboard.created_at)}
          </Text>
          <Text variant="caption" style={{ color: colors.textSecondary }}>
            {' \u2022 '}
          </Text>
          <Text variant="caption" style={{ color: colors.textSecondary }}>
            {formatExpiry(dashboard.expires_at)}
          </Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <Pressable
          style={[
            styles.actionButton,
            {
              backgroundColor: colors.surfaceVariant,
              borderRadius: borderRadius.md,
            },
          ]}
          onPress={handleCopyLink}
          disabled={disabled || !isValid}
          accessibilityRole="button"
          accessibilityLabel="Copy share link"
        >
          <Icon name="copy" size={16} color={isValid ? colors.primary : colors.textMuted} />
          <Text
            variant="caption"
            style={{
              color: isValid ? colors.primary : colors.textMuted,
              marginLeft: 4,
            }}
          >
            Copy Link
          </Text>
        </Pressable>

        {dashboard.is_active && (
          <Pressable
            style={[
              styles.actionButton,
              {
                backgroundColor: colors.error + '20',
                borderRadius: borderRadius.md,
              },
            ]}
            onPress={handleRevoke}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Revoke share link"
          >
            <Icon name="x-circle" size={16} color={colors.error} />
            <Text variant="caption" style={{ color: colors.error, marginLeft: 4 }}>
              Revoke
            </Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

/**
 * Empty state component
 */
function EmptyState({ onCreateNew }: { onCreateNew: () => void }): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.emptyState}>
      <Icon name="share-2" size={48} color={colors.textMuted} />
      <Text
        variant="body"
        style={{ color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' }}
      >
        No shared dashboards yet
      </Text>
      <Text
        variant="caption"
        style={{ color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' }}
      >
        Share your analytics with others by creating a share link
      </Text>
      <Button onPress={onCreateNew} style={{ marginTop: spacing.lg }}>
        Create Share Link
      </Button>
    </View>
  );
}

/**
 * SharedDashboardManager component
 *
 * Displays and manages user's shared dashboard links.
 */
export function SharedDashboardManager({
  disabled = false,
  onShareCreated,
}: SharedDashboardManagerProps): React.ReactElement {
  const { colors } = useTheme();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch shared dashboards
  const { data: dashboards, isLoading, refetch, isRefetching } = useSharedDashboards();

  // Revoke mutation
  const revokeMutation = useRevokeSharedDashboard({
    onSuccess: () => {
      Alert.alert('Success', 'Share link has been revoked.');
    },
    onError: error => {
      Alert.alert('Error', error.message);
    },
  });

  const handleCopyLink = useCallback(async (dashboard: SharedDashboardWithStats) => {
    const url = getShareUrl(dashboard.token);
    const success = await copyToClipboard(url);
    if (success) {
      Alert.alert('Copied', 'Share link copied to clipboard.');
    } else {
      Alert.alert('Error', 'Failed to copy link to clipboard.');
    }
  }, []);

  const handleRevoke = useCallback(
    (dashboard: SharedDashboardWithStats) => {
      revokeMutation.mutate(dashboard.id);
    },
    [revokeMutation]
  );

  const handleCreateNew = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    setShowCreateModal(false);
  }, []);

  const handleShareCreated = useCallback(
    (shareUrl: string) => {
      setShowCreateModal(false);
      onShareCreated?.(shareUrl);
    },
    [onShareCreated]
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<SharedDashboardWithStats>) => (
      <DashboardItem
        dashboard={item}
        onCopyLink={handleCopyLink}
        onRevoke={handleRevoke}
        disabled={disabled || revokeMutation.isPending}
      />
    ),
    [handleCopyLink, handleRevoke, disabled, revokeMutation.isPending]
  );

  const keyExtractor = useCallback((item: SharedDashboardWithStats) => item.id, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Spinner size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="heading" style={{ color: colors.text }}>
          Shared Dashboards
        </Text>
        <Button onPress={handleCreateNew} disabled={disabled} size="sm">
          <Icon name="plus" size={16} color={colors.text} /> New Share
        </Button>
      </View>

      {dashboards && dashboards.length > 0 ? (
        <FlatList
          data={dashboards}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <EmptyState onCreateNew={handleCreateNew} />
      )}

      <CreateShareModal
        visible={showCreateModal}
        onClose={handleCloseCreateModal}
        onSuccess={handleShareCreated}
      />
    </View>
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  listContent: {
    padding: spacing.md,
    paddingTop: 0,
  },
  dashboardCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    marginBottom: spacing.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    flex: 1,
    marginRight: spacing.sm,
  },
  workspaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
});
