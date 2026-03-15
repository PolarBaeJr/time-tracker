import { useSyncExternalStore } from 'react';

import { storage } from '@/lib';
import {
  OnboardingStateSchema,
  DEFAULT_ONBOARDING_STATE,
  ALL_ONBOARDING_STEPS,
  getNextOnboardingStep,
  calculateOnboardingProgress,
  type OnboardingStep,
  type OnboardingState,
} from '@/schemas/onboarding';

const ONBOARDING_STORE_STORAGE_KEY = 'worktracker.onboarding.v1';

/**
 * Onboarding Store
 *
 * Manages onboarding state using useSyncExternalStore pattern.
 * Persists to AsyncStorage for offline support.
 *
 * USAGE:
 * ```typescript
 * import { useOnboarding, completeStep, skipOnboarding } from '@/stores/onboardingStore';
 *
 * function OnboardingScreen() {
 *   const { hasCompleted, currentStep, progress } = useOnboarding();
 *
 *   if (hasCompleted) {
 *     return <MainApp />;
 *   }
 *
 *   return <OnboardingStep step={currentStep} />;
 * }
 * ```
 */

type Listener = () => void;

const listeners = new Set<Listener>();

const notifyListeners = (): void => {
  listeners.forEach(listener => listener());
};

// Internal state
let storeState: OnboardingState = { ...DEFAULT_ONBOARDING_STATE };
let isHydrated = false;

/**
 * Persist state to AsyncStorage
 */
const persistState = async (): Promise<void> => {
  try {
    await storage.setItem(ONBOARDING_STORE_STORAGE_KEY, JSON.stringify(storeState));
  } catch (error) {
    console.error('[onboardingStore] Failed to persist state:', error);
  }
};

/**
 * Hydrate store from AsyncStorage
 */
const hydrateStore = async (): Promise<void> => {
  try {
    const stored = await storage.getItem(ONBOARDING_STORE_STORAGE_KEY);
    if (!stored) {
      isHydrated = true;
      return;
    }

    const parsed: unknown = JSON.parse(stored);
    const validated = OnboardingStateSchema.safeParse(parsed);

    if (validated.success) {
      storeState = validated.data;
    } else {
      console.warn('[onboardingStore] Invalid stored state, using defaults:', validated.error);
      storeState = { ...DEFAULT_ONBOARDING_STATE };
    }

    isHydrated = true;
    notifyListeners();
  } catch (error) {
    console.error('[onboardingStore] Failed to hydrate state:', error);
    isHydrated = true;
  }
};

// Start hydration immediately
void hydrateStore();

/**
 * Get current store state
 */
export const getOnboardingStoreState = (): OnboardingState => storeState;

/**
 * Check if store has been hydrated from storage
 */
export const isOnboardingStoreHydrated = (): boolean => isHydrated;

/**
 * Subscribe to store changes
 */
export const subscribeOnboardingStore = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Check if onboarding has been completed
 */
export const hasCompletedOnboarding = (): boolean => storeState.hasCompletedOnboarding;

/**
 * Get array of completed steps
 */
export const getCompletedSteps = (): OnboardingStep[] => [...storeState.completedSteps];

/**
 * Get the timestamp when onboarding was skipped (or null)
 */
export const getSkippedAt = (): string | null => storeState.skippedAt;

/**
 * Get the timestamp when onboarding was completed (or null)
 */
export const getCompletedAt = (): string | null => storeState.completedAt;

/**
 * Get the current onboarding step
 */
export const getCurrentStep = (): OnboardingStep | null => storeState.currentStep;

/**
 * Check if a specific step has been completed
 */
export const isStepCompleted = (step: OnboardingStep): boolean => {
  return storeState.completedSteps.includes(step);
};

/**
 * Get onboarding progress percentage (0-100)
 */
export const getOnboardingProgress = (): number => {
  return calculateOnboardingProgress(storeState.completedSteps);
};

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Complete a specific onboarding step
 *
 * @param step - The step to mark as completed
 * @returns The next step, or null if onboarding is complete
 */
export const completeStep = (step: OnboardingStep): OnboardingStep | null => {
  // Don't add duplicate completed steps
  const completedSteps = storeState.completedSteps.includes(step)
    ? storeState.completedSteps
    : [...storeState.completedSteps, step];

  const nextStep = getNextOnboardingStep(step);

  // Check if this completes onboarding (completing the 'complete' step)
  const isComplete = step === 'complete' || completedSteps.length === ALL_ONBOARDING_STEPS.length;

  storeState = {
    ...storeState,
    completedSteps,
    currentStep: isComplete ? null : nextStep,
    hasCompletedOnboarding: isComplete,
    completedAt: isComplete ? new Date().toISOString() : storeState.completedAt,
  };

  notifyListeners();
  void persistState();

  return nextStep;
};

/**
 * Skip onboarding entirely
 *
 * Sets hasCompletedOnboarding to true and records skip timestamp.
 */
export const skipOnboarding = (): void => {
  storeState = {
    ...storeState,
    hasCompletedOnboarding: true,
    skippedAt: new Date().toISOString(),
    currentStep: null,
  };

  notifyListeners();
  void persistState();
};

/**
 * Set onboarding as complete (mark entire flow as done)
 */
export const setOnboardingComplete = (): void => {
  storeState = {
    ...storeState,
    hasCompletedOnboarding: true,
    completedSteps: [...ALL_ONBOARDING_STEPS],
    completedAt: new Date().toISOString(),
    currentStep: null,
  };

  notifyListeners();
  void persistState();
};

/**
 * Start onboarding flow (set current step to first step)
 */
export const startOnboarding = (): void => {
  storeState = {
    ...storeState,
    currentStep: ALL_ONBOARDING_STEPS[0],
  };

  notifyListeners();
  void persistState();
};

/**
 * Go to a specific step in onboarding
 *
 * @param step - The step to navigate to
 */
export const goToStep = (step: OnboardingStep): void => {
  storeState = {
    ...storeState,
    currentStep: step,
  };

  notifyListeners();
  void persistState();
};

/**
 * Reset onboarding state (for testing or user request)
 */
export const resetOnboarding = (): void => {
  storeState = { ...DEFAULT_ONBOARDING_STATE };
  notifyListeners();
  void persistState();
};

/**
 * Re-hydrate store from storage (useful after login/logout)
 */
export const rehydrateOnboardingStore = async (): Promise<void> => {
  isHydrated = false;
  await hydrateStore();
};

// ============================================================================
// REACT HOOKS
// ============================================================================

/**
 * React hook to use onboarding store with selector
 */
export const useOnboardingStore = <T>(selector: (state: OnboardingState) => T): T =>
  useSyncExternalStore(
    subscribeOnboardingStore,
    () => selector(storeState),
    () => selector(storeState)
  );

/**
 * React hook to get full onboarding state
 */
export const useOnboarding = (): {
  hasCompleted: boolean;
  completedSteps: OnboardingStep[];
  currentStep: OnboardingStep | null;
  skippedAt: string | null;
  completedAt: string | null;
  progress: number;
  isHydrated: boolean;
} =>
  useSyncExternalStore(
    subscribeOnboardingStore,
    () => ({
      hasCompleted: storeState.hasCompletedOnboarding,
      completedSteps: [...storeState.completedSteps],
      currentStep: storeState.currentStep,
      skippedAt: storeState.skippedAt,
      completedAt: storeState.completedAt,
      progress: calculateOnboardingProgress(storeState.completedSteps),
      isHydrated,
    }),
    () => ({
      hasCompleted: DEFAULT_ONBOARDING_STATE.hasCompletedOnboarding,
      completedSteps: [...DEFAULT_ONBOARDING_STATE.completedSteps],
      currentStep: DEFAULT_ONBOARDING_STATE.currentStep,
      skippedAt: DEFAULT_ONBOARDING_STATE.skippedAt,
      completedAt: DEFAULT_ONBOARDING_STATE.completedAt,
      progress: 0,
      isHydrated: false,
    })
  );

/**
 * React hook to check if onboarding is complete
 */
export const useHasCompletedOnboarding = (): boolean =>
  useSyncExternalStore(subscribeOnboardingStore, hasCompletedOnboarding, hasCompletedOnboarding);

/**
 * React hook to get current onboarding step
 */
export const useCurrentOnboardingStep = (): OnboardingStep | null =>
  useSyncExternalStore(subscribeOnboardingStore, getCurrentStep, getCurrentStep);

/**
 * React hook to check if store is hydrated
 */
export const useOnboardingStoreHydrated = (): boolean =>
  useSyncExternalStore(
    subscribeOnboardingStore,
    isOnboardingStoreHydrated,
    isOnboardingStoreHydrated
  );

export type { OnboardingState, OnboardingStep };
