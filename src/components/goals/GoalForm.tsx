/**
 * GoalForm Component
 *
 * Form for setting monthly goals. Supports both:
 * - Overall goals (total time for the month)
 * - Per-category goals (time for a specific category)
 *
 * USAGE:
 * ```tsx
 * <GoalForm
 *   month="2024-03-01"
 *   type="overall"
 *   onSuccess={() => console.log('Goal saved')}
 * />
 *
 * <GoalForm
 *   month="2024-03-01"
 *   type="category"
 *   categories={categories}
 *   onSuccess={() => console.log('Goal saved')}
 * />
 * ```
 *
 * SECURITY:
 * - Input is validated with Zod schemas before mutation
 * - user_id is enforced server-side via RLS
 */

import * as React from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Input, Text } from '@/components/ui';
import { useSetOverallGoal, useSetCategoryGoal, useSetTypeGoal, useCategories } from '@/hooks';
import { type Category } from '@/schemas';
import { borderRadius, colors, spacing } from '@/theme';

/**
 * Quick-set values for common goal targets (in hours)
 */
const QUICK_SET_VALUES = [10, 20, 40, 80, 120, 160] as const;

/**
 * Props for GoalForm component
 */
export interface GoalFormProps {
  /** Month in YYYY-MM-DD format (first day of month) */
  month: string;

  /** Type of goal to create */
  type: 'overall' | 'category' | 'type';

  /** Initial category ID (for category goals) */
  initialCategoryId?: string;

  /** Initial category type (for type goals) */
  initialCategoryType?: string;

  /** Initial target hours */
  initialTargetHours?: number;

  /** Callback when goal is successfully saved */
  onSuccess?: () => void;

  /** Callback when user cancels */
  onCancel?: () => void;
}

/**
 * Display an error alert
 */
function showError(title: string, message: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}: ${message}`);
    return;
  }
  Alert.alert(title, message);
}

/**
 * Format month string for display
 */
function formatMonthDisplay(month: string): string {
  const date = new Date(month);
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * GoalForm component for creating/updating monthly goals
 */
export function GoalForm({
  month,
  type,
  initialCategoryId,
  initialCategoryType,
  initialTargetHours,
  onSuccess,
  onCancel,
}: GoalFormProps): React.ReactElement {
  // State
  const [targetHours, setTargetHours] = React.useState<string>(
    initialTargetHours?.toString() ?? ''
  );
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(
    initialCategoryId ?? null
  );
  const [selectedType, setSelectedType] = React.useState<string | null>(
    initialCategoryType ?? null
  );
  const [error, setError] = React.useState<string | null>(null);

  // Hooks
  const { data: categories, isLoading: categoriesLoading } = useCategories({
    enabled: type === 'category' || type === 'type',
  });

  const setOverallGoal = useSetOverallGoal({
    onSuccess: () => {
      onSuccess?.();
    },
    onError: err => {
      setError(err.message);
      showError('Failed to save goal', err.message);
    },
  });

  const setCategoryGoal = useSetCategoryGoal({
    onSuccess: () => {
      onSuccess?.();
    },
    onError: err => {
      setError(err.message);
      showError('Failed to save goal', err.message);
    },
  });

  const setTypeGoal = useSetTypeGoal({
    onSuccess: () => {
      onSuccess?.();
    },
    onError: err => {
      setError(err.message);
      showError('Failed to save goal', err.message);
    },
  });

  const isMutating = setOverallGoal.isPending || setCategoryGoal.isPending || setTypeGoal.isPending;

  // Derive unique types from categories
  const uniqueTypes = React.useMemo(() => {
    if (!categories) return [];
    const typeSet = new Set<string>();
    for (const cat of categories) {
      typeSet.add(cat.type);
    }
    return Array.from(typeSet).sort();
  }, [categories]);

  /**
   * Validate the form input
   */
  const validateInput = (): { valid: boolean; targetHoursNum?: number } => {
    const targetHoursNum = parseFloat(targetHours);

    if (isNaN(targetHoursNum) || targetHoursNum <= 0) {
      setError('Target hours must be a positive number');
      return { valid: false };
    }

    if (type === 'category' && !selectedCategoryId) {
      setError('Please select a category');
      return { valid: false };
    }

    if (type === 'type' && !selectedType) {
      setError('Please select a type');
      return { valid: false };
    }

    return { valid: true, targetHoursNum };
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (): Promise<void> => {
    setError(null);

    const validation = validateInput();
    if (!validation.valid || !validation.targetHoursNum) {
      return;
    }

    try {
      if (type === 'overall') {
        await setOverallGoal.mutateAsync({
          month,
          target_hours: validation.targetHoursNum,
        });
      } else if (type === 'category') {
        if (!selectedCategoryId) {
          setError('Please select a category');
          return;
        }
        await setCategoryGoal.mutateAsync({
          month,
          category_id: selectedCategoryId,
          target_hours: validation.targetHoursNum,
        });
      } else {
        if (!selectedType) {
          setError('Please select a type');
          return;
        }
        await setTypeGoal.mutateAsync({
          month,
          category_type: selectedType,
          target_hours: validation.targetHoursNum,
        });
      }
    } catch {
      // Error handling is done in the mutation hooks
    }
  };

  /**
   * Handle quick-set button press
   */
  const handleQuickSet = (hours: number): void => {
    setTargetHours(hours.toString());
    setError(null);
  };

  /**
   * Handle category selection
   */
  const handleCategorySelect = (category: Category): void => {
    setSelectedCategoryId(category.id);
    setError(null);
  };

  /**
   * Get the selected category (for display)
   */
  const selectedCategory = React.useMemo(() => {
    return categories?.find(c => c.id === selectedCategoryId);
  }, [categories, selectedCategoryId]);

  return (
    <Card padding="lg" elevation="md" style={styles.card}>
      <Text variant="headingSmall" style={styles.title}>
        {type === 'overall'
          ? 'Set Overall Goal'
          : type === 'category'
            ? 'Set Category Goal'
            : 'Set Type Goal'}
      </Text>

      <Text variant="bodySmall" color="secondary" style={styles.subtitle}>
        {formatMonthDisplay(month)}
      </Text>

      {/* Category Selector (only for category goals) */}
      {type === 'category' && (
        <View style={styles.section}>
          <Text variant="label" style={styles.sectionLabel}>
            Category
          </Text>

          {categoriesLoading ? (
            <Text variant="bodySmall" color="muted">
              Loading categories...
            </Text>
          ) : categories && categories.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
              contentContainerStyle={styles.categoryScrollContent}
            >
              {categories.map(category => (
                <Pressable
                  key={category.id}
                  onPress={() => handleCategorySelect(category)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: category.id === selectedCategoryId }}
                  accessibilityLabel={`Select ${category.name} category`}
                  style={[
                    styles.categoryChip,
                    category.id === selectedCategoryId && styles.categoryChipSelected,
                    { borderColor: category.color },
                  ]}
                >
                  <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                  <Text
                    variant="bodySmall"
                    color={category.id === selectedCategoryId ? 'default' : 'secondary'}
                  >
                    {category.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Text variant="bodySmall" color="muted">
              No categories yet. Create a category first.
            </Text>
          )}

          {selectedCategory && (
            <View style={styles.selectedCategoryBanner}>
              <View style={[styles.categoryDot, { backgroundColor: selectedCategory.color }]} />
              <Text variant="body">
                Selected: <Text bold>{selectedCategory.name}</Text>
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Type Selector (only for type goals) */}
      {type === 'type' && (
        <View style={styles.section}>
          <Text variant="label" style={styles.sectionLabel}>
            Type
          </Text>

          {categoriesLoading ? (
            <Text variant="bodySmall" color="muted">
              Loading types...
            </Text>
          ) : uniqueTypes.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
              contentContainerStyle={styles.categoryScrollContent}
            >
              {uniqueTypes.map(typeName => (
                <Pressable
                  key={typeName}
                  onPress={() => {
                    setSelectedType(typeName);
                    setError(null);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: typeName === selectedType }}
                  accessibilityLabel={`Select ${typeName} type`}
                  style={[
                    styles.categoryChip,
                    typeName === selectedType && styles.categoryChipSelected,
                  ]}
                >
                  <Text
                    variant="bodySmall"
                    color={typeName === selectedType ? 'default' : 'secondary'}
                  >
                    {typeName}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Text variant="bodySmall" color="muted">
              No types yet. Create categories with types first.
            </Text>
          )}

          {selectedType && (
            <View style={styles.selectedCategoryBanner}>
              <Text variant="body">
                Selected: <Text bold>{selectedType}</Text>
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Target Hours Input */}
      <View style={styles.section}>
        <Input
          label="Target Hours"
          placeholder="Enter target hours"
          value={targetHours}
          onChangeText={text => {
            setTargetHours(text);
            setError(null);
          }}
          keyboardType="decimal-pad"
          error={error ?? undefined}
        />
      </View>

      {/* Quick Set Buttons */}
      <View style={styles.section}>
        <Text variant="label" style={styles.sectionLabel}>
          Quick Set
        </Text>
        <View style={styles.quickSetContainer}>
          {QUICK_SET_VALUES.map(hours => (
            <Button
              key={hours}
              variant={targetHours === hours.toString() ? 'primary' : 'outline'}
              size="sm"
              onPress={() => handleQuickSet(hours)}
              style={styles.quickSetButton}
              accessibilityLabel={`Set target to ${hours} hours`}
            >
              {hours}h
            </Button>
          ))}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        {onCancel && (
          <Button
            variant="ghost"
            onPress={onCancel}
            disabled={isMutating}
            style={styles.cancelButton}
          >
            Cancel
          </Button>
        )}
        <Button
          variant="primary"
          onPress={() => void handleSubmit()}
          loading={isMutating}
          disabled={
            isMutating ||
            !targetHours ||
            (type === 'category' && !selectedCategoryId) ||
            (type === 'type' && !selectedType)
          }
          style={styles.submitButton}
        >
          Save Goal
        </Button>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
  },
  categoryScroll: {
    marginHorizontal: -spacing.sm,
  },
  categoryScrollContent: {
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    backgroundColor: colors.surfaceVariant,
    gap: spacing.xs,
  },
  categoryChipSelected: {
    backgroundColor: colors.surface,
    borderWidth: 2,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  selectedCategoryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  quickSetContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickSetButton: {
    minWidth: 56,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    maxWidth: 120,
  },
  submitButton: {
    flex: 1,
    maxWidth: 120,
  },
});

export default GoalForm;
