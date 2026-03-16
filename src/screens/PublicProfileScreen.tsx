/**
 * PublicProfileScreen
 *
 * Public route for viewing user profiles by slug.
 * No authentication required - this is a public page.
 * Shows profile stats with branding footer.
 */

import * as React from 'react';
import { View, StyleSheet, ScrollView, Linking, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RouteProp } from '@react-navigation/native';

import { Text, Spinner, Icon, Button } from '@/components/ui';
import { PublicProfileCard } from '@/components/publicProfile';
import { useTheme, spacing } from '@/theme';
import { usePublicProfile, PublicProfileFetchError } from '@/hooks/usePublicProfile';
import type { RootStackParamList } from '@/navigation/types';

/**
 * Route params for PublicProfileScreen
 */
export interface PublicProfileScreenParams {
  slug: string;
}

/**
 * Props for PublicProfileScreen
 */
export interface PublicProfileScreenProps {
  route: RouteProp<RootStackParamList, 'PublicProfile'>;
}

/**
 * Error state component
 */
function ErrorState({
  error,
  onRetry,
}: {
  error: Error;
  onRetry?: () => void;
}): React.ReactElement {
  const { colors } = useTheme();

  // Determine error message
  let title = 'Something went wrong';
  let message = 'Unable to load this profile. Please try again later.';

  if (error instanceof PublicProfileFetchError) {
    switch (error.code) {
      case 'NOT_FOUND':
        title = 'Profile Not Found';
        message = 'This profile does not exist or has been disabled.';
        break;
      case 'INVALID_SLUG':
        title = 'Invalid Profile URL';
        message = 'The profile URL is not valid.';
        break;
      default:
        message = error.message;
    }
  }

  return (
    <View style={styles.errorContainer}>
      <View style={[styles.errorIcon, { backgroundColor: colors.error + '20' }]}>
        <Icon name="alert-circle" size={48} color={colors.error} />
      </View>
      <Text variant="heading" style={{ color: colors.text, marginTop: spacing.lg }}>
        {title}
      </Text>
      <Text
        variant="body"
        style={{ color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }}
      >
        {message}
      </Text>
      {onRetry && (
        <Button onPress={onRetry} variant="secondary" style={{ marginTop: spacing.lg }}>
          Try Again
        </Button>
      )}
    </View>
  );
}

/**
 * Loading state component
 */
function LoadingState(): React.ReactElement {
  return (
    <View style={styles.loadingContainer}>
      <Spinner size="large" message="Loading profile..." />
    </View>
  );
}

/**
 * Branding footer component
 */
function BrandingFooter(): React.ReactElement {
  const { colors } = useTheme();

  const handlePress = React.useCallback(() => {
    Linking.openURL('https://worktracker.app');
  }, []);

  return (
    <Pressable style={styles.brandingFooter} onPress={handlePress}>
      <Text variant="caption" style={{ color: colors.textMuted }}>
        Powered by{' '}
        <Text variant="caption" bold style={{ color: colors.primary }}>
          WorkTracker
        </Text>
      </Text>
    </Pressable>
  );
}

/**
 * PublicProfileScreen component
 *
 * Displays a user's public profile based on their slug.
 * Works without authentication - this is a public page.
 *
 * @example
 * ```tsx
 * // In navigation stack
 * <Stack.Screen name="PublicProfile" component={PublicProfileScreen} />
 * ```
 */
export function PublicProfileScreen({ route }: PublicProfileScreenProps): React.ReactElement {
  const { colors } = useTheme();
  const slug = route.params?.slug ?? '';

  // Fetch public profile
  const { data: profile, isLoading, error, refetch } = usePublicProfile(slug);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ErrorState error={error} onRetry={refetch} />
        <BrandingFooter />
      </SafeAreaView>
    );
  }

  // No profile found (shouldn't happen if query succeeded)
  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ErrorState
          error={new PublicProfileFetchError('Profile not found', 'NOT_FOUND')}
          onRetry={refetch}
        />
        <BrandingFooter />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <PublicProfileCard profile={profile} />

        {/* Spacer */}
        <View style={{ flex: 1, minHeight: spacing.xl }} />

        {/* Branding Footer */}
        <BrandingFooter />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandingFooter: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
  },
});

export default PublicProfileScreen;
