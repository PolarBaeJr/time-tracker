import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { Spinner, Text } from '@/components/ui';
import { AuthProvider } from '@/contexts';
import { useAuth } from '@/hooks';
import { ThemeProvider, colors, spacing } from '@/theme';

/**
 * WorkTracker App - Main Entry Point
 *
 * A cross-platform time tracking application built with:
 * - Expo (React Native + React Native Web)
 * - TypeScript
 * - Supabase Backend
 * - Google OAuth Authentication
 */
function AppContent(): React.ReactElement {
  const { loading, isAuthenticated, user, session } = useAuth();

  if (loading) {
    return <Spinner fullScreen size="large" message="Checking session..." />;
  }

  const displayName = user?.name ?? session?.user.email ?? 'WorkTracker user';

  return (
    <View style={styles.container}>
      <Text variant="display" center style={styles.title}>
        WorkTracker
      </Text>
      <Text variant="body" color="secondary" center>
        {isAuthenticated ? `Signed in as ${displayName}` : 'Authentication context is ready'}
      </Text>
      <Text variant="bodySmall" color="muted" center style={styles.subtitle}>
        {isAuthenticated
          ? 'Your Supabase session is active and the profile sync is connected.'
          : 'Google OAuth wiring is available. Login UI lands in the next auth task.'}
      </Text>
      <StatusBar style="light" />
    </View>
  );
}

export default function App(): React.ReactElement {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: {
    marginBottom: spacing.sm,
  },
  subtitle: {
    marginTop: spacing.md,
    maxWidth: 360,
  },
});

export { AppContent };
