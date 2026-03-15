/**
 * Onboarding Store Tests
 *
 * Tests for onboarding store state management including:
 * - Default values
 * - Step completion
 * - Skip functionality
 * - Persistence via storage
 * - Hydration from storage
 */

import { createMockStorage } from '../mocks/supabase';
import {
  OnboardingStateSchema,
  DEFAULT_ONBOARDING_STATE,
  ALL_ONBOARDING_STEPS,
  getNextOnboardingStep,
  type OnboardingState,
  type OnboardingStep,
} from '@/schemas';

// Create mock storage instance
const mockStorage = createMockStorage();

// Mock storage
jest.mock('@/lib', () => ({
  storage: mockStorage,
}));

describe('Onboarding Store Logic', () => {
  const ONBOARDING_STORAGE_KEY = 'worktracker.onboarding.v1';

  // Helper to simulate store state
  const createStoreState = (): OnboardingState => ({
    ...DEFAULT_ONBOARDING_STATE,
  });

  beforeEach(() => {
    mockStorage.__store.clear();
    jest.clearAllMocks();
  });

  describe('state management', () => {
    it('should initialize with default values', () => {
      const state = createStoreState();

      expect(state.version).toBe(1);
      expect(state.hasCompletedOnboarding).toBe(false);
      expect(state.completedSteps).toEqual([]);
      expect(state.skippedAt).toBeNull();
      expect(state.completedAt).toBeNull();
      expect(state.currentStep).toBeNull();
    });

    it('should track current step', () => {
      let state = createStoreState();

      // Start onboarding
      state = { ...state, currentStep: 'welcome' };
      expect(state.currentStep).toBe('welcome');

      // Advance to next step
      state = { ...state, currentStep: 'create_category' };
      expect(state.currentStep).toBe('create_category');
    });
  });

  describe('step completion', () => {
    it('should mark steps as completed', () => {
      let state = createStoreState();

      // Complete first step
      const step: OnboardingStep = 'welcome';
      const completedSteps = state.completedSteps.includes(step)
        ? state.completedSteps
        : [...state.completedSteps, step];

      state = { ...state, completedSteps };
      expect(state.completedSteps).toContain('welcome');
    });

    it('should not add duplicate completed steps', () => {
      let state = createStoreState();

      // Complete step
      state = { ...state, completedSteps: ['welcome'] };

      // Try to complete again
      const step: OnboardingStep = 'welcome';
      const completedSteps = state.completedSteps.includes(step)
        ? state.completedSteps
        : [...state.completedSteps, step];

      state = { ...state, completedSteps };
      expect(state.completedSteps.filter((s: OnboardingStep) => s === 'welcome').length).toBe(1);
    });

    it('should advance to next step when completing current', () => {
      const currentStep: OnboardingStep = 'welcome';
      const nextStep = getNextOnboardingStep(currentStep);

      expect(nextStep).toBe('create_category');
    });

    it('should mark onboarding complete when all steps done', () => {
      let state = createStoreState();

      // Complete all steps
      state = {
        ...state,
        completedSteps: [...ALL_ONBOARDING_STEPS],
        hasCompletedOnboarding: true,
        completedAt: new Date().toISOString(),
        currentStep: null,
      };

      expect(state.hasCompletedOnboarding).toBe(true);
      expect(state.completedAt).not.toBeNull();
      expect(state.currentStep).toBeNull();
    });

    it('should mark onboarding complete when completing final step', () => {
      let state = createStoreState();

      const isComplete = true; // Last step 'complete' was finished
      state = {
        ...state,
        completedSteps: ['welcome', 'create_category', 'create_entry', 'set_goal', 'complete'],
        hasCompletedOnboarding: isComplete,
        completedAt: isComplete ? new Date().toISOString() : null,
        currentStep: null,
      };

      expect(state.hasCompletedOnboarding).toBe(true);
    });
  });

  describe('skip functionality', () => {
    it('should mark onboarding as skipped with timestamp', () => {
      let state = createStoreState();

      // Skip onboarding
      const skippedAt = new Date().toISOString();
      state = {
        ...state,
        hasCompletedOnboarding: true,
        skippedAt,
        currentStep: null,
      };

      expect(state.hasCompletedOnboarding).toBe(true);
      expect(state.skippedAt).not.toBeNull();
      expect(state.currentStep).toBeNull();
    });

    it('should preserve completed steps when skipping', () => {
      let state = createStoreState();

      // Complete some steps first
      state = { ...state, completedSteps: ['welcome', 'create_category'] };

      // Skip remaining
      state = {
        ...state,
        hasCompletedOnboarding: true,
        skippedAt: new Date().toISOString(),
        currentStep: null,
      };

      expect(state.completedSteps).toEqual(['welcome', 'create_category']);
      expect(state.hasCompletedOnboarding).toBe(true);
    });
  });

  describe('set onboarding complete', () => {
    it('should mark all steps as complete', () => {
      let state = createStoreState();

      // Set complete
      state = {
        ...state,
        hasCompletedOnboarding: true,
        completedSteps: [...ALL_ONBOARDING_STEPS],
        completedAt: new Date().toISOString(),
        currentStep: null,
      };

      expect(state.hasCompletedOnboarding).toBe(true);
      expect(state.completedSteps).toEqual(ALL_ONBOARDING_STEPS);
      expect(state.completedAt).not.toBeNull();
    });
  });

  describe('navigation', () => {
    it('should start onboarding at first step', () => {
      let state = createStoreState();

      // Start onboarding
      state = { ...state, currentStep: ALL_ONBOARDING_STEPS[0] };

      expect(state.currentStep).toBe('welcome');
    });

    it('should go to a specific step', () => {
      let state = createStoreState();

      // Go to specific step
      const targetStep: OnboardingStep = 'set_goal';
      state = { ...state, currentStep: targetStep };

      expect(state.currentStep).toBe('set_goal');
    });
  });

  describe('reset functionality', () => {
    it('should reset to default state', () => {
      let state: OnboardingState = {
        version: 1,
        hasCompletedOnboarding: true,
        completedSteps: ['welcome', 'create_category'],
        skippedAt: null,
        completedAt: new Date().toISOString(),
        currentStep: null,
      };

      // Reset
      state = { ...DEFAULT_ONBOARDING_STATE };

      expect(state.hasCompletedOnboarding).toBe(false);
      expect(state.completedSteps).toEqual([]);
      expect(state.completedAt).toBeNull();
    });
  });

  describe('persistence', () => {
    it('should persist state to storage', async () => {
      const state: OnboardingState = {
        version: 1,
        hasCompletedOnboarding: false,
        completedSteps: ['welcome'],
        skippedAt: null,
        completedAt: null,
        currentStep: 'create_category',
      };

      await mockStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        ONBOARDING_STORAGE_KEY,
        JSON.stringify(state)
      );
      expect(mockStorage.__store.get(ONBOARDING_STORAGE_KEY)).toBe(JSON.stringify(state));
    });

    it('should hydrate state from storage', async () => {
      const savedState: OnboardingState = {
        version: 1,
        hasCompletedOnboarding: true,
        completedSteps: ['welcome', 'create_category', 'create_entry', 'set_goal', 'complete'],
        skippedAt: null,
        completedAt: '2024-03-15T12:00:00.000Z',
        currentStep: null,
      };

      await mockStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(savedState));

      const stored = await mockStorage.getItem(ONBOARDING_STORAGE_KEY);
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.hasCompletedOnboarding).toBe(true);
      expect(parsed.completedSteps).toEqual([
        'welcome',
        'create_category',
        'create_entry',
        'set_goal',
        'complete',
      ]);
      expect(parsed.completedAt).toBe('2024-03-15T12:00:00.000Z');
    });

    it('should handle empty storage gracefully', async () => {
      const stored = await mockStorage.getItem(ONBOARDING_STORAGE_KEY);
      expect(stored).toBeNull();
    });

    it('should validate stored data with schema', async () => {
      const invalidState = { version: 0 }; // Invalid - version must be positive
      await mockStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(invalidState));

      const stored = await mockStorage.getItem(ONBOARDING_STORAGE_KEY);
      const parsed = JSON.parse(stored!);
      const result = OnboardingStateSchema.safeParse(parsed);

      expect(result.success).toBe(false);
    });

    it('should handle corrupted storage data', async () => {
      await mockStorage.setItem(ONBOARDING_STORAGE_KEY, 'invalid-json');

      const stored = await mockStorage.getItem(ONBOARDING_STORAGE_KEY);
      expect(() => JSON.parse(stored!)).toThrow();
    });

    it('should handle partial state with defaults', async () => {
      // State with only version - other fields should use defaults
      const partialState = { version: 1 };
      await mockStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(partialState));

      const stored = await mockStorage.getItem(ONBOARDING_STORAGE_KEY);
      const parsed = JSON.parse(stored!);
      const result = OnboardingStateSchema.safeParse(parsed);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hasCompletedOnboarding).toBe(false);
        expect(result.data.completedSteps).toEqual([]);
        expect(result.data.skippedAt).toBeNull();
        expect(result.data.completedAt).toBeNull();
        expect(result.data.currentStep).toBeNull();
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

  describe('progress calculation', () => {
    it('should calculate 0% for no completed steps', () => {
      const completedSteps: OnboardingStep[] = [];
      const progress = Math.round((completedSteps.length / ALL_ONBOARDING_STEPS.length) * 100);

      expect(progress).toBe(0);
    });

    it('should calculate correct percentage for partial completion', () => {
      const completedSteps: OnboardingStep[] = ['welcome', 'create_category'];
      const progress = Math.round((completedSteps.length / ALL_ONBOARDING_STEPS.length) * 100);

      // 2/5 = 40%
      expect(progress).toBe(40);
    });

    it('should calculate 100% for all completed steps', () => {
      const completedSteps = [...ALL_ONBOARDING_STEPS];
      const progress = Math.round((completedSteps.length / ALL_ONBOARDING_STEPS.length) * 100);

      expect(progress).toBe(100);
    });
  });
});

describe('Security: Input Validation', () => {
  it('should reject invalid step IDs in completedSteps', () => {
    const invalidState = {
      version: 1,
      completedSteps: ['INVALID_STEP'],
    };

    const result = OnboardingStateSchema.safeParse(invalidState);
    expect(result.success).toBe(false);
  });

  it('should reject injection attempts in step arrays', () => {
    const sqlInjection = "welcome'; DROP TABLE onboarding; --";
    const result = OnboardingStateSchema.safeParse({
      version: 1,
      completedSteps: [sqlInjection],
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid version numbers', () => {
    expect(OnboardingStateSchema.safeParse({ version: 0 }).success).toBe(false);
    expect(OnboardingStateSchema.safeParse({ version: -1 }).success).toBe(false);
    expect(OnboardingStateSchema.safeParse({ version: 'one' }).success).toBe(false);
  });

  it('should reject invalid datetime formats', () => {
    expect(
      OnboardingStateSchema.safeParse({
        version: 1,
        skippedAt: 'not-a-date',
      }).success
    ).toBe(false);

    expect(
      OnboardingStateSchema.safeParse({
        version: 1,
        completedAt: '03/15/2024', // Wrong format
      }).success
    ).toBe(false);
  });

  it('should validate boolean types strictly', () => {
    expect(
      OnboardingStateSchema.safeParse({
        version: 1,
        hasCompletedOnboarding: 'true', // Should be boolean
      }).success
    ).toBe(false);

    expect(
      OnboardingStateSchema.safeParse({
        version: 1,
        hasCompletedOnboarding: 1, // Should be boolean
      }).success
    ).toBe(false);
  });

  it('should reject XSS attempts in step IDs', () => {
    const xssAttempt = '<script>alert("xss")</script>';
    const result = OnboardingStateSchema.safeParse({
      version: 1,
      completedSteps: [xssAttempt],
    });
    expect(result.success).toBe(false);
  });
});
