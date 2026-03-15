/**
 * Onboarding Schema Tests
 *
 * Tests for onboarding schema validation including:
 * - Onboarding step enum validation
 * - Onboarding step definition schema
 * - Onboarding state persistence schema
 * - Helper functions
 */

import {
  OnboardingStepEnum,
  OnboardingStepDefinitionSchema,
  OnboardingStateSchema,
  ONBOARDING_STEP_DEFINITIONS,
  ALL_ONBOARDING_STEPS,
  DEFAULT_ONBOARDING_STATE,
  getNextOnboardingStep,
  getPreviousOnboardingStep,
  calculateOnboardingProgress,
  type OnboardingStep,
  type OnboardingStepDefinition,
  type OnboardingState,
} from '@/schemas/onboarding';

describe('Onboarding Schemas', () => {
  describe('OnboardingStepEnum', () => {
    it('should include all expected step IDs', () => {
      const expectedSteps: OnboardingStep[] = [
        'welcome',
        'create_category',
        'create_entry',
        'set_goal',
        'complete',
      ];

      expect(OnboardingStepEnum.options).toEqual(expectedSteps);
    });

    it('should validate valid step IDs', () => {
      expect(OnboardingStepEnum.safeParse('welcome').success).toBe(true);
      expect(OnboardingStepEnum.safeParse('create_category').success).toBe(true);
      expect(OnboardingStepEnum.safeParse('complete').success).toBe(true);
    });

    it('should reject invalid step IDs', () => {
      expect(OnboardingStepEnum.safeParse('INVALID_STEP').success).toBe(false);
      expect(OnboardingStepEnum.safeParse('').success).toBe(false);
      expect(OnboardingStepEnum.safeParse(123).success).toBe(false);
      expect(OnboardingStepEnum.safeParse(null).success).toBe(false);
    });
  });

  describe('OnboardingStepDefinitionSchema', () => {
    const validDefinition: OnboardingStepDefinition = {
      id: 'welcome',
      title: 'Welcome to WorkTracker',
      description: 'Track your time and achieve your goals.',
      icon: 'waving-hand',
      order: 0,
      skippable: false,
    };

    it('should validate a valid step definition', () => {
      const result = OnboardingStepDefinitionSchema.safeParse(validDefinition);
      expect(result.success).toBe(true);
    });

    it('should require id', () => {
      const { id, ...rest } = validDefinition;
      const result = OnboardingStepDefinitionSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('should require title with min length', () => {
      expect(
        OnboardingStepDefinitionSchema.safeParse({ ...validDefinition, title: '' }).success
      ).toBe(false);
    });

    it('should require title with max length', () => {
      const longTitle = 'a'.repeat(101);
      expect(
        OnboardingStepDefinitionSchema.safeParse({ ...validDefinition, title: longTitle }).success
      ).toBe(false);
    });

    it('should require description with min length', () => {
      expect(
        OnboardingStepDefinitionSchema.safeParse({ ...validDefinition, description: '' }).success
      ).toBe(false);
    });

    it('should require non-negative order', () => {
      expect(
        OnboardingStepDefinitionSchema.safeParse({ ...validDefinition, order: -1 }).success
      ).toBe(false);
    });

    it('should default skippable to true', () => {
      const { skippable, ...rest } = validDefinition;
      const result = OnboardingStepDefinitionSchema.safeParse(rest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.skippable).toBe(true);
      }
    });
  });

  describe('OnboardingStateSchema', () => {
    it('should validate empty state with defaults', () => {
      const emptyState = { version: 1 };
      const result = OnboardingStateSchema.safeParse(emptyState);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hasCompletedOnboarding).toBe(false);
        expect(result.data.completedSteps).toEqual([]);
        expect(result.data.skippedAt).toBeNull();
        expect(result.data.completedAt).toBeNull();
        expect(result.data.currentStep).toBeNull();
      }
    });

    it('should validate complete state', () => {
      const completeState: OnboardingState = {
        version: 1,
        hasCompletedOnboarding: true,
        completedSteps: ['welcome', 'create_category', 'create_entry', 'set_goal', 'complete'],
        skippedAt: null,
        completedAt: '2024-03-15T12:00:00.000Z',
        currentStep: null,
      };
      const result = OnboardingStateSchema.safeParse(completeState);
      expect(result.success).toBe(true);
    });

    it('should validate skipped state', () => {
      const skippedState: OnboardingState = {
        version: 1,
        hasCompletedOnboarding: true,
        completedSteps: ['welcome'],
        skippedAt: '2024-03-15T10:00:00.000Z',
        completedAt: null,
        currentStep: null,
      };
      const result = OnboardingStateSchema.safeParse(skippedState);
      expect(result.success).toBe(true);
    });

    it('should validate in-progress state', () => {
      const inProgressState: OnboardingState = {
        version: 1,
        hasCompletedOnboarding: false,
        completedSteps: ['welcome', 'create_category'],
        skippedAt: null,
        completedAt: null,
        currentStep: 'create_entry',
      };
      const result = OnboardingStateSchema.safeParse(inProgressState);
      expect(result.success).toBe(true);
    });

    it('should require positive version number', () => {
      expect(OnboardingStateSchema.safeParse({ version: 0 }).success).toBe(false);
      expect(OnboardingStateSchema.safeParse({ version: -1 }).success).toBe(false);
      expect(OnboardingStateSchema.safeParse({ version: 1 }).success).toBe(true);
    });

    it('should validate step IDs in completedSteps', () => {
      const validState = {
        version: 1,
        completedSteps: ['welcome', 'create_entry'],
      };
      expect(OnboardingStateSchema.safeParse(validState).success).toBe(true);

      const invalidState = {
        version: 1,
        completedSteps: ['INVALID_STEP'],
      };
      expect(OnboardingStateSchema.safeParse(invalidState).success).toBe(false);
    });

    it('should validate ISO 8601 datetime for timestamps', () => {
      expect(
        OnboardingStateSchema.safeParse({
          version: 1,
          skippedAt: 'not-a-date',
        }).success
      ).toBe(false);

      expect(
        OnboardingStateSchema.safeParse({
          version: 1,
          completedAt: 'invalid',
        }).success
      ).toBe(false);

      expect(
        OnboardingStateSchema.safeParse({
          version: 1,
          skippedAt: '2024-03-15T10:00:00.000Z',
          completedAt: '2024-03-15T12:00:00.000Z',
        }).success
      ).toBe(true);
    });
  });
});

describe('Onboarding Step Definitions', () => {
  it('should have definitions for all step IDs', () => {
    ALL_ONBOARDING_STEPS.forEach(id => {
      expect(ONBOARDING_STEP_DEFINITIONS[id]).toBeDefined();
    });
  });

  it('should have valid definitions for all steps', () => {
    Object.values(ONBOARDING_STEP_DEFINITIONS).forEach(def => {
      const result = OnboardingStepDefinitionSchema.safeParse(def);
      expect(result.success).toBe(true);
    });
  });

  it('should have correct order values', () => {
    expect(ONBOARDING_STEP_DEFINITIONS.welcome.order).toBe(0);
    expect(ONBOARDING_STEP_DEFINITIONS.create_category.order).toBe(1);
    expect(ONBOARDING_STEP_DEFINITIONS.create_entry.order).toBe(2);
    expect(ONBOARDING_STEP_DEFINITIONS.set_goal.order).toBe(3);
    expect(ONBOARDING_STEP_DEFINITIONS.complete.order).toBe(4);
  });

  it('should have welcome and complete as non-skippable', () => {
    expect(ONBOARDING_STEP_DEFINITIONS.welcome.skippable).toBe(false);
    expect(ONBOARDING_STEP_DEFINITIONS.complete.skippable).toBe(false);
  });

  it('should have middle steps as skippable', () => {
    expect(ONBOARDING_STEP_DEFINITIONS.create_category.skippable).toBe(true);
    expect(ONBOARDING_STEP_DEFINITIONS.create_entry.skippable).toBe(true);
    expect(ONBOARDING_STEP_DEFINITIONS.set_goal.skippable).toBe(true);
  });
});

describe('Default Onboarding State', () => {
  it('should have version 1', () => {
    expect(DEFAULT_ONBOARDING_STATE.version).toBe(1);
  });

  it('should not be completed by default', () => {
    expect(DEFAULT_ONBOARDING_STATE.hasCompletedOnboarding).toBe(false);
  });

  it('should have empty completed steps', () => {
    expect(DEFAULT_ONBOARDING_STATE.completedSteps).toEqual([]);
  });

  it('should have null timestamps', () => {
    expect(DEFAULT_ONBOARDING_STATE.skippedAt).toBeNull();
    expect(DEFAULT_ONBOARDING_STATE.completedAt).toBeNull();
  });

  it('should have null current step', () => {
    expect(DEFAULT_ONBOARDING_STATE.currentStep).toBeNull();
  });

  it('should validate against schema', () => {
    const result = OnboardingStateSchema.safeParse(DEFAULT_ONBOARDING_STATE);
    expect(result.success).toBe(true);
  });
});

describe('Helper Functions', () => {
  describe('getNextOnboardingStep', () => {
    it('should return the next step in sequence', () => {
      expect(getNextOnboardingStep('welcome')).toBe('create_category');
      expect(getNextOnboardingStep('create_category')).toBe('create_entry');
      expect(getNextOnboardingStep('create_entry')).toBe('set_goal');
      expect(getNextOnboardingStep('set_goal')).toBe('complete');
    });

    it('should return null for the last step', () => {
      expect(getNextOnboardingStep('complete')).toBeNull();
    });
  });

  describe('getPreviousOnboardingStep', () => {
    it('should return the previous step in sequence', () => {
      expect(getPreviousOnboardingStep('complete')).toBe('set_goal');
      expect(getPreviousOnboardingStep('set_goal')).toBe('create_entry');
      expect(getPreviousOnboardingStep('create_entry')).toBe('create_category');
      expect(getPreviousOnboardingStep('create_category')).toBe('welcome');
    });

    it('should return null for the first step', () => {
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

      // 3 out of 5 steps = 60%
      expect(calculateOnboardingProgress(['welcome', 'create_category', 'create_entry'])).toBe(60);
    });

    it('should return 100 for all steps completed', () => {
      expect(
        calculateOnboardingProgress([
          'welcome',
          'create_category',
          'create_entry',
          'set_goal',
          'complete',
        ])
      ).toBe(100);
    });

    it('should round to nearest integer', () => {
      // Any percentage should be a whole number
      const progress = calculateOnboardingProgress(['welcome']);
      expect(Number.isInteger(progress)).toBe(true);
    });
  });
});

describe('Security: Input Validation', () => {
  it('should reject injection attempts in step IDs', () => {
    const maliciousId = '<script>alert("xss")</script>';
    expect(OnboardingStepEnum.safeParse(maliciousId).success).toBe(false);
  });

  it('should reject SQL injection in step arrays', () => {
    const sqlInjection = "welcome'; DROP TABLE onboarding; --";
    expect(
      OnboardingStateSchema.safeParse({
        version: 1,
        completedSteps: [sqlInjection],
      }).success
    ).toBe(false);
  });

  it('should sanitize description length', () => {
    const longDescription = 'a'.repeat(501);
    const result = OnboardingStepDefinitionSchema.safeParse({
      id: 'welcome',
      title: 'Test',
      description: longDescription,
      icon: 'test',
      order: 0,
      skippable: false,
    });
    expect(result.success).toBe(false);
  });

  it('should validate boolean types strictly', () => {
    expect(
      OnboardingStateSchema.safeParse({
        version: 1,
        hasCompletedOnboarding: 'true', // Should be boolean
      }).success
    ).toBe(false);
  });
});
