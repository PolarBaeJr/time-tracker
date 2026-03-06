/**
 * GoalProgress Component
 *
 * Displays progress toward monthly goals including:
 * - Overall monthly goal as progress bar with percentage
 * - Per-category goals as smaller progress bars
 * - Days remaining in month
 * - Required daily pace to meet goal
 *
 * USAGE:
 * ```tsx
 * import { GoalProgress } from '@/components/analytics';
 *
 * function Analytics() {
 *   return <GoalProgress month="2024-03-01" />;
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only the authenticated user's data is displayed
 */

import * as React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

import { Card, Text, Spinner } from '@/components/ui';
import { useGoalProgress } from '@/hooks/useGoalProgress';
import { useCategories } from '@/hooks/useCategories';
import { type GoalProgress as GoalProgressType } from '@/schemas';
import { colors, spacing, borderRadius } from '@/theme';

// ============================================================================
// TYPES
// ============================================================================

export interface GoalProgressProps {
  /** Month in YYYY-MM-DD format (first day of month) */
  month: string;
  /** Additional styles for the container */
  style?: ViewStyle;
  /** Whether to show category breakdown (default: true) */
  showCategories?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get the first day of the current month
 */
export function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}-01`;
}

/**
 * Format hours for display
 */
function formatHours(hours: number): string {
  if (hours >= 100) {
    return hours.toFixed(0);
  }
  return hours.toFixed(1);
}

/**
 * Get color based on progress percentage
 */
function getProgressColor(percent: number, isAchieved: boolean): string {
  if (isAchieved) return colors.success;
  if (percent >= 75) return colors.success;
  if (percent >= 50) return colors.warning;
  if (percent >= 25) return colors.primary;
  return colors.error;
}

// ============================================================================
// PROGRESS BAR COMPONENT
// ============================================================================

interface ProgressBarProps {
  /** Progress percentage (0-100) */
  percent: number;
  /** Bar color */
  color: string;
  /** Height of the bar */
  height?: number;
  /** Show percentage label */
  showLabel?: boolean;
}

function ProgressBar({
  percent,
  color,
  height = 8,
  showLabel = false,
}: ProgressBarProps): React.ReactElement {
  // Clamp percent between 0 and 100
  const clampedPercent = Math.min(100, Math.max(0, percent));

  return (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBarTrack, { height }]}>
        <View
          style={[
            styles.progressBarFill,
            {
              width: `${clampedPercent}%`,
              backgroundColor: color,
              height,
            },
          ]}
        />
      </View>
      {showLabel && (
        <Text variant="caption" color="secondary" style={styles.progressLabel}>
          {clampedPercent.toFixed(0)}%
        </Text>
      )}
    </View>
  );
}

// ============================================================================
// OVERALL GOAL CARD
// ============================================================================

interface OverallGoalCardProps {
  progress: GoalProgressType;
}

function OverallGoalCard({ progress }: OverallGoalCardProps): React.ReactElement {
  const progressColor = getProgressColor(progress.progressPercent, progress.isAchieved);

  return (
    <Card padding="md" elevation="sm" style={styles.overallCard}>
      <View style={styles.overallHeader}>
        <View style={styles.overallTitleRow}>
          <Text variant="headingSmall">Monthly Goal</Text>
          {progress.isAchieved && (
            <View style={styles.achievedBadge}>
              <Text variant="caption" style={styles.achievedText}>
                {'\u2713'} Achieved
              </Text>
            </View>
          )}
        </View>
        <Text variant="caption" color="muted">
          {progress.daysRemaining} days remaining
        </Text>
      </View>

      {/* Main progress display */}
      <View style={styles.overallProgress}>
        <View style={styles.hoursDisplay}>
          <Text variant="display" style={{ color: progressColor }}>
            {formatHours(progress.actualHours)}
          </Text>
          <Text variant="headingSmall" color="muted">
            {' / '}
            {formatHours(progress.targetHours)}h
          </Text>
        </View>

        <ProgressBar
          percent={progress.progressPercent}
          color={progressColor}
          height={12}
          showLabel
        />
      </View>

      {/* Daily pace info */}
      {!progress.isAchieved && progress.daysRemaining > 0 && (
        <View style={styles.paceInfo}>
          <Text variant="bodySmall" color="secondary">
            Need{' '}
            <Text variant="bodySmall" bold style={{ color: progressColor }}>
              {formatHours(progress.dailyRequiredToMeetGoal)}h/day
            </Text>{' '}
            to reach your goal
          </Text>
        </View>
      )}

      {/* Remaining hours */}
      {!progress.isAchieved && (
        <Text variant="caption" color="muted" style={styles.remainingText}>
          {formatHours(progress.remainingHours)}h remaining
        </Text>
      )}
    </Card>
  );
}

// ============================================================================
// CATEGORY GOAL ITEM
// ============================================================================

interface CategoryGoalItemProps {
  progress: GoalProgressType;
  categoryName: string | null;
  categoryColor: string | null;
}

function CategoryGoalItem({
  progress,
  categoryName,
  categoryColor,
}: CategoryGoalItemProps): React.ReactElement {
  const progressColor = categoryColor ?? getProgressColor(progress.progressPercent, progress.isAchieved);

  return (
    <View style={styles.categoryItem}>
      <View style={styles.categoryHeader}>
        <View style={styles.categoryNameRow}>
          <View style={[styles.categoryDot, { backgroundColor: categoryColor ?? colors.textMuted }]} />
          <Text variant="bodySmall" style={styles.categoryName}>
            {categoryName ?? 'Unknown Category'}
          </Text>
        </View>
        <Text variant="caption" color="secondary">
          {formatHours(progress.actualHours)} / {formatHours(progress.targetHours)}h
        </Text>
      </View>

      <ProgressBar percent={progress.progressPercent} color={progressColor} height={6} />

      {progress.isAchieved && (
        <Text variant="caption" color="success" style={styles.categoryAchieved}>
          {'\u2713'} Goal achieved
        </Text>
      )}
    </View>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function NoGoalsState(): React.ReactElement {
  return (
    <Card padding="lg" elevation="sm" style={styles.emptyCard}>
      <Text variant="headingSmall" center style={styles.emptyTitle}>
        No Goals Set
      </Text>
      <Text variant="body" color="muted" center>
        Set monthly goals to track your progress and stay motivated.
      </Text>
      <Text variant="caption" color="secondary" center style={styles.emptyHint}>
        Visit the Goals tab to create your first goal
      </Text>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * GoalProgress component displaying monthly goal progress
 */
export function GoalProgress({
  month,
  style,
  showCategories = true,
}: GoalProgressProps): React.ReactElement {
  const { data: progressData, isLoading: progressLoading, error: progressError } = useGoalProgress({
    month,
  });
  const { data: categories, isLoading: categoriesLoading } = useCategories();

  const isLoading = progressLoading || categoriesLoading;

  // Build category lookup map
  const categoryMap = React.useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    if (categories) {
      for (const cat of categories) {
        map.set(cat.id, { name: cat.name, color: cat.color });
      }
    }
    return map;
  }, [categories]);

  // Loading state
  if (isLoading) {
    return (
      <Card padding="lg" style={style}>
        <View style={styles.loadingContainer}>
          <Spinner message="Loading goals..." />
        </View>
      </Card>
    );
  }

  // Error state
  if (progressError) {
    return (
      <Card padding="lg" style={style}>
        <Text variant="body" color="error" center>
          Failed to load goal progress
        </Text>
        <Text variant="caption" color="muted" center>
          {progressError.message}
        </Text>
      </Card>
    );
  }

  // No goals set
  if (!progressData?.overall && (!progressData?.categories || progressData.categories.length === 0)) {
    return <NoGoalsState />;
  }

  return (
    <View style={style}>
      {/* Overall Goal */}
      {progressData?.overall && <OverallGoalCard progress={progressData.overall} />}

      {/* Category Goals */}
      {showCategories && progressData?.categories && progressData.categories.length > 0 && (
        <Card padding="md" elevation="sm" style={styles.categoriesCard}>
          <Text variant="label" color="secondary" style={styles.categoriesTitle}>
            Category Goals
          </Text>
          {progressData.categories.map((catProgress) => {
            const catInfo = catProgress.goal.category_id
              ? categoryMap.get(catProgress.goal.category_id)
              : null;
            return (
              <CategoryGoalItem
                key={catProgress.goal.id}
                progress={catProgress}
                categoryName={catInfo?.name ?? null}
                categoryColor={catInfo?.color ?? null}
              />
            );
          })}
        </Card>
      )}

      {/* Total logged summary */}
      {progressData && (
        <View style={styles.summaryRow}>
          <Text variant="caption" color="muted">
            Total logged this month:{' '}
            <Text variant="caption" bold>
              {formatHours(progressData.totalLoggedHours)}h
            </Text>
          </Text>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  loadingContainer: {
    minHeight: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overallCard: {
    marginBottom: spacing.md,
  },
  overallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  overallTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  achievedBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  achievedText: {
    color: colors.background,
    fontWeight: '600',
  },
  overallProgress: {
    marginBottom: spacing.md,
  },
  hoursDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  paceInfo: {
    backgroundColor: colors.surfaceVariant,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  remainingText: {
    textAlign: 'right',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarTrack: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    borderRadius: borderRadius.full,
  },
  progressLabel: {
    marginLeft: spacing.sm,
    minWidth: 40,
    textAlign: 'right',
  },
  categoriesCard: {
    marginBottom: spacing.md,
  },
  categoriesTitle: {
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryItem: {
    marginBottom: spacing.md,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  categoryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  categoryName: {
    flex: 1,
  },
  categoryAchieved: {
    marginTop: spacing.xs,
  },
  emptyCard: {
    alignItems: 'center',
  },
  emptyTitle: {
    marginBottom: spacing.sm,
  },
  emptyHint: {
    marginTop: spacing.md,
  },
  summaryRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});

export default GoalProgress;
