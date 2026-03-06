import { StatusBar } from 'expo-status-bar';

import { Spinner } from '@/components/ui';
import { AuthProvider } from '@/contexts';
import { useAuth } from '@/hooks';
import { NavigationProvider } from '@/navigation';
import { ThemeProvider } from '@/theme';

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
 * Once auth is ready, renders the navigation structure.
 */
function AppContent(): React.ReactElement {
  const { loading } = useAuth();

  if (loading) {
    return <Spinner fullScreen size="large" message="Checking session..." />;
  }

  // NavigationProvider renders RootNavigator which handles auth-based routing
  return (
    <>
      <NavigationProvider />
      <StatusBar style="light" />
    </>
  );
}

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
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export { AppContent };
