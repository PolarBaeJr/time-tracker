/**
 * useReducedMotion Hook
 *
 * Detects and monitors system reduced motion preference.
 * - On web: Uses matchMedia for prefers-reduced-motion
 * - On native: Uses AccessibilityInfo.isReduceMotionEnabled()
 *
 * Automatically syncs the detected value to:
 * - UX Settings Store (reducedMotion field)
 * - Animation Foundation (setReducedMotionPreference)
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { setReducedMotionPreference } from '@/lib/animations';
import { syncReducedMotion, useUXSettingsSelector } from '@/stores';

/**
 * Result type for useReducedMotion hook.
 */
export interface UseReducedMotionResult {
  /** Whether reduced motion is currently enabled (from system or user preference) */
  reducedMotion: boolean;
  /** Whether the hook has detected the system preference */
  isSystemDetected: boolean;
  /** Force refresh the system preference detection */
  refresh: () => Promise<void>;
}

/**
 * Detects system reduced motion preference on web platforms.
 */
function getWebReducedMotion(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Detects system reduced motion preference on native platforms.
 */
async function getNativeReducedMotion(): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return false;
  }

  try {
    return await AccessibilityInfo.isReduceMotionEnabled();
  } catch (error) {
    console.warn('[useReducedMotion] Failed to get native reduced motion:', error);
    return false;
  }
}

/**
 * Hook that detects system reduced motion preference and syncs it to stores.
 *
 * Features:
 * - Platform-specific detection (web: matchMedia, native: AccessibilityInfo)
 * - Automatic syncing to UX Settings Store
 * - Automatic syncing to Animation Foundation
 * - Subscription to changes on both platforms
 *
 * @returns Object with current reduced motion state, detection status, and refresh function
 *
 * @example
 * ```tsx
 * const { reducedMotion, isSystemDetected } = useReducedMotion();
 *
 * if (reducedMotion) {
 *   // Skip animations
 * }
 * ```
 */
export function useReducedMotion(): UseReducedMotionResult {
  // Get current value from UX Settings Store (which may already be synced)
  const reducedMotion = useUXSettingsSelector(state => state.reducedMotion);

  // Track whether we've detected the system preference
  const [isSystemDetected, setIsSystemDetected] = useState(false);

  // Ref to track if component is mounted (for async cleanup)
  const isMountedRef = useRef(true);

  /**
   * Syncs the detected value to both stores.
   */
  const syncValue = useCallback((value: boolean) => {
    // Sync to UX Settings Store
    syncReducedMotion(value);
    // Sync to Animation Foundation
    setReducedMotionPreference(value);
  }, []);

  /**
   * Refreshes the system preference detection.
   * Note: This is exposed for manual refresh, but initial detection
   * is handled separately in the effect to comply with React rules.
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (Platform.OS === 'web') {
      const webValue = getWebReducedMotion();
      syncValue(webValue);
      setIsSystemDetected(true);
    } else if (Platform.OS === 'ios' || Platform.OS === 'android') {
      const nativeValue = await getNativeReducedMotion();
      if (isMountedRef.current) {
        syncValue(nativeValue);
        setIsSystemDetected(true);
      }
    } else {
      // Unknown platform, default to false
      syncValue(false);
      setIsSystemDetected(true);
    }
  }, [syncValue]);

  // Initial detection - runs once on mount
  // Uses a separate effect to avoid React Compiler warnings
  useEffect(() => {
    let cancelled = false;

    const detectInitial = async (): Promise<void> => {
      let value = false;

      if (Platform.OS === 'web') {
        value = getWebReducedMotion();
      } else if (Platform.OS === 'ios' || Platform.OS === 'android') {
        value = await getNativeReducedMotion();
      }

      if (!cancelled) {
        syncValue(value);
        setIsSystemDetected(true);
      }
    };

    void detectInitial();

    return () => {
      cancelled = true;
    };
  }, [syncValue]);

  // Set up platform-specific listeners for ongoing changes
  useEffect(() => {
    isMountedRef.current = true;

    // Set up listeners based on platform
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      // Web: Listen for media query changes
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

      const handleChange = (event: MediaQueryListEvent): void => {
        if (isMountedRef.current) {
          syncValue(event.matches);
        }
      };

      // Use addEventListener if available, fallback to addListener for older browsers
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
      } else if (mediaQuery.addListener) {
        // Deprecated but needed for Safari < 14
        mediaQuery.addListener(handleChange);
      }

      return () => {
        isMountedRef.current = false;
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handleChange);
        } else if (mediaQuery.removeListener) {
          mediaQuery.removeListener(handleChange);
        }
      };
    } else if (Platform.OS === 'ios' || Platform.OS === 'android') {
      // Native: Listen for AccessibilityInfo changes
      const subscription = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        (isEnabled: boolean) => {
          if (isMountedRef.current) {
            syncValue(isEnabled);
          }
        }
      );

      return () => {
        isMountedRef.current = false;
        subscription.remove();
      };
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [syncValue]);

  return {
    reducedMotion,
    isSystemDetected,
    refresh,
  };
}

/**
 * Standalone function to get the current system reduced motion preference.
 * Useful for checking outside of React components.
 *
 * Note: This does NOT sync the value to stores. Use useReducedMotion hook
 * in components for automatic syncing.
 *
 * @returns Promise that resolves to the current system preference
 */
export async function getSystemReducedMotionPreference(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return getWebReducedMotion();
  } else if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return getNativeReducedMotion();
  }
  return false;
}

/**
 * Initialize reduced motion detection at app startup.
 * Should be called once in the app initialization.
 *
 * This sets up the initial value for both stores and starts listening
 * for changes without requiring a React component.
 */
export async function initializeReducedMotion(): Promise<void> {
  const value = await getSystemReducedMotionPreference();
  syncReducedMotion(value);
  setReducedMotionPreference(value);

  // Set up listener for native platforms (web already handled in uxSettingsStore)
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    AccessibilityInfo.addEventListener('reduceMotionChanged', (isEnabled: boolean) => {
      syncReducedMotion(isEnabled);
      setReducedMotionPreference(isEnabled);
    });
  }
}

export default useReducedMotion;
