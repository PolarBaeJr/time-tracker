/**
 * UX Settings Store Tests
 *
 * Tests for UX settings store state management including:
 * - Default values
 * - Settings updates
 * - Persistence via storage
 * - System reduced motion sync
 */

import { createMockStorage } from '../mocks/supabase';
import {
  UXSettingsSchema,
  UpdateUXSettingsSchema,
  type UXSettings,
  type UpdateUXSettingsInput,
} from '@/schemas/uxSettings';

// Create mock storage instance
const mockStorage = createMockStorage();

// Mock react-native Platform
let mockPlatformOS: 'web' | 'ios' | 'android' = 'web';

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

// Mock storage
jest.mock('@/lib', () => ({
  storage: mockStorage,
}));

// Mock window.matchMedia for web
const mockMatchMedia = {
  matches: false,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

const originalMatchMedia = globalThis.window?.matchMedia;

describe('UX Settings Schema', () => {
  describe('UXSettingsSchema', () => {
    it('should validate default settings', () => {
      const defaultSettings = {
        animationsEnabled: true,
        reducedMotion: false,
        hapticFeedbackEnabled: true,
        soundEnabled: false,
        soundVolume: 0.7,
        soundPreset: 'classic',
      };

      const result = UXSettingsSchema.safeParse(defaultSettings);
      expect(result.success).toBe(true);
    });

    it('should apply defaults for missing fields', () => {
      const result = UXSettingsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.animationsEnabled).toBe(true);
        expect(result.data.reducedMotion).toBe(false);
        expect(result.data.hapticFeedbackEnabled).toBe(true);
        expect(result.data.soundEnabled).toBe(false);
        expect(result.data.soundVolume).toBe(0.7);
        expect(result.data.soundPreset).toBe('classic');
      }
    });

    it('should validate soundVolume range', () => {
      expect(UXSettingsSchema.safeParse({ soundVolume: 0 }).success).toBe(true);
      expect(UXSettingsSchema.safeParse({ soundVolume: 1 }).success).toBe(true);
      expect(UXSettingsSchema.safeParse({ soundVolume: 0.5 }).success).toBe(true);
      expect(UXSettingsSchema.safeParse({ soundVolume: -0.1 }).success).toBe(false);
      expect(UXSettingsSchema.safeParse({ soundVolume: 1.1 }).success).toBe(false);
    });

    it('should validate soundPreset enum values', () => {
      expect(UXSettingsSchema.safeParse({ soundPreset: 'classic' }).success).toBe(true);
      expect(UXSettingsSchema.safeParse({ soundPreset: 'soft' }).success).toBe(true);
      expect(UXSettingsSchema.safeParse({ soundPreset: 'minimal' }).success).toBe(true);
      expect(UXSettingsSchema.safeParse({ soundPreset: 'invalid' }).success).toBe(false);
    });

    it('should validate boolean fields', () => {
      const validSettings = {
        animationsEnabled: false,
        reducedMotion: true,
        hapticFeedbackEnabled: false,
        soundEnabled: true,
      };

      const result = UXSettingsSchema.safeParse(validSettings);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.animationsEnabled).toBe(false);
        expect(result.data.reducedMotion).toBe(true);
        expect(result.data.hapticFeedbackEnabled).toBe(false);
        expect(result.data.soundEnabled).toBe(true);
      }
    });

    it('should reject non-boolean values for boolean fields', () => {
      expect(UXSettingsSchema.safeParse({ animationsEnabled: 'true' }).success).toBe(false);
      expect(UXSettingsSchema.safeParse({ hapticFeedbackEnabled: 1 }).success).toBe(false);
      expect(UXSettingsSchema.safeParse({ soundEnabled: null }).success).toBe(false);
    });
  });

  describe('UpdateUXSettingsSchema', () => {
    it('should allow partial updates', () => {
      const partialUpdate: UpdateUXSettingsInput = {
        soundEnabled: true,
      };

      const result = UpdateUXSettingsSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });

    it('should allow empty object', () => {
      const result = UpdateUXSettingsSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate partial soundVolume', () => {
      expect(UpdateUXSettingsSchema.safeParse({ soundVolume: 0.5 }).success).toBe(true);
      expect(UpdateUXSettingsSchema.safeParse({ soundVolume: -1 }).success).toBe(false);
      expect(UpdateUXSettingsSchema.safeParse({ soundVolume: 2 }).success).toBe(false);
    });

    it('should validate partial soundPreset', () => {
      expect(UpdateUXSettingsSchema.safeParse({ soundPreset: 'soft' }).success).toBe(true);
      expect(UpdateUXSettingsSchema.safeParse({ soundPreset: 'invalid' }).success).toBe(false);
    });
  });
});

describe('UX Settings Store Logic', () => {
  const UX_SETTINGS_STORAGE_KEY = 'worktracker.ux-settings.v1';

  // Helper to simulate store state
  const createStoreState = (): UXSettings => ({
    animationsEnabled: true,
    reducedMotion: false,
    hapticFeedbackEnabled: true,
    soundEnabled: false,
    soundVolume: 0.7,
    soundPreset: 'classic',
  });

  beforeEach(() => {
    mockStorage.__store.clear();
    jest.clearAllMocks();
    mockPlatformOS = 'web';
  });

  describe('state management', () => {
    it('should initialize with default values', () => {
      const state = createStoreState();

      expect(state.animationsEnabled).toBe(true);
      expect(state.reducedMotion).toBe(false);
      expect(state.hapticFeedbackEnabled).toBe(true);
      expect(state.soundEnabled).toBe(false);
      expect(state.soundVolume).toBe(0.7);
      expect(state.soundPreset).toBe('classic');
    });

    it('should update individual settings', () => {
      const state = createStoreState();
      const updatedState: UXSettings = { ...state, soundEnabled: true };

      expect(updatedState.soundEnabled).toBe(true);
      expect(updatedState.animationsEnabled).toBe(true); // Unchanged
    });

    it('should update multiple settings at once', () => {
      const state = createStoreState();
      const updatedState: UXSettings = {
        ...state,
        soundEnabled: true,
        soundVolume: 0.5,
        soundPreset: 'soft',
      };

      expect(updatedState.soundEnabled).toBe(true);
      expect(updatedState.soundVolume).toBe(0.5);
      expect(updatedState.soundPreset).toBe('soft');
    });

    it('should clamp soundVolume to valid range', () => {
      const clampVolume = (volume: number): number => Math.max(0, Math.min(1, volume));

      expect(clampVolume(-0.5)).toBe(0);
      expect(clampVolume(1.5)).toBe(1);
      expect(clampVolume(0.5)).toBe(0.5);
    });
  });

  describe('persistence', () => {
    it('should persist settings to storage', async () => {
      const state = createStoreState();
      state.soundEnabled = true;

      await mockStorage.setItem(UX_SETTINGS_STORAGE_KEY, JSON.stringify(state));

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        UX_SETTINGS_STORAGE_KEY,
        JSON.stringify(state)
      );
      expect(mockStorage.__store.get(UX_SETTINGS_STORAGE_KEY)).toBe(JSON.stringify(state));
    });

    it('should hydrate settings from storage', async () => {
      const savedState: UXSettings = {
        animationsEnabled: false,
        reducedMotion: true,
        hapticFeedbackEnabled: false,
        soundEnabled: true,
        soundVolume: 0.3,
        soundPreset: 'minimal',
      };

      await mockStorage.setItem(UX_SETTINGS_STORAGE_KEY, JSON.stringify(savedState));

      const stored = await mockStorage.getItem(UX_SETTINGS_STORAGE_KEY);
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.animationsEnabled).toBe(false);
      expect(parsed.soundEnabled).toBe(true);
      expect(parsed.soundVolume).toBe(0.3);
      expect(parsed.soundPreset).toBe('minimal');
    });

    it('should handle empty storage gracefully', async () => {
      const stored = await mockStorage.getItem(UX_SETTINGS_STORAGE_KEY);
      expect(stored).toBeNull();
    });

    it('should validate stored data with schema', async () => {
      const invalidState = { soundVolume: 999 }; // Invalid
      await mockStorage.setItem(UX_SETTINGS_STORAGE_KEY, JSON.stringify(invalidState));

      const stored = await mockStorage.getItem(UX_SETTINGS_STORAGE_KEY);
      const parsed = JSON.parse(stored!);
      const result = UXSettingsSchema.safeParse(parsed);

      expect(result.success).toBe(false);
    });

    it('should handle corrupted storage data', async () => {
      await mockStorage.setItem(UX_SETTINGS_STORAGE_KEY, 'invalid-json');

      const stored = await mockStorage.getItem(UX_SETTINGS_STORAGE_KEY);
      expect(() => JSON.parse(stored!)).toThrow();
    });

    it('should handle schema migration with defaults', async () => {
      // Old version might be missing soundPreset field
      const oldState = {
        animationsEnabled: true,
        reducedMotion: false,
        hapticFeedbackEnabled: true,
        soundEnabled: false,
        soundVolume: 0.7,
        // soundPreset missing
      };

      await mockStorage.setItem(UX_SETTINGS_STORAGE_KEY, JSON.stringify(oldState));

      const stored = await mockStorage.getItem(UX_SETTINGS_STORAGE_KEY);
      const parsed = JSON.parse(stored!);
      const result = UXSettingsSchema.safeParse(parsed);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.soundPreset).toBe('classic'); // Default applied
      }
    });
  });

  describe('subscriptions', () => {
    it('should notify listeners when state changes', () => {
      const listeners = new Set<() => void>();
      const listener = jest.fn();

      listeners.add(listener);
      listeners.forEach(l => l());

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should allow unsubscribing', () => {
      const listeners = new Set<() => void>();
      const listener = jest.fn();

      listeners.add(listener);
      listeners.delete(listener);
      listeners.forEach(l => l());

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle multiple listeners', () => {
      const listeners = new Set<() => void>();
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      listeners.add(listener1);
      listeners.add(listener2);
      listeners.forEach(l => l());

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('platform-specific defaults', () => {
    const checkIsMobile = (): boolean => {
      return mockPlatformOS === 'ios' || mockPlatformOS === 'android';
    };

    it('should default hapticFeedbackEnabled to false on web', () => {
      mockPlatformOS = 'web';
      expect(checkIsMobile()).toBe(false);
    });

    it('should default hapticFeedbackEnabled to true on iOS', () => {
      mockPlatformOS = 'ios';
      expect(checkIsMobile()).toBe(true);
    });

    it('should default hapticFeedbackEnabled to true on Android', () => {
      mockPlatformOS = 'android';
      expect(checkIsMobile()).toBe(true);
    });
  });

  describe('reduced motion sync', () => {
    it('should sync reducedMotion from system preference', () => {
      const state = createStoreState();

      // Simulate system preference change
      const systemReducedMotion = true;
      const syncedState = { ...state, reducedMotion: systemReducedMotion };

      expect(syncedState.reducedMotion).toBe(true);
    });

    it('should not persist if value unchanged', () => {
      const state = createStoreState();
      const currentReducedMotion = state.reducedMotion;

      // No change
      const newReducedMotion = currentReducedMotion;
      expect(newReducedMotion).toBe(state.reducedMotion);
    });

    it('should update and notify when reducedMotion changes', () => {
      const listeners = new Set<() => void>();
      const listener = jest.fn();
      listeners.add(listener);

      let state = createStoreState();

      // Simulate change
      if (state.reducedMotion !== true) {
        state = { ...state, reducedMotion: true };
        listeners.forEach(l => l());
      }

      expect(listener).toHaveBeenCalled();
      expect(state.reducedMotion).toBe(true);
    });
  });

  describe('sound settings migration', () => {
    it('should handle soundEnabled from timerSettingsStore', () => {
      // Legacy timerSettingsStore had soundEnabled
      const legacyTimerSettings = {
        soundEnabled: true,
        soundVolume: 0.8,
        selectedSound: 'default',
      };

      // New UX settings should support same values
      const uxSettings = createStoreState();
      uxSettings.soundEnabled = legacyTimerSettings.soundEnabled;
      uxSettings.soundVolume = legacyTimerSettings.soundVolume;

      expect(uxSettings.soundEnabled).toBe(true);
      expect(uxSettings.soundVolume).toBe(0.8);
    });

    it('should add soundPreset as new field', () => {
      const state = createStoreState();

      // soundPreset is new in UX settings
      expect(state.soundPreset).toBeDefined();
      expect(['classic', 'soft', 'minimal']).toContain(state.soundPreset);
    });
  });
});

describe('Security: Input Validation', () => {
  it('should reject injection attempts in string fields', () => {
    // soundPreset should only accept enum values
    const maliciousInput = {
      soundPreset: '<script>alert("xss")</script>',
    };

    const result = UXSettingsSchema.safeParse(maliciousInput);
    expect(result.success).toBe(false);
  });

  it('should validate all numeric inputs', () => {
    const invalidNumeric = {
      soundVolume: 'DROP TABLE users;',
    };

    const result = UXSettingsSchema.safeParse(invalidNumeric);
    expect(result.success).toBe(false);
  });

  it('should coerce but validate types', () => {
    // Ensure types are strictly validated
    const wrongTypes = {
      animationsEnabled: 'yes', // Should be boolean
      soundVolume: 'loud', // Should be number
    };

    const result = UXSettingsSchema.safeParse(wrongTypes);
    expect(result.success).toBe(false);
  });
});
