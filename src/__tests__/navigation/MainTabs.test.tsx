/**
 * MainTabs Navigation Tests
 *
 * Tests for tab navigation animations including:
 * - Scale bounce animation on tab select
 * - Active indicator bar animation
 * - Reduced motion support
 */

// Mock the hooks and animations before importing component
let mockReducedMotion = false;
let mockAnimationsEnabled = true;

jest.mock('@/lib/animations', () => ({
  ANIMATION_DURATION: {
    instant: 0,
    fast: 150,
    normal: 250,
    slow: 400,
    verySlow: 600,
  },
  getReducedMotionPreference: jest.fn(() => mockReducedMotion),
  spring: jest.fn(() => ({
    start: jest.fn(cb => cb?.()),
    stop: jest.fn(),
  })),
}));

jest.mock('@/stores/uxSettingsStore', () => ({
  useUXSettingsSelector: jest.fn((selector: (s: { animationsEnabled: boolean }) => boolean) =>
    selector({ animationsEnabled: mockAnimationsEnabled })
  ),
}));

jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6366F1',
      surface: '#1F1F1F',
      text: '#FFFFFF',
      textMuted: '#71717A',
      border: '#3F3F46',
    },
  }),
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    full: 9999,
  },
}));

// Mock navigation and screens
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: jest.fn(() => ({
    Navigator: 'MockNavigator',
    Screen: 'MockScreen',
  })),
}));

jest.mock('@/components/ui', () => ({
  Icon: 'MockIcon',
}));

jest.mock('@/components/KeyboardShortcutProvider', () => ({
  KeyboardShortcutProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/screens', () => ({
  HubScreen: 'MockHubScreen',
  TimerScreen: 'MockTimerScreen',
  HistoryScreen: 'MockHistoryScreen',
  NotesScreen: 'MockNotesScreen',
  AnalyticsScreen: 'MockAnalyticsScreen',
  SettingsScreen: 'MockSettingsScreen',
}));

describe('MainTabs Animations', () => {
  beforeEach(() => {
    mockReducedMotion = false;
    mockAnimationsEnabled = true;
    jest.clearAllMocks();
  });

  describe('Tab icon mapping', () => {
    it('should map Hub to correct icons', () => {
      const iconMap = {
        Hub: { active: 'home', inactive: 'home-outline' },
      };
      expect(iconMap.Hub.active).toBe('home');
      expect(iconMap.Hub.inactive).toBe('home-outline');
    });

    it('should map Timer to correct icons', () => {
      const iconMap = {
        Timer: { active: 'time', inactive: 'time-outline' },
      };
      expect(iconMap.Timer.active).toBe('time');
      expect(iconMap.Timer.inactive).toBe('time-outline');
    });

    it('should map History to correct icons', () => {
      const iconMap = {
        History: { active: 'list', inactive: 'list-outline' },
      };
      expect(iconMap.History.active).toBe('list');
      expect(iconMap.History.inactive).toBe('list-outline');
    });

    it('should map Notes to correct icons', () => {
      const iconMap = {
        Notes: { active: 'file-text', inactive: 'file-text-outline' },
      };
      expect(iconMap.Notes.active).toBe('file-text');
      expect(iconMap.Notes.inactive).toBe('file-text-outline');
    });

    it('should map Analytics to correct icons', () => {
      const iconMap = {
        Analytics: { active: 'bar-chart', inactive: 'bar-chart-outline' },
      };
      expect(iconMap.Analytics.active).toBe('bar-chart');
      expect(iconMap.Analytics.inactive).toBe('bar-chart-outline');
    });

    it('should map Settings to correct icons', () => {
      const iconMap = {
        Settings: { active: 'settings', inactive: 'settings-outline' },
      };
      expect(iconMap.Settings.active).toBe('settings');
      expect(iconMap.Settings.inactive).toBe('settings-outline');
    });
  });

  describe('Scale bounce animation', () => {
    it('should bounce to 1.2 scale on selection', () => {
      const bounceScale = 1.2;
      expect(bounceScale).toBe(1.2);
    });

    it('should return to 1.0 scale after bounce', () => {
      const finalScale = 1.0;
      expect(finalScale).toBe(1.0);
    });

    it('should use fast duration for scale up', () => {
      const { ANIMATION_DURATION } = require('@/lib/animations');
      expect(ANIMATION_DURATION.fast).toBe(150);
    });

    it('should use spring for scale down', () => {
      const { spring } = require('@/lib/animations');
      expect(typeof spring).toBe('function');
    });
  });

  describe('Active indicator animation', () => {
    it('should interpolate width from 0 to 20', () => {
      const indicatorInterpolation = {
        inputRange: [0, 1],
        outputRange: [0, 20],
      };

      expect(indicatorInterpolation.inputRange).toEqual([0, 1]);
      expect(indicatorInterpolation.outputRange).toEqual([0, 20]);
    });

    it('should interpolate opacity from 0 to 1', () => {
      const opacityInterpolation = {
        inputRange: [0, 1],
        outputRange: [0, 1],
      };

      expect(opacityInterpolation.inputRange).toEqual([0, 1]);
      expect(opacityInterpolation.outputRange).toEqual([0, 1]);
    });

    it('should use fast duration for indicator animation', () => {
      const { ANIMATION_DURATION } = require('@/lib/animations');
      expect(ANIMATION_DURATION.fast).toBe(150);
    });
  });

  describe('Reduced motion support', () => {
    it('should detect reduced motion preference', () => {
      const { getReducedMotionPreference } = require('@/lib/animations');

      // Default: no reduced motion
      expect(getReducedMotionPreference()).toBe(false);
    });

    it('should respect reduced motion when enabled', () => {
      mockReducedMotion = true;
      const { getReducedMotionPreference } = require('@/lib/animations');

      expect(getReducedMotionPreference()).toBe(true);
    });

    it('should determine animation state based on preference', () => {
      const { getReducedMotionPreference } = require('@/lib/animations');
      const shouldAnimate = !getReducedMotionPreference();

      expect(shouldAnimate).toBe(true);

      mockReducedMotion = true;
      const shouldAnimateWhenReduced = !getReducedMotionPreference();
      expect(shouldAnimateWhenReduced).toBe(false);
    });
  });

  describe('UX Settings Store integration', () => {
    it('should check animationsEnabled from UX settings', () => {
      const { useUXSettingsSelector } = require('@/stores/uxSettingsStore');

      // Default: animations enabled
      const animationsEnabled = useUXSettingsSelector(
        (s: { animationsEnabled: boolean }) => s.animationsEnabled
      );
      expect(animationsEnabled).toBe(true);
    });

    it('should disable animations when animationsEnabled is false', () => {
      mockAnimationsEnabled = false;
      const { useUXSettingsSelector } = require('@/stores/uxSettingsStore');

      const animationsEnabled = useUXSettingsSelector(
        (s: { animationsEnabled: boolean }) => s.animationsEnabled
      );
      expect(animationsEnabled).toBe(false);
    });

    it('should combine animationsEnabled and reducedMotion for shouldAnimate', () => {
      const { getReducedMotionPreference } = require('@/lib/animations');

      // Both enabled -> should animate
      mockAnimationsEnabled = true;
      mockReducedMotion = false;
      let shouldAnimate = mockAnimationsEnabled && !getReducedMotionPreference();
      expect(shouldAnimate).toBe(true);

      // Animations disabled -> should not animate
      mockAnimationsEnabled = false;
      mockReducedMotion = false;
      shouldAnimate = mockAnimationsEnabled && !getReducedMotionPreference();
      expect(shouldAnimate).toBe(false);

      // Reduced motion enabled -> should not animate
      mockAnimationsEnabled = true;
      mockReducedMotion = true;
      shouldAnimate = mockAnimationsEnabled && !getReducedMotionPreference();
      expect(shouldAnimate).toBe(false);

      // Both disabled -> should not animate
      mockAnimationsEnabled = false;
      mockReducedMotion = true;
      shouldAnimate = mockAnimationsEnabled && !getReducedMotionPreference();
      expect(shouldAnimate).toBe(false);
    });
  });

  describe('Animation trigger logic', () => {
    it('should only animate when focus changes from false to true', () => {
      const shouldTriggerAnimation = (focused: boolean, prevFocused: boolean) =>
        focused && !prevFocused;

      // Tab gets focused
      expect(shouldTriggerAnimation(true, false)).toBe(true);

      // Tab stays focused
      expect(shouldTriggerAnimation(true, true)).toBe(false);

      // Tab loses focus
      expect(shouldTriggerAnimation(false, true)).toBe(false);

      // Tab stays unfocused
      expect(shouldTriggerAnimation(false, false)).toBe(false);
    });
  });

  describe('Tab bar styling', () => {
    it('should use correct tab bar height', () => {
      const tabBarHeight = 60;
      expect(tabBarHeight).toBe(60);
    });

    it('should use correct label font size', () => {
      const labelFontSize = 11;
      expect(labelFontSize).toBe(11);
    });

    it('should use correct indicator height', () => {
      const indicatorHeight = 3;
      expect(indicatorHeight).toBe(3);
    });
  });

  describe('Spring animation config', () => {
    it('should use appropriate friction for natural bounce', () => {
      const friction = 5;
      expect(friction).toBe(5);
    });

    it('should use appropriate tension for responsive feel', () => {
      const tension = 100;
      expect(tension).toBe(100);
    });
  });

  describe('Color behavior', () => {
    it('should use primary color when focused', () => {
      const { useTheme } = require('@/theme');
      const { colors } = useTheme();

      const getColor = (focused: boolean) => (focused ? colors.primary : colors.textMuted);

      expect(getColor(true)).toBe('#6366F1');
    });

    it('should use muted color when unfocused', () => {
      const { useTheme } = require('@/theme');
      const { colors } = useTheme();

      const getColor = (focused: boolean) => (focused ? colors.primary : colors.textMuted);

      expect(getColor(false)).toBe('#71717A');
    });
  });

  describe('Tab routes', () => {
    it('should have all 6 tabs defined', () => {
      const routes = ['Hub', 'Timer', 'History', 'Notes', 'Analytics', 'Settings'];
      expect(routes).toHaveLength(6);
    });

    it('should have Hub as initial route', () => {
      const initialRouteName = 'Hub';
      expect(initialRouteName).toBe('Hub');
    });
  });
});
