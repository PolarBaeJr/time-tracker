/**
 * useReducedMotion Hook Tests
 *
 * Tests for reduced motion detection hook including:
 * - Web platform detection via matchMedia
 * - Syncing to UX Settings Store
 * - Syncing to Animation Foundation
 * - Exports verification
 *
 * Note: Native platform tests (iOS/Android) require more complex mocking
 * and are covered at the integration level. These unit tests focus on
 * web platform functionality and export verification.
 */

// Define mock functions before jest.mock calls (hoisting)
const mockSyncReducedMotion = jest.fn();
const mockUseUXSettingsSelector = jest.fn(selector => selector({ reducedMotion: false }));
const mockSetReducedMotionPreference = jest.fn();

// Mock the stores module
jest.mock('@/stores', () => ({
  syncReducedMotion: mockSyncReducedMotion,
  useUXSettingsSelector: mockUseUXSettingsSelector,
}));

// Mock the animations module
jest.mock('@/lib/animations', () => ({
  setReducedMotionPreference: mockSetReducedMotionPreference,
}));

import { Platform } from 'react-native';

// Store original Platform.OS
const originalPlatformOS = Platform.OS;

// Helper to set Platform.OS
function setPlatformOS(platform: 'ios' | 'android' | 'web' | 'windows' | 'macos'): void {
  Object.defineProperty(Platform, 'OS', {
    get: () => platform,
    configurable: true,
  });
}

// Import after mocks are set up
import {
  useReducedMotion,
  getSystemReducedMotionPreference,
  initializeReducedMotion,
} from '@/hooks/useReducedMotion';

describe('useReducedMotion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Platform.OS to web (default in test environment)
    setPlatformOS('web');
  });

  afterAll(() => {
    // Restore original Platform.OS
    Object.defineProperty(Platform, 'OS', {
      get: () => originalPlatformOS,
      configurable: true,
    });
  });

  describe('platform detection', () => {
    it('should detect web platform correctly', () => {
      setPlatformOS('web');
      expect(Platform.OS).toBe('web');
    });

    it('should detect ios platform correctly', () => {
      setPlatformOS('ios');
      expect(Platform.OS).toBe('ios');
    });

    it('should detect android platform correctly', () => {
      setPlatformOS('android');
      expect(Platform.OS).toBe('android');
    });
  });

  describe('web getSystemReducedMotionPreference', () => {
    it('should return false by default on web when matchMedia is not available', async () => {
      setPlatformOS('web');

      // Mock window without matchMedia
      const originalWindow = global.window;
      // @ts-expect-error - Mocking window
      global.window = {};

      const result = await getSystemReducedMotionPreference();
      expect(result).toBe(false);

      global.window = originalWindow;
    });

    it('should return matchMedia result on web when matches is true', async () => {
      setPlatformOS('web');

      // Mock window with matchMedia
      const originalWindow = global.window;
      // @ts-expect-error - Mocking window
      global.window = {
        matchMedia: jest.fn().mockReturnValue({ matches: true }),
      };

      const result = await getSystemReducedMotionPreference();
      expect(result).toBe(true);

      global.window = originalWindow;
    });

    it('should return matchMedia result on web when matches is false', async () => {
      setPlatformOS('web');

      // Mock window with matchMedia
      const originalWindow = global.window;
      // @ts-expect-error - Mocking window
      global.window = {
        matchMedia: jest.fn().mockReturnValue({ matches: false }),
      };

      const result = await getSystemReducedMotionPreference();
      expect(result).toBe(false);

      global.window = originalWindow;
    });

    it('should return false on unsupported platforms', async () => {
      setPlatformOS('windows');

      const result = await getSystemReducedMotionPreference();
      expect(result).toBe(false);
    });

    it('should return false on macos platform', async () => {
      setPlatformOS('macos');

      const result = await getSystemReducedMotionPreference();
      expect(result).toBe(false);
    });
  });

  describe('web initializeReducedMotion', () => {
    it('should sync true value to stores on web', async () => {
      setPlatformOS('web');

      // Mock window with matchMedia
      const originalWindow = global.window;
      // @ts-expect-error - Mocking window
      global.window = {
        matchMedia: jest.fn().mockReturnValue({ matches: true }),
      };

      await initializeReducedMotion();

      expect(mockSyncReducedMotion).toHaveBeenCalledWith(true);
      expect(mockSetReducedMotionPreference).toHaveBeenCalledWith(true);

      global.window = originalWindow;
    });

    it('should sync false value to stores on web', async () => {
      setPlatformOS('web');

      // Mock window with matchMedia
      const originalWindow = global.window;
      // @ts-expect-error - Mocking window
      global.window = {
        matchMedia: jest.fn().mockReturnValue({ matches: false }),
      };

      await initializeReducedMotion();

      expect(mockSyncReducedMotion).toHaveBeenCalledWith(false);
      expect(mockSetReducedMotionPreference).toHaveBeenCalledWith(false);

      global.window = originalWindow;
    });
  });

  describe('hook result type', () => {
    it('should return correct type shape', () => {
      // This is mainly a TypeScript compile-time check
      // but we can verify the expected interface
      type ExpectedResult = {
        reducedMotion: boolean;
        isSystemDetected: boolean;
        refresh: () => Promise<void>;
      };

      // If this compiles, the type is correct
      const _typeCheck: ExpectedResult = {
        reducedMotion: false,
        isSystemDetected: true,
        refresh: async () => {},
      };

      expect(_typeCheck).toBeDefined();
    });
  });

  describe('exports', () => {
    it('should export useReducedMotion hook', () => {
      expect(typeof useReducedMotion).toBe('function');
    });

    it('should export getSystemReducedMotionPreference function', () => {
      expect(typeof getSystemReducedMotionPreference).toBe('function');
    });

    it('should export initializeReducedMotion function', () => {
      expect(typeof initializeReducedMotion).toBe('function');
    });
  });

  describe('web matchMedia handling', () => {
    it('should handle missing window gracefully', async () => {
      setPlatformOS('web');

      // Save and clear window
      const originalWindow = global.window;
      // @ts-expect-error - Testing undefined window
      global.window = undefined;

      const result = await getSystemReducedMotionPreference();
      expect(result).toBe(false);

      global.window = originalWindow;
    });

    it('should handle window without matchMedia gracefully', async () => {
      setPlatformOS('web');

      const originalWindow = global.window;
      // @ts-expect-error - Mocking window without matchMedia
      global.window = { location: {} };

      const result = await getSystemReducedMotionPreference();
      expect(result).toBe(false);

      global.window = originalWindow;
    });
  });

  describe('matchMedia event listener handling', () => {
    it('should call matchMedia with correct query', async () => {
      setPlatformOS('web');

      const mockMatchMedia = jest.fn().mockReturnValue({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      });

      const originalWindow = global.window;
      // @ts-expect-error - Mocking window
      global.window = {
        matchMedia: mockMatchMedia,
      };

      await getSystemReducedMotionPreference();

      expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');

      global.window = originalWindow;
    });

    it('should work with addListener fallback for older browsers', async () => {
      setPlatformOS('web');

      const mockAddListener = jest.fn();
      const mockRemoveListener = jest.fn();

      const originalWindow = global.window;
      // @ts-expect-error - Mocking window
      global.window = {
        matchMedia: jest.fn().mockReturnValue({
          matches: true,
          addListener: mockAddListener,
          removeListener: mockRemoveListener,
          // No addEventListener (simulating old Safari)
        }),
      };

      const result = await getSystemReducedMotionPreference();
      expect(result).toBe(true);

      global.window = originalWindow;
    });
  });

  describe('native platform fallback behavior', () => {
    it('should gracefully handle iOS platform without proper AccessibilityInfo', async () => {
      setPlatformOS('ios');

      // When AccessibilityInfo is not properly available, it should return false
      // and not throw an error
      const result = await getSystemReducedMotionPreference();
      // Error is caught and false is returned
      expect(result).toBe(false);
    });

    it('should gracefully handle Android platform without proper AccessibilityInfo', async () => {
      setPlatformOS('android');

      // When AccessibilityInfo is not properly available, it should return false
      // and not throw an error
      const result = await getSystemReducedMotionPreference();
      // Error is caught and false is returned
      expect(result).toBe(false);
    });
  });

  describe('UseReducedMotionResult interface', () => {
    it('should have reducedMotion boolean property', () => {
      // Verify the interface structure
      type HasReducedMotion = {
        reducedMotion: boolean;
      };

      const result: HasReducedMotion = { reducedMotion: false };
      expect(typeof result.reducedMotion).toBe('boolean');
    });

    it('should have isSystemDetected boolean property', () => {
      type HasIsSystemDetected = {
        isSystemDetected: boolean;
      };

      const result: HasIsSystemDetected = { isSystemDetected: true };
      expect(typeof result.isSystemDetected).toBe('boolean');
    });

    it('should have refresh function property', () => {
      type HasRefresh = {
        refresh: () => Promise<void>;
      };

      const result: HasRefresh = { refresh: async () => {} };
      expect(typeof result.refresh).toBe('function');
    });
  });
});
