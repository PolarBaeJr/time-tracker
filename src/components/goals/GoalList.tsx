/**
 * GoalList Component
 *
 * Displays all goals for a selected month with progress indicators.
 * Shows both overall and per-category goals with edit/delete actions.
 *
 * USAGE:
 * ```tsx
 * <GoalList
 *   month="2024-03-01"
 *   onEditGoal={(goal) => openEditModal(goal)}
 * />
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only the authenticated user's goals are shown
 * - Delete confirmation prevents accidental data loss
 */

import * as React from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Spinner, Text } from '@/components/ui';
import { useGoalProgress, useDeleteGoal, useCategories } from '@/hooks';
import { type MonthlyGoal, type GoalProgress } from '@/schemas';
import { borderRadius, colors, spacing } from '@/theme';

/**
 * Props for GoalList component
 */
export interface GoalListProps {
  /** Month in YYYY-MM-DD format (first day of month) */
  month: string;

  /** Callback when edit button is pressed */
  onEditGoal?: (goal: MonthlyGoal) => void;

  /** Callback when a new goal should be added */
  onAddGoal?: (type: 'overall' | 'category') => void;
}

/**
 * Show a confirmation dialog
 */
function confirmDelete(goalName: string, onConfirm: () => void): void {
  const message = `Are you sure you want to delete the "${goalName}" goal?`;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(message)) {
      onConfirm();
    }
    return;
  }

  Alert.alert('Delete Goal', message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

/**
 * Format hours for display
 */
function formatHours(hours: number): string {
  return hours.toFixed(1);
}

/**
 * Get progress bar color based on percentage
 */
function getProgressColor(percent: number, isAchieved: boolean): string {
  if (isAchieved) return colors.success;
  if (percent >= 75) return colors.success;
  if (percent >= 50) return colors.warning;
  if (percent >= 25) return colors.secondary;
  return colors.error;
}

/**
 * Individual goal progress item
 */
interface GoalProgressItemProps {
  progress: GoalProgress;
  categoryName?: string;
  categoryColor?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

function GoalProgressItem({
  progress,
  categoryName,
  categoryColor,
  onEdit,
  onDelete,
  isDeleting,
}: GoalProgressItemProps): React.ReactElement {
  const isOverall = progress.goal.category_id === null;
  const displayName = isOverall ? 'Overall Goal' : categoryName ?? 'Category Goal';
  const progressPercent = Math.min(progress.progressPercent, 100);
  const progressColor = getProgressColor(progress.progressPercent, progress.isAchieved);

  return (
    <Card padding="md" elevation="sm" style={styles.goalCard}>
      {/* Header */}
      <View style={styles.goalHeader}>
        <View style={styles.goalTitleRow}>
          {categoryColor && (
            <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
          )}
          <Text variant="body" bold>
            {displayName}
          </Text>
        </View>

        {progress.isAchieved && (
          <View style={styles.achievedBadge}>
            <Text variant="caption" color="success">
              Achieved!
            </Text>
          </View>
        )}
      </View>

      {/* Progress Stats */}
      <View style={styles.progressStats}>
        <Text variant="headingSmall">
          {formatHours(progress.actualHours)}
          <Text variant="body" color="secondary">
            {' '}
            / {formatHours(progress.targetHours)}h
          </Text>
        </Text>
        <Text variant="bodySmall" color="secondary">
          {progress.progressPercent.toFixed(0)}% complete
        </Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${progressPercent}%`,
              backgroundColor: progressColor,
            },
          ]}
        />
      </View>

      {/* Additional Stats */}
      <View style={styles.statsRow}>
        {progress.remainingHours > 0 ? (
          <>
            <View style={styles.stat}>
              <Text variant="caption" color="muted">
                Remaining
              </Text>
              <Text variant="body">{formatHours(progress.remainingHours)}h</Text>
            </View>
            {progress.daysRemaining > 0 && (
              <View style={styles.stat}>
                <Text variant="caption" color="muted">
                  Daily target
                </Text>
                <Text variant="body">{formatHours(progress.dailyRequiredToMeetGoal)}h/day</Text>
              </View>
            )}
            <View style={styles.stat}>
              <Text variant="caption" color="muted">
                Days left
              </Text>
              <Text variant="body">{progress.daysRemaining}</Text>
            </View>
          </>
        ) : (
          <View style={styles.stat}>
            <Text variant="caption" color="success">
              Goal completed!
            </Text>
            <Text variant="body" color="success">
              +{formatHours(Math.abs(progress.remainingHours))}h extra
            </Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.goalActions}>
        {onEdit && (
          <Button variant="ghost" size="sm" onPress={onEdit} disabled={isDeleting}>
            Edit
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onPress={onDelete}
            disabled={isDeleting}
            loading={isDeleting}
          >
            Delete
          </Button>
        )}
      </View>
    </Card>
  );
}

/**
 * GoalList component for displaying goals with progress
 */
export function GoalList({ month, onEditGoal, onAddGoal }: GoalListProps): React.ReactElement {
  const {
    data: progressData,
    isLoading: progressLoading,
    error: progressError,
    refetch,
  } = useGoalProgress({ month });

  const { data: categories } = useCategories();

  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const deleteGoal = useDeleteGoal({
    onSuccess: () => {
      setDeletingId(null);
      void refetch();
    },
    onError: (err) => {
      setDeletingId(null);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`Failed to delete goal: ${err.message}`);
      } else {
        Alert.alert('Error', `Failed to delete goal: ${err.message}`);
      }
    },
  });

  /**
   * Handle delete confirmation
   */
  const handleDelete = (goal: MonthlyGoal, displayName: string): void => {
    confirmDelete(displayName, () => {
      setDeletingId(goal.id);
      deleteGoal.mutate(goal.id);
    });
  };

  /**
   * Get category details by ID
   */
  const getCategoryDetails = (
    categoryId: string | null
  ): { name?: string; color?: string } | undefined => {
    if (!categoryId || !categories) return undefined;
    const category = categories.find((c) => c.id === categoryId);
    return category ? { name: category.name, color: category.color } : undefined;
  };

  // Loading state
  if (progressLoading) {
    return (
      <View style={styles.centerContainer}>
        <Spinner message="Loading goals..." />
      </View>
    );
  }

  // Error state
  if (progressError) {
    return (
      <View style={styles.centerContainer}>
        <Text variant="body" color="error">
          Failed to load goals
        </Text>
        <Button variant="outline" size="sm" onPress={() => void refetch()} style={styles.retryBtn}>
          Retry
        </Button>
      </View>
    );
  }

  // Check if there are any goals
  const hasOverall = progressData?.overall !== null;
  const hasCategories = progressData?.categories && progressData.categories.length > 0;
  const hasGoals = hasOverall || hasCategories;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Summary Header */}
      {hasGoals && (
        <View style={styles.summaryCard}>
          <Text variant="body" color="secondary">
            Total logged this month
          </Text>
          <Text variant="headingSmall">
            {formatHours(progressData?.totalLoggedHours ?? 0)} hours
          </Text>
        </View>
      )}

      {/* Overall Goal */}
      {progressData?.overall ? (
        <GoalProgressItem
          progress={progressData.overall}
          onEdit={onEditGoal ? () => onEditGoal(progressData.overall!.goal) : undefined}
          onDelete={() => handleDelete(progressData.overall!.goal, 'Overall Goal')}
          isDeleting={deletingId === progressData.overall.goal.id}
        />
      ) : (
        <Pressable
          style={styles.addGoalCard}
          onPress={() => onAddGoal?.('overall')}
          accessibilityRole="button"
          accessibilityLabel="Add overall goal"
        >
          <Text variant="body" color="primary" center>
            + Set Overall Monthly Goal
          </Text>
          <Text variant="caption" color="muted" center>
            Track total time across all categories
          </Text>
        </Pressable>
      )}

      {/* Section Divider */}
      <View style={styles.sectionDivider}>
        <Text variant="label" color="muted">
          Category Goals
        </Text>
      </View>

      {/* Category Goals */}
      {progressData?.categories.map((catProgress) => {
        const catDetails = getCategoryDetails(catProgress.goal.category_id);
        return (
          <GoalProgressItem
            key={catProgress.goal.id}
            progress={catProgress}
            categoryName={catDetails?.name}
            categoryColor={catDetails?.color}
            onEdit={onEditGoal ? () => onEditGoal(catProgress.goal) : undefined}
            onDelete={() =>
              handleDelete(catProgress.goal, catDetails?.name ?? 'Category Goal')
            }
            isDeleting={deletingId === catProgress.goal.id}
          />
        );
      })}

      {/* Add Category Goal Button */}
      {categories && categories.length > 0 && (
        <Pressable
          style={styles.addGoalCard}
          onPress={() => onAddGoal?.('category')}
          accessibilityRole="button"
          accessibilityLabel="Add category goal"
        >
          <Text variant="body" color="primary" center>
            + Add Category Goal
          </Text>
          <Text variant="caption" color="muted" center>
            Set a target for a specific category
          </Text>
        </Pressable>
      )}

      {/* Empty State - No Categories */}
      {(!categories || categories.length === 0) && (
        <View style={styles.emptyState}>
          <Text variant="bodySmall" color="muted" center>
            Create categories to set category-specific goals
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  retryBtn: {
    marginTop: spacing.md,
  },
  summaryCard: {
    backgroundColor: colors.surfaceVariant,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  goalCard: {
    marginBottom: spacing.xs,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  achievedBadge: {
    backgroundColor: colors.overlayLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.success,
  },
  progressStats: {
    marginBottom: spacing.sm,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressBar: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  stat: {
    minWidth: 80,
  },
  goalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  sectionDivider: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  addGoalCard: {
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyState: {
    padding: spacing.lg,
    alignItems: 'center',
  },
});

export default GoalList;
