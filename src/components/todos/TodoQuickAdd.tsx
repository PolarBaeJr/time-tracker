/**
 * TodoQuickAdd Component
 *
 * A compact, single-line input for quickly adding new todos.
 * Supports quick entry with just a title, with optional expansion for more fields.
 *
 * USAGE:
 * ```tsx
 * import { TodoQuickAdd } from '@/components/todos';
 *
 * <TodoQuickAdd
 *   onSuccess={() => console.log('Todo created!')}
 *   placeholder="Add a task..."
 * />
 * ```
 */

import * as React from 'react';
import { useState, useCallback, useRef } from 'react';
import { View, TextInput, StyleSheet, Pressable, type TextInputProps } from 'react-native';

import { Icon, Text, Spinner } from '@/components/ui';
import { useCreateTodo } from '@/hooks';
import { useTheme, spacing, fontSizes, borderRadius } from '@/theme';
import type { TodoPriority, CreateTodoInput, Todo } from '@/schemas';

// ============================================================================
// TYPES
// ============================================================================

/**
 * TodoQuickAdd component props
 */
export interface TodoQuickAddProps {
  /** Callback when todo is successfully created */
  onSuccess?: (todo: Todo) => void;
  /** Callback when creation fails */
  onError?: (error: Error) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Default category ID for new todos */
  defaultCategoryId?: string | null;
  /** Default priority for new todos */
  defaultPriority?: TodoPriority;
  /** Whether to auto-focus the input */
  autoFocus?: boolean;
  /** Additional input props */
  inputProps?: Omit<TextInputProps, 'value' | 'onChangeText' | 'placeholder'>;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * TodoQuickAdd provides a quick way to add new todos with minimal friction.
 */
export function TodoQuickAdd({
  onSuccess,
  onError,
  placeholder = 'Add a todo...',
  defaultCategoryId = null,
  defaultPriority = 'medium',
  autoFocus = false,
  inputProps,
}: TodoQuickAddProps): React.ReactElement {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);

  // State
  const [title, setTitle] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Create mutation
  const createTodo = useCreateTodo({
    onSuccess: todo => {
      setTitle('');
      onSuccess?.(todo);
    },
    onError: error => {
      onError?.(error);
    },
  });

  // Handle submit
  const handleSubmit = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return;
    }

    const input: CreateTodoInput = {
      title: trimmedTitle,
      category_id: defaultCategoryId,
      priority: defaultPriority,
    };

    await createTodo.mutateAsync(input);
  }, [title, defaultCategoryId, defaultPriority, createTodo]);

  // Handle key press for enter
  const handleKeyPress = useCallback(
    (e: { nativeEvent: { key: string } }) => {
      if (e.nativeEvent.key === 'Enter') {
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Focus handlers
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  const isPending = createTodo.isPending;
  const canSubmit = title.trim().length > 0 && !isPending;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: isFocused ? colors.primary : colors.border,
        },
      ]}
    >
      {/* Add icon */}
      <View style={styles.iconContainer}>
        <Icon name="add" size={20} color={isFocused ? colors.primary : colors.textMuted} />
      </View>

      {/* Input */}
      <TextInput
        ref={inputRef}
        style={[styles.input, { color: colors.text }]}
        value={title}
        onChangeText={setTitle}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyPress={handleKeyPress}
        onSubmitEditing={handleSubmit}
        returnKeyType="done"
        autoFocus={autoFocus}
        editable={!isPending}
        maxLength={500}
        accessibilityLabel="Quick add todo"
        accessibilityHint="Enter a title and press enter to create a new todo"
        {...inputProps}
      />

      {/* Submit button */}
      {isPending ? (
        <View style={styles.submitButton}>
          <Spinner size="small" />
        </View>
      ) : canSubmit ? (
        <Pressable
          style={[styles.submitButton, { backgroundColor: colors.primary }]}
          onPress={handleSubmit}
          accessibilityRole="button"
          accessibilityLabel="Add todo"
        >
          <Icon name="check" size={16} color={colors.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ============================================================================
// EXTENDED COMPONENT - With Priority Selection
// ============================================================================

/**
 * Extended TodoQuickAdd with visible priority selection
 */
export interface TodoQuickAddExtendedProps extends TodoQuickAddProps {
  /** Whether to show priority buttons */
  showPriorityButtons?: boolean;
}

export function TodoQuickAddExtended({
  showPriorityButtons = true,
  defaultPriority = 'medium',
  ...props
}: TodoQuickAddExtendedProps): React.ReactElement {
  const { colors } = useTheme();
  const [priority, setPriority] = useState<TodoPriority>(defaultPriority);

  const priorities: { key: TodoPriority; color: string }[] = [
    { key: 'low', color: colors.textMuted },
    { key: 'medium', color: colors.primary },
    { key: 'high', color: '#F59E0B' },
    { key: 'urgent', color: colors.error },
  ];

  return (
    <View style={styles.extendedContainer}>
      <TodoQuickAdd {...props} defaultPriority={priority} />
      {showPriorityButtons && (
        <View style={styles.priorityRow}>
          <Text style={[styles.priorityLabel, { color: colors.textMuted }]}>Priority:</Text>
          <View style={styles.priorityButtons}>
            {priorities.map(p => (
              <Pressable
                key={p.key}
                style={[
                  styles.priorityButton,
                  priority === p.key && {
                    backgroundColor: p.color + '20',
                    borderColor: p.color,
                  },
                  priority !== p.key && { borderColor: colors.border },
                ]}
                onPress={() => setPriority(p.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: priority === p.key }}
                accessibilityLabel={`${p.key} priority`}
              >
                <View style={[styles.priorityDot, { backgroundColor: p.color }]} />
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    minHeight: 48,
    marginHorizontal: spacing.md,
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: fontSizes.md,
    paddingVertical: spacing.sm,
  },
  submitButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  // Extended version
  extendedContainer: {
    gap: spacing.sm,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  priorityLabel: {
    fontSize: fontSizes.sm,
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  priorityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

export default TodoQuickAdd;
