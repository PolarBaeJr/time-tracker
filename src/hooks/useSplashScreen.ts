import { useCallback, useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  // Silently catch if we can't prevent auto hide (e.g., on web in some cases)
});

/**
 * Hook to manage the splash screen visibility.
 *
 * The splash screen should be hidden once:
 * 1. Auth check is complete (session loaded or confirmed no session)
 * 2. Initial data is loaded (if authenticated)
 *
 * Usage:
 * ```tsx
 * const { isReady, onLayoutRootView } = useSplashScreen({ authLoading: false });
 *
 * if (!isReady) {
 *   return null; // Keep splash visible
 * }
 *
 * return (
 *   <View onLayout={onLayoutRootView}>
 *     <AppContent />
 *   </View>
 * );
 * ```
 */
export interface UseSplashScreenOptions {
  /**
   * Whether the auth check is still loading.
   * Splash will remain visible while this is true.
   */
  authLoading: boolean;

  /**
   * Optional additional loading state (e.g., initial data fetch).
   * Splash will remain visible while this is true.
   */
  dataLoading?: boolean;

  /**
   * Minimum time in ms to show the splash screen.
   * Useful to prevent flash if auth check is very fast.
   * Default: 500ms
   */
  minimumDisplayTime?: number;
}

export interface UseSplashScreenResult {
  /**
   * Whether the app is ready to render content.
   * Returns false if splash should still be visible.
   */
  isReady: boolean;

  /**
   * Callback to be passed to the root View's onLayout prop.
   * This triggers the splash screen to hide when the view is laid out.
   */
  onLayoutRootView: () => Promise<void>;

  /**
   * Manually hide the splash screen.
   * Use this if you need more control over when splash hides.
   */
  hideSplash: () => Promise<void>;
}

export function useSplashScreen(options: UseSplashScreenOptions): UseSplashScreenResult {
  const { authLoading, dataLoading = false, minimumDisplayTime = 500 } = options;

  const [minimumTimePassed, setMinimumTimePassed] = useState(false);

  // Track minimum display time
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinimumTimePassed(true);
    }, minimumDisplayTime);

    return () => clearTimeout(timer);
  }, [minimumDisplayTime]);

  // Derive ready state from conditions (no effect needed)
  const isReady = !authLoading && !dataLoading && minimumTimePassed;

  const hideSplash = useCallback(async () => {
    try {
      await SplashScreen.hideAsync();
    } catch {
      // Silently catch hide errors (may happen if already hidden)
    }
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (isReady) {
      // Once the root view is laid out, hide the splash screen
      await hideSplash();
    }
  }, [isReady, hideSplash]);

  return {
    isReady,
    onLayoutRootView,
    hideSplash,
  };
}
