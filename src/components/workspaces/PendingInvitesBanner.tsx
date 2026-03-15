/**
 * PendingInvitesBanner Component
 *
 * Shows a banner when the user has pending workspace invitations.
 * Displays accept/decline buttons for each invitation.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';

import { Text, Icon, Button, Card } from '@/components/ui';
import { useTheme, spacing, borderRadius } from '@/theme';
import { usePendingInvitesForEmail, useAcceptInvite, useDeclineInvite } from '@/hooks';
import type { WorkspaceInvite } from '@/schemas';

/**
 * Extended invite type with workspace info
 */
type PendingInviteWithWorkspace = WorkspaceInvite & {
  workspace: { id: string; name: string; slug: string };
};

/**
 * Props for PendingInvitesBanner component
 */
export interface PendingInvitesBannerProps {
  /** Callback when an invite is accepted */
  onAccepted?: (workspaceId: string) => void;
  /** Callback when an invite is declined */
  onDeclined?: () => void;
  /** Whether to show in compact mode (single line) */
  compact?: boolean;
}

/**
 * Individual invite card component
 */
function InviteCard({
  invite,
  onAccept,
  onDecline,
  isAccepting,
  isDeclining,
}: {
  invite: PendingInviteWithWorkspace;
  onAccept: () => void;
  onDecline: () => void;
  isAccepting: boolean;
  isDeclining: boolean;
}): React.ReactElement {
  const { colors } = useTheme();
  // isPending can be used for loading states if needed
  const _isPending = isAccepting || isDeclining;

  return (
    <Card padding="md" elevation="sm" style={styles.inviteCard}>
      <View style={styles.inviteHeader}>
        {/* Workspace icon */}
        <View style={[styles.workspaceIcon, { backgroundColor: colors.primary }]}>
          <Text variant="body" bold style={{ color: colors.text }}>
            {invite.workspace.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Workspace info */}
        <View style={styles.inviteInfo}>
          <Text variant="body" bold>
            {invite.workspace.name}
          </Text>
          <Text variant="caption" color="muted">
            Invited as {invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.inviteActions}>
        <Button
          variant="ghost"
          size="sm"
          onPress={onDecline}
          loading={isDeclining}
          disabled={isAccepting}
          style={styles.actionButton}
        >
          Decline
        </Button>
        <Button
          variant="primary"
          size="sm"
          onPress={onAccept}
          loading={isAccepting}
          disabled={isDeclining}
          style={styles.actionButton}
        >
          Accept
        </Button>
      </View>
    </Card>
  );
}

/**
 * Compact banner for header/notification area
 */
function CompactBanner({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}): React.ReactElement {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`You have ${count} pending workspace invitation${count === 1 ? '' : 's'}`}
      style={({ pressed }) => [
        styles.compactBanner,
        { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Icon name="mail" size={16} color={colors.text} />
      <Text variant="caption" bold style={{ color: colors.text, marginLeft: spacing.xs }}>
        {count} pending invite{count === 1 ? '' : 's'}
      </Text>
      <Icon name="chevron-forward" size={14} color={colors.text} style={styles.compactChevron} />
    </Pressable>
  );
}

/**
 * PendingInvitesBanner Component
 *
 * Displays pending workspace invitations with accept/decline options.
 *
 * @example
 * ```tsx
 * // Full banner with all invites
 * <PendingInvitesBanner
 *   onAccepted={(wsId) => {
 *     setActiveWorkspace(wsId);
 *     showToast('Welcome to the workspace!');
 *   }}
 *   onDeclined={() => showToast('Invitation declined')}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Compact mode for header
 * <PendingInvitesBanner compact onAccepted={handleAccepted} />
 * ```
 */
export function PendingInvitesBanner({
  onAccepted,
  onDeclined,
  compact = false,
}: PendingInvitesBannerProps): React.ReactElement | null {
  const { colors } = useTheme();

  // State for tracking which invite is being processed
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);
  const [expandedCompact, setExpandedCompact] = useState(false);

  // Fetch pending invites for current user
  const { data: invites = [], isLoading, refetch } = usePendingInvitesForEmail();

  // Accept invite mutation
  const acceptInvite = useAcceptInvite({
    onSuccess: result => {
      setProcessingInviteId(null);
      onAccepted?.(result.workspaceId);
      refetch();
    },
    onError: error => {
      setProcessingInviteId(null);
      Alert.alert('Error', error.message, [{ text: 'OK' }]);
    },
  });

  // Decline invite mutation
  const declineInvite = useDeclineInvite({
    onSuccess: () => {
      setProcessingInviteId(null);
      onDeclined?.();
      refetch();
    },
    onError: error => {
      setProcessingInviteId(null);
      Alert.alert('Error', error.message, [{ text: 'OK' }]);
    },
  });

  const handleAccept = useCallback((invite: PendingInviteWithWorkspace) => {
    // For accept, we need the token which we don't have directly
    // The invite flow expects the user to click a link with the token
    // For now, we'll show an alert explaining this
    Alert.alert(
      'Accept Invitation',
      `To accept the invitation to "${invite.workspace.name}", please click the link in the invitation email you received.`,
      [{ text: 'OK' }]
    );
  }, []);

  const handleDecline = useCallback(
    (invite: PendingInviteWithWorkspace) => {
      Alert.alert(
        'Decline Invitation',
        `Are you sure you want to decline the invitation to "${invite.workspace.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Decline',
            style: 'destructive',
            onPress: () => {
              setProcessingInviteId(invite.id);
              declineInvite.mutate({ inviteId: invite.id });
            },
          },
        ]
      );
    },
    [declineInvite]
  );

  // Don't render if loading or no invites
  if (isLoading) {
    return null;
  }

  if (invites.length === 0) {
    return null;
  }

  // Compact mode: show count badge that expands on press
  if (compact && !expandedCompact) {
    return <CompactBanner count={invites.length} onPress={() => setExpandedCompact(true)} />;
  }

  // Full banner with all invites
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="mail" size={20} color={colors.primary} />
          <Text variant="body" bold style={{ marginLeft: spacing.sm }}>
            Pending Invitations
          </Text>
        </View>
        {compact && (
          <Pressable
            onPress={() => setExpandedCompact(false)}
            style={styles.collapseButton}
            accessibilityRole="button"
            accessibilityLabel="Collapse"
          >
            <Icon name="close" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Invite list */}
      <View style={styles.inviteList}>
        {invites.map(invite => (
          <InviteCard
            key={invite.id}
            invite={invite}
            onAccept={() => handleAccept(invite)}
            onDecline={() => handleDecline(invite)}
            isAccepting={processingInviteId === invite.id && acceptInvite.isPending}
            isDeclining={processingInviteId === invite.id && declineInvite.isPending}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  collapseButton: {
    padding: spacing.xs,
  },
  inviteList: {
    gap: spacing.sm,
  },
  inviteCard: {},
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  workspaceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  inviteInfo: {
    flex: 1,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },

  // Compact mode
  compactBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
  },
  compactChevron: {
    marginLeft: spacing.xs,
  },
});

export default PendingInvitesBanner;
