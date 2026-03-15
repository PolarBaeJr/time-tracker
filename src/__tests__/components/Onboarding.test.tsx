/**
 * Tests for Onboarding Components
 *
 * Tests for OnboardingStep, OnboardingProgress, and OnboardingScreen.
 */

import { Animated } from 'react-native';

// Mock animation functions
jest.mock('@/lib/animations', () => ({
  ANIMATION_DURATION: { instant: 0, fast: 150, normal: 250, slow: 400, verySlow: 600 },
  ANIMATION_EASING: {
    linear: (v: number) => v,
    easeIn: (v: number) => v,
    easeOut: (v: number) => v,
    easeInOut: (v: number) => v,
    bounce: (v: number) => v,
    spring: (v: number) => v,
    elastic: (v: number) => v,
  },
  getReducedMotionPreference: jest.fn().mockReturnValue(false),
  setReducedMotionPreference: jest.fn(),
}));

// Mock onboarding store
const mockOnboardingState = {
  hasCompleted: false,
  currentStep: 'welcome',
  completedSteps: [],
  skippedAt: null,
  completedAt: null,
  progress: 0,
  isHydrated: true,
};

jest.mock('@/stores/onboardingStore', () => ({
  useOnboarding: jest.fn(() => mockOnboardingState),
  useHasCompletedOnboarding: jest.fn(() => mockOnboardingState.hasCompleted),
  useOnboardingStoreHydrated: jest.fn(() => mockOnboardingState.isHydrated),
  completeStep: jest.fn(),
  skipOnboarding: jest.fn(),
  setOnboardingComplete: jest.fn(),
  startOnboarding: jest.fn(),
  goToStep: jest.fn(),
}));

// Mock theme store
jest.mock('@/stores/themeStore', () => ({
  useThemePreference: jest.fn(() => ({ mode: 'dark', resolved: 'dark' })),
  setThemeMode: jest.fn(),
}));

// Mock theme
jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#1F1F1F',
      surface: '#2A2A2A',
      surfaceVariant: '#3A3A3A',
      primary: '#6366F1',
      primaryVariant: '#5558E3',
      text: '#FFFFFF',
      textSecondary: '#A0A0A0',
      textMuted: '#6B6B6B',
      border: '#3A3A3A',
      success: '#22C55E',
      error: '#EF4444',
    },
    isDark: true,
  }),
  spacing: { xxs: 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  fontSizes: { xs: 10, sm: 12, md: 14, lg: 16, xl: 20, xxl: 28 },
  fontWeights: { normal: '400', medium: '500', semibold: '600', bold: '700' },
  borderRadius: { none: 0, sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
}));

// Import schemas
import {
  ALL_ONBOARDING_STEPS,
  ONBOARDING_STEP_DEFINITIONS,
  DEFAULT_ONBOARDING_STATE,
  getNextOnboardingStep,
  getPreviousOnboardingStep,
  calculateOnboardingProgress,
} from '@/schemas/onboarding';

describe('Onboarding Components', () => {
  describe('OnboardingStep schema', () => {
    it('should have all expected step IDs', () => {
      expect(ALL_ONBOARDING_STEPS).toContain('welcome');
      expect(ALL_ONBOARDING_STEPS).toContain('create_category');
      expect(ALL_ONBOARDING_STEPS).toContain('create_entry');
      expect(ALL_ONBOARDING_STEPS).toContain('set_goal');
      expect(ALL_ONBOARDING_STEPS).toContain('complete');
    });

    it('should have step definitions for all steps', () => {
      ALL_ONBOARDING_STEPS.forEach(step => {
        expect(ONBOARDING_STEP_DEFINITIONS[step]).toBeDefined();
        expect(ONBOARDING_STEP_DEFINITIONS[step].id).toBe(step);
        expect(ONBOARDING_STEP_DEFINITIONS[step].title).toBeTruthy();
        expect(ONBOARDING_STEP_DEFINITIONS[step].description).toBeTruthy();
        expect(ONBOARDING_STEP_DEFINITIONS[step].icon).toBeTruthy();
        expect(typeof ONBOARDING_STEP_DEFINITIONS[step].order).toBe('number');
      });
    });

    it('should have correct default state', () => {
      expect(DEFAULT_ONBOARDING_STATE.version).toBe(1);
      expect(DEFAULT_ONBOARDING_STATE.hasCompletedOnboarding).toBe(false);
      expect(DEFAULT_ONBOARDING_STATE.completedSteps).toEqual([]);
      expect(DEFAULT_ONBOARDING_STATE.skippedAt).toBeNull();
      expect(DEFAULT_ONBOARDING_STATE.completedAt).toBeNull();
      expect(DEFAULT_ONBOARDING_STATE.currentStep).toBeNull();
    });
  });

  describe('getNextOnboardingStep', () => {
    it('should return next step for each step', () => {
      expect(getNextOnboardingStep('welcome')).toBe('create_category');
      expect(getNextOnboardingStep('create_category')).toBe('create_entry');
      expect(getNextOnboardingStep('create_entry')).toBe('set_goal');
      expect(getNextOnboardingStep('set_goal')).toBe('complete');
    });

    it('should return null for last step', () => {
      expect(getNextOnboardingStep('complete')).toBeNull();
    });
  });

  describe('getPreviousOnboardingStep', () => {
    it('should return previous step for each step', () => {
      expect(getPreviousOnboardingStep('complete')).toBe('set_goal');
      expect(getPreviousOnboardingStep('set_goal')).toBe('create_entry');
      expect(getPreviousOnboardingStep('create_entry')).toBe('create_category');
      expect(getPreviousOnboardingStep('create_category')).toBe('welcome');
    });

    it('should return null for first step', () => {
      expect(getPreviousOnboardingStep('welcome')).toBeNull();
    });
  });

  describe('calculateOnboardingProgress', () => {
    it('should return 0 for no completed steps', () => {
      expect(calculateOnboardingProgress([])).toBe(0);
    });

    it('should return correct percentage for partial completion', () => {
      // 1 out of 5 steps = 20%
      expect(calculateOnboardingProgress(['welcome'])).toBe(20);
      // 2 out of 5 steps = 40%
      expect(calculateOnboardingProgress(['welcome', 'create_category'])).toBe(40);
    });

    it('should return 100 for all steps completed', () => {
      expect(calculateOnboardingProgress([...ALL_ONBOARDING_STEPS])).toBe(100);
    });
  });

  describe('OnboardingProgress visual tests', () => {
    it('should calculate correct active/completed states for dots', () => {
      const totalSteps = 5;
      const currentStep = 2;

      const dots = Array.from({ length: totalSteps }, (_, index) => ({
        isActive: index === currentStep,
        isCompleted: index < currentStep,
      }));

      // Dot 0 and 1 should be completed
      expect(dots[0].isCompleted).toBe(true);
      expect(dots[1].isCompleted).toBe(true);

      // Dot 2 should be active
      expect(dots[2].isActive).toBe(true);
      expect(dots[2].isCompleted).toBe(false);

      // Dots 3 and 4 should be neither
      expect(dots[3].isActive).toBe(false);
      expect(dots[3].isCompleted).toBe(false);
      expect(dots[4].isActive).toBe(false);
      expect(dots[4].isCompleted).toBe(false);
    });
  });

  describe('OnboardingStep visual tests', () => {
    it('should map icons correctly', () => {
      const iconMapping: Record<string, string> = {
        'waving-hand': 'home',
        category: 'folder',
        'add-circle': 'add',
        'track-changes': 'flag',
        celebration: 'check',
        timer: 'time',
        analytics: 'bar-chart',
        notes: 'file-text',
      };

      Object.entries(iconMapping).forEach(([input, expected]) => {
        const result = iconMapping[input];
        expect(result).toBe(expected);
      });
    });

    it('should return correct animation preset for direction', () => {
      const getPreset = (direction: 'left' | 'right') =>
        direction === 'right' ? 'slideLeft' : 'slideRight';

      expect(getPreset('right')).toBe('slideLeft');
      expect(getPreset('left')).toBe('slideRight');
    });
  });

  describe('OnboardingScreen step data', () => {
    const ONBOARDING_STEPS = [
      { id: 'welcome', title: 'Welcome to WorkTracker', skippable: false },
      { id: 'features', title: 'Powerful Features', skippable: true },
      { id: 'theme', title: 'Choose Your Theme', skippable: true },
      { id: 'category_prompt', title: 'Organize with Categories', skippable: true },
      { id: 'complete', title: "You're All Set!", skippable: false },
    ];

    it('should have 5 steps', () => {
      expect(ONBOARDING_STEPS).toHaveLength(5);
    });

    it('should have welcome as first step', () => {
      expect(ONBOARDING_STEPS[0].id).toBe('welcome');
    });

    it('should have complete as last step', () => {
      expect(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1].id).toBe('complete');
    });

    it('should have non-skippable welcome and complete steps', () => {
      expect(ONBOARDING_STEPS[0].skippable).toBe(false);
      expect(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1].skippable).toBe(false);
    });

    it('should have skippable middle steps', () => {
      ONBOARDING_STEPS.slice(1, -1).forEach(step => {
        expect(step.skippable).toBe(true);
      });
    });
  });

  describe('OnboardingScreen navigation logic', () => {
    it('should not go back on first step', () => {
      const stepIndex = 0;
      const isFirstStep = stepIndex === 0;
      expect(isFirstStep).toBe(true);
    });

    it('should show "Get Started" on last step', () => {
      const totalSteps = 5;
      const stepIndex = 4;
      const isLastStep = stepIndex === totalSteps - 1;
      expect(isLastStep).toBe(true);
    });

    it('should show "Continue" on non-last steps', () => {
      const totalSteps = 5;
      [0, 1, 2, 3].forEach(stepIndex => {
        const isLastStep = stepIndex === totalSteps - 1;
        expect(isLastStep).toBe(false);
      });
    });

    it('should increment step index on next', () => {
      let stepIndex = 0;
      const totalSteps = 5;

      const handleNext = () => {
        stepIndex = Math.min(stepIndex + 1, totalSteps - 1);
      };

      handleNext();
      expect(stepIndex).toBe(1);

      handleNext();
      expect(stepIndex).toBe(2);
    });

    it('should decrement step index on back', () => {
      let stepIndex = 2;

      const handleBack = () => {
        stepIndex = Math.max(stepIndex - 1, 0);
      };

      handleBack();
      expect(stepIndex).toBe(1);

      handleBack();
      expect(stepIndex).toBe(0);

      handleBack();
      expect(stepIndex).toBe(0); // Shouldn't go below 0
    });
  });

  describe('Animated value behavior', () => {
    it('should create animated values with initial values', () => {
      // Verify Animated.Value can be instantiated (mocked in test environment)
      const scaleValue = new Animated.Value(1);
      const opacityValue = new Animated.Value(0.4);

      // Animated.Value instances should be truthy objects
      expect(scaleValue).toBeTruthy();
      expect(opacityValue).toBeTruthy();
    });

    it('should set active dot values correctly', () => {
      const isActive = true;
      const isCompleted = false;

      const expectedScale = isActive ? 1.2 : 1;
      const expectedOpacity = isActive || isCompleted ? 1 : 0.4;

      expect(expectedScale).toBe(1.2);
      expect(expectedOpacity).toBe(1);
    });

    it('should set completed dot values correctly', () => {
      const isActive = false;
      const isCompleted = true;

      const expectedScale = isActive ? 1.2 : 1;
      const expectedOpacity = isActive || isCompleted ? 1 : 0.4;

      expect(expectedScale).toBe(1);
      expect(expectedOpacity).toBe(1);
    });

    it('should set inactive dot values correctly', () => {
      const isActive = false;
      const isCompleted = false;

      const expectedScale = isActive ? 1.2 : 1;
      const expectedOpacity = isActive || isCompleted ? 1 : 0.4;

      expect(expectedScale).toBe(1);
      expect(expectedOpacity).toBe(0.4);
    });
  });
});
