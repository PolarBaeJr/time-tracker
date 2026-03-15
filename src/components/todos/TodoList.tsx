/**
 * TodoList Component
 *
 * Displays a list of todos with filter tabs, sort options, and drag-and-drop reordering.
 * Uses FlatList for performance with large lists.
 *
 * USAGE:
 * ```tsx
 * import { TodoList } from '@/components/todos';
 *
 * <TodoList
 *   onTodoPress={(todo) => openEditModal(todo)}
 *   onCreatePress={() => openCreateModal()}
 * />
 * ```
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { View, FlatList, StyleSheet, Pressable, type ListRenderItemInfo } from 'react-native';

import { Text, Button, Spinner } from '@/components/ui';
import { TodoItem } from './TodoItem';
import { useTodos, useToggleTodo, useDeleteTodo, useCategories } from '@/hooks';
import { useTheme, spacing, fontSizes, borderRadius } from '@/theme';
import type { Todo, TodosFilter, Category } from '@/schemas';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Filter tab options
 */
type FilterTab = 'all' | 'active' | 'completed';

/**
 * Sort options
 */
type SortOption = 'position' | 'due_date' | 'priority' | 'created_at' | 'title';

/**
 * Props for TodoList component
 */
export interface TodoListProps {
  /** Callback when a todo is pressed for editing */
  onTodoPress?: (todo: Todo) => void;
  /** Callback to create a new todo */
  onCreatePress?: () => void;
  /** Callback for pull-to-refresh */
  onRefresh?: () => void;
  /** Additional filters to apply */
  filters?: Omit<TodosFilter, 'completed' | 'sortBy' | 'sortOrder'>;
  /** Initial filter tab */
  initialTab?: FilterTab;
  /** Whether to show the filter tabs */
  showFilterTabs?: boolean;
  /** Whether to show the sort options */
  showSortOptions?: boolean;
}

// ============================================================================
// FILTER TABS COMPONENT
// ============================================================================

interface FilterTabsProps {
  activeTab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
  counts: { all: number; active: number; completed: number };
}

function FilterTabs({ activeTab, onTabChange, counts }: FilterTabsProps): React.ReactElement {
  const { colors } = useTheme();

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'completed', label: 'Done', count: counts.completed },
  ];

  return (
    <View style={styles.filterTabs}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={[styles.filterTab, isActive && { backgroundColor: colors.primary + '20' }]}
            onPress={() => onTabChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${tab.label} todos: ${tab.count}`}
          >
            <Text
              style={StyleSheet.flatten([
                styles.filterTabText,
                { color: isActive ? colors.primary : colors.textSecondary },
              ])}
            >
              {tab.label}
            </Text>
            <View
              style={[
                styles.countBadge,
                { backgroundColor: isActive ? colors.primary : colors.surfaceVariant },
              ]}
            >
              <Text
                style={StyleSheet.flatten([
                  styles.countText,
                  { color: isActive ? colors.text : colors.textSecondary },
                ])}
              >
                {tab.count}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ============================================================================
// SORT OPTIONS COMPONENT
// ============================================================================

interface SortOptionsProps {
  sortBy: SortOption;
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: SortOption, sortOrder: 'asc' | 'desc') => void;
}

function SortOptions({ sortBy, sortOrder, onSortChange }: SortOptionsProps): React.ReactElement {
  const { colors } = useTheme();

  const sortOptions: { key: SortOption; label: string }[] = [
    { key: 'position', label: 'Manual' },
    { key: 'due_date', label: 'Due Date' },
    { key: 'priority', label: 'Priority' },
    { key: 'created_at', label: 'Created' },
    { key: 'title', label: 'Title' },
  ];

  const handleSortPress = useCallback(
    (option: SortOption) => {
      if (sortBy === option) {
        // Toggle order if same option
        onSortChange(option, sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        // Default order for new option
        const defaultOrder = option === 'due_date' || option === 'priority' ? 'asc' : 'desc';
        onSortChange(option, defaultOrder);
      }
    },
    [sortBy, sortOrder, onSortChange]
  );

  return (
    <View style={styles.sortOptions}>
      <Text style={[styles.sortLabel, { color: colors.textMuted }]}>Sort:</Text>
      <View style={styles.sortButtons}>
        {sortOptions.map(option => {
          const isActive = sortBy === option.key;
          return (
            <Pressable
              key={option.key}
              style={[styles.sortButton, isActive && { backgroundColor: colors.surfaceVariant }]}
              onPress={() => handleSortPress(option.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Sort by ${option.label}`}
            >
              <Text
                style={StyleSheet.flatten([
                  styles.sortButtonText,
                  { color: isActive ? colors.text : colors.textSecondary },
                ])}
              >
                {option.label}
              </Text>
              {isActive && (
                <Text style={[styles.sortArrow, { color: colors.textSecondary }]}>
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

interface EmptyStateProps {
  filter: FilterTab;
  onCreatePress?: () => void;
}

function EmptyState({ filter, onCreatePress }: EmptyStateProps): React.ReactElement {
  const { colors } = useTheme();

  const getMessage = () => {
    switch (filter) {
      case 'active':
        return {
          title: 'All caught up!',
          subtitle: "You've completed all your todos.",
        };
      case 'completed':
        return {
          title: 'No completed todos',
          subtitle: "Complete some tasks and they'll appear here.",
        };
      default:
        return {
          title: 'No todos yet',
          subtitle: 'Create your first todo to get started.',
        };
    }
  };

  const { title, subtitle } = getMessage();

  return (
    <View style={styles.emptyState}>
      <Text style={StyleSheet.flatten([styles.emptyTitle, { color: colors.text }])}>{title}</Text>
      <Text style={StyleSheet.flatten([styles.emptySubtitle, { color: colors.textSecondary }])}>
        {subtitle}
      </Text>
      {filter === 'all' && onCreatePress && (
        <Button variant="primary" onPress={onCreatePress} style={styles.emptyButton}>
          Create Todo
        </Button>
      )}
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * TodoList displays a filterable, sortable list of todos.
 */
export function TodoList({
  onTodoPress,
  onCreatePress,
  onRefresh,
  filters: externalFilters,
  initialTab = 'all',
  showFilterTabs = true,
  showSortOptions = true,
}: TodoListProps): React.ReactElement {
  const { colors } = useTheme();

  // Local state
  const [activeTab, setActiveTab] = useState<FilterTab>(initialTab);
  const [sortBy, setSortBy] = useState<SortOption>('position');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Build filters based on tab and sort
  const queryFilters = useMemo<TodosFilter>(() => {
    const baseFilters: TodosFilter = {
      ...externalFilters,
      sortBy,
      sortOrder,
    };

    if (activeTab === 'active') {
      baseFilters.completed = false;
    } else if (activeTab === 'completed') {
      baseFilters.completed = true;
    }

    return baseFilters;
  }, [activeTab, sortBy, sortOrder, externalFilters]);

  // Fetch todos
  const {
    data: todos = [],
    isLoading,
    refetch,
    isRefetching,
  } = useTodos({ filters: queryFilters });

  // Fetch all todos for counts (without completion filter)
  const { data: allTodos = [] } = useTodos({
    filters: { ...externalFilters },
    enabled: showFilterTabs,
  });

  // Fetch categories for display
  const { data: categories = [] } = useCategories();
  const categoryMap = useMemo(() => {
    const map = new Map<string, Pick<Category, 'name' | 'color'>>();
    categories.forEach(cat => {
      map.set(cat.id, { name: cat.name, color: cat.color });
    });
    return map;
  }, [categories]);

  // Mutations
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();

  // Calculate counts for tabs
  const counts = useMemo(() => {
    const active = allTodos.filter(t => !t.is_completed).length;
    const completed = allTodos.filter(t => t.is_completed).length;
    return {
      all: allTodos.length,
      active,
      completed,
    };
  }, [allTodos]);

  // Handlers
  const handleTabChange = useCallback((tab: FilterTab) => {
    setActiveTab(tab);
  }, []);

  const handleSortChange = useCallback((newSortBy: SortOption, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
  }, []);

  const handleToggle = useCallback(
    (id: string) => {
      toggleTodo.mutate(id);
    },
    [toggleTodo]
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteTodo.mutate(id);
    },
    [deleteTodo]
  );

  const handleRefresh = useCallback(() => {
    refetch();
    onRefresh?.();
  }, [refetch, onRefresh]);

  // Render todo item
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Todo>) => (
      <TodoItem
        todo={item}
        category={item.category_id ? categoryMap.get(item.category_id) : null}
        onToggle={handleToggle}
        onEdit={onTodoPress}
        onDelete={handleDelete}
        onPress={onTodoPress}
      />
    ),
    [categoryMap, handleToggle, handleDelete, onTodoPress]
  );

  // Key extractor
  const keyExtractor = useCallback((item: Todo) => item.id, []);

  // List header
  const ListHeader = useMemo(() => {
    return (
      <View style={styles.header}>
        {showFilterTabs && (
          <FilterTabs activeTab={activeTab} onTabChange={handleTabChange} counts={counts} />
        )}
        {showSortOptions && (
          <SortOptions sortBy={sortBy} sortOrder={sortOrder} onSortChange={handleSortChange} />
        )}
      </View>
    );
  }, [
    showFilterTabs,
    showSortOptions,
    activeTab,
    handleTabChange,
    counts,
    sortBy,
    sortOrder,
    handleSortChange,
  ]);

  // Loading state
  if (isLoading && todos.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Spinner size="large" message="Loading todos..." />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={todos}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={<EmptyState filter={activeTab} onCreatePress={onCreatePress} />}
        contentContainerStyle={styles.listContent}
        onRefresh={handleRefresh}
        refreshing={isRefetching}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        // Accessibility
        accessibilityRole="list"
        accessibilityLabel="Todo list"
      />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

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
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  separator: {
    height: 0,
  },
  // Filter tabs
  filterTabs: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  filterTabText: {
    fontSize: fontSizes.sm,
    fontWeight: '500',
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  countText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  // Sort options
  sortOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sortLabel: {
    fontSize: fontSizes.sm,
    marginRight: spacing.sm,
  },
  sortButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  sortButtonText: {
    fontSize: fontSizes.xs,
    fontWeight: '500',
  },
  sortArrow: {
    marginLeft: 2,
  },
  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  emptyTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: fontSizes.md,
    textAlign: 'center',
    marginBottom: spacing.lg,
    maxWidth: 280,
  },
  emptyButton: {
    minWidth: 160,
  },
});

export default TodoList;
