/**
 * NoteEditor Component
 *
 * Modal form for creating and editing notes.
 * Includes validation with CreateNoteSchema/UpdateNoteSchema,
 * category selection, and delete functionality.
 *
 * USAGE:
 * ```tsx
 * import { NoteEditor } from '@/components/notes';
 *
 * <NoteEditor
 *   visible={showEditor}
 *   onClose={() => setShowEditor(false)}
 *   note={editingNote}
 *   categories={categories}
 *   onSubmit={handleSave}
 *   onDelete={handleDelete}
 *   isSaving={isSaving}
 *   isDeleting={isDeleting}
 * />
 * ```
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  View,
  Modal,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Button, Text, Input, Card } from '@/components/ui';
import { colors, spacing, borderRadius, fontSizes } from '@/theme';
import {
  CreateNoteSchema,
  UpdateNoteSchema,
  type Note,
  type Category,
  type CreateNoteInput,
  type UpdateNoteInput,
} from '@/schemas';

/**
 * Form state interface
 */
interface FormState {
  title: string;
  content: string;
  category_id: string | null;
  pinned: boolean;
}

/**
 * Form errors interface
 */
interface FormErrors {
  title?: string;
  content?: string;
}

/**
 * Props for NoteEditor component
 */
export interface NoteEditorProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Note to edit (null for create mode) */
  note: Note | null;
  /** Available categories for selection */
  categories?: Category[];
  /** Whether a save operation is in progress */
  isSaving?: boolean;
  /** Whether a delete operation is in progress */
  isDeleting?: boolean;
  /** Callback when form is submitted */
  onSubmit: (data: CreateNoteInput | UpdateNoteInput, noteId?: string) => void;
  /** Callback when delete is confirmed */
  onDelete?: (noteId: string) => void;
}

/**
 * NoteEditor modal component for creating and editing notes
 */
export function NoteEditor({
  visible,
  onClose,
  note,
  categories = [],
  isSaving = false,
  isDeleting = false,
  onSubmit,
  onDelete,
}: NoteEditorProps): React.ReactElement {
  const isEditMode = note !== null;

  // Form state
  const getInitialForm = (): FormState =>
    note
      ? {
          title: note.title,
          content: note.content || '',
          category_id: note.category_id,
          pinned: note.pinned,
        }
      : {
          title: '',
          content: '',
          category_id: null,
          pinned: false,
        };

  // Track previous note/visible to reset form during render
  const currentKey = `${note?.id ?? 'new'}-${visible}`;
  const [prevKey, setPrevKey] = useState(currentKey);

  const [form, setForm] = useState<FormState>(getInitialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Reset form when note or visibility changes
  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setForm(getInitialForm());
    setErrors({});
    setShowDeleteConfirm(false);
    setShowCategoryPicker(false);
  }

  // Update form field
  const updateField = useCallback(<K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear error when field is modified
    if (field === 'title' || field === 'content') {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, []);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    const dataToValidate = {
      title: form.title,
      content: form.content || null,
      category_id: form.category_id,
      pinned: form.pinned,
    };

    if (isEditMode) {
      const result = UpdateNoteSchema.safeParse(dataToValidate);
      if (!result.success) {
        result.error.issues.forEach(issue => {
          const field = issue.path[0] as keyof FormErrors;
          if (field === 'title' || field === 'content') {
            newErrors[field] = issue.message;
          }
        });
      }
    } else {
      const result = CreateNoteSchema.safeParse(dataToValidate);
      if (!result.success) {
        result.error.issues.forEach(issue => {
          const field = issue.path[0] as keyof FormErrors;
          if (field === 'title' || field === 'content') {
            newErrors[field] = issue.message;
          }
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

    const data = {
      title: form.title,
      content: form.content || null,
      category_id: form.category_id,
      pinned: form.pinned,
    };

    if (isEditMode && note) {
      onSubmit(data, note.id);
    } else {
      onSubmit(data);
    }
  }, [validateForm, form, isEditMode, note, onSubmit]);

  // Confirm deletion
  const confirmDelete = useCallback(() => {
    if (note && onDelete) {
      onDelete(note.id);
    }
  }, [note, onDelete]);

  // Handle close
  const handleClose = useCallback(() => {
    if (isSaving || isDeleting) return;
    onClose();
  }, [isSaving, isDeleting, onClose]);

  // Get selected category
  const selectedCategory = categories.find(c => c.id === form.category_id);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} disabled={isSaving || isDeleting}>
            <Text color={isSaving || isDeleting ? 'muted' : 'primary'}>Cancel</Text>
          </Pressable>
          <Text variant="heading" style={styles.headerTitle}>
            {isEditMode ? 'Edit Note' : 'New Note'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Main form content */}
          {!showDeleteConfirm && !showCategoryPicker && (
            <>
              {/* Title input */}
              <Input
                label="Title"
                placeholder="Note title"
                value={form.title}
                onChangeText={text => updateField('title', text)}
                error={errors.title}
                maxLength={200}
                autoFocus={!isEditMode}
              />

              {/* Content input */}
              <View style={styles.contentSection}>
                <Text style={styles.label}>Content</Text>
                <TextInput
                  style={[
                    styles.contentInput,
                    errors.content ? styles.contentInputError : undefined,
                  ]}
                  placeholder="Write your note here..."
                  placeholderTextColor={colors.textMuted}
                  value={form.content}
                  onChangeText={text => updateField('content', text)}
                  multiline
                  textAlignVertical="top"
                  maxLength={10000}
                />
                {errors.content && <Text style={styles.errorText}>{errors.content}</Text>}
                <Text style={styles.charCount}>{form.content.length} / 10000</Text>
              </View>

              {/* Category selector */}
              <View style={styles.categorySection}>
                <Text style={styles.label}>Category (optional)</Text>
                <Pressable
                  style={styles.categorySelector}
                  onPress={() => setShowCategoryPicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Select category"
                >
                  {selectedCategory ? (
                    <View style={styles.selectedCategory}>
                      <View
                        style={[styles.categoryDot, { backgroundColor: selectedCategory.color }]}
                      />
                      <Text style={styles.categoryName}>{selectedCategory.name}</Text>
                    </View>
                  ) : (
                    <Text style={styles.categoryPlaceholder}>No category</Text>
                  )}
                </Pressable>
              </View>

              {/* Pin toggle */}
              <Pressable
                style={styles.pinToggle}
                onPress={() => updateField('pinned', !form.pinned)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: form.pinned }}
              >
                <View style={[styles.checkbox, form.pinned ? styles.checkboxChecked : undefined]}>
                  {form.pinned && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.pinLabel}>Pin this note</Text>
              </Pressable>

              {/* Submit button */}
              <Button
                variant="primary"
                onPress={handleSubmit}
                loading={isSaving}
                disabled={isSaving || isDeleting}
                style={styles.submitButton}
              >
                {isEditMode ? 'Save Changes' : 'Create Note'}
              </Button>

              {/* Delete button (edit mode only) */}
              {isEditMode && onDelete && (
                <Button
                  variant="danger"
                  onPress={() => setShowDeleteConfirm(true)}
                  disabled={isSaving || isDeleting}
                  loading={isDeleting}
                  style={styles.deleteButton}
                >
                  Delete Note
                </Button>
              )}
            </>
          )}

          {/* Category picker */}
          {showCategoryPicker && (
            <View style={styles.pickerSection}>
              <Text variant="heading" center style={styles.pickerTitle}>
                Select Category
              </Text>

              <Card
                pressable
                onPress={() => {
                  updateField('category_id', null);
                  setShowCategoryPicker(false);
                }}
                padding="sm"
                style={StyleSheet.flatten([
                  styles.categoryCard,
                  form.category_id === null ? styles.categoryCardSelected : undefined,
                ])}
              >
                <Text style={styles.noCategoryText}>No category</Text>
              </Card>

              {categories.map(cat => {
                const isSelected = form.category_id === cat.id;
                return (
                  <Card
                    key={cat.id}
                    pressable
                    onPress={() => {
                      updateField('category_id', cat.id);
                      setShowCategoryPicker(false);
                    }}
                    padding="sm"
                    style={StyleSheet.flatten([
                      styles.categoryCard,
                      isSelected ? styles.categoryCardSelected : undefined,
                    ])}
                  >
                    <View style={styles.categoryCardContent}>
                      <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                      <Text>{cat.name}</Text>
                    </View>
                  </Card>
                );
              })}

              <Button
                variant="ghost"
                onPress={() => setShowCategoryPicker(false)}
                style={styles.pickerCancelButton}
              >
                Cancel
              </Button>
            </View>
          )}

          {/* Delete confirmation */}
          {showDeleteConfirm && (
            <View style={styles.confirmSection}>
              <Text variant="heading" center style={styles.confirmTitle}>
                Delete Note?
              </Text>
              <Text variant="body" color="secondary" center style={styles.confirmText}>
                Are you sure you want to delete &ldquo;{note?.title}&rdquo;? This action cannot be
                undone.
              </Text>

              <View style={styles.confirmActions}>
                <Button
                  variant="danger"
                  onPress={confirmDelete}
                  loading={isDeleting}
                  disabled={isDeleting}
                  style={styles.confirmButton}
                >
                  Delete Note
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
      </KeyboardAvoidingView>
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
  headerTitle: {
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
  label: {
    fontSize: fontSizes.sm,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  contentSection: {
    marginBottom: spacing.md,
  },
  contentInput: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 150,
    fontSize: fontSizes.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  contentInputError: {
    borderColor: colors.error,
  },
  errorText: {
    fontSize: fontSizes.sm,
    color: colors.error,
    marginTop: spacing.xs,
  },
  charCount: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  categorySection: {
    marginBottom: spacing.md,
  },
  categorySelector: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  selectedCategory: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  categoryName: {
    fontSize: fontSizes.md,
    color: colors.text,
  },
  categoryPlaceholder: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
  pinToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  pinLabel: {
    fontSize: fontSizes.md,
    color: colors.text,
  },
  submitButton: {
    marginTop: spacing.md,
  },
  deleteButton: {
    marginTop: spacing.md,
  },
  pickerSection: {
    paddingVertical: spacing.md,
  },
  pickerTitle: {
    marginBottom: spacing.md,
  },
  categoryCard: {
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
  },
  categoryCardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  categoryCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noCategoryText: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  pickerCancelButton: {
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
});

export default NoteEditor;
