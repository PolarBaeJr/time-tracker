import { useCallback } from 'react';
import { Platform } from 'react-native';

import { useUXSettingsSelector } from '@/stores';

/**
 * Haptic feedback types available in the app.
 */
export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/**
 * Result type for useHaptics hook.
 */
export interface UseHapticsResult {
  /** Trigger light impact feedback (gentle tap) */
  triggerLight: () => void;
  /** Trigger medium impact feedback (firm tap) */
  triggerMedium: () => void;
  /** Trigger heavy impact feedback (strong tap) */
  triggerHeavy: () => void;
  /** Trigger success notification feedback */
  triggerSuccess: () => void;
  /** Trigger warning notification feedback */
  triggerWarning: () => void;
  /** Trigger error notification feedback */
  triggerError: () => void;
  /** Generic trigger function accepting any haptic type */
  trigger: (type: HapticType) => void;
  /** Whether haptic feedback is enabled */
  isEnabled: boolean;
}

// Lazy-load expo-haptics only on native platforms
let Haptics: typeof import('expo-haptics') | null = null;

const loadHaptics = async (): Promise<typeof import('expo-haptics') | null> => {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return null;
  }

  if (Haptics) {
    return Haptics;
  }

  try {
    // Dynamic import to avoid loading on web
    Haptics = await import('expo-haptics');
    return Haptics;
  } catch (error) {
    console.warn('[useHaptics] Failed to load expo-haptics:', error);
    return null;
  }
};

// Preload haptics on native platforms
if (Platform.OS === 'ios' || Platform.OS === 'android') {
  void loadHaptics();
}

/**
 * Hook that provides haptic feedback functions for mobile devices.
 *
 * Features:
 * - No-op on web/desktop (silent, no errors)
 * - Respects hapticFeedbackEnabled setting from UX Settings Store
 * - Maps to appropriate Haptics.ImpactFeedbackStyle and Haptics.NotificationFeedbackType
 * - Lazy-loads expo-haptics to minimize bundle impact on web
 *
 * @returns Object with haptic trigger functions and enabled state
 *
 * @example
 * ```tsx
 * const { triggerSuccess, triggerLight } = useHaptics();
 *
 * // On button press
 * const handlePress = () => {
 *   triggerLight();
 *   // ... do something
 * };
 *
 * // On success
 * const handleSuccess = () => {
 *   triggerSuccess();
 *   showSuccessMessage();
 * };
 * ```
 */
export function useHaptics(): UseHapticsResult {
  const hapticFeedbackEnabled = useUXSettingsSelector(state => state.hapticFeedbackEnabled);

  const isNativePlatform = Platform.OS === 'ios' || Platform.OS === 'android';
  const isEnabled = hapticFeedbackEnabled && isNativePlatform;

  const triggerLight = useCallback(() => {
    if (!isEnabled || !Haptics) return;

    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      // Silently ignore haptic errors
    }
  }, [isEnabled]);

  const triggerMedium = useCallback(() => {
    if (!isEnabled || !Haptics) return;

    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      // Silently ignore haptic errors
    }
  }, [isEnabled]);

  const triggerHeavy = useCallback(() => {
    if (!isEnabled || !Haptics) return;

    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (error) {
      // Silently ignore haptic errors
    }
  }, [isEnabled]);

  const triggerSuccess = useCallback(() => {
    if (!isEnabled || !Haptics) return;

    try {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      // Silently ignore haptic errors
    }
  }, [isEnabled]);

  const triggerWarning = useCallback(() => {
    if (!isEnabled || !Haptics) return;

    try {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (error) {
      // Silently ignore haptic errors
    }
  }, [isEnabled]);

  const triggerError = useCallback(() => {
    if (!isEnabled || !Haptics) return;

    try {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (error) {
      // Silently ignore haptic errors
    }
  }, [isEnabled]);

  const trigger = useCallback(
    (type: HapticType) => {
      switch (type) {
        case 'light':
          triggerLight();
          break;
        case 'medium':
          triggerMedium();
          break;
        case 'heavy':
          triggerHeavy();
          break;
        case 'success':
          triggerSuccess();
          break;
        case 'warning':
          triggerWarning();
          break;
        case 'error':
          triggerError();
          break;
      }
    },
    [triggerLight, triggerMedium, triggerHeavy, triggerSuccess, triggerWarning, triggerError]
  );

  return {
    triggerLight,
    triggerMedium,
    triggerHeavy,
    triggerSuccess,
    triggerWarning,
    triggerError,
    trigger,
    isEnabled,
  };
}

/**
 * Standalone haptic trigger functions for use outside of React components.
 *
 * Note: These functions do NOT check the hapticFeedbackEnabled setting.
 * Use the useHaptics hook in components for setting-aware haptic feedback.
 * These are provided for edge cases where you need to trigger haptics
 * outside of a React context and know the user has haptics enabled.
 */
export const haptics = {
  async triggerLight(): Promise<void> {
    const h = await loadHaptics();
    if (!h) return;
    try {
      await h.impactAsync(h.ImpactFeedbackStyle.Light);
    } catch {
      // Silently ignore
    }
  },

  async triggerMedium(): Promise<void> {
    const h = await loadHaptics();
    if (!h) return;
    try {
      await h.impactAsync(h.ImpactFeedbackStyle.Medium);
    } catch {
      // Silently ignore
    }
  },

  async triggerHeavy(): Promise<void> {
    const h = await loadHaptics();
    if (!h) return;
    try {
      await h.impactAsync(h.ImpactFeedbackStyle.Heavy);
    } catch {
      // Silently ignore
    }
  },

  async triggerSuccess(): Promise<void> {
    const h = await loadHaptics();
    if (!h) return;
    try {
      await h.notificationAsync(h.NotificationFeedbackType.Success);
    } catch {
      // Silently ignore
    }
  },

  async triggerWarning(): Promise<void> {
    const h = await loadHaptics();
    if (!h) return;
    try {
      await h.notificationAsync(h.NotificationFeedbackType.Warning);
    } catch {
      // Silently ignore
    }
  },

  async triggerError(): Promise<void> {
    const h = await loadHaptics();
    if (!h) return;
    try {
      await h.notificationAsync(h.NotificationFeedbackType.Error);
    } catch {
      // Silently ignore
    }
  },

  async trigger(type: HapticType): Promise<void> {
    switch (type) {
      case 'light':
        await this.triggerLight();
        break;
      case 'medium':
        await this.triggerMedium();
        break;
      case 'heavy':
        await this.triggerHeavy();
        break;
      case 'success':
        await this.triggerSuccess();
        break;
      case 'warning':
        await this.triggerWarning();
        break;
      case 'error':
        await this.triggerError();
        break;
    }
  },
};

export default useHaptics;
