/**
 * HistoryFilters Component
 *
 * Filter panel for the History screen with date range, category selection,
 * notes search, and duration range controls.
 *
 * USAGE:
 * ```tsx
 * import { HistoryFilters } from '@/components/history';
 *
 * <HistoryFilters
 *   filters={currentFilters}
 *   onFiltersChange={setFilters}
 *   categories={categories}
 * />
 * ```
 */

import * as React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { Button, Text, Input, Card, Icon } from '@/components/ui';
import { colors, spacing, fontSizes, borderRadius } from '@/theme';
import type { TimeEntryFilters, Category } from '@/schemas';

/**
 * HistoryFilters props
 */
export interface HistoryFiltersProps {
  /** Current filter values */
  filters: TimeEntryFilters;
  /** Callback when filters change */
  onFiltersChange: (filters: TimeEntryFilters) => void;
  /** Available categories for filtering */
  categories: Category[];
  /** Whether filters are loading (disabled state) */
  disabled?: boolean;
}

/**
 * Format date for display
 */
function formatDateForDisplay(isoString: string | undefined): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Duration presets in hours
 */
const DURATION_PRESETS = [
  { label: 'Any', min: undefined, max: undefined },
  { label: '< 30m', min: undefined, max: 1800 },
  { label: '30m - 1h', min: 1800, max: 3600 },
  { label: '1h - 2h', min: 3600, max: 7200 },
  { label: '2h - 4h', min: 7200, max: 14400 },
  { label: '> 4h', min: 14400, max: undefined },
];

/**
 * HistoryFilters component
 */
export function HistoryFilters({
  filters,
  onFiltersChange,
  categories,
  disabled = false,
}: HistoryFiltersProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [dateFromInput, setDateFromInput] = useState('');
  const [dateToInput, setDateToInput] = useState('');
  const [searchText, setSearchText] = useState(filters.searchNotes || '');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync date inputs with filters
  useEffect(() => {
    setDateFromInput(filters.dateStart ? filters.dateStart.split('T')[0] : '');
    setDateToInput(filters.dateEnd ? filters.dateEnd.split('T')[0] : '');
  }, [filters.dateStart, filters.dateEnd]);

  // Debounced search
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      if (searchText !== (filters.searchNotes || '')) {
        onFiltersChange({
          ...filters,
          searchNotes: searchText || undefined,
        });
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchText]);

  // Handle date from change
  const handleDateFromChange = useCallback(
    (text: string) => {
      setDateFromInput(text);
      // Parse YYYY-MM-DD format
      const match = text.match(/^\d{4}-\d{2}-\d{2}$/);
      if (match) {
        const date = new Date(text);
        if (!isNaN(date.getTime())) {
          onFiltersChange({
            ...filters,
            dateStart: `${text}T00:00:00Z`,
          });
        }
      } else if (text === '') {
        onFiltersChange({
          ...filters,
          dateStart: undefined,
        });
      }
    },
    [filters, onFiltersChange]
  );

  // Handle date to change
  const handleDateToChange = useCallback(
    (text: string) => {
      setDateToInput(text);
      const match = text.match(/^\d{4}-\d{2}-\d{2}$/);
      if (match) {
        const date = new Date(text);
        if (!isNaN(date.getTime())) {
          onFiltersChange({
            ...filters,
            dateEnd: `${text}T23:59:59Z`,
          });
        }
      } else if (text === '') {
        onFiltersChange({
          ...filters,
          dateEnd: undefined,
        });
      }
    },
    [filters, onFiltersChange]
  );

  // Handle category selection (multi-select simulation via single filter)
  const handleCategorySelect = useCallback(
    (categoryId: string | null | undefined) => {
      onFiltersChange({
        ...filters,
        categoryId,
      });
      setCategoryModalVisible(false);
    },
    [filters, onFiltersChange]
  );

  // Handle duration preset selection
  const handleDurationPreset = useCallback(
    (min: number | undefined, max: number | undefined) => {
      onFiltersChange({
        ...filters,
        minDuration: min,
        maxDuration: max,
      });
    },
    [filters, onFiltersChange]
  );

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSearchText('');
    setDateFromInput('');
    setDateToInput('');
    onFiltersChange({});
  }, [onFiltersChange]);

  // Check if any filters are active
  const hasActiveFilters =
    filters.dateStart ||
    filters.dateEnd ||
    filters.categoryId !== undefined ||
    filters.searchNotes ||
    filters.minDuration ||
    filters.maxDuration;

  // Get selected category name
  const selectedCategory = categories.find((c) => c.id === filters.categoryId);
  const categoryLabel =
    filters.categoryId === null
      ? 'Uncategorized'
      : selectedCategory?.name || 'All Categories';

  // Get current duration preset label
  const durationLabel = DURATION_PRESETS.find(
    (p) => p.min === filters.minDuration && p.max === filters.maxDuration
  )?.label || 'Custom';

  return (
    <View style={styles.container}>
      {/* Collapsed header */}
      <Pressable
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse filters' : 'Expand filters'}
        disabled={disabled}
      >
        <View style={styles.headerLeft}>
          <Icon name="filter" size={18} color={colors.text} />
          <Text style={styles.headerTitle}>Filters</Text>
          {hasActiveFilters && <View style={styles.activeIndicator} />}
        </View>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>

      {/* Expanded filter panel */}
      {expanded && (
        <View style={styles.panel}>
          {/* Search */}
          <View style={styles.searchContainer}>
            <Icon name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search notes..."
              placeholderTextColor={colors.textMuted}
              value={searchText}
              onChangeText={setSearchText}
              editable={!disabled}
            />
            {searchText.length > 0 && (
              <Pressable onPress={() => setSearchText('')} style={styles.clearSearch}>
                <Icon name="close" size={14} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Date range */}
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>From</Text>
              <Input
                value={dateFromInput}
                onChangeText={handleDateFromChange}
                placeholder="YYYY-MM-DD"
                keyboardType="default"
                disabled={disabled}
              />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>To</Text>
              <Input
                value={dateToInput}
                onChangeText={handleDateToChange}
                placeholder="YYYY-MM-DD"
                keyboardType="default"
                disabled={disabled}
              />
            </View>
          </View>

          {/* Category selector */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Category</Text>
            <Pressable
              style={[styles.selectorButton, disabled && styles.selectorDisabled]}
              onPress={() => setCategoryModalVisible(true)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel="Select category filter"
            >
              {selectedCategory && (
                <View
                  style={[
                    styles.categoryColor,
                    { backgroundColor: selectedCategory.color },
                  ]}
                />
              )}
              <Text style={styles.selectorText}>{categoryLabel}</Text>
              <Icon name="chevron-down" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Duration presets */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Duration</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.durationPresets}
            >
              {DURATION_PRESETS.map((preset, index) => {
                const isActive =
                  preset.min === filters.minDuration && preset.max === filters.maxDuration;
                return (
                  <Pressable
                    key={index}
                    style={[styles.durationChip, isActive && styles.durationChipActive]}
                    onPress={() => handleDurationPreset(preset.min, preset.max)}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text
                      style={StyleSheet.flatten([
                        styles.durationChipText,
                        isActive ? styles.durationChipTextActive : null,
                      ])}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onPress={handleClearFilters}
              disabled={disabled}
              style={styles.clearButton}
            >
              Clear All Filters
            </Button>
          )}
        </View>
      )}

      {/* Category selection modal */}
      <Modal
        visible={categoryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text variant="heading" style={styles.modalTitle}>
              Filter by Category
            </Text>

            <ScrollView style={styles.categoryList}>
              {/* All categories option */}
              <Pressable
                style={[
                  styles.categoryOption,
                  filters.categoryId === undefined && styles.categoryOptionActive,
                ]}
                onPress={() => handleCategorySelect(undefined)}
              >
                <Text style={styles.categoryOptionText}>All Categories</Text>
              </Pressable>

              {/* Uncategorized option */}
              <Pressable
                style={[
                  styles.categoryOption,
                  filters.categoryId === null && styles.categoryOptionActive,
                ]}
                onPress={() => handleCategorySelect(null)}
              >
                <Text style={styles.categoryOptionText}>Uncategorized</Text>
              </Pressable>

              {/* Category list */}
              {categories.map((category) => (
                <Pressable
                  key={category.id}
                  style={[
                    styles.categoryOption,
                    filters.categoryId === category.id && styles.categoryOptionActive,
                  ]}
                  onPress={() => handleCategorySelect(category.id)}
                >
                  <View style={styles.categoryOptionContent}>
                    <View
                      style={[styles.categoryColor, { backgroundColor: category.color }]}
                    />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSizes.md,
    color: colors.text,
    fontWeight: '500',
    marginLeft: spacing.sm,
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.xs,
  },
  panel: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSizes.md,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  clearSearch: {
    padding: spacing.xs,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  dateField: {
    flex: 1,
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
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectorDisabled: {
    opacity: 0.5,
  },
  selectorText: {
    flex: 1,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  categoryColor: {
    width: 16,
    height: 16,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  durationPresets: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  durationChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationChipActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  durationChipText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  durationChipTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  clearButton: {
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
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

export default HistoryFilters;
