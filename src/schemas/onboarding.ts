import { z } from 'zod';

/**
 * Onboarding Schema
 *
 * Defines the validation schemas for onboarding state management.
 * The onboarding flow tracks:
 * - Whether the user has completed onboarding
 * - Which steps they've completed
 * - If/when they skipped onboarding
 *
 * SECURITY NOTES:
 * - Onboarding state is stored client-side only
 * - No sensitive data is stored in onboarding state
 * - Skipping onboarding does not bypass any security measures
 */

/**
 * Onboarding Step IDs
 *
 * Each step represents a distinct phase of the onboarding flow.
 * Steps can be completed in order or skipped entirely.
 */
export const OnboardingStepEnum = z.enum([
  'welcome', // Initial welcome screen
  'create_category', // Guide to create first category
  'create_entry', // Guide to create first time entry
  'set_goal', // Guide to set first monthly goal
  'complete', // Final completion step
]);

export type OnboardingStep = z.infer<typeof OnboardingStepEnum>;

/**
 * All onboarding step IDs as a readonly array
 */
export const ALL_ONBOARDING_STEPS: readonly OnboardingStep[] = OnboardingStepEnum.options;

/**
 * Onboarding Step Definition Schema
 *
 * Defines metadata for each onboarding step for UI rendering.
 */
export const OnboardingStepDefinitionSchema = z.object({
  /** Step identifier */
  id: OnboardingStepEnum,

  /** Display title for the step */
  title: z.string().min(1).max(100),

  /** Description or instructions for the step */
  description: z.string().min(1).max(500),

  /** Icon name for visual representation */
  icon: z.string().min(1).max(50),

  /** Order in the onboarding flow (0-based) */
  order: z.number().int().nonnegative(),

  /** Whether this step can be skipped individually */
  skippable: z.boolean().default(true),
});

export type OnboardingStepDefinition = z.infer<typeof OnboardingStepDefinitionSchema>;

/**
 * Onboarding State Schema
 *
 * The complete state stored in AsyncStorage for onboarding.
 * Persists user progress through the onboarding flow.
 */
export const OnboardingStateSchema = z.object({
  /** Schema version for migrations */
  version: z.number().int().positive(),

  /** Whether the user has completed the full onboarding flow */
  hasCompletedOnboarding: z.boolean().default(false),

  /** Array of completed step IDs */
  completedSteps: z.array(OnboardingStepEnum).default([]),

  /**
   * ISO 8601 timestamp when onboarding was skipped
   * NULL if not skipped (completed normally or still in progress)
   */
  skippedAt: z.string().datetime({ offset: true }).nullable().default(null),

  /**
   * ISO 8601 timestamp when onboarding was completed
   * NULL if not yet completed
   */
  completedAt: z.string().datetime({ offset: true }).nullable().default(null),

  /** Current step the user is on (if in progress) */
  currentStep: OnboardingStepEnum.nullable().default(null),
});

export type OnboardingState = z.infer<typeof OnboardingStateSchema>;

/**
 * Onboarding step definitions
 *
 * Static definitions for all onboarding steps.
 * Used for rendering the onboarding UI.
 */
export const ONBOARDING_STEP_DEFINITIONS: Record<OnboardingStep, OnboardingStepDefinition> = {
  welcome: {
    id: 'welcome',
    title: 'Welcome to WorkTracker',
    description: 'Track your time, achieve your goals, and build better habits.',
    icon: 'waving-hand',
    order: 0,
    skippable: false,
  },
  create_category: {
    id: 'create_category',
    title: 'Create Your First Category',
    description: 'Categories help you organize your time entries by project or activity type.',
    icon: 'category',
    order: 1,
    skippable: true,
  },
  create_entry: {
    id: 'create_entry',
    title: 'Log Your First Time Entry',
    description: 'Start tracking your time by creating your first entry.',
    icon: 'add-circle',
    order: 2,
    skippable: true,
  },
  set_goal: {
    id: 'set_goal',
    title: 'Set a Monthly Goal',
    description: 'Goals help you stay motivated and track your progress over time.',
    icon: 'track-changes',
    order: 3,
    skippable: true,
  },
  complete: {
    id: 'complete',
    title: "You're All Set!",
    description: 'You can always access these features from the main menu.',
    icon: 'celebration',
    order: 4,
    skippable: false,
  },
};

/**
 * Default empty onboarding state
 */
export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  version: 1,
  hasCompletedOnboarding: false,
  completedSteps: [],
  skippedAt: null,
  completedAt: null,
  currentStep: null,
};

/**
 * Get the next step after a given step
 *
 * @param currentStep - Current step ID
 * @returns Next step ID or null if at the end
 */
export function getNextOnboardingStep(currentStep: OnboardingStep): OnboardingStep | null {
  const currentIndex = ALL_ONBOARDING_STEPS.indexOf(currentStep);
  if (currentIndex === -1 || currentIndex >= ALL_ONBOARDING_STEPS.length - 1) {
    return null;
  }
  return ALL_ONBOARDING_STEPS[currentIndex + 1];
}

/**
 * Get the previous step before a given step
 *
 * @param currentStep - Current step ID
 * @returns Previous step ID or null if at the beginning
 */
export function getPreviousOnboardingStep(currentStep: OnboardingStep): OnboardingStep | null {
  const currentIndex = ALL_ONBOARDING_STEPS.indexOf(currentStep);
  if (currentIndex <= 0) {
    return null;
  }
  return ALL_ONBOARDING_STEPS[currentIndex - 1];
}

/**
 * Calculate completion percentage for onboarding
 *
 * @param completedSteps - Array of completed step IDs
 * @returns Percentage complete (0-100)
 */
export function calculateOnboardingProgress(completedSteps: OnboardingStep[]): number {
  if (ALL_ONBOARDING_STEPS.length === 0) {
    return 100;
  }
  return Math.round((completedSteps.length / ALL_ONBOARDING_STEPS.length) * 100);
}
