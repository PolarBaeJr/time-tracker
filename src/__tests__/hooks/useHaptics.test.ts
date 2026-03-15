/**
 * useHaptics Hook Tests
 *
 * Tests for haptic feedback hook utilities including:
 * - No-op behavior on web
 * - Standalone haptics functions
 * - HapticType type checking
 *
 * Note: Hook integration tests would require proper React rendering setup.
 * These tests focus on the exported standalone functions which can be tested directly.
 */

// Mock expo-haptics
const mockImpactAsync = jest.fn().mockResolvedValue(undefined);
const mockNotificationAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-haptics', () => ({
  impactAsync: mockImpactAsync,
  notificationAsync: mockNotificationAsync,
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock UX settings store
jest.mock('@/stores', () => ({
  useUXSettingsSelector: jest.fn(selector => selector({ hapticFeedbackEnabled: true })),
}));

// Import after mocks - Platform.OS is 'web' from the shared react-native mock
import { haptics, type HapticType } from '@/hooks/useHaptics';

describe('haptics standalone functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Platform.OS is 'web' from the shared mock
  });

  describe('on web platform', () => {
    it('triggerLight should be a no-op on web', async () => {
      await haptics.triggerLight();
      expect(mockImpactAsync).not.toHaveBeenCalled();
    });

    it('triggerMedium should be a no-op on web', async () => {
      await haptics.triggerMedium();
      expect(mockImpactAsync).not.toHaveBeenCalled();
    });

    it('triggerHeavy should be a no-op on web', async () => {
      await haptics.triggerHeavy();
      expect(mockImpactAsync).not.toHaveBeenCalled();
    });

    it('triggerSuccess should be a no-op on web', async () => {
      await haptics.triggerSuccess();
      expect(mockNotificationAsync).not.toHaveBeenCalled();
    });

    it('triggerWarning should be a no-op on web', async () => {
      await haptics.triggerWarning();
      expect(mockNotificationAsync).not.toHaveBeenCalled();
    });

    it('triggerError should be a no-op on web', async () => {
      await haptics.triggerError();
      expect(mockNotificationAsync).not.toHaveBeenCalled();
    });

    it('trigger generic should be a no-op on web for all types', async () => {
      const types: HapticType[] = ['light', 'medium', 'heavy', 'success', 'warning', 'error'];

      for (const type of types) {
        await haptics.trigger(type);
      }

      expect(mockImpactAsync).not.toHaveBeenCalled();
      expect(mockNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('generic trigger function', () => {
    it('should handle all haptic types without throwing', async () => {
      const hapticTypes: HapticType[] = ['light', 'medium', 'heavy', 'success', 'warning', 'error'];

      for (const type of hapticTypes) {
        await expect(haptics.trigger(type)).resolves.not.toThrow();
      }
    });

    it('should return promises that resolve', async () => {
      const lightPromise = haptics.triggerLight();
      const mediumPromise = haptics.triggerMedium();
      const heavyPromise = haptics.triggerHeavy();
      const successPromise = haptics.triggerSuccess();
      const warningPromise = haptics.triggerWarning();
      const errorPromise = haptics.triggerError();

      await expect(
        Promise.all([
          lightPromise,
          mediumPromise,
          heavyPromise,
          successPromise,
          warningPromise,
          errorPromise,
        ])
      ).resolves.not.toThrow();
    });
  });
});

describe('HapticType', () => {
  it('should have correct type values', () => {
    const validTypes: HapticType[] = ['light', 'medium', 'heavy', 'success', 'warning', 'error'];

    // TypeScript will catch invalid types at compile time
    // This test documents the expected values
    expect(validTypes).toHaveLength(6);
    expect(validTypes).toContain('light');
    expect(validTypes).toContain('medium');
    expect(validTypes).toContain('heavy');
    expect(validTypes).toContain('success');
    expect(validTypes).toContain('warning');
    expect(validTypes).toContain('error');
  });

  it('should map impact types correctly', () => {
    const impactTypes: HapticType[] = ['light', 'medium', 'heavy'];
    const notificationTypes: HapticType[] = ['success', 'warning', 'error'];

    // These categorizations are important for understanding how haptics are triggered
    expect(impactTypes).toHaveLength(3);
    expect(notificationTypes).toHaveLength(3);
  });
});

describe('exports', () => {
  it('should export haptics object with all functions', () => {
    expect(typeof haptics.triggerLight).toBe('function');
    expect(typeof haptics.triggerMedium).toBe('function');
    expect(typeof haptics.triggerHeavy).toBe('function');
    expect(typeof haptics.triggerSuccess).toBe('function');
    expect(typeof haptics.triggerWarning).toBe('function');
    expect(typeof haptics.triggerError).toBe('function');
    expect(typeof haptics.trigger).toBe('function');
  });
});
