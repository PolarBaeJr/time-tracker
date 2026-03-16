/**
 * SharedDashboardScreen
 *
 * Public route for viewing shared dashboards by token.
 * No authentication required - this is a public page.
 * Shows analytics data with branding footer.
 */

import * as React from 'react';
import { View, StyleSheet, Linking, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RouteProp } from '@react-navigation/native';

import { Text, Spinner, Icon, Button } from '@/components/ui';
import { SharedDashboardViewer } from '@/components/sharedDashboards';
import { useTheme, spacing } from '@/theme';
import {
  useSharedDashboardView,
  SharedDashboardViewError,
  isLinkInvalid,
} from '@/hooks/useSharedDashboardView';
import type { RootStackParamList } from '@/navigation/types';

/**
 * Route params for SharedDashboardScreen
 */
export interface SharedDashboardScreenParams {
  token: string;
}

/**
 * Props for SharedDashboardScreen
 */
export interface SharedDashboardScreenProps {
  route: RouteProp<RootStackParamList, 'SharedDashboard'>;
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

  // Determine error message based on error type
  let title = 'Something went wrong';
  let message = 'Unable to load this dashboard. Please try again later.';
  let iconName: 'alert-circle' | 'clock' | 'x-circle' = 'alert-circle';
  let showRetry = true;

  if (error instanceof SharedDashboardViewError) {
    switch (error.code) {
      case 'NOT_FOUND':
        title = 'Dashboard Not Found';
        message = 'This dashboard does not exist or has been removed.';
        iconName = 'x-circle';
        showRetry = false;
        break;
      case 'EXPIRED':
        title = 'Link Expired';
        message = 'This share link has expired and is no longer available.';
        iconName = 'clock';
        showRetry = false;
        break;
      case 'REVOKED':
        title = 'Access Revoked';
        message = 'The owner has revoked access to this dashboard.';
        iconName = 'x-circle';
        showRetry = false;
        break;
      case 'INVALID_TOKEN':
        title = 'Invalid Link';
        message = 'This share link is not valid.';
        iconName = 'alert-circle';
        showRetry = false;
        break;
      default:
        message = error.message;
    }
  }

  return (
    <View style={styles.errorContainer}>
      <View style={[styles.errorIcon, { backgroundColor: colors.error + '20' }]}>
        <Icon name={iconName} size={48} color={colors.error} />
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
      {showRetry && onRetry && (
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
      <Spinner size="large" message="Loading dashboard..." />
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
 * SharedDashboardScreen component
 *
 * Displays a shared analytics dashboard based on the share token.
 * Works without authentication - this is a public page.
 *
 * @example
 * ```tsx
 * // In navigation stack
 * <Stack.Screen name="SharedDashboard" component={SharedDashboardScreen} />
 * ```
 */
export function SharedDashboardScreen({ route }: SharedDashboardScreenProps): React.ReactElement {
  const { colors } = useTheme();
  const token = route.params?.token ?? '';

  // Fetch shared dashboard data
  const { data, isLoading, error, refetch } = useSharedDashboardView(token, {
    enabled: !!token,
  });

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
    const showRetry = !(error instanceof SharedDashboardViewError && isLinkInvalid(error));
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ErrorState error={error} onRetry={showRetry ? refetch : undefined} />
        <BrandingFooter />
      </SafeAreaView>
    );
  }

  // No data found (shouldn't happen if query succeeded)
  if (!data) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ErrorState error={new SharedDashboardViewError('Dashboard not found', 'NOT_FOUND')} />
        <BrandingFooter />
      </SafeAreaView>
    );
  }

  // Success - render the dashboard viewer
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <SharedDashboardViewer data={data} />
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

export default SharedDashboardScreen;
