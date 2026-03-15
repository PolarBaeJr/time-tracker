/**
 * Achievement Components
 *
 * Components for displaying and managing user achievements.
 *
 * @example
 * ```tsx
 * import {
 *   AchievementBadge,
 *   AchievementList,
 *   AchievementUnlock,
 * } from '@/components/achievements';
 *
 * // Individual badge
 * <AchievementBadge achievement={achievement} size="md" showProgress />
 *
 * // Grid/list of achievements
 * <AchievementList showCategoryTabs onAchievementPress={handlePress} />
 *
 * // Unlock celebration modal
 * <AchievementUnlock
 *   achievement={unlockedAchievement}
 *   visible={showModal}
 *   onDismiss={handleDismiss}
 *   showConfetti
 * />
 * ```
 */

// AchievementBadge - Individual achievement badge with icon, name, progress
export { AchievementBadge, type AchievementBadgeProps } from './AchievementBadge';

// AchievementList - Grid/list of all achievements with filtering
export {
  AchievementList,
  type AchievementListProps,
  type AchievementListMode,
  type AchievementFilter,
} from './AchievementList';

// AchievementUnlock - Modal/overlay for achievement unlock celebration
export { AchievementUnlock, type AchievementUnlockProps } from './AchievementUnlock';
