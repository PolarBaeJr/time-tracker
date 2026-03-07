/**
 * QuickEntry Component
 *
 * A form component for manual time entry creation. Allows users to:
 * - Select a category (optional)
 * - Choose entry date
 * - Set start time and end time OR duration
 * - Add optional notes
 *
 * Validates input using CreateTimeEntrySchema before submission.
 *
 * USAGE:
 * ```tsx
 * import { QuickEntry } from '@/components/timer';
 *
 * function TimerScreen() {
 *   return (
 *     <QuickEntry
 *       onSuccess={() => console.log('Entry created!')}
 *       onCancel={() => navigation.goBack()}
 *     />
 *   );
 * }
 * ```
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  Pressable,
  Modal,
  Switch,
} from 'react-native';

import { Button, Input, Text, Card, Spinner, Icon } from '@/components/ui';
import { colors, spacing, fontSizes, borderRadius } from '@/theme';
import { useCategories } from '@/hooks/useCategories';
import { useCreateTimeEntry } from '@/hooks/useTimeEntryMutations';
import { CreateTimeEntrySchema } from '@/schemas';
import type { Category } from '@/schemas';
import { useEntryTemplates, addTemplate } from '@/stores/entryTemplateStore';
import { TemplateSelector } from '@/components/history/TemplateSelector';
import type { EntryTemplate } from '@/stores/entryTemplateStore';

// ============================================================================
// Types
// ============================================================================

/**
 * Entry mode: use start/end times or direct duration input
 */
type EntryMode = 'times' | 'duration';

/**
 * Form state for the quick entry
 */
interface FormState {
  categoryId: string | null;
  date: Date;
  startTime: Date;
  endTime: Date;
  durationMinutes: string;
  notes: string;
  isBillable: boolean;
}

/**
 * Form validation errors
 */
interface FormErrors {
  category?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  notes?: string;
  general?: string;
}

/**
 * QuickEntry component props
 */
export interface QuickEntryProps {
  /** Callback when entry is successfully created */
  onSuccess?: () => void;
  /** Callback when user cancels */
  onCancel?: () => void;
  /** Pre-selected category ID */
  initialCategoryId?: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format time as HH:MM for display
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Format date as YYYY-MM-DD for display
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Calculate duration in seconds between two times on the same date
 */
function calculateDurationSeconds(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / 1000);
}

/**
 * Format duration in seconds to human readable string
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
 * Parse minutes string to seconds, returns null if invalid
 */
function parseMinutesToSeconds(minutesStr: string): number | null {
  const minutes = parseInt(minutesStr, 10);
  if (isNaN(minutes) || minutes <= 0) {
    return null;
  }
  return minutes * 60;
}

/**
 * Combine date and time into a single Date object
 */
function combineDateAndTime(date: Date, time: Date): Date {
  const combined = new Date(date);
  combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return combined;
}

/**
 * Get start of today
 */
function getToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * Get current time rounded to nearest 5 minutes
 */
function getRoundedCurrentTime(): Date {
  const now = new Date();
  const minutes = Math.round(now.getMinutes() / 5) * 5;
  now.setMinutes(minutes, 0, 0);
  return now;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Category selector with color swatches
 */
interface CategorySelectorProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  error?: string;
  loading?: boolean;
}

function CategorySelector({
  categories,
  selectedId,
  onSelect,
  error,
  loading,
}: CategorySelectorProps): React.ReactElement {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedCategory = useMemo(
    () => categories.find(c => c.id === selectedId),
    [categories, selectedId]
  );

  const handleSelect = useCallback(
    (id: string | null) => {
      onSelect(id);
      setModalVisible(false);
    },
    [onSelect]
  );

  if (loading) {
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Category</Text>
        <Spinner size="small" />
      </View>
    );
  }

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>Category (optional)</Text>
      <Pressable
        style={[styles.selectorButton, error && styles.selectorButtonError]}
        onPress={() => setModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Select category"
      >
        {selectedCategory ? (
          <View style={styles.selectedCategory}>
            <View style={[styles.colorSwatch, { backgroundColor: selectedCategory.color }]} />
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryName}>{selectedCategory.name}</Text>
              <Text style={styles.categoryType}>{selectedCategory.type}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.placeholderText}>No category selected</Text>
        )}
      </Pressable>
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text variant="heading" style={styles.modalTitle}>
              Select Category
            </Text>

            <ScrollView style={styles.categoryList}>
              {/* No category option */}
              <Pressable
                style={[
                  styles.categoryOption,
                  selectedId === null && styles.categoryOptionSelected,
                ]}
                onPress={() => handleSelect(null)}
                accessibilityRole="button"
              >
                <Text style={styles.categoryName}>No category</Text>
              </Pressable>

              {categories.map(category => (
                <Pressable
                  key={category.id}
                  style={[
                    styles.categoryOption,
                    selectedId === category.id && styles.categoryOptionSelected,
                  ]}
                  onPress={() => handleSelect(category.id)}
                  accessibilityRole="button"
                >
                  <View style={styles.selectedCategory}>
                    <View style={[styles.colorSwatch, { backgroundColor: category.color }]} />
                    <View style={styles.categoryInfo}>
                      <Text style={styles.categoryName}>{category.name}</Text>
                      <Text style={styles.categoryType}>{category.type}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            <Button variant="outline" onPress={() => setModalVisible(false)}>
              Cancel
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/**
 * Simple date picker using text input (cross-platform)
 */
interface DatePickerFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  error?: string;
  maxDate?: Date;
}

function DatePickerField({
  label,
  value,
  onChange,
  error,
  maxDate,
}: DatePickerFieldProps): React.ReactElement {
  const [textValue, setTextValue] = useState(formatDate(value));

  const handleChange = useCallback(
    (text: string) => {
      setTextValue(text);
      // Try to parse as date
      const parsed = new Date(text);
      if (!isNaN(parsed.getTime())) {
        // Check max date constraint
        if (maxDate && parsed > maxDate) {
          return;
        }
        onChange(parsed);
      }
    },
    [onChange, maxDate]
  );

  return (
    <Input
      label={label}
      value={textValue}
      onChangeText={handleChange}
      placeholder="YYYY-MM-DD"
      error={error}
      keyboardType="default"
      accessibilityLabel={label}
    />
  );
}

/**
 * Simple time picker using text input (cross-platform)
 */
interface TimePickerFieldProps {
  label: string;
  value: Date;
  onChange: (time: Date) => void;
  error?: string;
}

function TimePickerField({
  label,
  value,
  onChange,
  error,
}: TimePickerFieldProps): React.ReactElement {
  const [textValue, setTextValue] = useState(formatTime(value));

  const handleChange = useCallback(
    (text: string) => {
      setTextValue(text);
      // Try to parse as time (HH:MM format)
      const match = text.match(/^(\d{1,2}):(\d{2})$/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
          const newTime = new Date(value);
          newTime.setHours(hours, minutes, 0, 0);
          onChange(newTime);
        }
      }
    },
    [onChange, value]
  );

  return (
    <Input
      label={label}
      value={textValue}
      onChangeText={handleChange}
      placeholder="HH:MM"
      error={error}
      keyboardType="default"
      accessibilityLabel={label}
    />
  );
}

/**
 * Mode toggle for switching between times and duration entry
 */
interface ModeToggleProps {
  mode: EntryMode;
  onModeChange: (mode: EntryMode) => void;
}

function ModeToggle({ mode, onModeChange }: ModeToggleProps): React.ReactElement {
  const timesTextStyle =
    mode === 'times'
      ? StyleSheet.flatten([styles.modeButtonText, styles.modeButtonTextActive])
      : styles.modeButtonText;
  const durationTextStyle =
    mode === 'duration'
      ? StyleSheet.flatten([styles.modeButtonText, styles.modeButtonTextActive])
      : styles.modeButtonText;

  return (
    <View style={styles.modeToggle}>
      <Pressable
        style={[styles.modeButton, mode === 'times' ? styles.modeButtonActive : null]}
        onPress={() => onModeChange('times')}
        accessibilityRole="button"
        accessibilityState={{ selected: mode === 'times' }}
      >
        <Text style={timesTextStyle}>Start/End Times</Text>
      </Pressable>
      <Pressable
        style={[styles.modeButton, mode === 'duration' ? styles.modeButtonActive : null]}
        onPress={() => onModeChange('duration')}
        accessibilityRole="button"
        accessibilityState={{ selected: mode === 'duration' }}
      >
        <Text style={durationTextStyle}>Duration</Text>
      </Pressable>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * QuickEntry component for manual time entry creation
 */
export function QuickEntry({
  onSuccess,
  onCancel,
  initialCategoryId = null,
}: QuickEntryProps): React.ReactElement {
  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();

  // Create mutation
  const createEntry = useCreateTimeEntry({
    onSuccess: () => {
      // Show success feedback
      if (Platform.OS === 'web') {
        // Toast would be ideal here, but using alert as fallback
        Alert.alert('Success', 'Time entry created successfully');
      } else {
        Alert.alert('Success', 'Time entry created successfully');
      }

      // Reset form
      resetForm();

      // Call success callback
      onSuccess?.();
    },
    onError: error => {
      setErrors(prev => ({
        ...prev,
        general: error.message,
      }));
    },
  });

  // Form state
  const [mode, setMode] = useState<EntryMode>('times');
  const [form, setForm] = useState<FormState>(() => {
    const now = getRoundedCurrentTime();
    const oneHourAgo = new Date(now);
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    return {
      categoryId: initialCategoryId,
      date: getToday(),
      startTime: oneHourAgo,
      endTime: now,
      durationMinutes: '60',
      notes: '',
      isBillable: false,
    };
  });
  const [errors, setErrors] = useState<FormErrors>({});

  // Calculated duration for display
  const calculatedDuration = useMemo(() => {
    if (mode === 'times') {
      const start = combineDateAndTime(form.date, form.startTime);
      const end = combineDateAndTime(form.date, form.endTime);
      const seconds = calculateDurationSeconds(start, end);
      return seconds > 0 ? seconds : 0;
    } else {
      return parseMinutesToSeconds(form.durationMinutes) ?? 0;
    }
  }, [mode, form.date, form.startTime, form.endTime, form.durationMinutes]);

  // Reset form to initial state
  const resetForm = () => {
    const now = getRoundedCurrentTime();
    const oneHourAgo = new Date(now);
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    setForm({
      categoryId: initialCategoryId,
      date: getToday(),
      startTime: oneHourAgo,
      endTime: now,
      durationMinutes: '60',
      notes: '',
      isBillable: false,
    });
    setErrors({});
  };

  // Validate form and return true if valid
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Check date is not in the future
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (form.date > today) {
      newErrors.date = 'Date cannot be in the future';
    }

    if (mode === 'times') {
      // Check end time is after start time
      const start = combineDateAndTime(form.date, form.startTime);
      const end = combineDateAndTime(form.date, form.endTime);

      if (end <= start) {
        newErrors.endTime = 'End time must be after start time';
      }

      // Check start time is not in the future
      if (start > new Date()) {
        newErrors.startTime = 'Start time cannot be in the future';
      }
    } else {
      // Check duration is valid
      const duration = parseMinutesToSeconds(form.durationMinutes);
      if (duration === null) {
        newErrors.duration = 'Duration must be a positive number';
      }
    }

    // Check notes length
    if (form.notes.length > 1000) {
      newErrors.notes = 'Notes cannot exceed 1000 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    // Build entry data
    let start_at: string;
    let end_at: string | null;
    let duration_seconds: number;

    if (mode === 'times') {
      const start = combineDateAndTime(form.date, form.startTime);
      const end = combineDateAndTime(form.date, form.endTime);
      start_at = start.toISOString();
      end_at = end.toISOString();
      duration_seconds = calculateDurationSeconds(start, end);
    } else {
      // For duration mode, use current date/time minus duration as start
      const duration = parseMinutesToSeconds(form.durationMinutes);
      if (duration === null) {
        setErrors({ duration: 'Invalid duration' });
        return;
      }

      const end = combineDateAndTime(form.date, new Date());
      const start = new Date(end.getTime() - duration * 1000);
      start_at = start.toISOString();
      end_at = end.toISOString();
      duration_seconds = duration;
    }

    // Validate with schema
    const input = {
      category_id: form.categoryId,
      start_at,
      end_at,
      duration_seconds,
      notes: form.notes || null,
      is_billable: form.isBillable,
    };

    const validationResult = CreateTimeEntrySchema.safeParse(input);
    if (!validationResult.success) {
      const flatErrors = validationResult.error.flatten();
      setErrors({
        general: flatErrors.formErrors.join(', ') || 'Validation failed',
        startTime: flatErrors.fieldErrors.start_at?.join(', '),
        endTime: flatErrors.fieldErrors.end_at?.join(', '),
        duration: flatErrors.fieldErrors.duration_seconds?.join(', '),
        notes: flatErrors.fieldErrors.notes?.join(', '),
      });
      return;
    }

    // Submit
    try {
      await createEntry.mutateAsync(validationResult.data);
    } catch {
      // Error handled by onError callback
    }
  };

  // Form field update handlers
  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear related error
    if (field === 'categoryId') setErrors(prev => ({ ...prev, category: undefined }));
    if (field === 'date') setErrors(prev => ({ ...prev, date: undefined }));
    if (field === 'startTime') setErrors(prev => ({ ...prev, startTime: undefined }));
    if (field === 'endTime') setErrors(prev => ({ ...prev, endTime: undefined }));
    if (field === 'durationMinutes') setErrors(prev => ({ ...prev, duration: undefined }));
    if (field === 'notes') setErrors(prev => ({ ...prev, notes: undefined }));
  };

  // Handle save as template
  const handleSaveAsTemplate = () => {
    const templateName = form.notes
      ? form.notes.slice(0, 30).trim()
      : `Template ${new Date().toLocaleDateString()}`;

    addTemplate({
      name: templateName,
      categoryId: form.categoryId,
      notes: form.notes,
      durationSeconds: calculatedDuration,
      isBillable: form.isBillable,
      tagIds: [],
    });

    if (Platform.OS === 'web') {
      Alert.alert('Saved', 'Template saved successfully');
    } else {
      Alert.alert('Saved', 'Template saved successfully');
    }
  };

  // Handle load template
  const handleLoadTemplate = (template: EntryTemplate) => {
    setForm(prev => ({
      ...prev,
      categoryId: template.categoryId,
      notes: template.notes,
      durationMinutes: String(Math.round(template.durationSeconds / 60)),
      isBillable: template.isBillable,
    }));
    if (template.durationSeconds > 0) {
      setMode('duration');
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Card padding="lg" style={styles.card}>
        <Text variant="heading" style={styles.title}>
          Add Time Entry
        </Text>

        {/* Template actions */}
        <View style={styles.templateRow}>
          <TemplateSelector onSelect={handleLoadTemplate} />
          <Pressable
            style={styles.saveTemplateButton}
            onPress={handleSaveAsTemplate}
            disabled={calculatedDuration <= 0}
            accessibilityRole="button"
            accessibilityLabel="Save as template"
          >
            <Icon name="save" size={14} color={colors.textSecondary} />
            <Text style={styles.saveTemplateText}>Save as Template</Text>
          </Pressable>
        </View>

        {/* General error */}
        {errors.general && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errors.general}</Text>
          </View>
        )}

        {/* Category selector */}
        <CategorySelector
          categories={categories}
          selectedId={form.categoryId}
          onSelect={id => updateField('categoryId', id)}
          error={errors.category}
          loading={categoriesLoading}
        />

        {/* Date picker */}
        <DatePickerField
          label="Date"
          value={form.date}
          onChange={date => updateField('date', date)}
          error={errors.date}
          maxDate={new Date()}
        />

        {/* Mode toggle */}
        <ModeToggle mode={mode} onModeChange={setMode} />

        {/* Time/Duration inputs */}
        {mode === 'times' ? (
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <TimePickerField
                label="Start Time"
                value={form.startTime}
                onChange={time => updateField('startTime', time)}
                error={errors.startTime}
              />
            </View>
            <View style={styles.timeField}>
              <TimePickerField
                label="End Time"
                value={form.endTime}
                onChange={time => updateField('endTime', time)}
                error={errors.endTime}
              />
            </View>
          </View>
        ) : (
          <Input
            label="Duration (minutes)"
            value={form.durationMinutes}
            onChangeText={text => updateField('durationMinutes', text)}
            error={errors.duration}
            keyboardType="numeric"
            placeholder="Enter duration in minutes"
          />
        )}

        {/* Calculated duration display */}
        {calculatedDuration > 0 && (
          <View style={styles.durationDisplay}>
            <Text style={styles.durationLabel}>Duration:</Text>
            <Text style={styles.durationValue}>{formatDuration(calculatedDuration)}</Text>
          </View>
        )}

        {/* Notes */}
        <Input
          label="Notes (optional)"
          value={form.notes}
          onChangeText={text => updateField('notes', text)}
          error={errors.notes}
          multiline
          numberOfLines={3}
          placeholder="Add notes about this time entry..."
          helperText={`${form.notes.length}/1000 characters`}
        />

        {/* Billable toggle */}
        <View style={styles.billableRow}>
          <Text style={styles.billableLabel}>Billable</Text>
          <Switch
            value={form.isBillable}
            onValueChange={value => updateField('isBillable', value)}
            trackColor={{ false: colors.surfaceVariant, true: colors.success + '60' }}
            thumbColor={form.isBillable ? colors.success : colors.textMuted}
          />
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {onCancel && (
            <Button
              variant="outline"
              onPress={onCancel}
              style={styles.cancelButton}
              disabled={createEntry.isPending}
            >
              Cancel
            </Button>
          )}
          <Button
            variant="primary"
            onPress={handleSubmit}
            loading={createEntry.isPending}
            disabled={calculatedDuration <= 0}
            style={styles.submitButton}
          >
            Save Entry
          </Button>
        </View>
      </Card>
    </ScrollView>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    margin: spacing.md,
  },
  title: {
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  fieldContainer: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSizes.sm,
    color: colors.text,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  selectorButton: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  selectorButtonError: {
    borderColor: colors.error,
  },
  selectedCategory: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: fontSizes.md,
    color: colors.text,
  },
  categoryType: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  placeholderText: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
  errorText: {
    fontSize: fontSizes.sm,
    color: colors.error,
    marginTop: spacing.xs,
  },
  errorBanner: {
    backgroundColor: colors.error + '20',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    color: colors.error,
    fontSize: fontSizes.sm,
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
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  modalTitle: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  categoryList: {
    marginBottom: spacing.md,
  },
  categoryOption: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  categoryOptionSelected: {
    backgroundColor: colors.primary + '20',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    marginBottom: spacing.md,
  },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
  },
  modeButtonText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  modeButtonTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timeField: {
    flex: 1,
  },
  durationDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  durationLabel: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  durationValue: {
    fontSize: fontSizes.lg,
    color: colors.primary,
    fontWeight: '600',
  },
  billableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  },
  billableLabel: {
    fontSize: fontSizes.md,
    color: colors.text,
    fontWeight: '500',
  },
  templateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  saveTemplateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceVariant,
  },
  saveTemplateText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
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

export default QuickEntry;
