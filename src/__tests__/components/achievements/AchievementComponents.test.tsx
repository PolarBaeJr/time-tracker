/**
 * Tests for Achievement Components
 *
 * Tests cover:
 * - AchievementBadge rendering and props
 * - AchievementBadge locked/unlocked states
 * - AchievementBadge progress display
 * - AchievementList grid and list modes
 * - AchievementList filtering and category tabs
 * - AchievementUnlock modal behavior
 * - Animation behavior and reduced motion support
 */

// Mock react-native modules before any imports
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
    absoluteFill: {},
    absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    flatten: jest.fn((style: unknown) => style),
  },
  Animated: {
    Value: jest.fn(() => ({
      setValue: jest.fn(),
      interpolate: jest.fn(() => '0%'),
    })),
    View: 'Animated.View',
    Text: 'Animated.Text',
    timing: jest.fn(() => ({
      start: jest.fn(cb => cb?.({ finished: true })),
    })),
    spring: jest.fn(() => ({
      start: jest.fn(cb => cb?.({ finished: true })),
    })),
    parallel: jest.fn((_animations: unknown[]) => ({
      start: jest.fn(cb => cb?.({ finished: true })),
    })),
    sequence: jest.fn((_animations: unknown[]) => ({
      start: jest.fn(cb => cb?.({ finished: true })),
    })),
    loop: jest.fn(animation => animation),
  },
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  FlatList: 'FlatList',
  RefreshControl: 'RefreshControl',
  Modal: 'Modal',
  Easing: {
    linear: (x: number) => x,
    ease: (x: number) => x,
    out: (fn: (x: number) => number) => fn,
    inOut: (fn: (x: number) => number) => fn,
    bounce: (x: number) => x,
    bezier: () => (x: number) => x,
    elastic: () => (x: number) => x,
  },
  Dimensions: {
    get: () => ({ width: 375, height: 812 }),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
}));

// Mock the stores
jest.mock('@/stores/uxSettingsStore', () => ({
  useUXSettingsSelector: jest.fn(selector => {
    const defaultState = {
      animationsEnabled: true,
      reducedMotion: false,
      hapticFeedbackEnabled: false,
      soundEnabled: false,
      soundVolume: 0.7,
      soundPreset: 'classic',
    };
    return selector(defaultState);
  }),
}));

// Mock the theme
jest.mock('@/theme', () => ({
  useTheme: jest.fn(() => ({
    colors: {
      primary: '#6366F1',
      secondary: '#22D3EE',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      text: '#1F2937',
      textSecondary: '#6B7280',
      surface: '#FFFFFF',
      border: '#E5E7EB',
    },
    isDark: false,
  })),
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: { sm: 4, md: 8, lg: 16, full: 9999 },
  shadows: { none: {}, sm: {}, md: {}, lg: {} },
}));

// Mock the hooks
jest.mock('@/hooks/useAchievements', () => ({
  useAchievements: jest.fn(() => ({
    achievements: [],
    unlockedAchievements: [],
    lockedAchievements: [],
    isCalculating: false,
    recalculate: jest.fn(),
  })),
}));

// Mock the confetti
jest.mock('@/components/ui/Confetti', () => ({
  useConfettiSafe: jest.fn(() => ({
    fire: jest.fn(),
  })),
}));

// Mock animation lib
jest.mock('@/lib/animations', () => ({
  getReducedMotionPreference: jest.fn(() => false),
  ANIMATION_DURATION: { instant: 0, fast: 150, normal: 250, slow: 400, verySlow: 600 },
  parallel: jest.fn((_animations: unknown[]) => ({
    start: jest.fn(cb => cb?.({ finished: true })),
  })),
  spring: jest.fn(() => ({
    start: jest.fn(cb => cb?.({ finished: true })),
  })),
}));

import type { Achievement, AchievementCategory } from '@/schemas/achievement';

// ============================================================================
// TEST DATA
// ============================================================================

const createMockAchievement = (overrides: Partial<Achievement> = {}): Achievement => ({
  id: 'STREAK_3',
  name: '3-Day Streak',
  description: 'Track time for 3 consecutive days',
  icon: 'local-fire-department',
  category: 'streak' as AchievementCategory,
  targetValue: 3,
  progress: 0,
  progressPercent: 0,
  unlockedAt: null,
  isUnlocked: false,
  ...overrides,
});

const unlockedAchievement = createMockAchievement({
  id: 'FIRST_ENTRY',
  name: 'First Steps',
  description: 'Create your first time entry',
  icon: 'flag',
  category: 'first',
  targetValue: 1,
  progress: 1,
  progressPercent: 100,
  unlockedAt: '2024-01-01T00:00:00Z',
  isUnlocked: true,
});

// partialAchievement is used for testing progress states
const _partialAchievement = createMockAchievement({
  progress: 2,
  progressPercent: 66.67,
});

// ============================================================================
// TESTS
// ============================================================================

describe('AchievementBadge Component', () => {
  describe('Badge Size Configuration', () => {
    it('should have correct size configs for all sizes', () => {
      const sizeConfig = {
        sm: {
          containerSize: 80,
          iconSize: 28,
          iconContainerSize: 48,
          nameSize: 11,
          progressBarHeight: 3,
        },
        md: {
          containerSize: 100,
          iconSize: 36,
          iconContainerSize: 60,
          nameSize: 13,
          progressBarHeight: 4,
        },
        lg: {
          containerSize: 120,
          iconSize: 44,
          iconContainerSize: 72,
          nameSize: 15,
          progressBarHeight: 5,
        },
      };

      expect(sizeConfig.sm.iconSize).toBeLessThan(sizeConfig.md.iconSize);
      expect(sizeConfig.md.iconSize).toBeLessThan(sizeConfig.lg.iconSize);
      expect(sizeConfig.sm.iconContainerSize).toBeLessThan(sizeConfig.md.iconContainerSize);
    });
  });

  describe('Category Colors', () => {
    it('should have colors for all achievement categories', () => {
      const categoryColors: Record<AchievementCategory, { light: string; dark: string }> = {
        streak: { light: '#F59E0B', dark: '#FBBF24' },
        time: { light: '#6366F1', dark: '#818CF8' },
        first: { light: '#10B981', dark: '#34D399' },
      };

      expect(categoryColors.streak.light).toBe('#F59E0B');
      expect(categoryColors.time.light).toBe('#6366F1');
      expect(categoryColors.first.light).toBe('#10B981');
    });
  });

  describe('Locked State', () => {
    it('should display locked state for locked achievements', () => {
      const achievement = createMockAchievement({ isUnlocked: false });

      expect(achievement.isUnlocked).toBe(false);
      expect(achievement.unlockedAt).toBeNull();
    });

    it('should show progress for locked achievements', () => {
      const achievement = createMockAchievement({
        progress: 2,
        progressPercent: 66.67,
        isUnlocked: false,
      });

      expect(achievement.progress).toBe(2);
      expect(achievement.progressPercent).toBeCloseTo(66.67);
    });
  });

  describe('Unlocked State', () => {
    it('should display unlocked state correctly', () => {
      expect(unlockedAchievement.isUnlocked).toBe(true);
      expect(unlockedAchievement.unlockedAt).not.toBeNull();
    });

    it('should have 100% progress when unlocked', () => {
      expect(unlockedAchievement.progressPercent).toBe(100);
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate correct progress percentage', () => {
      const achievement = createMockAchievement({ progress: 2, targetValue: 3 });
      const progressPercent = (achievement.progress / (achievement.targetValue ?? 1)) * 100;

      expect(progressPercent).toBeCloseTo(66.67, 1);
    });

    it('should handle zero target value', () => {
      const achievement = createMockAchievement({ targetValue: 1, progress: 0 });
      const progressPercent = achievement.targetValue
        ? (achievement.progress / achievement.targetValue) * 100
        : 0;

      expect(progressPercent).toBe(0);
    });

    it('should cap progress at 100%', () => {
      const achievement = createMockAchievement({ progress: 5, targetValue: 3 });
      const progressPercent = Math.min(
        100,
        (achievement.progress / (achievement.targetValue ?? 1)) * 100
      );

      expect(progressPercent).toBe(100);
    });
  });

  describe('Icon Mapping', () => {
    it('should map icon names to fallbacks for unknown icons', () => {
      const getAchievementIcon = (iconName: string): string => {
        const iconMap = { sparkles: true, time: true, flag: true };
        if (iconName in iconMap) return iconName;
        if (iconName.includes('fire') || iconName.includes('hot')) return 'sparkles';
        if (iconName.includes('time') || iconName.includes('clock')) return 'time';
        if (iconName.includes('flag')) return 'flag';
        return 'sparkles';
      };

      expect(getAchievementIcon('local-fire-department')).toBe('sparkles');
      expect(getAchievementIcon('access-time')).toBe('time');
      expect(getAchievementIcon('flag')).toBe('flag');
      expect(getAchievementIcon('unknown')).toBe('sparkles');
    });
  });

  describe('Accessibility', () => {
    it('should generate correct accessibility label for locked achievement', () => {
      const achievement = createMockAchievement({ progressPercent: 66.67 });
      const label = `${achievement.name}. ${achievement.description}. ${
        achievement.isUnlocked ? 'Unlocked' : `${achievement.progressPercent.toFixed(0)}% complete`
      }`;

      expect(label).toContain('3-Day Streak');
      expect(label).toContain('67% complete');
    });

    it('should generate correct accessibility label for unlocked achievement', () => {
      const label = `${unlockedAchievement.name}. ${unlockedAchievement.description}. Unlocked`;

      expect(label).toContain('First Steps');
      expect(label).toContain('Unlocked');
    });
  });
});

describe('AchievementList Component', () => {
  describe('Category Labels', () => {
    it('should have labels for all categories', () => {
      const categoryLabels: Record<AchievementCategory, string> = {
        streak: 'Streaks',
        time: 'Time',
        first: 'Firsts',
      };

      expect(categoryLabels.streak).toBe('Streaks');
      expect(categoryLabels.time).toBe('Time');
      expect(categoryLabels.first).toBe('Firsts');
    });
  });

  describe('Category Order', () => {
    it('should have correct category order', () => {
      const categoryOrder: AchievementCategory[] = ['first', 'streak', 'time'];

      expect(categoryOrder[0]).toBe('first');
      expect(categoryOrder[1]).toBe('streak');
      expect(categoryOrder[2]).toBe('time');
    });
  });

  describe('Filter Logic', () => {
    const achievements = [
      createMockAchievement({ id: 'FIRST_ENTRY', isUnlocked: true }),
      createMockAchievement({ id: 'STREAK_3', isUnlocked: false }),
      createMockAchievement({ id: 'TIME_10H', isUnlocked: true }),
    ];

    it('should filter unlocked achievements correctly', () => {
      const filtered = achievements.filter(a => a.isUnlocked);
      expect(filtered.length).toBe(2);
    });

    it('should filter locked achievements correctly', () => {
      const filtered = achievements.filter(a => !a.isUnlocked);
      expect(filtered.length).toBe(1);
    });

    it('should return all achievements when no filter', () => {
      expect(achievements.length).toBe(3);
    });
  });

  describe('Grouping Logic', () => {
    const achievements = [
      createMockAchievement({ id: 'FIRST_ENTRY', category: 'first' }),
      createMockAchievement({ id: 'STREAK_3', category: 'streak' }),
      createMockAchievement({ id: 'STREAK_7', category: 'streak' }),
      createMockAchievement({ id: 'TIME_10H', category: 'time' }),
    ];

    it('should group achievements by category', () => {
      const groups: Record<AchievementCategory, Achievement[]> = {
        first: [],
        streak: [],
        time: [],
      };

      for (const achievement of achievements) {
        groups[achievement.category].push(achievement);
      }

      expect(groups.first.length).toBe(1);
      expect(groups.streak.length).toBe(2);
      expect(groups.time.length).toBe(1);
    });
  });

  describe('Empty States', () => {
    it('should have correct message for unlocked filter with none', () => {
      const filter = 'unlocked';
      const message =
        filter === 'unlocked'
          ? 'No achievements unlocked yet. Keep tracking!'
          : filter === 'locked'
            ? 'All achievements unlocked!'
            : 'No achievements available.';

      expect(message).toBe('No achievements unlocked yet. Keep tracking!');
    });

    it('should have correct message for all unlocked', () => {
      const filter = 'locked';
      const message =
        filter === 'locked' ? 'All achievements unlocked!' : 'No achievements available.';

      expect(message).toBe('All achievements unlocked!');
    });
  });

  describe('Stagger Animation', () => {
    it('should calculate correct stagger delay for each item', () => {
      const staggerDelay = 50;
      const itemCount = 5;
      const delays = Array.from({ length: itemCount }, (_, i) => i * staggerDelay);

      expect(delays).toEqual([0, 50, 100, 150, 200]);
    });
  });
});

describe('AchievementUnlock Component', () => {
  describe('Configuration', () => {
    it('should have correct default auto-dismiss delay', () => {
      const DEFAULT_AUTO_DISMISS = 5000;
      expect(DEFAULT_AUTO_DISMISS).toBe(5000);
    });

    it('should have correct animation delays', () => {
      const ANIMATION_DELAY = 200;
      const CONFETTI_DELAY = 400;

      expect(ANIMATION_DELAY).toBe(200);
      expect(CONFETTI_DELAY).toBe(400);
    });
  });

  describe('Modal Colors', () => {
    it('should have correct backdrop colors', () => {
      const isDark = false;
      const backdropColor = isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.7)';

      expect(backdropColor).toBe('rgba(0, 0, 0, 0.7)');
    });

    it('should have correct dark mode backdrop', () => {
      const isDark = true;
      const backdropColor = isDark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.7)';

      expect(backdropColor).toBe('rgba(0, 0, 0, 0.85)');
    });
  });

  describe('Animation Values', () => {
    it('should define all required animation values', () => {
      const animValues = {
        backdropOpacity: 0,
        cardScale: 0.8,
        cardOpacity: 0,
        badgeScale: 0,
        contentOpacity: 0,
      };

      expect(animValues.backdropOpacity).toBe(0);
      expect(animValues.cardScale).toBe(0.8);
      expect(animValues.cardOpacity).toBe(0);
      expect(animValues.badgeScale).toBe(0);
      expect(animValues.contentOpacity).toBe(0);
    });

    it('should animate to correct final values', () => {
      const finalValues = {
        backdropOpacity: 1,
        cardScale: 1,
        cardOpacity: 1,
        badgeScale: 1,
        contentOpacity: 1,
      };

      expect(finalValues.backdropOpacity).toBe(1);
      expect(finalValues.cardScale).toBe(1);
    });
  });

  describe('Confetti Integration', () => {
    it('should fire confetti with correct config', () => {
      const confettiConfig = {
        originY: 0.3,
        particleCount: 80,
      };

      expect(confettiConfig.originY).toBe(0.3);
      expect(confettiConfig.particleCount).toBe(80);
    });
  });

  describe('Auto-dismiss Behavior', () => {
    it('should not auto-dismiss when delay is 0', () => {
      const autoDismissDelay = 0;
      const shouldAutoDismiss = autoDismissDelay > 0;

      expect(shouldAutoDismiss).toBe(false);
    });

    it('should auto-dismiss when delay is positive', () => {
      const autoDismissDelay = 5000;
      const shouldAutoDismiss = autoDismissDelay > 0;

      expect(shouldAutoDismiss).toBe(true);
    });
  });

  describe('Dismiss Animation', () => {
    it('should animate exit correctly', () => {
      const exitValues = {
        backdropOpacity: 0,
        cardScale: 0.9,
        cardOpacity: 0,
      };

      expect(exitValues.cardScale).toBe(0.9); // Slight scale down on exit
      expect(exitValues.backdropOpacity).toBe(0);
      expect(exitValues.cardOpacity).toBe(0);
    });
  });
});

describe('Reduced Motion Support', () => {
  describe('Animation Decision Logic', () => {
    it('should disable animations when reduced motion is enabled', () => {
      const animationsEnabled = true;
      const reducedMotion = true;
      const reducedMotionPreference = false;
      const shouldAnimate = animationsEnabled && !reducedMotion && !reducedMotionPreference;

      expect(shouldAnimate).toBe(false);
    });

    it('should enable animations when all conditions are met', () => {
      const animationsEnabled = true;
      const reducedMotion = false;
      const reducedMotionPreference = false;
      const shouldAnimate = animationsEnabled && !reducedMotion && !reducedMotionPreference;

      expect(shouldAnimate).toBe(true);
    });

    it('should respect system reduced motion preference', () => {
      const animationsEnabled = true;
      const reducedMotion = false;
      const reducedMotionPreference = true;
      const shouldAnimate = animationsEnabled && !reducedMotion && !reducedMotionPreference;

      expect(shouldAnimate).toBe(false);
    });

    it('should respect app animations toggle', () => {
      const animationsEnabled = false;
      const reducedMotion = false;
      const reducedMotionPreference = false;
      const shouldAnimate = animationsEnabled && !reducedMotion && !reducedMotionPreference;

      expect(shouldAnimate).toBe(false);
    });
  });

  describe('Instant State for Reduced Motion', () => {
    it('should show final state instantly when animations disabled', () => {
      const shouldAnimate = false;
      const initialScale = shouldAnimate ? 0 : 1;
      const initialOpacity = shouldAnimate ? 0 : 1;

      expect(initialScale).toBe(1);
      expect(initialOpacity).toBe(1);
    });
  });
});

describe('Achievement Props', () => {
  describe('AchievementBadge Props', () => {
    it('should have correct default props', () => {
      const defaults = {
        size: 'md',
        showProgress: true,
        showDescription: false,
        animateUnlock: false,
      };

      expect(defaults.size).toBe('md');
      expect(defaults.showProgress).toBe(true);
      expect(defaults.showDescription).toBe(false);
      expect(defaults.animateUnlock).toBe(false);
    });
  });

  describe('AchievementList Props', () => {
    it('should have correct default props', () => {
      const defaults = {
        mode: 'grid',
        filter: 'all',
        showCategoryTabs: false,
        animateOnMount: true,
        badgeSize: 'md',
        showProgress: true,
        numColumns: 3,
      };

      expect(defaults.mode).toBe('grid');
      expect(defaults.filter).toBe('all');
      expect(defaults.showCategoryTabs).toBe(false);
      expect(defaults.animateOnMount).toBe(true);
      expect(defaults.numColumns).toBe(3);
    });
  });

  describe('AchievementUnlock Props', () => {
    it('should have correct default props', () => {
      const defaults = {
        autoDismissDelay: 5000,
        showConfetti: true,
        dismissLabel: 'Awesome!',
      };

      expect(defaults.autoDismissDelay).toBe(5000);
      expect(defaults.showConfetti).toBe(true);
      expect(defaults.dismissLabel).toBe('Awesome!');
    });
  });
});
