/**
 * TodoItem Component
 *
 * Displays a single todo item with checkbox, title (strikethrough when completed),
 * due date badge, priority indicator, and action buttons.
 *
 * USAGE:
 * ```tsx
 * import { TodoItem } from '@/components/todos';
 *
 * <TodoItem
 *   todo={todo}
 *   onToggle={() => toggleTodo(todo.id)}
 *   onEdit={() => openEditModal(todo)}
 *   onDelete={() => deleteTodo(todo.id)}
 * />
 * ```
 */

import * as React from 'react';
import { useCallback } from 'react';
import { View, StyleSheet, Pressable, type ViewStyle, type TextStyle } from 'react-native';

import { Card, Text, Icon } from '@/components/ui';
import { useTheme, spacing, fontSizes, borderRadius } from '@/theme';
import type { Todo, TodoPriority, Category } from '@/schemas';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for TodoItem component
 */
export interface TodoItemProps {
  /** The todo data */
  todo: Todo;
  /** Optional category information for display */
  category?: Pick<Category, 'name' | 'color'> | null;
  /** Callback when checkbox is toggled */
  onToggle?: (id: string) => void;
  /** Callback when edit button is pressed */
  onEdit?: (todo: Todo) => void;
  /** Callback when delete button is pressed */
  onDelete?: (id: string) => void;
  /** Callback when the item is pressed */
  onPress?: (todo: Todo) => void;
  /** Whether the item is being dragged */
  isDragging?: boolean;
  /** Additional container styles */
  style?: ViewStyle;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get priority badge color based on priority level
 */
function getPriorityColor(
  priority: TodoPriority,
  colors: ReturnType<typeof useTheme>['colors']
): {
  background: string;
  text: string;
} {
  switch (priority) {
    case 'urgent':
      return { background: colors.error + '20', text: colors.error };
    case 'high':
      return { background: '#F59E0B20', text: '#F59E0B' }; // Orange/warning
    case 'medium':
      return { background: colors.primary + '20', text: colors.primary };
    case 'low':
      return { background: colors.textMuted + '20', text: colors.textMuted };
    default:
      return { background: colors.surfaceVariant, text: colors.textSecondary };
  }
}

/**
 * Format due date for display
 */
function formatDueDate(dateString: string | null): string | null {
  if (!dateString) return null;

  const dueDate = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dueDateOnly = new Date(dueDate);
  dueDateOnly.setHours(0, 0, 0, 0);

  if (dueDateOnly.getTime() === today.getTime()) {
    return 'Today';
  }

  if (dueDateOnly.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dueDateOnly.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }

  // Check if overdue
  if (dueDateOnly < today) {
    const diffDays = Math.floor((today.getTime() - dueDateOnly.getTime()) / (1000 * 60 * 60 * 24));
    return `${diffDays}d overdue`;
  }

  // Future date - show formatted
  return dueDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Check if a due date is overdue
 */
function isOverdue(dateString: string | null): boolean {
  if (!dateString) return false;

  const dueDate = new Date(dateString);
  dueDate.setHours(23, 59, 59, 999);

  return dueDate < new Date();
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * TodoItem displays a single todo with checkbox, title, due date, and priority indicator.
 */
export function TodoItem({
  todo,
  category,
  onToggle,
  onEdit,
  onDelete,
  onPress,
  isDragging = false,
  style,
}: TodoItemProps): React.ReactElement {
  const { colors } = useTheme();

  const handleToggle = useCallback(() => {
    onToggle?.(todo.id);
  }, [onToggle, todo.id]);

  const handleEdit = useCallback(() => {
    onEdit?.(todo);
  }, [onEdit, todo]);

  const handleDelete = useCallback(() => {
    onDelete?.(todo.id);
  }, [onDelete, todo.id]);

  const handlePress = useCallback(() => {
    onPress?.(todo);
  }, [onPress, todo]);

  const priorityColors = getPriorityColor(todo.priority, colors);
  const formattedDueDate = formatDueDate(todo.due_date);
  const overdueStatus = !todo.is_completed && isOverdue(todo.due_date);

  return (
    <Card
      padding="md"
      elevation={isDragging ? 'md' : 'sm'}
      style={StyleSheet.flatten([styles.card, isDragging && styles.cardDragging, style])}
      pressable={!!onPress}
      onPress={handlePress}
    >
      <View style={styles.container}>
        {/* Checkbox */}
        <Pressable
          style={styles.checkbox}
          onPress={handleToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: todo.is_completed }}
          accessibilityLabel={todo.is_completed ? 'Mark as incomplete' : 'Mark as complete'}
        >
          <Icon
            name={todo.is_completed ? 'checkbox-checked' : 'checkbox-blank'}
            size={22}
            color={todo.is_completed ? colors.success : colors.textSecondary}
          />
        </Pressable>

        {/* Content */}
        <View style={styles.content}>
          {/* Title row */}
          <View style={styles.titleRow}>
            <Text
              style={
                StyleSheet.flatten([
                  styles.title,
                  { color: colors.text },
                  todo.is_completed && styles.titleCompleted,
                  todo.is_completed && { color: colors.textMuted },
                ]) as TextStyle
              }
              numberOfLines={2}
            >
              {todo.title}
            </Text>
          </View>

          {/* Content preview if available */}
          {todo.content && !todo.is_completed && (
            <Text
              style={
                StyleSheet.flatten([
                  styles.contentPreview,
                  { color: colors.textSecondary },
                ]) as TextStyle
              }
              numberOfLines={1}
            >
              {todo.content}
            </Text>
          )}

          {/* Meta row: category, due date, priority */}
          <View style={styles.metaRow}>
            {/* Category badge */}
            {category && (
              <View style={[styles.categoryBadge, { backgroundColor: category.color + '20' }]}>
                <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                <Text
                  style={
                    StyleSheet.flatten([
                      styles.categoryText,
                      { color: category.color },
                    ]) as TextStyle
                  }
                >
                  {category.name}
                </Text>
              </View>
            )}

            {/* Due date badge */}
            {formattedDueDate && (
              <View
                style={[
                  styles.dueDateBadge,
                  {
                    backgroundColor: overdueStatus ? colors.error + '20' : colors.surfaceVariant,
                  },
                ]}
              >
                <Icon
                  name="calendar"
                  size={12}
                  color={overdueStatus ? colors.error : colors.textSecondary}
                />
                <Text
                  style={
                    StyleSheet.flatten([
                      styles.dueDateText,
                      { color: overdueStatus ? colors.error : colors.textSecondary },
                    ]) as TextStyle
                  }
                >
                  {formattedDueDate}
                </Text>
              </View>
            )}

            {/* Priority badge */}
            <View style={[styles.priorityBadge, { backgroundColor: priorityColors.background }]}>
              <Text
                style={
                  StyleSheet.flatten([
                    styles.priorityText,
                    { color: priorityColors.text },
                  ]) as TextStyle
                }
              >
                {todo.priority}
              </Text>
            </View>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {onEdit && (
            <Pressable
              style={styles.actionButton}
              onPress={handleEdit}
              accessibilityRole="button"
              accessibilityLabel="Edit todo"
            >
              <Icon name="edit" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
          {onDelete && (
            <Pressable
              style={styles.actionButton}
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel="Delete todo"
            >
              <Icon name="trash" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>
    </Card>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  cardDragging: {
    opacity: 0.9,
    transform: [{ scale: 1.02 }],
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    paddingRight: spacing.sm,
    paddingTop: 2,
  },
  content: {
    flex: 1,
    minHeight: 40,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: fontSizes.md,
    fontWeight: '500',
    flex: 1,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
  },
  contentPreview: {
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
    lineHeight: fontSizes.sm * 1.4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  categoryText: {
    fontSize: fontSizes.xs,
    fontWeight: '500',
  },
  dueDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  dueDateText: {
    fontSize: fontSizes.xs,
    fontWeight: '500',
  },
  priorityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  priorityText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  actionButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
});

export default TodoItem;
