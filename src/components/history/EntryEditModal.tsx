/**
 * EntryEditModal Component
 *
 * Modal for editing and deleting time entries. Pre-fills form with existing
 * entry data and validates changes using UpdateTimeEntrySchema.
 *
 * USAGE:
 * ```tsx
 * import { EntryEditModal } from '@/components/history';
 *
 * <EntryEditModal
 *   entry={selectedEntry}
 *   categories={categories}
 *   visible={isEditModalVisible}
 *   onClose={() => setEditModalVisible(false)}
 *   onSaveSuccess={() => showToast('Entry updated')}
 *   onDeleteSuccess={() => showToast('Entry deleted')}
 * />
 * ```
 *
 * SECURITY:
 * - Validates input against UpdateTimeEntrySchema before mutation
 * - RLS policies ensure users can only edit their own entries
 * - Defensive user_id check (though RLS handles this server-side)
 */

import * as React from 'react';
import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Button, Text, Input, Card, Icon } from '@/components/ui';
import { ProjectPicker } from '@/components/projects';
import { colors, spacing, fontSizes, borderRadius } from '@/theme';
import { useUpdateTimeEntry, useDeleteTimeEntry } from '@/hooks/useTimeEntryMutations';
import { useAuth } from '@/hooks/useAuth';
import { useEntryTags, useSetEntryTags } from '@/hooks/useTags';
import { useWorkspaceContext } from '@/contexts';
import { UpdateTimeEntrySchema } from '@/schemas';
import type { TimeEntry, Category, UpdateTimeEntryInput } from '@/schemas';
import { TagSelector } from './TagSelector';
import { EntryComments } from './EntryComments';
import { EntryAttachments } from './EntryAttachments';

// ============================================================================
// TYPES
// ============================================================================

/**
 * EntryEditModal props
 */
export interface EntryEditModalProps {
  /** The time entry to edit (null when modal is closed) */
  entry: TimeEntry | null;
  /** Available categories for selection */
  categories: Category[];
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when entry is successfully updated */
  onSaveSuccess?: () => void;
  /** Callback when entry is successfully deleted */
  onDeleteSuccess?: () => void;
  /** When true, renders without Modal wrapper (for use inside navigation screens) */
  embedded?: boolean;
}

/**
 * Form state for editing entry
 */
interface FormState {
  categoryId: string | null;
  projectId: string | null;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  notes: string;
  billingRate: string;
}

/**
 * Form validation errors
 */
interface FormErrors {
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  billingRate?: string;
  general?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract date (YYYY-MM-DD) from ISO string
 */
function extractDate(isoString: string): string {
  return isoString.split('T')[0];
}

/**
 * Extract time (HH:MM) from ISO string
 */
function extractTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Combine date and time into ISO string
 */
function combineDateTime(date: string, time: string): string {
  // Parse and validate
  const dateMatch = date.match(/^\d{4}-\d{2}-\d{2}$/);
  const timeMatch = time.match(/^(\d{2}):(\d{2})$/);

  if (!dateMatch || !timeMatch) {
    throw new Error('Invalid date or time format');
  }

  const dateTime = new Date(`${date}T${time}:00`);
  if (isNaN(dateTime.getTime())) {
    throw new Error('Invalid date/time combination');
  }

  return dateTime.toISOString();
}

/**
 * Calculate duration in seconds between two ISO timestamps
 */
function calculateDuration(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Platform-aware alert/confirm dialog
 */
function showConfirmDialog(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText: string = 'Delete',
  cancelText: string = 'Cancel'
): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel' },
      { text: confirmText, style: 'destructive', onPress: onConfirm },
    ]);
  }
}

/**
 * Platform-aware error alert
 */
function showErrorAlert(title: string, message: string): void {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * EntryEditModal component
 *
 * Modal for editing time entry details:
 * - Category selection
 * - Start date/time
 * - End date/time (with automatic duration calculation)
 * - Notes
 * - Delete with confirmation
 */
export function EntryEditModal({
  entry,
  categories,
  visible,
  onClose,
  onSaveSuccess,
  onDeleteSuccess,
  embedded = false,
}: EntryEditModalProps): React.ReactElement {
  const { user } = useAuth();

  // Mutation hooks
  const updateEntry = useUpdateTimeEntry({
    onSuccess: () => {
      onSaveSuccess?.();
      onClose();
    },
    onError: error => {
      showErrorAlert('Update Failed', error.message);
    },
  });

  const deleteEntry = useDeleteTimeEntry({
    onSuccess: () => {
      onDeleteSuccess?.();
      onClose();
    },
    onError: error => {
      showErrorAlert('Delete Failed', error.message);
    },
  });

  // Form state
  const [form, setForm] = useState<FormState>({
    categoryId: null,
    projectId: null,
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    notes: '',
    billingRate: '',
  });

  // Workspace context for project picker
  const { activeWorkspace, isPersonalMode } = useWorkspaceContext();

  const [errors, setErrors] = useState<FormErrors>({});
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  // Tag hooks
  const { data: entryTagIds = [] } = useEntryTags(entry?.id || null);
  const setEntryTags = useSetEntryTags();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Initialize form when entry changes
  useEffect(() => {
    if (entry) {
      setForm({
        categoryId: entry.category_id,
        projectId: entry.project_id ?? null,
        startDate: extractDate(entry.start_at),
        startTime: extractTime(entry.start_at),
        endDate: entry.end_at ? extractDate(entry.end_at) : '',
        endTime: entry.end_at ? extractTime(entry.end_at) : '',
        notes: entry.notes || '',
        billingRate: entry.billing_rate != null ? String(entry.billing_rate) : '',
      });
      setErrors({});
    }
  }, [entry]);

  // Sync tag selection when entry tags load
  useEffect(() => {
    setSelectedTagIds(entryTagIds);
  }, [entryTagIds]);

  // Defensive check: ensure user owns this entry
  const isOwnEntry = useMemo(() => {
    if (!entry || !user) return false;
    return entry.user_id === user.id;
  }, [entry, user]);

  // Calculate computed duration from form values
  const computedDuration = useMemo(() => {
    try {
      if (form.startDate && form.startTime && form.endDate && form.endTime) {
        const startIso = combineDateTime(form.startDate, form.startTime);
        const endIso = combineDateTime(form.endDate, form.endTime);
        const duration = calculateDuration(startIso, endIso);
        return duration > 0 ? duration : null;
      }
    } catch {
      // Invalid date/time format
    }
    return null;
  }, [form.startDate, form.startTime, form.endDate, form.endTime]);

  // Get selected category
  const selectedCategory = useMemo(() => {
    return categories.find(c => c.id === form.categoryId) || null;
  }, [categories, form.categoryId]);

  // Handle category selection
  const handleCategorySelect = useCallback((categoryId: string | null) => {
    setForm(prev => ({ ...prev, categoryId }));
    setCategoryModalVisible(false);
  }, []);

  // Validate form and return UpdateTimeEntryInput or null
  const validateForm = useCallback((): UpdateTimeEntryInput | null => {
    const newErrors: FormErrors = {};

    // Validate date formats
    if (!form.startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      newErrors.startDate = 'Use YYYY-MM-DD format';
    }
    if (!form.startTime.match(/^\d{2}:\d{2}$/)) {
      newErrors.startTime = 'Use HH:MM format';
    }
    if (form.endDate && !form.endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      newErrors.endDate = 'Use YYYY-MM-DD format';
    }
    if (form.endTime && !form.endTime.match(/^\d{2}:\d{2}$/)) {
      newErrors.endTime = 'Use HH:MM format';
    }

    if (form.billingRate.trim() !== '') {
      const parsed = parseFloat(form.billingRate);
      if (isNaN(parsed) || parsed < 0) {
        newErrors.billingRate = 'Must be a valid non-negative number';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return null;
    }

    try {
      const startIso = combineDateTime(form.startDate, form.startTime);
      const endIso =
        form.endDate && form.endTime ? combineDateTime(form.endDate, form.endTime) : null;

      const duration = endIso ? calculateDuration(startIso, endIso) : 0;

      const updateData: UpdateTimeEntryInput = {
        category_id: form.categoryId,
        project_id: form.projectId,
        start_at: startIso,
        end_at: endIso,
        duration_seconds: duration,
        notes: form.notes.trim() || null,
        billing_rate: form.billingRate.trim() === '' ? null : parseFloat(form.billingRate),
      };

      // Validate against schema
      const validation = UpdateTimeEntrySchema.safeParse(updateData);
      if (!validation.success) {
        const errorMessages = validation.error.issues.map(issue => issue.message).join(', ');
        setErrors({ general: errorMessages });
        return null;
      }

      setErrors({});
      return validation.data;
    } catch (err) {
      setErrors({ general: 'Invalid date/time values' });
      return null;
    }
  }, [form]);

  // Handle save
  const handleSave = useCallback(() => {
    if (!entry) return;

    // Defensive check
    if (!isOwnEntry) {
      showErrorAlert('Permission Denied', 'You can only edit your own entries.');
      return;
    }

    const updateData = validateForm();
    if (!updateData) return;

    updateEntry.mutate({ id: entry.id, data: updateData });

    // Save tags if changed
    const tagsChanged =
      selectedTagIds.length !== entryTagIds.length ||
      selectedTagIds.some(id => !entryTagIds.includes(id));
    if (tagsChanged) {
      setEntryTags.mutate({ entryId: entry.id, tagIds: selectedTagIds });
    }
  }, [entry, isOwnEntry, validateForm, updateEntry, selectedTagIds, entryTagIds, setEntryTags]);

  // Handle delete with confirmation
  const handleDelete = useCallback(() => {
    if (!entry) return;

    // Defensive check
    if (!isOwnEntry) {
      showErrorAlert('Permission Denied', 'You can only delete your own entries.');
      return;
    }

    showConfirmDialog(
      'Delete Entry',
      'Are you sure you want to delete this time entry? This action cannot be undone.',
      () => {
        deleteEntry.mutate(entry.id);
      }
    );
  }, [entry, isOwnEntry, deleteEntry]);

  // Determine if form has changes
  const hasChanges = useMemo(() => {
    if (!entry) return false;

    return (
      form.categoryId !== entry.category_id ||
      form.projectId !== (entry.project_id ?? null) ||
      form.startDate !== extractDate(entry.start_at) ||
      form.startTime !== extractTime(entry.start_at) ||
      form.endDate !== (entry.end_at ? extractDate(entry.end_at) : '') ||
      form.endTime !== (entry.end_at ? extractTime(entry.end_at) : '') ||
      form.notes !== (entry.notes || '') ||
      form.billingRate !== (entry.billing_rate != null ? String(entry.billing_rate) : '')
    );
  }, [entry, form]);

  const isSubmitting = updateEntry.isPending || deleteEntry.isPending;

  // Shared form content rendered in both modal and embedded modes
  const formContent = (
    <>
      {/* Permission warning */}
      {entry && !isOwnEntry && (
        <Card padding="sm" style={styles.warningCard}>
          <View style={styles.warningContent}>
            <Icon name="alert" size={18} color={colors.warning} />
            <Text style={styles.warningText}>
              You cannot edit this entry as it belongs to another user.
            </Text>
          </View>
        </Card>
      )}

      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
        {/* Category selector */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Category</Text>
          <Pressable
            style={styles.selectorButton}
            onPress={() => setCategoryModalVisible(true)}
            disabled={isSubmitting || !isOwnEntry}
            accessibilityRole="button"
            accessibilityLabel="Select category"
          >
            {selectedCategory ? (
              <>
                <View style={[styles.categoryColor, { backgroundColor: selectedCategory.color }]} />
                <Text style={styles.selectorText}>{selectedCategory.name}</Text>
              </>
            ) : (
              <Text style={StyleSheet.flatten([styles.selectorText, styles.selectorPlaceholder])}>
                No category
              </Text>
            )}
            <Icon name="chevron-down" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Project picker (when workspace active) */}
        {!isPersonalMode && activeWorkspace && (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Project</Text>
            <ProjectPicker
              workspaceId={activeWorkspace.id}
              value={form.projectId}
              onChange={projectId => setForm(prev => ({ ...prev, projectId }))}
              disabled={isSubmitting || !isOwnEntry}
            />
          </View>
        )}

        {/* Start date/time */}
        <Text style={styles.sectionLabel}>Start</Text>
        <View style={styles.dateTimeRow}>
          <View style={styles.dateField}>
            <Input
              label="Date"
              value={form.startDate}
              onChangeText={text => setForm(prev => ({ ...prev, startDate: text }))}
              placeholder="YYYY-MM-DD"
              error={errors.startDate}
              disabled={isSubmitting || !isOwnEntry}
            />
          </View>
          <View style={styles.timeField}>
            <Input
              label="Time"
              value={form.startTime}
              onChangeText={text => setForm(prev => ({ ...prev, startTime: text }))}
              placeholder="HH:MM"
              error={errors.startTime}
              disabled={isSubmitting || !isOwnEntry}
            />
          </View>
        </View>

        {/* End date/time */}
        <Text style={styles.sectionLabel}>End</Text>
        <View style={styles.dateTimeRow}>
          <View style={styles.dateField}>
            <Input
              label="Date"
              value={form.endDate}
              onChangeText={text => setForm(prev => ({ ...prev, endDate: text }))}
              placeholder="YYYY-MM-DD"
              error={errors.endDate}
              disabled={isSubmitting || !isOwnEntry}
            />
          </View>
          <View style={styles.timeField}>
            <Input
              label="Time"
              value={form.endTime}
              onChangeText={text => setForm(prev => ({ ...prev, endTime: text }))}
              placeholder="HH:MM"
              error={errors.endTime}
              disabled={isSubmitting || !isOwnEntry}
            />
          </View>
        </View>

        {/* Computed duration */}
        {computedDuration !== null && (
          <View style={styles.durationDisplay}>
            <Icon name="clock" size={16} color={colors.primary} />
            <Text style={styles.durationText}>Duration: {formatDuration(computedDuration)}</Text>
          </View>
        )}

        {/* Billing Rate */}
        <Input
          label="Billing Rate ($/hr)"
          value={form.billingRate}
          onChangeText={text => setForm(prev => ({ ...prev, billingRate: text }))}
          placeholder="Category default"
          keyboardType="decimal-pad"
          error={errors.billingRate}
          disabled={isSubmitting || !isOwnEntry}
        />

        {/* Notes */}
        <Input
          label="Notes"
          value={form.notes}
          onChangeText={text => setForm(prev => ({ ...prev, notes: text }))}
          placeholder="Add notes about this entry..."
          multiline
          numberOfLines={4}
          disabled={isSubmitting || !isOwnEntry}
        />

        {/* Tags */}
        <TagSelector
          selectedTagIds={selectedTagIds}
          onTagsChange={setSelectedTagIds}
          disabled={isSubmitting || !isOwnEntry}
        />

        {/* Comments */}
        {entry && <EntryComments entryId={entry.id} disabled={isSubmitting || !isOwnEntry} />}

        {/* Attachments */}
        {entry && <EntryAttachments entryId={entry.id} disabled={isSubmitting || !isOwnEntry} />}

        {/* General error */}
        {errors.general && (
          <View style={styles.errorContainer}>
            <Icon name="alert" size={16} color={colors.error} />
            <Text style={styles.errorText}>{errors.general}</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer actions */}
      <View style={styles.footer}>
        <Button
          variant="danger"
          onPress={handleDelete}
          disabled={isSubmitting || !isOwnEntry}
          loading={deleteEntry.isPending}
          style={styles.deleteButton}
        >
          Delete
        </Button>
        <View style={styles.footerRight}>
          <Button
            variant="outline"
            onPress={onClose}
            disabled={isSubmitting}
            style={styles.cancelButton}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onPress={handleSave}
            disabled={isSubmitting || !hasChanges || !isOwnEntry}
            loading={updateEntry.isPending}
          >
            Save
          </Button>
        </View>
      </View>
    </>
  );

  // Category picker modal (shared between both modes)
  const categoryModal = (
    <Modal
      visible={categoryModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setCategoryModalVisible(false)}
    >
      <View style={styles.categoryModalOverlay}>
        <View style={styles.categoryModalContent}>
          <Text variant="heading" style={styles.categoryModalTitle}>
            Select Category
          </Text>

          <ScrollView style={styles.categoryList}>
            {/* No category option */}
            <Pressable
              style={[
                styles.categoryOption,
                form.categoryId === null && styles.categoryOptionActive,
              ]}
              onPress={() => handleCategorySelect(null)}
            >
              <Text style={styles.categoryOptionText}>No Category</Text>
            </Pressable>

            {/* Category list */}
            {categories.map(category => (
              <Pressable
                key={category.id}
                style={[
                  styles.categoryOption,
                  form.categoryId === category.id && styles.categoryOptionActive,
                ]}
                onPress={() => handleCategorySelect(category.id)}
              >
                <View style={styles.categoryOptionContent}>
                  <View style={[styles.categoryColor, { backgroundColor: category.color }]} />
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryOptionText}>{category.name}</Text>
                    <Text style={styles.categoryTypeText}>{category.type}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          <Button variant="outline" onPress={() => setCategoryModalVisible(false)}>
            Cancel
          </Button>
        </View>
      </View>
    </Modal>
  );

  // Embedded mode: render directly without Modal wrapper (used inside navigation screens)
  if (embedded) {
    return (
      <View style={styles.embeddedContainer}>
        {formContent}
        {categoryModal}
      </View>
    );
  }

  // Standard mode: render inside a Modal
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.overlayTouchable} onPress={onClose} />
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text variant="heading" style={styles.title}>
              Edit Entry
            </Text>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close modal"
            >
              <Icon name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          {formContent}
        </View>
      </KeyboardAvoidingView>
      {categoryModal}
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  embeddedContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: fontSizes.lg,
  },
  closeButton: {
    padding: spacing.xs,
  },
  warningCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.warning + '20',
  },
  warningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: fontSizes.sm,
    color: colors.warning,
  },
  form: {
    flex: 1,
    padding: spacing.lg,
  },
  field: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  sectionLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectorText: {
    flex: 1,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  selectorPlaceholder: {
    color: colors.textMuted,
  },
  categoryColor: {
    width: 16,
    height: 16,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dateField: {
    flex: 2,
  },
  timeField: {
    flex: 1,
  },
  durationDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary + '10',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  durationText: {
    fontSize: fontSizes.sm,
    color: colors.primary,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.error + '20',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: fontSizes.sm,
    color: colors.error,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deleteButton: {
    minWidth: 80,
  },
  footerRight: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    minWidth: 80,
  },
  // Category modal styles
  categoryModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  categoryModalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
  },
  categoryModalTitle: {
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  categoryList: {
    marginBottom: spacing.md,
  },
  categoryOption: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  categoryOptionActive: {
    backgroundColor: colors.primary + '20',
  },
  categoryOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryOptionText: {
    fontSize: fontSizes.md,
    color: colors.text,
  },
  categoryTypeText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
});

export default EntryEditModal;
