/**
 * CategorySelector Component
 *
 * A modal/dropdown for selecting a category before starting a timer.
 * Shows user's categories with colors AND types, allows 'No category' option.
 *
 * @example
 * ```tsx
 * <CategorySelector
 *   visible={showSelector}
 *   onClose={() => setShowSelector(false)}
 *   onSelect={(categoryId) => handleCategorySelect(categoryId)}
 *   selectedCategoryId={currentCategoryId}
 * />
 * ```
 */

import * as React from 'react';
import { useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  type ViewStyle,
  type ListRenderItem,
  Pressable,
  Dimensions,
} from 'react-native';

import { Button, Card, Text, Spinner } from '@/components/ui';
import { useCategories } from '@/hooks';
import { colors, spacing, borderRadius } from '@/theme';
import type { Category } from '@/schemas';

/**
 * Props for CategorySelector component
 */
export interface CategorySelectorProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when the modal is closed */
  onClose: () => void;
  /** Callback when a category is selected */
  onSelect: (categoryId: string | null) => void;
  /** Currently selected category ID (null for no category) */
  selectedCategoryId?: string | null;
  /** Additional styles for the container */
  style?: ViewStyle;
}

/**
 * Single category item in the list
 */
interface CategoryItemProps {
  category: Category | null; // null represents "No category"
  isSelected: boolean;
  onPress: () => void;
}

function CategoryItem({
  category,
  isSelected,
  onPress,
}: CategoryItemProps): React.ReactElement {
  const isNoCategory = category === null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.categoryItem,
        isSelected && styles.categoryItemSelected,
        pressed && styles.categoryItemPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={isNoCategory ? 'No category' : category.name}
    >
      {/* Color indicator */}
      <View
        style={[
          styles.colorIndicator,
          { backgroundColor: isNoCategory ? colors.textMuted : category.color },
        ]}
      />

      {/* Category info */}
      <View style={styles.categoryInfo}>
        <Text
          variant="body"
          style={StyleSheet.flatten(
            isSelected
              ? [styles.categoryName, styles.selectedText]
              : [styles.categoryName]
          )}
        >
          {isNoCategory ? 'No category' : category.name}
        </Text>
        {!isNoCategory && (
          <View style={styles.typeBadge}>
            <Text variant="caption" color="muted">
              {category.type}
            </Text>
          </View>
        )}
      </View>

      {/* Selection indicator */}
      {isSelected && (
        <View style={styles.checkmark}>
          <Text style={styles.checkmarkText}>{'\u2713'}</Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * CategorySelector Component
 *
 * Modal for selecting a category before starting a timer.
 * Shows user's categories with colors and types.
 */
export function CategorySelector({
  visible,
  onClose,
  onSelect,
  selectedCategoryId = null,
  style,
}: CategorySelectorProps): React.ReactElement {
  // Fetch user's categories
  const { data: categories = [], isLoading } = useCategories();

  // Handle category selection
  const handleSelect = useCallback(
    (categoryId: string | null) => {
      onSelect(categoryId);
      onClose();
    },
    [onSelect, onClose]
  );

  // Render a single category item
  const renderItem: ListRenderItem<Category> = useCallback(
    ({ item }) => (
      <CategoryItem
        category={item}
        isSelected={selectedCategoryId === item.id}
        onPress={() => handleSelect(item.id)}
      />
    ),
    [selectedCategoryId, handleSelect]
  );

  // List header with "No category" option
  const ListHeader = useCallback(
    () => (
      <CategoryItem
        category={null}
        isSelected={selectedCategoryId === null}
        onPress={() => handleSelect(null)}
      />
    ),
    [selectedCategoryId, handleSelect]
  );

  // Empty state when user has no categories
  const EmptyState = useCallback(
    () => (
      <View style={styles.emptyState}>
        <Text variant="body" color="muted" center>
          No categories yet
        </Text>
        <Text variant="caption" color="muted" center style={styles.emptyHint}>
          Create categories in the Categories tab
        </Text>
      </View>
    ),
    []
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <Card
            style={StyleSheet.flatten([styles.modal, style])}
            padding="none"
            elevation="lg"
          >
            {/* Header */}
            <View style={styles.header}>
              <Text variant="heading">Select Category</Text>
              <Button
                variant="ghost"
                size="sm"
                onPress={onClose}
                accessibilityLabel="Close"
              >
                {'\u2715'}
              </Button>
            </View>

            {/* Category list */}
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <Spinner message="Loading categories..." />
              </View>
            ) : (
              <FlatList
                data={categories}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={ListHeader}
                ListEmptyComponent={EmptyState}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                style={styles.list}
              />
            )}
          </Card>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const windowHeight = Dimensions.get('window').height;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    maxHeight: windowHeight * 0.7,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
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
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: 'transparent',
  },
  categoryItemSelected: {
    backgroundColor: colors.primaryVariant + '30', // 30% opacity
  },
  categoryItemPressed: {
    backgroundColor: colors.surfaceVariant,
  },
  colorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  categoryInfo: {
    flex: 1,
    flexDirection: 'column',
  },
  categoryName: {
    fontWeight: '500',
  },
  selectedText: {
    color: colors.primary,
  },
  typeBadge: {
    marginTop: 2,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  checkmarkText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  loadingContainer: {
    paddingVertical: spacing.xl,
  },
  emptyState: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  emptyHint: {
    marginTop: spacing.xs,
  },
});

export default CategorySelector;
