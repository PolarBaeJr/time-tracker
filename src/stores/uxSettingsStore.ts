import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { storage } from '@/lib';
import {
  UXSettingsSchema,
  type UXSettings,
  type UpdateUXSettingsInput,
  type SoundPreset,
} from '@/schemas/uxSettings';

const UX_SETTINGS_STORAGE_KEY = 'worktracker.ux-settings.v1';

type Listener = () => void;

const listeners = new Set<Listener>();

const notifyListeners = (): void => {
  listeners.forEach(listener => listener());
};

/**
 * Detect if the system prefers reduced motion.
 * On web, uses the prefers-reduced-motion media query.
 * On native, this should be synced via AccessibilityInfo (done in useReducedMotion hook).
 */
const getSystemReducedMotion = (): boolean => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return false;
};

/**
 * Check if current platform is mobile (iOS or Android).
 * Used for determining haptic feedback default.
 */
const isMobilePlatform = (): boolean => {
  return Platform.OS === 'ios' || Platform.OS === 'android';
};

/**
 * Default UX settings.
 * hapticFeedbackEnabled defaults to true on mobile, false on web.
 */
const getDefaultSettings = (): UXSettings => ({
  animationsEnabled: true,
  reducedMotion: getSystemReducedMotion(),
  hapticFeedbackEnabled: isMobilePlatform(),
  soundEnabled: false,
  soundVolume: 0.7,
  soundPreset: 'classic',
});

let settings: UXSettings = getDefaultSettings();

/**
 * Persist settings to AsyncStorage.
 */
const persistState = async (): Promise<void> => {
  try {
    await storage.setItem(UX_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('[uxSettingsStore] Failed to persist settings:', error);
  }
};

/**
 * Hydrate settings from AsyncStorage on app start.
 * Validates stored data against schema to handle version migrations.
 */
const hydrateStore = async (): Promise<void> => {
  try {
    const stored = await storage.getItem(UX_SETTINGS_STORAGE_KEY);
    if (!stored) {
      return;
    }

    const parsed: unknown = JSON.parse(stored);

    // Use Zod schema to validate and provide defaults for missing fields
    const result = UXSettingsSchema.safeParse(parsed);

    if (result.success) {
      settings = result.data;
      // Always sync reducedMotion with system on hydration
      settings.reducedMotion = getSystemReducedMotion();
      notifyListeners();
    } else {
      console.warn('[uxSettingsStore] Invalid stored settings, using defaults:', result.error);
    }
  } catch (error) {
    console.error('[uxSettingsStore] Failed to hydrate settings:', error);
  }
};

/**
 * Listen for system reduced motion preference changes on web.
 */
if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const handleChange = (): void => {
    settings = { ...settings, reducedMotion: mediaQuery.matches };
    notifyListeners();
    void persistState();
  };

  // Use addEventListener if available, fallback to addListener for older browsers
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleChange);
  } else if (mediaQuery.addListener) {
    // Deprecated but needed for Safari < 14
    mediaQuery.addListener(handleChange);
  }
}

// Initialize store
void hydrateStore();

/**
 * Update UX settings with partial updates.
 *
 * @param partial - Object containing settings to update
 */
export const updateUXSettings = (partial: UpdateUXSettingsInput): void => {
  settings = { ...settings, ...partial };
  notifyListeners();
  void persistState();
};

/**
 * Set animations enabled state.
 */
export const setAnimationsEnabled = (enabled: boolean): void => {
  updateUXSettings({ animationsEnabled: enabled });
};

/**
 * Set haptic feedback enabled state.
 */
export const setHapticFeedbackEnabled = (enabled: boolean): void => {
  updateUXSettings({ hapticFeedbackEnabled: enabled });
};

/**
 * Set sound enabled state.
 */
export const setSoundEnabled = (enabled: boolean): void => {
  updateUXSettings({ soundEnabled: enabled });
};

/**
 * Set sound volume (0.0 to 1.0).
 */
export const setSoundVolume = (volume: number): void => {
  const clampedVolume = Math.max(0, Math.min(1, volume));
  updateUXSettings({ soundVolume: clampedVolume });
};

/**
 * Set sound preset.
 */
export const setSoundPreset = (preset: SoundPreset): void => {
  updateUXSettings({ soundPreset: preset });
};

/**
 * Sync reduced motion from system accessibility settings.
 * Called by useReducedMotion hook when system preference changes.
 *
 * @param reducedMotion - Whether system prefers reduced motion
 */
export const syncReducedMotion = (reducedMotion: boolean): void => {
  if (settings.reducedMotion !== reducedMotion) {
    settings = { ...settings, reducedMotion };
    notifyListeners();
    void persistState();
  }
};

/**
 * Get current UX settings state.
 */
export const getUXSettingsState = (): UXSettings => settings;

/**
 * Subscribe to UX settings changes.
 *
 * @param listener - Callback to invoke when settings change
 * @returns Unsubscribe function
 */
export const subscribeUXSettings = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Hook to access UX settings with React 18 useSyncExternalStore.
 * Automatically subscribes to changes and re-renders when settings update.
 *
 * @returns Current UX settings
 */
export const useUXSettings = (): UXSettings =>
  useSyncExternalStore(
    subscribeUXSettings,
    () => settings,
    () => settings
  );

/**
 * Hook to access a specific UX setting with a selector.
 * Useful for components that only need part of the state.
 *
 * @param selector - Function to select a value from UX settings
 * @returns Selected value from UX settings
 */
export const useUXSettingsSelector = <T>(selector: (state: UXSettings) => T): T =>
  useSyncExternalStore(
    subscribeUXSettings,
    () => selector(settings),
    () => selector(settings)
  );

export type { UXSettings, UpdateUXSettingsInput, SoundPreset };
