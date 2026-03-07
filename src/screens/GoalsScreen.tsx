/**
 * GoalsScreen
 *
 * Main screen for managing monthly goals. Features:
 * - Month picker to navigate between months
 * - Overall goal setting (total time target)
 * - Per-category goal setting
 * - Progress visualization with percentages and remaining time
 * - Edit and delete functionality for existing goals
 *
 * USAGE:
 * ```tsx
 * // In navigation
 * <Stack.Screen name="Goals" component={GoalsScreen} />
 * ```
 *
 * SECURITY:
 * - All data access is protected by RLS policies
 * - Input validation via Zod schemas
 */

import * as React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GoalForm, GoalList } from '@/components/goals';
import { Button, Card, Text } from '@/components/ui';
import { type MonthlyGoal } from '@/schemas';
import { colors, spacing } from '@/theme';

/**
 * Get the first day of a month as YYYY-MM-DD
 */
function getFirstDayOfMonth(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}-01`;
}

/**
 * Get the first day of the current month
 */
function getCurrentMonth(): string {
  return getFirstDayOfMonth(new Date());
}

/**
 * Navigate to previous month
 */
function getPreviousMonth(month: string): string {
  const date = new Date(month);
  date.setMonth(date.getMonth() - 1);
  return getFirstDayOfMonth(date);
}

/**
 * Navigate to next month
 */
function getNextMonth(month: string): string {
  const date = new Date(month);
  date.setMonth(date.getMonth() + 1);
  return getFirstDayOfMonth(date);
}

/**
 * Format month for display
 */
function formatMonthDisplay(month: string): string {
  const date = new Date(month);
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * Check if a month is in the future (beyond current month)
 */
function isCurrentOrPastMonth(month: string): boolean {
  const currentMonth = getCurrentMonth();
  return month <= currentMonth;
}

/**
 * GoalsScreen component
 */
export function GoalsScreen(): React.ReactElement {
  // State
  const [selectedMonth, setSelectedMonth] = React.useState<string>(getCurrentMonth());
  const [isFormVisible, setIsFormVisible] = React.useState(false);
  const [formType, setFormType] = React.useState<'overall' | 'category' | 'type'>('overall');
  const [editingGoal, setEditingGoal] = React.useState<MonthlyGoal | null>(null);

  // We need a key to force GoalList to refresh after mutations
  const [listKey, setListKey] = React.useState(0);

  /**
   * Handle month navigation
   */
  const handlePreviousMonth = (): void => {
    setSelectedMonth(getPreviousMonth(selectedMonth));
  };

  const handleNextMonth = (): void => {
    setSelectedMonth(getNextMonth(selectedMonth));
  };

  const handleGoToCurrentMonth = (): void => {
    setSelectedMonth(getCurrentMonth());
  };

  /**
   * Handle opening the goal form
   */
  const handleAddGoal = (type: 'overall' | 'category' | 'type'): void => {
    setFormType(type);
    setEditingGoal(null);
    setIsFormVisible(true);
  };

  /**
   * Handle editing an existing goal
   */
  const handleEditGoal = (goal: MonthlyGoal): void => {
    if (goal.category_type !== null) {
      setFormType('type');
    } else if (goal.category_id !== null) {
      setFormType('category');
    } else {
      setFormType('overall');
    }
    setEditingGoal(goal);
    setIsFormVisible(true);
  };

  /**
   * Handle form close
   */
  const handleFormClose = (): void => {
    setIsFormVisible(false);
    setEditingGoal(null);
  };

  /**
   * Handle successful goal save
   */
  const handleFormSuccess = (): void => {
    setIsFormVisible(false);
    setEditingGoal(null);
    // Force GoalList to refresh
    setListKey(prev => prev + 1);
  };

  const isCurrentMonth = selectedMonth === getCurrentMonth();
  const showProgress = isCurrentOrPastMonth(selectedMonth);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="heading">Goals</Text>
        <Text variant="bodySmall" color="secondary">
          Set monthly targets and track progress
        </Text>
      </View>

      {/* Month Picker */}
      <Card padding="md" elevation="sm" style={styles.monthPicker}>
        <View style={styles.monthPickerRow}>
          <Pressable
            onPress={handlePreviousMonth}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            style={styles.monthNavButton}
          >
            <Text variant="headingSmall" color="primary">
              {'<'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleGoToCurrentMonth}
            disabled={isCurrentMonth}
            accessibilityRole="button"
            accessibilityLabel={isCurrentMonth ? 'Current month selected' : 'Go to current month'}
            style={styles.monthDisplay}
          >
            <Text variant="headingSmall" center>
              {formatMonthDisplay(selectedMonth)}
            </Text>
            {!isCurrentMonth && (
              <Text variant="caption" color="primary" center>
                Tap to return to current month
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleNextMonth}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            style={styles.monthNavButton}
          >
            <Text variant="headingSmall" color="primary">
              {'>'}
            </Text>
          </Pressable>
        </View>

        {/* Month Status */}
        {!showProgress && (
          <View style={styles.futureMonthBanner}>
            <Text variant="caption" color="muted" center>
              This is a future month. Set goals now to track progress later.
            </Text>
          </View>
        )}
      </Card>

      {/* Goals List */}
      <GoalList
        key={listKey}
        month={selectedMonth}
        onAddGoal={handleAddGoal}
        onEditGoal={handleEditGoal}
      />

      {/* Goal Form Modal */}
      <Modal
        visible={isFormVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleFormClose}
      >
        <View style={styles.modalContainer}>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalHeader}>
              <Text variant="headingSmall">{editingGoal ? 'Edit Goal' : 'New Goal'}</Text>
              <Button variant="ghost" size="sm" onPress={handleFormClose}>
                Close
              </Button>
            </View>

            <GoalForm
              month={selectedMonth}
              type={formType}
              initialCategoryId={editingGoal?.category_id ?? undefined}
              initialCategoryType={editingGoal?.category_type ?? undefined}
              initialTargetHours={editingGoal?.target_hours}
              onSuccess={handleFormSuccess}
              onCancel={handleFormClose}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  monthPicker: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  monthPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthNavButton: {
    padding: spacing.md,
    minWidth: 48,
    alignItems: 'center',
  },
  monthDisplay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  futureMonthBanner: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
});

export default GoalsScreen;
