/**
 * CategoriesScreen
 *
 * Main screen for managing user-defined categories.
 * Displays category list and provides create/edit/delete functionality.
 */

import * as React from 'react';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryList, CategoryForm } from '@/components/categories';
import { Button, Text } from '@/components/ui';
import { colors, spacing } from '@/theme';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@/hooks';
import { supabase } from '@/lib/supabase';
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '@/schemas';

/**
 * Hook to fetch entry counts for all categories
 */
function useEntryCounts(categoryIds: string[]) {
  const [entryCounts, setEntryCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (categoryIds.length === 0) {
      setEntryCounts({});
      return;
    }

    const fetchCounts = async () => {
      setIsLoading(true);
      try {
        // Get counts grouped by category_id
        const { data, error } = await supabase
          .from('time_entries')
          .select('category_id')
          .in('category_id', categoryIds);

        if (error) throw error;

        // Count entries per category
        const counts: Record<string, number> = {};
        categoryIds.forEach((id) => {
          counts[id] = 0;
        });

        if (data) {
          data.forEach((entry) => {
            if (entry.category_id && counts[entry.category_id] !== undefined) {
              counts[entry.category_id]++;
            }
          });
        }

        setEntryCounts(counts);
      } catch (error) {
        console.error('Failed to fetch entry counts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCounts();
  }, [categoryIds.join(',')]);

  return { entryCounts, isLoading };
}

/**
 * Hook to check if there's an active timer for a category
 */
function useActiveTimerCategory() {
  const [activeTimerCategoryId, setActiveTimerCategoryId] = useState<string | null>(null);

  useEffect(() => {
    const fetchActiveTimer = async () => {
      try {
        const { data, error } = await supabase
          .from('active_timers')
          .select('category_id')
          .single();

        if (error && error.code !== 'PGRST116') {
          // PGRST116 = no rows returned (expected when no active timer)
          console.error('Failed to fetch active timer:', error);
        }

        setActiveTimerCategoryId(data?.category_id ?? null);
      } catch (error) {
        console.error('Failed to fetch active timer:', error);
      }
    };

    fetchActiveTimer();
  }, []);

  return activeTimerCategoryId;
}

/**
 * CategoriesScreen component
 *
 * @example
 * ```tsx
 * // In navigation stack
 * <Stack.Screen name="Categories" component={CategoriesScreen} />
 * ```
 */
export function CategoriesScreen(): React.ReactElement {
  // State
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Data hooks
  const {
    data: categories = [],
    isLoading: isCategoriesLoading,
    refetch,
  } = useCategories();

  const categoryIds = useMemo(
    () => categories.map((c) => c.id),
    [categories]
  );

  const { entryCounts } = useEntryCounts(categoryIds);
  const activeTimerCategoryId = useActiveTimerCategory();

  // Mutations
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  // Open create modal
  const handleCreatePress = useCallback(() => {
    setEditingCategory(null);
    setIsFormVisible(true);
  }, []);

  // Open edit modal
  const handleCategoryPress = useCallback((category: Category) => {
    setEditingCategory(category);
    setIsFormVisible(true);
  }, []);

  // Close modal
  const handleCloseForm = useCallback(() => {
    setIsFormVisible(false);
    setEditingCategory(null);
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(
    async (data: CreateCategoryInput | UpdateCategoryInput) => {
      try {
        if (editingCategory) {
          await updateMutation.mutateAsync({
            id: editingCategory.id,
            data: data as UpdateCategoryInput,
          });
        } else {
          await createMutation.mutateAsync(data as CreateCategoryInput);
        }
        handleCloseForm();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An error occurred';
        if (Platform.OS === 'web') {
          alert(`Failed to save category: ${message}`);
        } else {
          Alert.alert('Error', `Failed to save category: ${message}`);
        }
      }
    },
    [editingCategory, updateMutation, createMutation, handleCloseForm]
  );

  // Handle delete
  const handleDelete = useCallback(
    async (categoryId: string) => {
      try {
        await deleteMutation.mutateAsync(categoryId);
        handleCloseForm();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An error occurred';
        if (Platform.OS === 'web') {
          alert(`Failed to delete category: ${message}`);
        } else {
          Alert.alert('Error', `Failed to delete category: ${message}`);
        }
      }
    },
    [deleteMutation, handleCloseForm]
  );

  // Handle reassigning entries before deletion
  const handleReassignEntries = useCallback(
    async (fromCategoryId: string, toCategoryId: string) => {
      try {
        // Update all entries from old category to new category
        const { error } = await supabase
          .from('time_entries')
          .update({ category_id: toCategoryId })
          .eq('category_id', fromCategoryId);

        if (error) throw error;

        // Then delete the category
        await handleDelete(fromCategoryId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An error occurred';
        if (Platform.OS === 'web') {
          alert(`Failed to reassign entries: ${message}`);
        } else {
          Alert.alert('Error', `Failed to reassign entries: ${message}`);
        }
      }
    },
    [handleDelete]
  );

  // Handle stopping active timer
  const handleStopTimer = useCallback(async () => {
    try {
      const { error } = await supabase.rpc('stop_timer_and_create_entry', {
        p_notes: 'Timer stopped to delete category',
      });

      if (error) throw error;

      // Show success message
      if (Platform.OS === 'web') {
        alert('Timer stopped. You can now delete the category.');
      } else {
        Alert.alert('Timer Stopped', 'You can now delete the category.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      if (Platform.OS === 'web') {
        alert(`Failed to stop timer: ${message}`);
      } else {
        Alert.alert('Error', `Failed to stop timer: ${message}`);
      }
    }
  }, []);

  // Get other categories for reassignment (excluding the one being edited)
  const otherCategories = useMemo(
    () => categories.filter((c) => c.id !== editingCategory?.id),
    [categories, editingCategory]
  );

  // Handle pull-to-refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="display" style={styles.headerTitle}>
          Categories
        </Text>
        <Button
          variant="primary"
          size="sm"
          onPress={handleCreatePress}
          disabled={isCategoriesLoading}
        >
          Add
        </Button>
      </View>

      {/* Category list */}
      <CategoryList
        categories={categories}
        entryCounts={entryCounts}
        isLoading={isCategoriesLoading}
        onCategoryPress={handleCategoryPress}
        onCreatePress={handleCreatePress}
        onRefresh={handleRefresh}
        refreshing={isCategoriesLoading}
      />

      {/* Category form modal */}
      <CategoryForm
        visible={isFormVisible}
        onClose={handleCloseForm}
        category={editingCategory}
        entryCount={editingCategory ? entryCounts[editingCategory.id] ?? 0 : 0}
        isSaving={isSaving}
        isDeleting={isDeleting}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        onReassignEntries={handleReassignEntries}
        otherCategories={otherCategories}
        hasActiveTimer={editingCategory?.id === activeTimerCategoryId}
        onStopTimer={handleStopTimer}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 28,
  },
});

export default CategoriesScreen;
