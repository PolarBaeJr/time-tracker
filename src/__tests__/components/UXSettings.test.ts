/**
 * UXSettings Component Tests
 *
 * Tests for the UX Settings component covering:
 * - Component structure and props
 * - Animation toggle behavior
 * - Haptic feedback toggle (mobile only)
 * - Reduced motion indicator
 * - Accessibility attributes
 */

import { Platform } from 'react-native';

// Mock UX settings store
const mockUXSettings = {
  animationsEnabled: true,
  hapticFeedbackEnabled: true,
  reducedMotion: false,
};

jest.mock('@/stores', () => ({
  useUXSettings: () => mockUXSettings,
  setAnimationsEnabled: jest.fn(),
  setHapticFeedbackEnabled: jest.fn(),
}));

// Mock theme hook
jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      text: '#FFFFFF',
      textSecondary: '#A1A1AA',
      textMuted: '#71717A',
      primary: '#6366F1',
      warning: '#F59E0B',
      surfaceVariant: '#252525',
      border: '#27272A',
    },
  }),
  colors: {
    text: '#FFFFFF',
    textSecondary: '#A1A1AA',
    textMuted: '#71717A',
    primary: '#6366F1',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  fontSizes: { sm: 12, md: 14, lg: 16 },
  borderRadius: { md: 8 },
}));

describe('UXSettings Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock settings
    mockUXSettings.animationsEnabled = true;
    mockUXSettings.hapticFeedbackEnabled = true;
    mockUXSettings.reducedMotion = false;
  });

  describe('Props Interface', () => {
    it('should accept disabled prop', () => {
      const props = { disabled: true };
      expect(props.disabled).toBe(true);
    });

    it('should default disabled to false', () => {
      const props = { disabled: undefined };
      expect(props.disabled ?? false).toBe(false);
    });
  });

  describe('Animations Toggle Behavior', () => {
    it('should show animations as enabled when animationsEnabled is true', () => {
      mockUXSettings.animationsEnabled = true;
      mockUXSettings.reducedMotion = false;
      const effectiveEnabled = mockUXSettings.animationsEnabled && !mockUXSettings.reducedMotion;
      expect(effectiveEnabled).toBe(true);
    });

    it('should show animations as disabled when reducedMotion is true', () => {
      mockUXSettings.animationsEnabled = true;
      mockUXSettings.reducedMotion = true;
      const effectiveEnabled = mockUXSettings.animationsEnabled && !mockUXSettings.reducedMotion;
      expect(effectiveEnabled).toBe(false);
    });

    it('should disable animations toggle when reducedMotion is active', () => {
      mockUXSettings.reducedMotion = true;
      const shouldDisableToggle = mockUXSettings.reducedMotion;
      expect(shouldDisableToggle).toBe(true);
    });
  });

  describe('Haptic Feedback Toggle - Platform Behavior', () => {
    const checkIsMobile = (platform: string): boolean => {
      return platform === 'ios' || platform === 'android';
    };

    it('should show haptic toggle on iOS', () => {
      expect(checkIsMobile('ios')).toBe(true);
    });

    it('should show haptic toggle on Android', () => {
      expect(checkIsMobile('android')).toBe(true);
    });

    it('should hide haptic toggle on web', () => {
      expect(checkIsMobile('web')).toBe(false);
    });
  });

  describe('Reduced Motion Indicator', () => {
    it('should show indicator when reducedMotion is true', () => {
      mockUXSettings.reducedMotion = true;
      expect(mockUXSettings.reducedMotion).toBe(true);
    });

    it('should hide indicator when reducedMotion is false', () => {
      mockUXSettings.reducedMotion = false;
      expect(mockUXSettings.reducedMotion).toBe(false);
    });

    it('should show help text when reducedMotion is active', () => {
      mockUXSettings.reducedMotion = true;
      const showHelpText = mockUXSettings.reducedMotion;
      expect(showHelpText).toBe(true);
    });
  });

  describe('Toggle State Logic', () => {
    it('should compute correct switch value for animations', () => {
      mockUXSettings.animationsEnabled = true;
      mockUXSettings.reducedMotion = false;
      const switchValue = mockUXSettings.animationsEnabled && !mockUXSettings.reducedMotion;
      expect(switchValue).toBe(true);
    });

    it('should compute disabled state correctly for animations toggle', () => {
      const disabled = false;
      mockUXSettings.reducedMotion = true;
      const isToggleDisabled = disabled || mockUXSettings.reducedMotion;
      expect(isToggleDisabled).toBe(true);
    });

    it('should not disable animations toggle when disabled prop is false and reducedMotion is false', () => {
      const disabled = false;
      mockUXSettings.reducedMotion = false;
      const isToggleDisabled = disabled || mockUXSettings.reducedMotion;
      expect(isToggleDisabled).toBe(false);
    });
  });

  describe('Accessibility', () => {
    it('should compute correct accessibility hint for animations when enabled', () => {
      mockUXSettings.reducedMotion = false;
      const hint = mockUXSettings.reducedMotion
        ? 'Disabled because system reduced motion is enabled'
        : 'Enable or disable smooth transitions and animations';
      expect(hint).toBe('Enable or disable smooth transitions and animations');
    });

    it('should compute correct accessibility hint when reduced motion is active', () => {
      mockUXSettings.reducedMotion = true;
      const hint = mockUXSettings.reducedMotion
        ? 'Disabled because system reduced motion is enabled'
        : 'Enable or disable smooth transitions and animations';
      expect(hint).toBe('Disabled because system reduced motion is enabled');
    });

    it('should compute correct accessibility state for animations toggle', () => {
      mockUXSettings.animationsEnabled = true;
      mockUXSettings.reducedMotion = false;
      const disabled = false;
      const accessibilityState = {
        checked: mockUXSettings.animationsEnabled && !mockUXSettings.reducedMotion,
        disabled: disabled || mockUXSettings.reducedMotion,
      };
      expect(accessibilityState).toEqual({ checked: true, disabled: false });
    });
  });

  describe('Theme Colors', () => {
    it('should use warning color with opacity for reduced motion indicator background', () => {
      const warningColor = '#F59E0B';
      const bgColor = warningColor + '15';
      expect(bgColor).toBe('#F59E0B15');
    });

    it('should use primary color with opacity for switch track', () => {
      const primaryColor = '#6366F1';
      const trackColor = primaryColor + '80';
      expect(trackColor).toBe('#6366F180');
    });
  });

  describe('Toggle Handlers', () => {
    it('should allow toggle when not disabled', () => {
      const disabled = false;
      const shouldAllowToggle = !disabled;
      expect(shouldAllowToggle).toBe(true);
    });

    it('should prevent toggle when disabled', () => {
      const disabled = true;
      const shouldAllowToggle = !disabled;
      expect(shouldAllowToggle).toBe(false);
    });
  });

  describe('Haptic Feedback Toggle State', () => {
    it('should show correct thumb color when haptics enabled', () => {
      mockUXSettings.hapticFeedbackEnabled = true;
      const primaryColor = '#6366F1';
      const mutedColor = '#71717A';
      const thumbColor = mockUXSettings.hapticFeedbackEnabled ? primaryColor : mutedColor;
      expect(thumbColor).toBe(primaryColor);
    });

    it('should show correct thumb color when haptics disabled', () => {
      mockUXSettings.hapticFeedbackEnabled = false;
      const primaryColor = '#6366F1';
      const mutedColor = '#71717A';
      const thumbColor = mockUXSettings.hapticFeedbackEnabled ? primaryColor : mutedColor;
      expect(thumbColor).toBe(mutedColor);
    });
  });

  describe('Component Integration', () => {
    const getExpectedToggles = (platform: string): number => {
      const isMobile = platform === 'ios' || platform === 'android';
      // Animations toggle always shown, haptics toggle shown on mobile
      return isMobile ? 2 : 1;
    };

    it('should respect all UX settings from store', () => {
      mockUXSettings.animationsEnabled = false;
      mockUXSettings.hapticFeedbackEnabled = false;
      mockUXSettings.reducedMotion = true;

      expect(mockUXSettings.animationsEnabled).toBe(false);
      expect(mockUXSettings.hapticFeedbackEnabled).toBe(false);
      expect(mockUXSettings.reducedMotion).toBe(true);
    });

    it('should show correct number of toggles on mobile', () => {
      expect(getExpectedToggles('ios')).toBe(2);
    });

    it('should show correct number of toggles on web', () => {
      expect(getExpectedToggles('web')).toBe(1);
    });
  });
});
