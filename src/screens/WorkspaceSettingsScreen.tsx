/**
 * WorkspaceSettingsScreen
 *
 * Full-screen workspace settings accessible from navigation.
 * Wraps the WorkspaceSettingsSheet form functionality in a standalone screen.
 *
 * Features:
 * - Edit workspace name and slug (admin/owner only)
 * - Manage members with MemberList component
 * - Invite new members with InviteMemberModal
 * - Danger zone for workspace deletion (owner only)
 *
 * SECURITY:
 * - All data access is protected by RLS policies
 * - Only workspace admins/owners can access settings
 *
 * USAGE:
 * ```tsx
 * // In navigation
 * <Stack.Screen name="WorkspaceSettings" component={WorkspaceSettingsScreen} />
 * ```
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Text, Icon, Input, Button, Card, Spinner } from '@/components/ui';
import { MemberList, InviteMemberModal } from '@/components/workspaces';
import { useTheme, spacing, borderRadius, colors } from '@/theme';
import { useWorkspace, useUpdateWorkspace, useDeleteWorkspace, useWorkspaceMembers } from '@/hooks';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks';
import { UpdateWorkspaceSchema } from '@/schemas';
import type { RootStackParamList } from '@/navigation/types';
import type { WorkspaceRole } from '@/schemas';

// ============================================================================
// TYPES
// ============================================================================

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type WorkspaceSettingsRouteProp = RouteProp<RootStackParamList, 'WorkspaceSettings'>;

/**
 * WorkspaceSettingsScreen props (from navigation)
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WorkspaceSettingsScreenProps {
  /** No additional props needed - workspaceId comes from route params */
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Validate slug format
 */
function validateSlug(slug: string): string | null {
  if (slug.length < 3) {
    return 'Slug must be at least 3 characters';
  }
  if (slug.length > 50) {
    return 'Slug must be 50 characters or less';
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return 'Slug must contain only lowercase letters, numbers, and hyphens';
  }
  return null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * WorkspaceSettingsScreen component
 *
 * Full-screen settings for a workspace, accessible via navigation.
 */
export function WorkspaceSettingsScreen(): React.ReactElement {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<WorkspaceSettingsRouteProp>();
  const { workspaceId } = route.params;
  const { user } = useAuth();
  const { setActiveWorkspace } = useWorkspaceContext();

  // State for forms and modals
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);

  // Fetch workspace details
  const {
    data: workspace,
    isLoading: workspaceLoading,
    error: workspaceError,
    refetch: refetchWorkspace,
  } = useWorkspace(workspaceId, { enabled: !!workspaceId });

  // Fetch workspace members
  const {
    data: members = [],
    isLoading: membersLoading,
    refetch: refetchMembers,
    isRefetching: membersRefetching,
  } = useWorkspaceMembers(workspaceId, { enabled: !!workspaceId });

  // Get current user's role
  const currentUserRole: WorkspaceRole = useMemo(() => {
    if (!user?.id || members.length === 0) return 'member';
    const myMembership = members.find(m => m.user_id === user.id);
    return myMembership?.role ?? 'member';
  }, [user, members]);

  const isOwner = currentUserRole === 'owner';
  const isAdmin = currentUserRole === 'admin' || isOwner;

  // Initialize form values from workspace
  React.useEffect(() => {
    if (workspace && !hasInitialized) {
      setName(workspace.name);
      setSlug(workspace.slug);
      setHasInitialized(true);
    }
  }, [workspace, hasInitialized]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!workspace) return false;
    return name !== workspace.name || slug !== workspace.slug;
  }, [name, slug, workspace]);

  // Mutations
  const updateWorkspace = useUpdateWorkspace({
    onSuccess: updated => {
      refetchWorkspace();
      // Update active workspace if it was the one being edited
      setActiveWorkspace(updated);
    },
    onError: error => {
      if (error.code === 'SLUG_TAKEN') {
        setSlugError('This slug is already taken.');
      } else {
        setSlugError(error.message);
      }
    },
  });

  const deleteWorkspace = useDeleteWorkspace({
    onSuccess: () => {
      setActiveWorkspace(null);
      navigation.goBack();
      navigation.goBack(); // Go back twice to exit both settings and workspaces screen
    },
    onError: error => {
      Alert.alert('Delete Failed', error.message, [{ text: 'OK' }]);
    },
  });

  // Handlers
  const handleNameChange = useCallback((text: string) => {
    setName(text);
    setNameError(null);
  }, []);

  const handleSlugChange = useCallback((text: string) => {
    const cleanedSlug = text.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(cleanedSlug);
    setSlugError(null);
  }, []);

  const handleSave = useCallback(() => {
    if (!workspace) return;

    // Validate name
    const nameValidation = UpdateWorkspaceSchema.shape.name.safeParse(name);
    if (!nameValidation.success) {
      const issues = nameValidation.error.issues;
      setNameError(issues[0]?.message ?? 'Invalid name');
      return;
    }

    // Validate slug
    const slugValidationError = validateSlug(slug);
    if (slugValidationError) {
      setSlugError(slugValidationError);
      return;
    }

    // Build update data (only changed fields)
    const updateData: { name?: string; slug?: string } = {};
    if (name !== workspace.name) {
      updateData.name = name;
    }
    if (slug !== workspace.slug) {
      updateData.slug = slug;
    }

    if (Object.keys(updateData).length === 0) {
      return;
    }

    updateWorkspace.mutate({ id: workspace.id, data: updateData });
  }, [name, slug, workspace, updateWorkspace]);

  const handleDelete = useCallback(() => {
    if (!workspace) return;

    Alert.alert(
      'Delete Workspace',
      `Are you sure you want to permanently delete "${workspace.name}"? This action cannot be undone and will remove all associated data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteWorkspace.mutate(workspace.id),
        },
      ]
    );
  }, [workspace, deleteWorkspace]);

  const handleMemberUpdated = useCallback(() => {
    refetchMembers();
  }, [refetchMembers]);

  const handleMemberRemoved = useCallback(() => {
    refetchMembers();
  }, [refetchMembers]);

  const handleInviteSent = useCallback(() => {
    setInviteModalVisible(false);
    refetchMembers();
  }, [refetchMembers]);

  const handleRefresh = useCallback(() => {
    refetchWorkspace();
    refetchMembers();
  }, [refetchWorkspace, refetchMembers]);

  const isPending = updateWorkspace.isPending || deleteWorkspace.isPending;

  // Loading state
  if (workspaceLoading && !workspace) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <View style={styles.loadingContainer}>
          <Spinner size="large" message="Loading workspace..." />
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (workspaceError || !workspace) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color={colors.error} />
          <Text variant="body" color="error" style={styles.errorText}>
            {workspaceError?.message || 'Failed to load workspace'}
          </Text>
          <Pressable
            onPress={() => refetchWorkspace()}
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Retry loading workspace"
          >
            <Text variant="body" style={{ color: colors.text }}>
              Retry
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Danger card style
  const dangerCardStyle = StyleSheet.flatten([styles.dangerCard, { borderColor: colors.error }]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={membersRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <Card
            padding="md"
            elevation="none"
            style={StyleSheet.flatten([styles.card, { borderColor: colors.border }])}
          >
            <Input
              label="Workspace Name"
              value={name}
              onChangeText={handleNameChange}
              error={nameError ?? undefined}
              disabled={!isAdmin || isPending}
              maxLength={100}
            />

            <Input
              label="Workspace URL"
              value={slug}
              onChangeText={handleSlugChange}
              error={slugError ?? undefined}
              disabled={!isAdmin || isPending}
              maxLength={50}
              autoCapitalize="none"
              autoCorrect={false}
              helperText={slug !== workspace.slug ? `New URL: ${slug}` : undefined}
            />

            {hasChanges && isAdmin && (
              <Button
                variant="primary"
                onPress={handleSave}
                loading={updateWorkspace.isPending}
                disabled={deleteWorkspace.isPending}
                style={styles.saveButton}
              >
                Save Changes
              </Button>
            )}
          </Card>
        </View>

        {/* Members Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members</Text>
            {isAdmin && (
              <Button variant="outline" size="sm" onPress={() => setInviteModalVisible(true)}>
                Invite
              </Button>
            )}
          </View>
          <Card
            padding="md"
            elevation="none"
            style={StyleSheet.flatten([styles.card, { borderColor: colors.border }])}
          >
            <MemberList
              workspaceId={workspaceId}
              members={members}
              currentUserId={user?.id ?? ''}
              currentUserRole={currentUserRole}
              isLoading={membersLoading}
              onMemberUpdated={handleMemberUpdated}
              onMemberRemoved={handleMemberRemoved}
            />
          </Card>
        </View>

        {/* Danger Zone (Owner only) */}
        {isOwner && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.error }]}>Danger Zone</Text>
            <Card padding="md" style={dangerCardStyle}>
              <Text variant="body" bold style={{ marginBottom: spacing.xs }}>
                Delete Workspace
              </Text>
              <Text variant="caption" color="muted" style={{ marginBottom: spacing.md }}>
                Once you delete a workspace, there is no going back. This will permanently remove
                the workspace and all associated data including projects, time entries, and member
                associations.
              </Text>
              <Button
                variant="danger"
                onPress={handleDelete}
                loading={deleteWorkspace.isPending}
                disabled={updateWorkspace.isPending}
                size="sm"
              >
                Delete Workspace
              </Button>
            </Card>
          </View>
        )}

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Invite Modal */}
      <InviteMemberModal
        visible={inviteModalVisible}
        workspaceId={workspaceId}
        onClose={() => setInviteModalVisible(false)}
        onInviteSent={handleInviteSent}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    borderWidth: 1,
  },
  saveButton: {
    marginTop: spacing.sm,
  },
  dangerCard: {
    borderWidth: 1,
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
});

export default WorkspaceSettingsScreen;
