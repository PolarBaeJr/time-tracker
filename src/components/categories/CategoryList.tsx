/**
 * CategoryList Component
 *
 * Displays all categories as cards with color swatch, name, type badge, and entry count.
 * Supports selection for editing and empty state handling.
 */

import * as React from 'react';
import { useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  type ListRenderItemInfo,
} from 'react-native';
import { Card, Text, Button, Spinner } from '@/components/ui';
import { colors, spacing, borderRadius } from '@/theme';
import type { Category } from '@/schemas';

/**
 * Props for individual category card
 */
interface CategoryCardProps {
  category: Category;
  entryCount?: number;
  onPress: (category: Category) => void;
}

/**
 * Individual category card component
 */
function CategoryCard({
  category,
  entryCount = 0,
  onPress,
}: CategoryCardProps): React.ReactElement {
  const handlePress = useCallback(() => {
    onPress(category);
  }, [category, onPress]);

  return (
    <Card
      pressable
      onPress={handlePress}
      padding="md"
      elevation="sm"
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${category.name} category`}
    >
      <View style={styles.cardContent}>
        {/* Color swatch */}
        <View
          style={[styles.colorSwatch, { backgroundColor: category.color }]}
        />

        {/* Category info */}
        <View style={styles.categoryInfo}>
          <Text variant="body" bold>
            {category.name}
          </Text>
          <View style={styles.metaRow}>
            {/* Type badge */}
            <View style={styles.typeBadge}>
              <Text variant="caption" color="secondary">
                {category.type}
              </Text>
            </View>
            {/* Entry count */}
            <Text variant="caption" color="muted">
              {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
            </Text>
          </View>
        </View>

        {/* Chevron indicator */}
        <Text color="muted" style={styles.chevron}>
          {'>'}
        </Text>
      </View>
    </Card>
  );
}

/**
 * Props for CategoryList component
 */
export interface CategoryListProps {
  /** Array of categories to display */
  categories: Category[];
  /** Map of category ID to entry count */
  entryCounts?: Record<string, number>;
  /** Whether categories are currently loading */
  isLoading?: boolean;
  /** Callback when a category is selected for editing */
  onCategoryPress: (category: Category) => void;
  /** Callback to create a new category */
  onCreatePress: () => void;
  /** Callback for pull-to-refresh */
  onRefresh?: () => void;
  /** Whether a refresh is in progress */
  refreshing?: boolean;
}

/**
 * Empty state component when no categories exist
 */
function EmptyState({
  onCreatePress,
}: {
  onCreatePress: () => void;
}): React.ReactElement {
  return (
    <View style={styles.emptyState}>
      <Text variant="heading" center style={styles.emptyTitle}>
        No Categories Yet
      </Text>
      <Text variant="body" color="secondary" center style={styles.emptyText}>
        Categories help you organize your time entries by project, type, or any
        other grouping that makes sense for you.
      </Text>
      <Button
        variant="primary"
        onPress={onCreatePress}
        style={styles.emptyButton}
      >
        Create Your First Category
      </Button>
    </View>
  );
}

/**
 * CategoryList component for displaying and managing categories
 *
 * @example
 * ```tsx
 * <CategoryList
 *   categories={categories}
 *   entryCounts={entryCounts}
 *   isLoading={isLoading}
 *   onCategoryPress={(cat) => openEditModal(cat)}
 *   onCreatePress={() => openCreateModal()}
 * />
 * ```
 */
export function CategoryList({
  categories,
  entryCounts = {},
  isLoading = false,
  onCategoryPress,
  onCreatePress,
  onRefresh,
  refreshing = false,
}: CategoryListProps): React.ReactElement {
  // Render individual category item
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Category>) => (
      <CategoryCard
        category={item}
        entryCount={entryCounts[item.id] ?? 0}
        onPress={onCategoryPress}
      />
    ),
    [entryCounts, onCategoryPress]
  );

  // Key extractor for FlatList
  const keyExtractor = useCallback((item: Category) => item.id, []);

  // Loading state
  if (isLoading && categories.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Spinner size="large" message="Loading categories..." />
      </View>
    );
  }

  // Empty state
  if (!isLoading && categories.length === 0) {
    return <EmptyState onCreatePress={onCreatePress} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={categories}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        onRefresh={onRefresh}
        refreshing={refreshing}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  separator: {
    height: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    marginRight: spacing.md,
  },
  categoryInfo: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  typeBadge: {
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  chevron: {
    fontSize: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    marginBottom: spacing.md,
  },
  emptyText: {
    marginBottom: spacing.lg,
    maxWidth: 280,
  },
  emptyButton: {
    minWidth: 200,
  },
});

export default CategoryList;
