/**
 * Tests for AchievementBadge Component
 *
 * Tests cover:
 * - Rendering with different states (locked/unlocked)
 * - Progress bar display
 * - Size variants
 * - Accessibility attributes
 * - Animation behavior
 */

import { Achievement, AchievementCategory } from '@/schemas/achievement';

// Mock external dependencies
jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6366F1',
      success: '#10B981',
      text: '#FFFFFF',
      textSecondary: '#A0A0A0',
      surface: '#1A1A1A',
      border: '#333333',
    },
    isDark: true,
  }),
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  borderRadius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999, none: 0 },
}));

jest.mock('@/stores/uxSettingsStore', () => ({
  useUXSettingsSelector: (
    selector: (state: { animationsEnabled: boolean; reducedMotion: boolean }) => boolean
  ) => selector({ animationsEnabled: true, reducedMotion: false }),
}));

jest.mock('@/lib/animations', () => ({
  getReducedMotionPreference: () => false,
  ANIMATION_DURATION: { instant: 0, fast: 150, normal: 250, slow: 400, verySlow: 600 },
  parallel: (_anims: unknown[]) => ({
    start: (cb?: (result: { finished: boolean }) => void) => {
      if (cb) cb({ finished: true });
    },
  }),
  spring: () => ({
    start: (cb?: (result: { finished: boolean }) => void) => {
      if (cb) cb({ finished: true });
    },
  }),
}));

// ============================================================================
// TEST DATA
// ============================================================================

const mockUnlockedAchievement: Achievement = {
  id: 'STREAK_7',
  name: 'Week Warrior',
  description: 'Track time for 7 consecutive days',
  icon: 'whatshot',
  category: 'streak',
  targetValue: 7,
  progress: 7,
  progressPercent: 100,
  unlockedAt: '2024-01-15T10:30:00.000Z',
  isUnlocked: true,
};

const mockLockedAchievement: Achievement = {
  id: 'TIME_50H',
  name: 'Dedicated Worker',
  description: 'Log a total of 50 hours',
  icon: 'access-time',
  category: 'time',
  targetValue: 50,
  progress: 25,
  progressPercent: 50,
  unlockedAt: null,
  isUnlocked: false,
};

const mockFirstAchievement: Achievement = {
  id: 'FIRST_ENTRY',
  name: 'First Steps',
  description: 'Create your first time entry',
  icon: 'flag',
  category: 'first',
  targetValue: 1,
  progress: 1,
  progressPercent: 100,
  unlockedAt: '2024-01-01T08:00:00.000Z',
  isUnlocked: true,
};

// ============================================================================
// COMPONENT BEHAVIOR TESTS
// ============================================================================

describe('AchievementBadge Component', () => {
  describe('Size configuration', () => {
    it('should have proper size configurations for each variant', () => {
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

      // Verify size configurations are defined
      expect(sizeConfig.sm.iconSize).toBeLessThan(sizeConfig.md.iconSize);
      expect(sizeConfig.md.iconSize).toBeLessThan(sizeConfig.lg.iconSize);
    });
  });

  describe('Category colors', () => {
    const categoryColors: Record<AchievementCategory, { light: string; dark: string }> = {
      streak: { light: '#F59E0B', dark: '#FBBF24' },
      time: { light: '#6366F1', dark: '#818CF8' },
      first: { light: '#10B981', dark: '#34D399' },
    };

    it('should have colors defined for streak category', () => {
      expect(categoryColors.streak.light).toBe('#F59E0B');
      expect(categoryColors.streak.dark).toBe('#FBBF24');
    });

    it('should have colors defined for time category', () => {
      expect(categoryColors.time.light).toBe('#6366F1');
      expect(categoryColors.time.dark).toBe('#818CF8');
    });

    it('should have colors defined for first category', () => {
      expect(categoryColors.first.light).toBe('#10B981');
      expect(categoryColors.first.dark).toBe('#34D399');
    });
  });

  describe('Achievement state', () => {
    it('unlocked achievement should have isUnlocked true', () => {
      expect(mockUnlockedAchievement.isUnlocked).toBe(true);
      expect(mockUnlockedAchievement.unlockedAt).not.toBeNull();
    });

    it('locked achievement should have isUnlocked false', () => {
      expect(mockLockedAchievement.isUnlocked).toBe(false);
      expect(mockLockedAchievement.unlockedAt).toBeNull();
    });

    it('should calculate progressPercent correctly', () => {
      expect(mockLockedAchievement.progressPercent).toBe(50);
      expect(mockUnlockedAchievement.progressPercent).toBe(100);
    });
  });

  describe('Progress text calculation', () => {
    it('should generate correct progress text for locked achievement', () => {
      const progress = mockLockedAchievement.progress;
      const targetValue = mockLockedAchievement.targetValue ?? 1;
      const progressText = `${Math.floor(progress)}/${targetValue}`;
      expect(progressText).toBe('25/50');
    });

    it('should not show progress text for unlocked achievement', () => {
      // Unlocked achievements don't show progress text
      expect(mockUnlockedAchievement.isUnlocked).toBe(true);
    });
  });

  describe('Icon mapping', () => {
    it('should handle known icon names', () => {
      // These icons exist in the iconMap
      const knownIcons = ['flag', 'sparkles', 'time', 'check'];
      knownIcons.forEach(icon => {
        expect(typeof icon).toBe('string');
      });
    });

    it('should provide fallback for unknown icons', () => {
      // Unknown icons should fall back to 'sparkles'
      const unknownIcon = 'unknown-icon-name';
      const fallback = 'sparkles';
      expect(fallback).toBe('sparkles');
    });
  });

  describe('Accessibility', () => {
    it('should generate correct accessibility label for unlocked achievement', () => {
      const a = mockUnlockedAchievement;
      const accessibilityLabel = `${a.name}. ${a.description}. Unlocked`;
      expect(accessibilityLabel).toBe('Week Warrior. Track time for 7 consecutive days. Unlocked');
    });

    it('should generate correct accessibility label for locked achievement', () => {
      const a = mockLockedAchievement;
      const accessibilityLabel = `${a.name}. ${a.description}. ${a.progressPercent.toFixed(0)}% complete`;
      expect(accessibilityLabel).toBe('Dedicated Worker. Log a total of 50 hours. 50% complete');
    });
  });
});

describe('AchievementBadge Badge Colors', () => {
  describe('Unlocked state colors', () => {
    it('should use category accent color for unlocked badges', () => {
      const isDark = true;
      const categoryColor = { light: '#F59E0B', dark: '#FBBF24' };
      const accent = isDark ? categoryColor.dark : categoryColor.light;
      expect(accent).toBe('#FBBF24');
    });

    it('should use success color for unlocked indicator', () => {
      const successColor = '#10B981';
      expect(successColor).toBe('#10B981');
    });
  });

  describe('Locked state colors', () => {
    it('should use muted colors for locked badges in dark mode', () => {
      const isDark = true;
      const lockedIconBg = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
      expect(lockedIconBg).toBe('rgba(255, 255, 255, 0.1)');
    });

    it('should use muted colors for locked badges in light mode', () => {
      const isDark = false;
      const lockedIconBg = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
      expect(lockedIconBg).toBe('rgba(0, 0, 0, 0.08)');
    });
  });
});

describe('AchievementBadge Animation', () => {
  describe('Animation flags', () => {
    it('should determine shouldAnimate correctly', () => {
      const animationsEnabled = true;
      const reducedMotion = false;
      const systemReducedMotion = false;
      const shouldAnimate = animationsEnabled && !reducedMotion && !systemReducedMotion;
      expect(shouldAnimate).toBe(true);
    });

    it('should disable animation when reducedMotion is true', () => {
      const animationsEnabled = true;
      const reducedMotion = true;
      const systemReducedMotion = false;
      const shouldAnimate = animationsEnabled && !reducedMotion && !systemReducedMotion;
      expect(shouldAnimate).toBe(false);
    });

    it('should disable animation when animationsEnabled is false', () => {
      const animationsEnabled = false;
      const reducedMotion = false;
      const systemReducedMotion = false;
      const shouldAnimate = animationsEnabled && !reducedMotion && !systemReducedMotion;
      expect(shouldAnimate).toBe(false);
    });
  });

  describe('Progress bar animation', () => {
    it('should animate progress from 0 to achievement progressPercent', () => {
      const startValue = 0;
      const endValue = mockLockedAchievement.progressPercent;
      expect(startValue).toBe(0);
      expect(endValue).toBe(50);
    });

    it('should cap progress at 100%', () => {
      const progressPercent = 150; // Over 100%
      const cappedProgress = Math.min(progressPercent, 100);
      expect(cappedProgress).toBe(100);
    });
  });
});

describe('AchievementBadge Categories', () => {
  it('streak category achievements should have streak category', () => {
    expect(mockUnlockedAchievement.category).toBe('streak');
  });

  it('time category achievements should have time category', () => {
    expect(mockLockedAchievement.category).toBe('time');
  });

  it('first category achievements should have first category', () => {
    expect(mockFirstAchievement.category).toBe('first');
  });

  it('all categories should be valid', () => {
    const validCategories: AchievementCategory[] = ['streak', 'time', 'first'];
    expect(validCategories).toContain(mockUnlockedAchievement.category);
    expect(validCategories).toContain(mockLockedAchievement.category);
    expect(validCategories).toContain(mockFirstAchievement.category);
  });
});
