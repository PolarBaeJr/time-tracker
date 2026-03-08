import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/ui';
import { AuthProvider } from '@/contexts';
import { useAuth, useSplashScreen } from '@/hooks';
import { NavigationProvider } from '@/navigation';
import { ThemeProvider, useTheme } from '@/theme';

const queryClient = new QueryClient();

/**
 * WorkTracker App - Main Entry Point
 *
 * A cross-platform time tracking application built with:
 * - Expo (React Native + React Native Web)
 * - TypeScript
 * - Supabase Backend
 * - Google OAuth Authentication
 * - React Navigation for routing
 */

/**
 * App Content Component
 *
 * Handles the loading state while auth is being initialized.
 * Uses expo-splash-screen to keep the native splash visible until
 * auth check is complete, then renders the navigation structure.
 */
function AppContent(): React.ReactElement | null {
  const { loading } = useAuth();
  const { colors, isDark } = useTheme();

  // Control splash screen visibility based on auth loading state
  const { isReady, onLayoutRootView } = useSplashScreen({
    authLoading: loading,
    minimumDisplayTime: 500,
  });

  if (!isReady) {
    return null;
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      onLayout={onLayoutRootView}
    >
      <OfflineBanner />
      <NavigationProvider />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

/**
 * App Root Component
 *
 * Sets up the provider hierarchy:
 * 1. ThemeProvider - Provides theme context
 * 2. AuthProvider - Manages authentication state
 * 3. AppContent - Navigation and main app UI
 */
export default function App(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ErrorBoundary>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export { AppContent };
