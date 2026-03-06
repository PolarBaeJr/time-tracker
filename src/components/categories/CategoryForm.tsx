/**
 * CategoryForm Component
 *
 * Modal form for creating and editing categories.
 * Includes validation with CreateCategorySchema/UpdateCategorySchema,
 * delete functionality with confirmation, and entry reassignment option.
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Modal,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { Button, Text, Input, ColorPicker, Card } from '@/components/ui';
import { colors, spacing, borderRadius } from '@/theme';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  type Category,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@/schemas';
import { PRESET_COLORS } from '@/components/ui/ColorPicker';

/**
 * Form state interface
 */
interface FormState {
  name: string;
  color: string;
  type: string;
}

/**
 * Form errors interface
 */
interface FormErrors {
  name?: string;
  color?: string;
  type?: string;
}

/**
 * Props for CategoryForm component
 */
export interface CategoryFormProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Category to edit (null for create mode) */
  category: Category | null;
  /** Number of time entries using this category (for delete warning) */
  entryCount?: number;
  /** Whether a save operation is in progress */
  isSaving?: boolean;
  /** Whether a delete operation is in progress */
  isDeleting?: boolean;
  /** Callback when form is submitted */
  onSubmit: (data: CreateCategoryInput | UpdateCategoryInput) => void;
  /** Callback when delete is confirmed */
  onDelete?: (categoryId: string) => void;
  /** Callback when entries should be reassigned before deletion */
  onReassignEntries?: (fromCategoryId: string, toCategoryId: string) => void;
  /** Other categories available for reassignment */
  otherCategories?: Category[];
  /** Whether there's an active timer using this category */
  hasActiveTimer?: boolean;
  /** Callback to stop the active timer */
  onStopTimer?: () => void;
}

/**
 * Common category type suggestions
 */
const TYPE_SUGGESTIONS = ['work', 'personal', 'hobby', 'study', 'exercise', 'project', 'meeting'];

/**
 * CategoryForm modal component for creating and editing categories
 *
 * @example
 * ```tsx
 * <CategoryForm
 *   visible={showModal}
 *   onClose={() => setShowModal(false)}
 *   category={editingCategory}
 *   entryCount={5}
 *   onSubmit={handleSave}
 *   onDelete={handleDelete}
 * />
 * ```
 */
export function CategoryForm({
  visible,
  onClose,
  category,
  entryCount = 0,
  isSaving = false,
  isDeleting = false,
  onSubmit,
  onDelete,
  onReassignEntries,
  otherCategories = [],
  hasActiveTimer = false,
  onStopTimer,
}: CategoryFormProps): React.ReactElement {
  const isEditMode = category !== null;

  // Form state
  const [form, setForm] = useState<FormState>({
    name: '',
    color: PRESET_COLORS[0],
    type: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReassignOptions, setShowReassignOptions] = useState(false);
  const [selectedReassignCategory, setSelectedReassignCategory] = useState<string | null>(null);

  // Initialize form when category changes
  useEffect(() => {
    if (category) {
      setForm({
        name: category.name,
        color: category.color,
        type: category.type,
      });
    } else {
      setForm({
        name: '',
        color: PRESET_COLORS[0],
        type: '',
      });
    }
    setErrors({});
    setShowDeleteConfirm(false);
    setShowReassignOptions(false);
    setSelectedReassignCategory(null);
  }, [category, visible]);

  // Update form field
  const updateField = useCallback((field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear error when field is modified
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (isEditMode) {
      const result = UpdateCategorySchema.safeParse(form);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          const field = issue.path[0] as keyof FormErrors;
          newErrors[field] = issue.message;
        });
      }
    } else {
      const result = CreateCategorySchema.safeParse(form);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          const field = issue.path[0] as keyof FormErrors;
          newErrors[field] = issue.message;
        });
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form, isEditMode]);

  // Handle form submission
  const handleSubmit = useCallback(() => {
    if (!validateForm()) {
      return;
    }

    if (isEditMode) {
      // Only include changed fields for update
      const updateData: UpdateCategoryInput = {};
      if (form.name !== category?.name) updateData.name = form.name;
      if (form.color !== category?.color) updateData.color = form.color;
      if (form.type !== category?.type) updateData.type = form.type;
      onSubmit(updateData);
    } else {
      onSubmit(form as CreateCategoryInput);
    }
  }, [validateForm, isEditMode, form, category, onSubmit]);

  // Confirm deletion
  const confirmDelete = useCallback(() => {
    if (category && onDelete) {
      onDelete(category.id);
    }
  }, [category, onDelete]);

  // Handle delete initiation
  const handleDeletePress = useCallback(() => {
    if (hasActiveTimer) {
      // Show alert about active timer
      if (Platform.OS === 'web') {
        if (confirm('This category has an active timer. Stop the timer to delete the category.')) {
          onStopTimer?.();
        }
      } else {
        Alert.alert(
          'Active Timer',
          'This category has an active timer. Stop the timer before deleting the category.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Stop Timer', style: 'destructive', onPress: onStopTimer },
          ]
        );
      }
      return;
    }

    if (entryCount > 0 && otherCategories.length > 0) {
      setShowReassignOptions(true);
    } else if (entryCount > 0) {
      setShowDeleteConfirm(true);
    } else {
      // No entries, delete immediately
      confirmDelete();
    }
  }, [hasActiveTimer, entryCount, otherCategories.length, onStopTimer, confirmDelete]);

  // Handle reassignment and deletion
  const handleReassignAndDelete = useCallback(() => {
    if (category && selectedReassignCategory && onReassignEntries) {
      onReassignEntries(category.id, selectedReassignCategory);
    }
  }, [category, selectedReassignCategory, onReassignEntries]);

  // Handle proceeding to delete without reassignment
  const handleSkipReassign = useCallback(() => {
    setShowReassignOptions(false);
    setShowDeleteConfirm(true);
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    if (isSaving || isDeleting) return;
    onClose();
  }, [isSaving, isDeleting, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} disabled={isSaving || isDeleting}>
            <Text color={isSaving || isDeleting ? 'muted' : 'primary'}>Cancel</Text>
          </Pressable>
          <Text variant="heading" style={styles.title}>
            {isEditMode ? 'Edit Category' : 'New Category'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Main form content */}
          {!showDeleteConfirm && !showReassignOptions && (
            <>
              {/* Name input */}
              <Input
                label="Name"
                placeholder="Category name"
                value={form.name}
                onChangeText={(text) => updateField('name', text)}
                error={errors.name}
                maxLength={100}
                autoFocus={!isEditMode}
              />

              {/* Type input */}
              <Input
                label="Type"
                placeholder="e.g., work, hobby, study"
                value={form.type}
                onChangeText={(text) => updateField('type', text)}
                error={errors.type}
                maxLength={50}
                helperText="A classification for this category"
              />

              {/* Type suggestions */}
              <View style={styles.suggestions}>
                {TYPE_SUGGESTIONS.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => updateField('type', suggestion)}
                    style={[
                      styles.suggestionChip,
                      form.type === suggestion && styles.suggestionChipActive,
                    ]}
                  >
                    <Text
                      variant="caption"
                      color={form.type === suggestion ? 'primary' : 'secondary'}
                    >
                      {suggestion}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Color picker */}
              <ColorPicker
                label="Color"
                value={form.color}
                onChange={(color) => updateField('color', color)}
                error={errors.color}
                showCustomInput
              />

              {/* Submit button */}
              <Button
                variant="primary"
                onPress={handleSubmit}
                loading={isSaving}
                disabled={isSaving || isDeleting}
                style={styles.submitButton}
              >
                {isEditMode ? 'Save Changes' : 'Create Category'}
              </Button>

              {/* Delete button (edit mode only) */}
              {isEditMode && onDelete && (
                <Button
                  variant="danger"
                  onPress={handleDeletePress}
                  disabled={isSaving || isDeleting}
                  loading={isDeleting}
                  style={styles.deleteButton}
                >
                  Delete Category
                </Button>
              )}
            </>
          )}

          {/* Reassign options */}
          {showReassignOptions && (
            <View style={styles.confirmSection}>
              <Text variant="heading" center style={styles.confirmTitle}>
                Reassign Entries?
              </Text>
              <Text variant="body" color="secondary" center style={styles.confirmText}>
                This category has {entryCount} time {entryCount === 1 ? 'entry' : 'entries'}.
                You can reassign them to another category before deleting, or leave them uncategorized.
              </Text>

              <Text variant="label" style={styles.reassignLabel}>
                Move entries to:
              </Text>

              {otherCategories.map((cat) => {
                const isSelected = selectedReassignCategory === cat.id;
                return (
                  <Card
                    key={cat.id}
                    pressable
                    onPress={() => setSelectedReassignCategory(cat.id)}
                    padding="sm"
                    style={
                      isSelected
                        ? { ...styles.reassignCard, ...styles.reassignCardSelected }
                        : styles.reassignCard
                    }
                  >
                    <View style={styles.reassignCardContent}>
                      <View style={{ ...styles.miniSwatch, backgroundColor: cat.color }} />
                      <Text>{cat.name}</Text>
                    </View>
                  </Card>
                );
              })}

              <View style={styles.reassignActions}>
                <Button
                  variant="primary"
                  onPress={handleReassignAndDelete}
                  disabled={!selectedReassignCategory || isDeleting}
                  loading={isDeleting}
                  style={styles.reassignButton}
                >
                  Move & Delete
                </Button>
                <Button
                  variant="outline"
                  onPress={handleSkipReassign}
                  disabled={isDeleting}
                  style={styles.reassignButton}
                >
                  Leave Uncategorized
                </Button>
                <Button
                  variant="ghost"
                  onPress={() => setShowReassignOptions(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
              </View>
            </View>
          )}

          {/* Delete confirmation */}
          {showDeleteConfirm && (
            <View style={styles.confirmSection}>
              <Text variant="heading" center style={styles.confirmTitle}>
                Delete Category?
              </Text>
              {entryCount > 0 ? (
                <Text variant="body" color="secondary" center style={styles.confirmText}>
                  This category has {entryCount} time {entryCount === 1 ? 'entry' : 'entries'}.
                  Deleting it will leave those entries uncategorized (they won't be deleted).
                </Text>
              ) : (
                <Text variant="body" color="secondary" center style={styles.confirmText}>
                  Are you sure you want to delete "{category?.name}"? This action cannot be undone.
                </Text>
              )}

              <View style={styles.confirmActions}>
                <Button
                  variant="danger"
                  onPress={confirmDelete}
                  loading={isDeleting}
                  disabled={isDeleting}
                  style={styles.confirmButton}
                >
                  Delete Category
                </Button>
                <Button
                  variant="outline"
                  onPress={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  style={styles.confirmButton}
                >
                  Cancel
                </Button>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
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
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 50,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  suggestionChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  suggestionChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.overlayLight,
  },
  submitButton: {
    marginTop: spacing.lg,
  },
  deleteButton: {
    marginTop: spacing.md,
  },
  confirmSection: {
    paddingVertical: spacing.lg,
  },
  confirmTitle: {
    marginBottom: spacing.md,
  },
  confirmText: {
    marginBottom: spacing.lg,
    maxWidth: 300,
    alignSelf: 'center',
  },
  confirmActions: {
    gap: spacing.sm,
  },
  confirmButton: {
    marginVertical: spacing.xs,
  },
  reassignLabel: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  reassignCard: {
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
  },
  reassignCardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  reassignCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniSwatch: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  reassignActions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  reassignButton: {
    marginVertical: spacing.xs,
  },
});

export default CategoryForm;
