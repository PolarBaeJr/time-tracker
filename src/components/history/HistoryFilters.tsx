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
import { View, StyleSheet, Pressable, Modal, ScrollView, TextInput } from 'react-native';
import { Button, Text, Input, Icon } from '@/components/ui';
import { colors, spacing, fontSizes, borderRadius } from '@/theme';
import type { TimeEntryFilters, EntryType, Category } from '@/schemas';

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
 * Date range presets
 */
const DATE_PRESETS = [
  {
    label: 'Today',
    getRange: () => {
      const now = new Date();
      const y = now.getFullYear(),
        m = String(now.getMonth() + 1).padStart(2, '0'),
        d = String(now.getDate()).padStart(2, '0');
      return { dateStart: `${y}-${m}-${d}T00:00:00.000Z`, dateEnd: `${y}-${m}-${d}T23:59:59.999Z` };
    },
  },
  {
    label: 'Yesterday',
    getRange: () => {
      const now = new Date();
      now.setDate(now.getDate() - 1);
      const y = now.getFullYear(),
        m = String(now.getMonth() + 1).padStart(2, '0'),
        d = String(now.getDate()).padStart(2, '0');
      return { dateStart: `${y}-${m}-${d}T00:00:00.000Z`, dateEnd: `${y}-${m}-${d}T23:59:59.999Z` };
    },
  },
  {
    label: 'This Week',
    getRange: () => {
      const now = new Date();
      const day = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() - day);
      const sy = start.getFullYear(),
        sm = String(start.getMonth() + 1).padStart(2, '0'),
        sd = String(start.getDate()).padStart(2, '0');
      const ey = now.getFullYear(),
        em = String(now.getMonth() + 1).padStart(2, '0'),
        ed = String(now.getDate()).padStart(2, '0');
      return {
        dateStart: `${sy}-${sm}-${sd}T00:00:00.000Z`,
        dateEnd: `${ey}-${em}-${ed}T23:59:59.999Z`,
      };
    },
  },
  {
    label: 'This Month',
    getRange: () => {
      const now = new Date();
      const y = now.getFullYear(),
        m = String(now.getMonth() + 1).padStart(2, '0');
      const ed = String(now.getDate()).padStart(2, '0');
      return { dateStart: `${y}-${m}-01T00:00:00.000Z`, dateEnd: `${y}-${m}-${ed}T23:59:59.999Z` };
    },
  },
  {
    label: 'Last 7 Days',
    getRange: () => {
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      const sy = start.getFullYear(),
        sm = String(start.getMonth() + 1).padStart(2, '0'),
        sd = String(start.getDate()).padStart(2, '0');
      const ey = now.getFullYear(),
        em = String(now.getMonth() + 1).padStart(2, '0'),
        ed = String(now.getDate()).padStart(2, '0');
      return {
        dateStart: `${sy}-${sm}-${sd}T00:00:00.000Z`,
        dateEnd: `${ey}-${em}-${ed}T23:59:59.999Z`,
      };
    },
  },
  {
    label: 'Last 30 Days',
    getRange: () => {
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() - 29);
      const sy = start.getFullYear(),
        sm = String(start.getMonth() + 1).padStart(2, '0'),
        sd = String(start.getDate()).padStart(2, '0');
      const ey = now.getFullYear(),
        em = String(now.getMonth() + 1).padStart(2, '0'),
        ed = String(now.getDate()).padStart(2, '0');
      return {
        dateStart: `${sy}-${sm}-${sd}T00:00:00.000Z`,
        dateEnd: `${ey}-${em}-${ed}T23:59:59.999Z`,
      };
    },
  },
];

/**
 * Entry type filter options
 */
const ENTRY_TYPE_OPTIONS: { label: string; value: EntryType; color: string }[] = [
  { label: 'Work', value: 'work', color: colors.primary },
  { label: 'Break', value: 'break', color: colors.success },
  { label: 'Long Break', value: 'long_break', color: colors.warning },
];

/**
 * Sort options
 */
const SORT_OPTIONS: { label: string; value: 'date' | 'duration' | 'entry_type' }[] = [
  { label: 'Date', value: 'date' },
  { label: 'Duration', value: 'duration' },
  { label: 'Type', value: 'entry_type' },
];

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
  const [searchText, setSearchText] = useState(filters.searchNotes || '');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive date inputs from filters (no separate state needed)
  const dateFromInput = filters.dateStart ? filters.dateStart.split('T')[0] : '';
  const dateToInput = filters.dateEnd ? filters.dateEnd.split('T')[0] : '';

  // Debounced search
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    const currentSearchNotes = filters.searchNotes || '';
    searchDebounceRef.current = setTimeout(() => {
      if (searchText !== currentSearchNotes) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  // Handle date from change
  const handleDateFromChange = useCallback(
    (text: string) => {
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

  // Handle date preset selection
  const handleDatePreset = useCallback(
    (getRange: () => { dateStart: string; dateEnd: string }) => {
      const { dateStart, dateEnd } = getRange();
      onFiltersChange({
        ...filters,
        dateStart,
        dateEnd,
      });
    },
    [filters, onFiltersChange]
  );

  // Handle entry type toggle
  const handleEntryTypeToggle = useCallback(
    (type: EntryType) => {
      const current = filters.entryTypes ?? [];
      const updated = current.includes(type) ? current.filter(t => t !== type) : [...current, type];
      onFiltersChange({
        ...filters,
        entryTypes: updated.length > 0 ? updated : undefined,
      });
    },
    [filters, onFiltersChange]
  );

  // Handle sort by selection
  const handleSortBy = useCallback(
    (sortBy: 'date' | 'duration' | 'entry_type') => {
      onFiltersChange({
        ...filters,
        sortBy: sortBy === 'date' ? undefined : sortBy,
      });
    },
    [filters, onFiltersChange]
  );

  // Handle sort order toggle
  const handleSortOrderToggle = useCallback(() => {
    const current = filters.sortOrder ?? 'desc';
    onFiltersChange({
      ...filters,
      sortOrder: current === 'desc' ? 'asc' : 'desc',
    });
  }, [filters, onFiltersChange]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSearchText('');
    onFiltersChange({});
  }, [onFiltersChange]);

  // Check if any filters are active
  const hasActiveFilters =
    filters.dateStart ||
    filters.dateEnd ||
    filters.categoryId !== undefined ||
    filters.searchNotes ||
    filters.minDuration ||
    filters.maxDuration ||
    (filters.entryTypes && filters.entryTypes.length > 0) ||
    filters.sortBy ||
    (filters.sortOrder && filters.sortOrder !== 'desc');

  // Get selected category name
  const selectedCategory = categories.find(c => c.id === filters.categoryId);
  const categoryLabel =
    filters.categoryId === null ? 'Uncategorized' : selectedCategory?.name || 'All Categories';

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

          {/* Date range presets */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Date Range</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.durationPresets}
            >
              {DATE_PRESETS.map(preset => {
                const range = preset.getRange();
                const isActive =
                  filters.dateStart === range.dateStart && filters.dateEnd === range.dateEnd;
                return (
                  <Pressable
                    key={preset.label}
                    style={[styles.durationChip, isActive && styles.durationChipActive]}
                    onPress={() => handleDatePreset(preset.getRange)}
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

          {/* Date range manual inputs */}
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
                <View style={[styles.categoryColor, { backgroundColor: selectedCategory.color }]} />
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

          {/* Entry type filter */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Entry Type</Text>
            <View style={styles.durationPresets}>
              {ENTRY_TYPE_OPTIONS.map(option => {
                const isActive = filters.entryTypes?.includes(option.value) ?? false;
                return (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.durationChip,
                      isActive && {
                        backgroundColor: option.color + '20',
                        borderColor: option.color,
                      },
                    ]}
                    onPress={() => handleEntryTypeToggle(option.value)}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text
                      style={StyleSheet.flatten([
                        styles.durationChipText,
                        isActive ? { color: option.color, fontWeight: '500' as const } : null,
                      ])}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Sort options */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Sort by</Text>
            <View style={styles.sortRow}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.durationPresets}
              >
                {SORT_OPTIONS.map(option => {
                  const isActive = (filters.sortBy ?? 'date') === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.durationChip, isActive && styles.durationChipActive]}
                      onPress={() => handleSortBy(option.value)}
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
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable
                style={styles.sortOrderButton}
                onPress={handleSortOrderToggle}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`Sort ${(filters.sortOrder ?? 'desc') === 'desc' ? 'descending' : 'ascending'}`}
              >
                <Icon
                  name={(filters.sortOrder ?? 'desc') === 'desc' ? 'chevron-down' : 'chevron-up'}
                  size={16}
                  color={colors.text}
                />
                <Text style={styles.sortOrderText}>
                  {(filters.sortOrder ?? 'desc') === 'desc' ? 'DESC' : 'ASC'}
                </Text>
              </Pressable>
            </View>
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
              {categories.map(category => (
                <Pressable
                  key={category.id}
                  style={[
                    styles.categoryOption,
                    filters.categoryId === category.id && styles.categoryOptionActive,
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
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sortOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortOrderText: {
    fontSize: fontSizes.sm,
    color: colors.text,
    fontWeight: '500',
  },
  clearButton: {
    alignSelf: 'center',
    marginTop: spacing.sm,
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
