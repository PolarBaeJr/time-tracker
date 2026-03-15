/**
 * SettingsScreen
 *
 * Main settings screen with timezone, week start, goals, and account settings.
 */

import * as React from 'react';
import { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Card, Spinner } from '@/components/ui';
import {
  TimezoneSelector,
  WeekStartSelector,
  GoalDefaults,
  AccountSection,
  PomodoroSettings,
  ThemeSelector,
  IdleDetectionSettings,
  SpotifySettings,
  AISettings,
  EmailSettings,
  CalendarSettings,
  SettingsNavLink,
  UXSettings,
} from '@/components/settings';
import { colors, spacing } from '@/theme';
import { useAuth } from '@/hooks';
import { useUserSettings, useUpdateUserSettings } from '@/hooks/useUserSettings';
import Constants from 'expo-constants';

/**
 * Get app version from Constants or Electron API
 */
function useAppVersion(): string {
  const [version, setVersion] = React.useState(Constants.expoConfig?.version ?? '1.0.0');

  React.useEffect(() => {
    if (window.desktop?.getAppVersion) {
      window.desktop.getAppVersion().then(v => setVersion(v));
    }
  }, []);

  const buildNumber =
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    '';

  if (buildNumber) {
    return `${version} (${buildNumber})`;
  }

  return version;
}

/**
 * SettingsScreen component
 *
 * @example
 * ```tsx
 * // In navigation stack
 * <Stack.Screen name="Settings" component={SettingsScreen} />
 * ```
 */
export function SettingsScreen(): React.ReactElement {
  const { user, signOut, session } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch user settings
  const { settings, isLoading, error, refetch } = useUserSettings({
    userId: user?.id,
    enabled: !!user?.id,
  });

  // Update settings mutation
  const { updateSettings, isUpdating } = useUpdateUserSettings({
    onSuccess: () => {
      // Optionally show success feedback
    },
    onError: err => {
      const message = err.message || 'Failed to update settings';
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('Error', message);
      }
    },
  });

  // Handle timezone change
  const handleTimezoneChange = useCallback(
    async (timezone: string) => {
      if (!user?.id) return;

      try {
        await updateSettings({
          userId: user.id,
          updates: { timezone },
        });
      } catch {
        // Error handling is done in onError callback
      }
    },
    [user?.id, updateSettings]
  );

  // Handle week start change
  const handleWeekStartChange = useCallback(
    async (weekStartDay: number) => {
      if (!user?.id) return;

      try {
        await updateSettings({
          userId: user.id,
          updates: { week_start_day: weekStartDay },
        });
      } catch {
        // Error handling is done in onError callback
      }
    },
    [user?.id, updateSettings]
  );

  // Handle sign out
  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  // Handle pull to refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const appVersion = useAppVersion();

  // Get avatar URL from session metadata
  const avatarUrl = session?.user?.user_metadata?.avatar_url as string | undefined;

  // Loading state
  if (isLoading && !settings) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <Text variant="display" style={styles.headerTitle}>
            Settings
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <Spinner size="large" message="Loading settings..." />
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && !settings) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <Text variant="display" style={styles.headerTitle}>
            Settings
          </Text>
        </View>
        <View style={styles.errorContainer}>
          <Text variant="body" color="error">
            {error.message || 'Failed to load settings'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="display" style={styles.headerTitle}>
          Settings
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Collaboration - Workspaces */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Collaboration</Text>
          <Card padding="md" elevation="none" style={styles.sectionCard}>
            <SettingsNavLink
              screen="Workspaces"
              icon="briefcase"
              title="Workspaces"
              subtitle="Manage team workspaces and invitations"
            />
          </Card>
        </View>

        {/* Data Management - Categories & Goals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          <Card padding="md" elevation="none" style={styles.sectionCard}>
            <SettingsNavLink
              screen="Categories"
              icon="folder"
              title="Categories"
              subtitle="Organize your time entries by project or task"
            />
            <View style={styles.navLinkDivider} />
            <SettingsNavLink
              screen="Goals"
              icon="flag"
              title="Goals"
              subtitle="Set and track monthly time goals"
            />
          </Card>
        </View>

        {/* Appearance Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <Card padding="md" elevation="none" style={styles.sectionCard}>
            <ThemeSelector />
          </Card>
        </View>

        {/* UX Settings - Animations & Haptics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Experience</Text>
          <Card padding="md" elevation="none" style={styles.sectionCard}>
            <UXSettings disabled={isUpdating} />
          </Card>
        </View>

        {/* Regional Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Regional</Text>
          <Card padding="md" elevation="none" style={styles.sectionCard}>
            <TimezoneSelector
              value={settings?.timezone ?? 'UTC'}
              onChange={handleTimezoneChange}
              disabled={isUpdating}
              loading={isUpdating}
            />

            <WeekStartSelector
              value={settings?.week_start_day ?? 1}
              onChange={handleWeekStartChange}
              disabled={isUpdating}
              loading={isUpdating}
            />
          </Card>
        </View>

        {/* Pomodoro Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pomodoro</Text>
          <Card padding="md" elevation="none" style={styles.sectionCard}>
            <PomodoroSettings disabled={isUpdating} />
          </Card>
        </View>

        {/* Idle Detection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Idle Detection</Text>
          <Card padding="md" elevation="none" style={styles.sectionCard}>
            <IdleDetectionSettings disabled={isUpdating} />
          </Card>
        </View>

        {/* Goals Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Goals</Text>
          <Card padding="md" elevation="none" style={styles.sectionCard}>
            <GoalDefaults />
          </Card>
        </View>

        {/* Integrations — only shown on web (Spotify is web-only) */}
        {Platform.OS === 'web' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Integrations</Text>
            <Card padding="md" elevation="none" style={styles.sectionCard}>
              <SpotifySettings disabled={isUpdating} />
            </Card>
          </View>
        )}

        {/* AI Assistant — only shown on web */}
        {Platform.OS === 'web' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI Assistant</Text>
            <Card padding="md" elevation="none" style={styles.sectionCard}>
              <AISettings disabled={isUpdating} />
            </Card>
          </View>
        )}

        {/* Email — only shown on web (OAuth requires web environment) */}
        {Platform.OS === 'web' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Email</Text>
            <Card padding="md" elevation="none" style={styles.sectionCard}>
              <EmailSettings disabled={isUpdating} />
            </Card>
          </View>
        )}

        {/* Calendar — only shown on web (OAuth requires web environment) */}
        {Platform.OS === 'web' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Calendar</Text>
            <Card padding="md" elevation="none" style={styles.sectionCard}>
              <CalendarSettings disabled={isUpdating} />
            </Card>
          </View>
        )}

        {/* Account Settings */}
        <View style={styles.section}>
          <AccountSection
            email={settings?.email ?? user?.email ?? null}
            name={settings?.name ?? null}
            avatarUrl={avatarUrl}
            onSignOut={handleSignOut}
          />
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionLabel}>WorkTracker</Text>
          <Text style={styles.versionText}>Version {appVersion}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    ...Platform.select({
      ios: { letterSpacing: 0.5 },
      default: { letterSpacing: 0.5 },
      android: {},
    }),
  },
  sectionCard: {
    borderColor: colors.border,
  },
  navLinkDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginTop: spacing.lg,
  },
  versionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  versionText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});

export default SettingsScreen;
