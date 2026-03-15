/**
 * Achievements Hook
 *
 * This hook provides an interface for querying and managing user achievements.
 * It combines data from the achievement store and provides calculation triggers.
 *
 * USAGE:
 * ```typescript
 * import { useAchievements } from '@/hooks/useAchievements';
 *
 * function AchievementsList() {
 *   const { achievements, unlockedAchievements, recalculate, isCalculating } = useAchievements();
 *
 *   return (
 *     <View>
 *       <Text>Unlocked: {unlockedAchievements.length}</Text>
 *       {achievements.map(a => <AchievementBadge key={a.id} achievement={a} />)}
 *       <Button onPress={recalculate} loading={isCalculating}>
 *         Refresh Progress
 *       </Button>
 *     </View>
 *   );
 * }
 * ```
 *
 * SECURITY:
 * - Achievement calculations use locally cached data only
 * - No server-side state modification
 * - User cannot manipulate achievement unlocks via API (local validation only)
 */

import { useCallback, useState, useEffect } from 'react';

import {
  useAllAchievements,
  useUnlockedAchievements,
  useLockedAchievements,
  usePendingAchievementNotifications,
  useAchievementStoreHydrated,
  acknowledgeAchievement,
  acknowledgeAllAchievements,
  type Achievement,
  type AchievementId,
} from '@/stores/achievementStore';
import { calculateAndUpdateAchievements } from '@/services/achievementService';
import { AchievementCategoryEnum, type AchievementCategory } from '@/schemas/achievement';

/**
 * Options for the useAchievements hook
 */
export interface UseAchievementsOptions {
  /**
   * Auto-calculate achievements when hook mounts
   * @default true
   */
  autoCalculate?: boolean;

  /**
   * Filter achievements by category
   */
  category?: AchievementCategory;
}

/**
 * Return type for the useAchievements hook
 */
export interface UseAchievementsResult {
  /** All achievements with their progress */
  achievements: Achievement[];

  /** Only unlocked achievements */
  unlockedAchievements: Achievement[];

  /** Only locked achievements */
  lockedAchievements: Achievement[];

  /** Newly unlocked achievements awaiting acknowledgment */
  pendingNotifications: AchievementId[];

  /** Number of unlocked achievements */
  unlockedCount: number;

  /** Total number of achievements */
  totalCount: number;

  /** Whether achievements are being recalculated */
  isCalculating: boolean;

  /** Whether the store has been hydrated from storage */
  isHydrated: boolean;

  /** Trigger recalculation of all achievements */
  recalculate: () => Promise<AchievementId[]>;

  /** Acknowledge a pending notification */
  acknowledge: (id: AchievementId) => void;

  /** Acknowledge all pending notifications */
  acknowledgeAll: () => void;

  /** Get achievement by ID */
  getAchievement: (id: AchievementId) => Achievement | undefined;

  /** Get achievements by category */
  getByCategory: (category: AchievementCategory) => Achievement[];
}

/**
 * Hook to access and manage achievements
 *
 * @param options - Configuration options
 * @returns Achievement data and management functions
 *
 * @example
 * ```typescript
 * // Basic usage
 * const { achievements, unlockedCount, totalCount } = useAchievements();
 *
 * // Filter by category
 * const { achievements } = useAchievements({ category: 'streak' });
 *
 * // Disable auto-calculation
 * const { recalculate } = useAchievements({ autoCalculate: false });
 * ```
 */
export function useAchievements(options?: UseAchievementsOptions): UseAchievementsResult {
  const { autoCalculate = true, category } = options ?? {};

  const [isCalculating, setIsCalculating] = useState(false);

  // Get data from store
  const allAchievements = useAllAchievements();
  const unlockedAchievements = useUnlockedAchievements();
  const lockedAchievements = useLockedAchievements();
  const pendingNotifications = usePendingAchievementNotifications();
  const isHydrated = useAchievementStoreHydrated();

  // Filter by category if specified
  const achievements = category
    ? allAchievements.filter(a => a.category === category)
    : allAchievements;

  const filteredUnlocked = category
    ? unlockedAchievements.filter(a => a.category === category)
    : unlockedAchievements;

  const filteredLocked = category
    ? lockedAchievements.filter(a => a.category === category)
    : lockedAchievements;

  /**
   * Recalculate all achievements from cached data
   */
  const recalculate = useCallback(async (): Promise<AchievementId[]> => {
    setIsCalculating(true);
    try {
      const newlyUnlocked = await calculateAndUpdateAchievements();
      return newlyUnlocked;
    } finally {
      setIsCalculating(false);
    }
  }, []);

  /**
   * Get a single achievement by ID
   */
  const getAchievement = useCallback(
    (id: AchievementId): Achievement | undefined => {
      return allAchievements.find(a => a.id === id);
    },
    [allAchievements]
  );

  /**
   * Get achievements by category
   */
  const getByCategory = useCallback(
    (cat: AchievementCategory): Achievement[] => {
      return allAchievements.filter(a => a.category === cat);
    },
    [allAchievements]
  );

  // Auto-calculate on mount if enabled and hydrated
  useEffect(() => {
    if (autoCalculate && isHydrated) {
      void recalculate();
    }
  }, [autoCalculate, isHydrated, recalculate]);

  return {
    achievements,
    unlockedAchievements: filteredUnlocked,
    lockedAchievements: filteredLocked,
    pendingNotifications,
    unlockedCount: filteredUnlocked.length,
    totalCount: achievements.length,
    isCalculating,
    isHydrated,
    recalculate,
    acknowledge: acknowledgeAchievement,
    acknowledgeAll: acknowledgeAllAchievements,
    getAchievement,
    getByCategory,
  };
}

/**
 * Hook to get a single achievement by ID
 *
 * @param id - Achievement ID to look up
 * @returns Achievement or undefined if not found
 */
export function useAchievement(id: AchievementId): Achievement | undefined {
  const allAchievements = useAllAchievements();
  return allAchievements.find(a => a.id === id);
}

/**
 * Hook to check if any achievements are pending notification
 *
 * @returns true if there are pending notifications
 */
export function useHasPendingAchievements(): boolean {
  const pending = usePendingAchievementNotifications();
  return pending.length > 0;
}

/**
 * Hook to get achievement categories
 *
 * @returns Array of achievement categories
 */
export function useAchievementCategories(): AchievementCategory[] {
  return AchievementCategoryEnum.options;
}

// Export types and constants
export type { Achievement, AchievementId, AchievementCategory };
