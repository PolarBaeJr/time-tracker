/**
 * InviteMemberModal Component
 *
 * Modal for inviting new members to a workspace.
 * Includes email input, role picker, and pending invites list.
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
  FlatList,
  Alert,
  type ListRenderItemInfo,
} from 'react-native';

import { Text, Icon, Input, Button, Spinner } from '@/components/ui';
import { RolePicker } from './RolePicker';
import { useTheme, spacing, borderRadius, fontSizes } from '@/theme';
import { useSendInvite, useWorkspaceInvites, useRevokeInvite } from '@/hooks';
import { CreateInviteSchema } from '@/schemas';
import type { WorkspaceInvite, WorkspaceRole } from '@/schemas';

/**
 * Props for InviteMemberModal component
 */
export interface InviteMemberModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Workspace ID to invite to */
  workspaceId: string;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback when invitation is sent */
  onInviteSent?: () => void;
}

/**
 * Format time ago for invite expiry
 */
function formatTimeUntil(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs < 0) {
    return 'Expired';
  }

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffDays > 0) {
    return `Expires in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
  }
  if (diffHours > 0) {
    return `Expires in ${diffHours} hour${diffHours === 1 ? '' : 's'}`;
  }

  return 'Expires soon';
}

/**
 * Pending invite item component
 */
function PendingInviteItem({
  invite,
  onRevoke,
  isRevoking,
}: {
  invite: WorkspaceInvite;
  onRevoke: (id: string) => void;
  isRevoking: boolean;
}): React.ReactElement {
  const { colors } = useTheme();

  const handleRevoke = useCallback(() => {
    Alert.alert(
      'Revoke Invitation',
      `Are you sure you want to revoke the invitation to ${invite.invited_email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => onRevoke(invite.id),
        },
      ]
    );
  }, [invite, onRevoke]);

  return (
    <View style={[styles.inviteItem, { backgroundColor: colors.surfaceVariant }]}>
      <View style={styles.inviteInfo}>
        <Text variant="body" numberOfLines={1}>
          {invite.invited_email}
        </Text>
        <View style={styles.inviteMeta}>
          <Text variant="caption" color="muted">
            {invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}
          </Text>
          <Text variant="caption" color="muted" style={{ marginLeft: spacing.sm }}>
            • {formatTimeUntil(invite.expires_at)}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={handleRevoke}
        disabled={isRevoking}
        style={styles.revokeButton}
        accessibilityRole="button"
        accessibilityLabel="Revoke invitation"
      >
        {isRevoking ? (
          <Spinner size="small" />
        ) : (
          <Icon name="close" size={18} color={colors.error} />
        )}
      </Pressable>
    </View>
  );
}

/**
 * Inner form component that resets when key changes
 */
function InviteMemberForm({
  workspaceId,
  onClose,
  onInviteSent,
}: {
  workspaceId: string;
  onClose: () => void;
  onInviteSent?: () => void;
}): React.ReactElement {
  const { colors } = useTheme();

  // Form state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('member');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Fetch pending invites
  const {
    data: invites = [],
    isLoading: invitesLoading,
    refetch: refetchInvites,
  } = useWorkspaceInvites(workspaceId, { enabled: true });

  // Send invite mutation
  const sendInvite = useSendInvite({
    onSuccess: () => {
      setEmail('');
      setRole('member');
      setEmailError(null);
      onInviteSent?.();
      refetchInvites();
    },
    onError: error => {
      setEmailError(error.message);
    },
  });

  // Revoke invite mutation
  const revokeInvite = useRevokeInvite({
    onSuccess: () => {
      setRevokingId(null);
      refetchInvites();
    },
    onError: error => {
      setRevokingId(null);
      Alert.alert('Error', error.message, [{ text: 'OK' }]);
    },
  });

  const handleClose = useCallback(() => {
    if (!sendInvite.isPending) {
      onClose();
    }
  }, [onClose, sendInvite.isPending]);

  const handleEmailChange = useCallback((text: string) => {
    setEmail(text.trim());
    setEmailError(null);
  }, []);

  const handleRoleChange = useCallback((newRole: WorkspaceRole) => {
    setRole(newRole);
  }, []);

  const handleSendInvite = useCallback(() => {
    // Validate email
    const validation = CreateInviteSchema.shape.email.safeParse(email);
    if (!validation.success) {
      const issues = validation.error.issues;
      setEmailError(issues[0]?.message ?? 'Invalid email');
      return;
    }

    // Send invite
    const roleToSend = role === 'owner' ? 'member' : role;
    sendInvite.mutate({
      workspaceId,
      email: validation.data,
      role: roleToSend, // Ensure we don't send 'owner' role
    });
  }, [email, role, workspaceId, sendInvite]);

  const handleRevokeInvite = useCallback(
    (inviteId: string) => {
      setRevokingId(inviteId);
      revokeInvite.mutate({ inviteId, workspaceId });
    },
    [workspaceId, revokeInvite]
  );

  // Render pending invite item
  const renderInviteItem = useCallback(
    ({ item }: ListRenderItemInfo<WorkspaceInvite>) => (
      <PendingInviteItem
        invite={item}
        onRevoke={handleRevokeInvite}
        isRevoking={revokingId === item.id}
      />
    ),
    [handleRevokeInvite, revokingId]
  );

  return (
    <>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text variant="heading" style={styles.title}>
          Invite Member
        </Text>
        <Pressable
          onPress={handleClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close"
          disabled={sendInvite.isPending}
        >
          <Icon name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Invite form */}
        <View style={styles.section}>
          <Text variant="body" bold style={styles.sectionTitle}>
            Send Invitation
          </Text>

          <Input
            label="Email Address"
            placeholder="colleague@example.com"
            value={email}
            onChangeText={handleEmailChange}
            error={emailError ?? undefined}
            disabled={sendInvite.isPending}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />

          <RolePicker
            value={role}
            onChange={handleRoleChange}
            disabled={sendInvite.isPending}
            label="Role"
          />

          <Button
            variant="primary"
            onPress={handleSendInvite}
            loading={sendInvite.isPending}
            disabled={!email.trim()}
            style={styles.sendButton}
          >
            <View style={styles.sendButtonContent}>
              <Icon name="mail" size={18} color={colors.text} />
              <Text variant="body" bold style={{ marginLeft: spacing.xs }}>
                Send Invitation
              </Text>
            </View>
          </Button>
        </View>

        {/* Pending invites section */}
        <View style={styles.section}>
          <Text variant="body" bold style={styles.sectionTitle}>
            Pending Invitations
          </Text>

          {invitesLoading ? (
            <View style={styles.loadingContainer}>
              <Spinner size="small" />
            </View>
          ) : invites.length === 0 ? (
            <Text variant="body" color="muted" style={styles.emptyText}>
              No pending invitations
            </Text>
          ) : (
            <FlatList
              data={invites}
              renderItem={renderInviteItem}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.inviteSeparator} />}
            />
          )}
        </View>

        {/* Info text */}
        <View style={[styles.infoBox, { backgroundColor: colors.surfaceVariant }]}>
          <Icon name="alert" size={16} color={colors.textMuted} />
          <Text variant="caption" color="muted" style={styles.infoText}>
            Invitations expire after 7 days. The invitee must sign up or log in with the email
            address the invitation was sent to.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

/**
 * InviteMemberModal Component
 *
 * A modal for inviting new members to a workspace.
 *
 * @example
 * ```tsx
 * <InviteMemberModal
 *   visible={inviteModalVisible}
 *   workspaceId={workspace.id}
 *   onClose={() => setInviteModalVisible(false)}
 *   onInviteSent={() => showToast('Invitation sent!')}
 * />
 * ```
 */
export function InviteMemberModal({
  visible,
  workspaceId,
  onClose,
  onInviteSent,
}: InviteMemberModalProps): React.ReactElement {
  const { colors } = useTheme();

  // Use a key to force re-mount of form when modal opens
  const [formKey, setFormKey] = useState(0);

  const handleClose = useCallback(() => {
    onClose();
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
          <InviteMemberForm
            key={formKey}
            workspaceId={workspaceId}
            onClose={handleClose}
            onInviteSent={onInviteSent}
          />
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
  content: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  sendButton: {
    marginTop: spacing.sm,
  },
  sendButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    padding: spacing.md,
  },
  inviteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  inviteInfo: {
    flex: 1,
  },
  inviteMeta: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  revokeButton: {
    padding: spacing.sm,
    marginLeft: spacing.sm,
  },
  inviteSeparator: {
    height: spacing.sm,
  },
  infoBox: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  infoText: {
    flex: 1,
    marginLeft: spacing.sm,
  },
});

export default InviteMemberModal;
