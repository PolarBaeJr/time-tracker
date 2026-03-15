import { useSyncExternalStore } from 'react';

import { storage } from '@/lib';
import {
  AchievementStateSchema,
  DEFAULT_ACHIEVEMENT_STATE,
  ACHIEVEMENT_DEFINITIONS,
  ALL_ACHIEVEMENT_IDS,
  type AchievementId,
  type AchievementState,
  type UserAchievement,
  type Achievement,
} from '@/schemas/achievement';

const ACHIEVEMENT_STORE_STORAGE_KEY = 'worktracker.achievements.v1';

/**
 * Achievement Store
 *
 * Manages achievement state using useSyncExternalStore pattern.
 * Persists to AsyncStorage for offline support.
 *
 * NOTE: Achievement calculations happen in achievementService.ts.
 * This store only manages state persistence and notifications.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

const notifyListeners = (): void => {
  listeners.forEach(listener => listener());
};

// Internal state
let storeState: AchievementState = { ...DEFAULT_ACHIEVEMENT_STATE };
let isHydrated = false;

/**
 * Persist state to AsyncStorage
 */
const persistState = async (): Promise<void> => {
  try {
    await storage.setItem(ACHIEVEMENT_STORE_STORAGE_KEY, JSON.stringify(storeState));
  } catch (error) {
    console.error('[achievementStore] Failed to persist state:', error);
  }
};

/**
 * Hydrate store from AsyncStorage
 */
const hydrateStore = async (): Promise<void> => {
  try {
    const stored = await storage.getItem(ACHIEVEMENT_STORE_STORAGE_KEY);
    if (!stored) {
      isHydrated = true;
      return;
    }

    const parsed: unknown = JSON.parse(stored);
    const validated = AchievementStateSchema.safeParse(parsed);

    if (validated.success) {
      storeState = validated.data;
    } else {
      console.warn('[achievementStore] Invalid stored state, using defaults:', validated.error);
      storeState = { ...DEFAULT_ACHIEVEMENT_STATE };
    }

    isHydrated = true;
    notifyListeners();
  } catch (error) {
    console.error('[achievementStore] Failed to hydrate state:', error);
    isHydrated = true;
  }
};

// Start hydration immediately
void hydrateStore();

/**
 * Get current store state
 */
export const getAchievementStoreState = (): AchievementState => storeState;

/**
 * Check if store has been hydrated from storage
 */
export const isAchievementStoreHydrated = (): boolean => isHydrated;

/**
 * Subscribe to store changes
 */
export const subscribeAchievementStore = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Get a single user achievement progress
 */
export const getUserAchievement = (id: AchievementId): UserAchievement | undefined => {
  return storeState.achievements?.[id];
};

/**
 * Get all achievements with their definitions and progress
 */
export const getAllAchievements = (): Achievement[] => {
  return ALL_ACHIEVEMENT_IDS.map(id => {
    const definition = ACHIEVEMENT_DEFINITIONS[id];
    const userProgress = storeState.achievements?.[id];
    const progress = userProgress?.progress ?? 0;
    const targetValue = definition.targetValue ?? 1;

    return {
      id,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      category: definition.category,
      targetValue: definition.targetValue,
      progress,
      progressPercent: Math.min(100, (progress / targetValue) * 100),
      unlockedAt: userProgress?.unlockedAt ?? null,
      isUnlocked: userProgress?.unlockedAt !== null && userProgress?.unlockedAt !== undefined,
    };
  });
};

/**
 * Get achievements that have been unlocked
 */
export const getUnlockedAchievements = (): Achievement[] => {
  return getAllAchievements().filter(a => a.isUnlocked);
};

/**
 * Get achievements that are locked (not yet unlocked)
 */
export const getLockedAchievements = (): Achievement[] => {
  return getAllAchievements().filter(a => !a.isUnlocked);
};

/**
 * Get pending notifications (newly unlocked achievements)
 */
export const getPendingNotifications = (): AchievementId[] => {
  return [...storeState.pendingNotifications];
};

/**
 * Update achievement progress
 * Returns true if the achievement was newly unlocked
 */
export const updateAchievementProgress = (id: AchievementId, progress: number): boolean => {
  const definition = ACHIEVEMENT_DEFINITIONS[id];
  const targetValue = definition.targetValue ?? 1;
  const existingProgress = storeState.achievements?.[id];
  const wasUnlocked =
    existingProgress?.unlockedAt !== null && existingProgress?.unlockedAt !== undefined;
  const shouldUnlock = progress >= targetValue && !wasUnlocked;

  const userAchievement: UserAchievement = {
    id,
    progress,
    unlockedAt: shouldUnlock ? new Date().toISOString() : (existingProgress?.unlockedAt ?? null),
    acknowledged: existingProgress?.acknowledged ?? false,
  };

  storeState = {
    ...storeState,
    achievements: {
      ...storeState.achievements,
      [id]: userAchievement,
    },
    lastCalculatedAt: new Date().toISOString(),
    pendingNotifications: shouldUnlock
      ? [...storeState.pendingNotifications, id]
      : storeState.pendingNotifications,
  };

  notifyListeners();
  void persistState();

  return shouldUnlock;
};

/**
 * Bulk update multiple achievement progress values
 * Returns array of newly unlocked achievement IDs
 */
export const updateMultipleAchievements = (
  updates: Array<{ id: AchievementId; progress: number }>
): AchievementId[] => {
  const newlyUnlocked: AchievementId[] = [];

  const newAchievements = { ...storeState.achievements };

  for (const { id, progress } of updates) {
    const definition = ACHIEVEMENT_DEFINITIONS[id];
    const targetValue = definition.targetValue ?? 1;
    const existingProgress = newAchievements[id];
    const wasUnlocked =
      existingProgress?.unlockedAt !== null && existingProgress?.unlockedAt !== undefined;
    const shouldUnlock = progress >= targetValue && !wasUnlocked;

    if (shouldUnlock) {
      newlyUnlocked.push(id);
    }

    newAchievements[id] = {
      id,
      progress,
      unlockedAt: shouldUnlock ? new Date().toISOString() : (existingProgress?.unlockedAt ?? null),
      acknowledged: existingProgress?.acknowledged ?? false,
    };
  }

  storeState = {
    ...storeState,
    achievements: newAchievements,
    lastCalculatedAt: new Date().toISOString(),
    pendingNotifications: [...storeState.pendingNotifications, ...newlyUnlocked],
  };

  notifyListeners();
  void persistState();

  return newlyUnlocked;
};

/**
 * Acknowledge a pending notification (remove from pending list)
 */
export const acknowledgeAchievement = (id: AchievementId): void => {
  const existingProgress = storeState.achievements?.[id];
  if (!existingProgress) return;

  storeState = {
    ...storeState,
    achievements: {
      ...storeState.achievements,
      [id]: {
        ...existingProgress,
        acknowledged: true,
      },
    },
    pendingNotifications: storeState.pendingNotifications.filter(aId => aId !== id),
  };

  notifyListeners();
  void persistState();
};

/**
 * Acknowledge all pending notifications
 */
export const acknowledgeAllAchievements = (): void => {
  const newAchievements = { ...storeState.achievements };

  for (const id of storeState.pendingNotifications) {
    const existing = newAchievements[id];
    if (existing) {
      newAchievements[id] = {
        ...existing,
        acknowledged: true,
      };
    }
  }

  storeState = {
    ...storeState,
    achievements: newAchievements,
    pendingNotifications: [],
  };

  notifyListeners();
  void persistState();
};

/**
 * Clear all achievement data (for testing or reset)
 */
export const clearAchievements = (): void => {
  storeState = { ...DEFAULT_ACHIEVEMENT_STATE };
  notifyListeners();
  void persistState();
};

/**
 * Re-hydrate store from storage (useful after login/logout)
 */
export const rehydrateAchievementStore = async (): Promise<void> => {
  isHydrated = false;
  await hydrateStore();
};

/**
 * React hook to use achievement store with selector
 */
export const useAchievementStore = <T>(selector: (state: AchievementState) => T): T =>
  useSyncExternalStore(
    subscribeAchievementStore,
    () => selector(storeState),
    () => selector(storeState)
  );

/**
 * React hook to get all achievements with progress
 */
export const useAllAchievements = (): Achievement[] =>
  useSyncExternalStore(subscribeAchievementStore, getAllAchievements, getAllAchievements);

/**
 * React hook to get unlocked achievements
 */
export const useUnlockedAchievements = (): Achievement[] =>
  useSyncExternalStore(subscribeAchievementStore, getUnlockedAchievements, getUnlockedAchievements);

/**
 * React hook to get locked achievements
 */
export const useLockedAchievements = (): Achievement[] =>
  useSyncExternalStore(subscribeAchievementStore, getLockedAchievements, getLockedAchievements);

/**
 * React hook to get pending notifications
 */
export const usePendingAchievementNotifications = (): AchievementId[] =>
  useSyncExternalStore(subscribeAchievementStore, getPendingNotifications, getPendingNotifications);

/**
 * React hook to check if store is hydrated
 */
export const useAchievementStoreHydrated = (): boolean =>
  useSyncExternalStore(
    subscribeAchievementStore,
    isAchievementStoreHydrated,
    isAchievementStoreHydrated
  );

export type { AchievementState, Achievement, AchievementId };
