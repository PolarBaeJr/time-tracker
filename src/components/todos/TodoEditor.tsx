/**
 * TodoEditor Component
 *
 * Form component for creating and editing todos.
 * Supports title, content, due date, priority, and category selection.
 *
 * USAGE:
 * ```tsx
 * import { TodoEditor } from '@/components/todos';
 *
 * // Create mode
 * <TodoEditor
 *   onSuccess={() => closeModal()}
 *   onCancel={() => closeModal()}
 * />
 *
 * // Edit mode
 * <TodoEditor
 *   todo={existingTodo}
 *   onSuccess={() => closeModal()}
 *   onCancel={() => closeModal()}
 * />
 * ```
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Modal, Alert, Platform } from 'react-native';

import { Button, Input, Text, Card, Spinner, Icon } from '@/components/ui';
import { useCreateTodo, useUpdateTodo, useCategories } from '@/hooks';
import { useTheme, spacing, fontSizes, borderRadius } from '@/theme';
import type { Todo, TodoPriority, Category, CreateTodoInput, UpdateTodoInput } from '@/schemas';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Form state for the todo editor
 */
interface FormState {
  title: string;
  content: string;
  categoryId: string | null;
  dueDate: string;
  priority: TodoPriority;
}

/**
 * Form validation errors
 */
interface FormErrors {
  title?: string;
  content?: string;
  dueDate?: string;
  general?: string;
}

/**
 * TodoEditor component props
 */
export interface TodoEditorProps {
  /** Existing todo to edit (null for create mode) */
  todo?: Todo | null;
  /** Callback when todo is successfully saved */
  onSuccess?: (todo: Todo) => void;
  /** Callback when user cancels */
  onCancel?: () => void;
  /** Pre-selected category ID (create mode only) */
  initialCategoryId?: string | null;
}

// ============================================================================
// PRIORITY SELECTOR
// ============================================================================

interface PrioritySelectorProps {
  value: TodoPriority;
  onChange: (priority: TodoPriority) => void;
}

function PrioritySelector({ value, onChange }: PrioritySelectorProps): React.ReactElement {
  const { colors } = useTheme();

  const priorities: { key: TodoPriority; label: string; color: string }[] = [
    { key: 'low', label: 'Low', color: colors.textMuted },
    { key: 'medium', label: 'Medium', color: colors.primary },
    { key: 'high', label: 'High', color: '#F59E0B' }, // Orange
    { key: 'urgent', label: 'Urgent', color: colors.error },
  ];

  return (
    <View style={styles.priorityContainer}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>Priority</Text>
      <View style={styles.priorityOptions}>
        {priorities.map(priority => {
          const isSelected = value === priority.key;
          return (
            <Pressable
              key={priority.key}
              style={[
                styles.priorityOption,
                { borderColor: colors.border },
                isSelected && {
                  backgroundColor: priority.color + '20',
                  borderColor: priority.color,
                },
              ]}
              onPress={() => onChange(priority.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${priority.label} priority`}
            >
              <View style={[styles.priorityDot, { backgroundColor: priority.color }]} />
              <Text
                style={StyleSheet.flatten([
                  styles.priorityLabel,
                  { color: isSelected ? priority.color : colors.textSecondary },
                ])}
              >
                {priority.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ============================================================================
// CATEGORY SELECTOR MODAL
// ============================================================================

interface CategorySelectorModalProps {
  visible: boolean;
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  isLoading?: boolean;
}

function CategorySelectorModal({
  visible,
  categories,
  selectedId,
  onSelect,
  onClose,
  isLoading,
}: CategorySelectorModalProps): React.ReactElement {
  const { colors } = useTheme();

  const handleSelect = useCallback(
    (id: string | null) => {
      onSelect(id);
      onClose();
    },
    [onSelect, onClose]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text variant="heading">Select Category</Text>
            <Button variant="ghost" size="sm" onPress={onClose} accessibilityLabel="Close">
              ✕
            </Button>
          </View>

          {isLoading ? (
            <View style={styles.modalLoading}>
              <Spinner message="Loading categories..." />
            </View>
          ) : (
            <ScrollView style={styles.categoryList}>
              {/* No category option */}
              <Pressable
                style={[
                  styles.categoryOption,
                  selectedId === null && { backgroundColor: colors.primary + '20' },
                ]}
                onPress={() => handleSelect(null)}
                accessibilityRole="button"
              >
                <Text style={{ color: colors.textSecondary }}>No category</Text>
                {selectedId === null && <Icon name="check" size={18} color={colors.primary} />}
              </Pressable>

              {categories.map(category => (
                <Pressable
                  key={category.id}
                  style={[
                    styles.categoryOption,
                    selectedId === category.id && { backgroundColor: colors.primary + '20' },
                  ]}
                  onPress={() => handleSelect(category.id)}
                  accessibilityRole="button"
                >
                  <View style={styles.categoryInfo}>
                    <View style={[styles.categoryColor, { backgroundColor: category.color }]} />
                    <View>
                      <Text style={{ color: colors.text }}>{category.name}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: fontSizes.xs }}>
                        {category.type}
                      </Text>
                    </View>
                  </View>
                  {selectedId === category.id && (
                    <Icon name="check" size={18} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * TodoEditor for creating and editing todos.
 */
export function TodoEditor({
  todo,
  onSuccess,
  onCancel,
  initialCategoryId,
}: TodoEditorProps): React.ReactElement {
  const { colors } = useTheme();
  const isEditMode = !!todo;

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();

  // Mutations
  const createTodo = useCreateTodo({
    onSuccess: data => {
      if (Platform.OS !== 'web') {
        Alert.alert('Success', 'Todo created successfully');
      }
      onSuccess?.(data);
    },
    onError: error => {
      setErrors(prev => ({ ...prev, general: error.message }));
    },
  });

  const updateTodo = useUpdateTodo({
    onSuccess: data => {
      if (Platform.OS !== 'web') {
        Alert.alert('Success', 'Todo updated successfully');
      }
      onSuccess?.(data);
    },
    onError: error => {
      setErrors(prev => ({ ...prev, general: error.message }));
    },
  });

  // Form state
  const [form, setForm] = useState<FormState>(() => ({
    title: todo?.title ?? '',
    content: todo?.content ?? '',
    categoryId: todo?.category_id ?? initialCategoryId ?? null,
    dueDate: todo?.due_date ?? '',
    priority: todo?.priority ?? 'medium',
  }));
  const [errors, setErrors] = useState<FormErrors>({});
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Selected category for display
  const selectedCategory = useMemo(
    () => categories.find(c => c.id === form.categoryId),
    [categories, form.categoryId]
  );

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (form.title.length > 500) {
      newErrors.title = 'Title must be 500 characters or less';
    }

    if (form.content.length > 5000) {
      newErrors.content = 'Content must be 5000 characters or less';
    }

    if (form.dueDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(form.dueDate)) {
        newErrors.dueDate = 'Invalid date format (use YYYY-MM-DD)';
      } else {
        const parsed = new Date(form.dueDate);
        if (isNaN(parsed.getTime())) {
          newErrors.dueDate = 'Invalid date';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    if (isEditMode && todo) {
      // Update existing todo
      const updateData: UpdateTodoInput = {
        title: form.title.trim(),
        content: form.content.trim() || null,
        category_id: form.categoryId,
        due_date: form.dueDate || null,
        priority: form.priority,
      };

      await updateTodo.mutateAsync({ id: todo.id, data: updateData });
    } else {
      // Create new todo
      const createData: CreateTodoInput = {
        title: form.title.trim(),
        content: form.content.trim() || null,
        category_id: form.categoryId,
        due_date: form.dueDate || null,
        priority: form.priority,
      };

      await createTodo.mutateAsync(createData);
    }
  };

  // Update form field
  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear related error
    if (field === 'title') setErrors(prev => ({ ...prev, title: undefined }));
    if (field === 'content') setErrors(prev => ({ ...prev, content: undefined }));
    if (field === 'dueDate') setErrors(prev => ({ ...prev, dueDate: undefined }));
  };

  const isPending = createTodo.isPending || updateTodo.isPending;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      keyboardShouldPersistTaps="handled"
    >
      <Card padding="lg" style={styles.card}>
        <Text variant="heading" style={styles.title}>
          {isEditMode ? 'Edit Todo' : 'New Todo'}
        </Text>

        {/* General error */}
        {errors.general && (
          <View style={[styles.errorBanner, { backgroundColor: colors.error + '20' }]}>
            <Text style={{ color: colors.error }}>{errors.general}</Text>
          </View>
        )}

        {/* Title */}
        <Input
          label="Title"
          value={form.title}
          onChangeText={text => updateField('title', text)}
          placeholder="What needs to be done?"
          error={errors.title}
          autoFocus={!isEditMode}
          maxLength={500}
          accessibilityLabel="Todo title"
        />

        {/* Content */}
        <Input
          label="Notes (optional)"
          value={form.content}
          onChangeText={text => updateField('content', text)}
          placeholder="Add additional details..."
          error={errors.content}
          multiline
          numberOfLines={3}
          maxLength={5000}
          helperText={`${form.content.length}/5000`}
          accessibilityLabel="Todo notes"
        />

        {/* Category selector */}
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Category</Text>
          <Pressable
            style={[
              styles.selectorButton,
              { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
            ]}
            onPress={() => setShowCategoryModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Select category"
          >
            {selectedCategory ? (
              <View style={styles.categoryInfo}>
                <View style={[styles.categoryColor, { backgroundColor: selectedCategory.color }]} />
                <Text style={{ color: colors.text }}>{selectedCategory.name}</Text>
              </View>
            ) : (
              <Text style={{ color: colors.textMuted }}>No category</Text>
            )}
            <Icon name="chevron-forward" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Due date */}
        <Input
          label="Due Date (optional)"
          value={form.dueDate}
          onChangeText={text => updateField('dueDate', text)}
          placeholder="YYYY-MM-DD"
          error={errors.dueDate}
          keyboardType="default"
          accessibilityLabel="Due date"
        />

        {/* Priority selector */}
        <PrioritySelector
          value={form.priority}
          onChange={priority => updateField('priority', priority)}
        />

        {/* Action buttons */}
        <View style={styles.actions}>
          {onCancel && (
            <Button
              variant="outline"
              onPress={onCancel}
              style={styles.cancelButton}
              disabled={isPending}
            >
              Cancel
            </Button>
          )}
          <Button
            variant="primary"
            onPress={handleSubmit}
            loading={isPending}
            disabled={!form.title.trim()}
            style={styles.submitButton}
          >
            {isEditMode ? 'Save Changes' : 'Create Todo'}
          </Button>
        </View>
      </Card>

      {/* Category selector modal */}
      <CategorySelectorModal
        visible={showCategoryModal}
        categories={categories}
        selectedId={form.categoryId}
        onSelect={id => updateField('categoryId', id)}
        onClose={() => setShowCategoryModal(false)}
        isLoading={categoriesLoading}
      />
    </ScrollView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    margin: spacing.md,
  },
  title: {
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  errorBanner: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  fieldContainer: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: 48,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  // Priority selector
  priorityContainer: {
    marginBottom: spacing.md,
  },
  priorityOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  priorityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '500',
  },
  // Modal
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalLoading: {
    paddingVertical: spacing.xl,
  },
  categoryList: {
    marginBottom: spacing.md,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  // Actions
  actions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 2,
  },
});

export default TodoEditor;
