/**
 * SetupScreen
 *
 * Forced settings configuration for new users.
 * Shown after first OAuth sign-in before accessing the main app.
 * Marks onboarding_complete = true when the user taps "Get Started".
 */

import * as React from 'react';
import { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Card, Button, Spinner } from '@/components/ui';
import { TimezoneSelector, WeekStartSelector } from '@/components/settings';
import { colors, spacing } from '@/theme';
import { useAuth } from '@/hooks';
import { useUserSettings, useUpdateUserSettings } from '@/hooks/useUserSettings';

export function SetupScreen(): React.ReactElement {
  const { user, refreshUser } = useAuth();
  const [isCompleting, setIsCompleting] = useState(false);

  const { settings, isLoading } = useUserSettings({
    userId: user?.id,
    enabled: !!user?.id,
  });

  const { updateSettings, isUpdating } = useUpdateUserSettings({
    onError: err => {
      const message = err.message || 'Failed to update settings';
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('Error', message);
      }
    },
  });

  const handleTimezoneChange = async (timezone: string) => {
    if (!user?.id) return;
    try {
      await updateSettings({ userId: user.id, updates: { timezone } });
    } catch {
      // handled by onError
    }
  };

  const handleWeekStartChange = async (weekStartDay: number) => {
    if (!user?.id) return;
    try {
      await updateSettings({ userId: user.id, updates: { week_start_day: weekStartDay } });
    } catch {
      // handled by onError
    }
  };

  const handleGetStarted = async () => {
    if (!user?.id) return;
    setIsCompleting(true);
    try {
      await updateSettings({ userId: user.id, updates: { onboarding_complete: true } });
      await refreshUser();
    } catch {
      setIsCompleting(false);
    }
  };

  if (isLoading && !settings) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <Spinner size="large" message="Loading..." />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text variant="display" style={styles.headerTitle}>
          Welcome
        </Text>
        <Text variant="body" color="muted" style={styles.headerSubtitle}>
          Set up your preferences to get started
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Regional</Text>
          <Card padding="md" elevation="none" style={styles.sectionCard}>
            <TimezoneSelector
              value={settings?.timezone ?? 'UTC'}
              onChange={handleTimezoneChange}
              disabled={isUpdating || isCompleting}
              loading={isUpdating}
            />
            <WeekStartSelector
              value={settings?.week_start_day ?? 1}
              onChange={handleWeekStartChange}
              disabled={isUpdating || isCompleting}
              loading={isUpdating}
            />
          </Card>
        </View>

        <Button
          onPress={handleGetStarted}
          disabled={isUpdating || isCompleting}
          style={styles.button}
        >
          {isCompleting ? 'Setting up...' : 'Get Started'}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: 14,
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
  button: {
    marginTop: spacing.md,
  },
});

export default SetupScreen;
