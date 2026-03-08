/**
 * HistoryScreen
 *
 * Main screen for viewing time entry history with filtering and infinite scroll.
 * Displays entries grouped by date with category information.
 * Supports select mode for bulk edit, delete, and merge operations.
 *
 * USAGE:
 * ```tsx
 * import { HistoryScreen } from '@/screens';
 *
 * // In navigation
 * <Stack.Screen name="History" component={HistoryScreen} />
 * ```
 */

import * as React from 'react';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  Modal,
  ScrollView,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HistoryFilters, EntryList, ManualEntryModal, SplitEntryModal } from '@/components/history';
import { Text, Icon, Button } from '@/components/ui';
import { colors, spacing, fontSizes, borderRadius } from '@/theme';
import {
  useTimeEntries,
  useCategories,
  useBulkUpdateEntries,
  useBulkDeleteEntries,
  useMergeTimeEntries,
  useDeleteTimeEntry,
  useRestoreTimeEntry,
  useDuplicateTimeEntry,
} from '@/hooks';
import type { TimeEntry, TimeEntryFilters, Category } from '@/schemas';

/**
 * HistoryScreen props (from navigation)
 */
export interface HistoryScreenProps {
  /** Optional route params */
  route?: {
    params?: {
      /** Pre-filter by category ID */
      categoryId?: string;
      /** Pre-filter by date start */
      dateStart?: string;
      /** Pre-filter by date end */
      dateEnd?: string;
    };
  };
  /** Navigation object */
  navigation?: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

/**
 * HistoryScreen component
 */
export function HistoryScreen({ route, navigation }: HistoryScreenProps): React.ReactElement {
  // Manual entry modal state
  const [addEntryModalVisible, setAddEntryModalVisible] = useState(false);

  // Select mode state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Split modal state
  const [splitEntry, setSplitEntry] = useState<TimeEntry | null>(null);
  const [splitModalVisible, setSplitModalVisible] = useState(false);

  // Category picker modal for bulk edit
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);

  // Initialize filters from route params
  const [filters, setFilters] = useState<TimeEntryFilters>(() => ({
    categoryId: route?.params?.categoryId,
    dateStart: route?.params?.dateStart,
    dateEnd: route?.params?.dateEnd,
  }));

  // Fetch categories for filter dropdown and entry display
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();

  // Fetch time entries with filters and pagination
  const {
    data,
    isLoading: entriesLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
    error,
  } = useTimeEntries({
    filters,
    pageSize: 20,
  });

  // Bulk mutation hooks
  const bulkUpdate = useBulkUpdateEntries({
    onSuccess: () => {
      exitSelectMode();
    },
  });
  const bulkDelete = useBulkDeleteEntries({
    onSuccess: () => {
      exitSelectMode();
    },
  });
  const mergeEntries = useMergeTimeEntries({
    onSuccess: () => {
      exitSelectMode();
    },
  });

  // Undo delete state
  const [undoBanner, setUndoBanner] = useState<{ id: string; visible: boolean } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deleteEntry = useDeleteTimeEntry({
    onSuccess: id => {
      setUndoBanner({ id, visible: true });
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => {
        setUndoBanner(null);
      }, 5000);
    },
  });

  const restoreEntry = useRestoreTimeEntry({
    onSuccess: () => {
      setUndoBanner(null);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    },
  });

  const duplicateEntry = useDuplicateTimeEntry();

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const handleUndoDelete = useCallback(() => {
    if (undoBanner) {
      restoreEntry.mutate(undoBanner.id);
    }
  }, [undoBanner, restoreEntry]);

  const handleEntryDuplicate = useCallback(
    (entry: TimeEntry) => {
      duplicateEntry.mutate(entry.id);
    },
    [duplicateEntry]
  );

  // Flatten paginated entries
  const entries = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.data);
  }, [data]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: TimeEntryFilters) => {
    setFilters(newFilters);
  }, []);

  // Handle entry press - navigate to edit
  const handleEntryPress = useCallback(
    (entry: TimeEntry) => {
      if (navigation) {
        navigation.navigate('EntryEdit', { entryId: entry.id });
      }
    },
    [navigation]
  );

  // Handle entry edit button press
  const handleEntryEdit = useCallback(
    (entry: TimeEntry) => {
      if (navigation) {
        navigation.navigate('EntryEdit', { entryId: entry.id });
      }
    },
    [navigation]
  );

  // Handle entry split button press
  const handleEntrySplit = useCallback((entry: TimeEntry) => {
    setSplitEntry(entry);
    setSplitModalVisible(true);
  }, []);

  // Handle fetch next page
  const handleFetchNextPage = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Select mode handlers
  const enterSelectMode = useCallback(() => {
    setIsSelectMode(true);
    setSelectedIds(new Set());
  }, []);

  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleToggleSelect = useCallback((entry: TimeEntry) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(entry.id)) {
        next.delete(entry.id);
      } else {
        next.add(entry.id);
      }
      return next;
    });
  }, []);

  // Bulk action handlers
  const handleBulkEditCategory = useCallback(
    (categoryId: string | null) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      bulkUpdate.mutate({ ids, data: { category_id: categoryId } });
      setCategoryPickerVisible(false);
    },
    [selectedIds, bulkUpdate]
  );

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    Alert.alert(
      'Delete Entries',
      `Are you sure you want to delete ${ids.length} entries? This action can be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => bulkDelete.mutate(ids),
        },
      ]
    );
  }, [selectedIds, bulkDelete]);

  const handleMerge = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length < 2) return;
    Alert.alert(
      'Merge Entries',
      `Merge ${ids.length} entries into one? The merged entry will use the category from the earliest entry and combine all notes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Merge',
          onPress: () => mergeEntries.mutate(ids),
        },
      ]
    );
  }, [selectedIds, mergeEntries]);

  // Generate empty message based on filters
  const emptyMessage = useMemo(() => {
    const hasFilters =
      filters.dateStart ||
      filters.dateEnd ||
      filters.categoryId !== undefined ||
      filters.searchNotes ||
      filters.minDuration ||
      filters.maxDuration;

    if (hasFilters) {
      return 'No entries match your current filters. Try adjusting the filters or clearing them.';
    }
    return 'Start tracking your time to see entries here. Use the Timer tab to begin!';
  }, [filters]);

  // Initial loading state
  const isLoading = entriesLoading || categoriesLoading;

  const selectedCount = selectedIds.size;
  const isBulkActionPending =
    bulkUpdate.isPending || bulkDelete.isPending || mergeEntries.isPending;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text variant="heading" style={styles.title}>
            {isSelectMode ? `${selectedCount} selected` : 'History'}
          </Text>
          {isSelectMode && (
            <Pressable
              onPress={() => {
                if (selectedIds.size === entries.length) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(entries.map(e => e.id)));
                }
              }}
              style={styles.selectAllButton}
              accessibilityRole="button"
              accessibilityLabel={
                selectedIds.size === entries.length ? 'Deselect all' : 'Select all'
              }
            >
              <Text style={styles.selectAllText}>
                {selectedIds.size === entries.length ? 'Deselect All' : 'Select All'}
              </Text>
            </Pressable>
          )}
        </View>
        <View style={styles.headerRight}>
          {!isSelectMode && entries.length > 0 && (
            <Text style={styles.entryCount}>
              {entries.length}
              {hasNextPage ? '+' : ''} entries
            </Text>
          )}
          {entries.length > 0 && (
            <Pressable
              style={
                StyleSheet.flatten([
                  styles.selectButton,
                  isSelectMode ? styles.selectButtonActive : undefined,
                ]) as ViewStyle
              }
              onPress={isSelectMode ? exitSelectMode : enterSelectMode}
              accessibilityRole="button"
              accessibilityLabel={isSelectMode ? 'Exit select mode' : 'Enter select mode'}
            >
              <Icon name="select" size={14} color={isSelectMode ? '#fff' : colors.textSecondary} />
              <Text
                style={
                  StyleSheet.flatten([
                    styles.selectButtonText,
                    isSelectMode ? styles.selectButtonTextActive : undefined,
                  ]) as TextStyle
                }
              >
                {isSelectMode ? 'Cancel' : 'Select'}
              </Text>
            </Pressable>
          )}
          {!isSelectMode && (
            <Pressable
              style={styles.addEntryButton}
              onPress={() => setAddEntryModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Add entry"
            >
              <Icon name="add" size={16} color="#fff" />
              <Text style={styles.addEntryButtonText}>Add Entry</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Filters */}
      {!isSelectMode && (
        <HistoryFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          categories={categories}
          disabled={isLoading}
        />
      )}

      {/* Error state */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load entries. Pull down to retry.</Text>
        </View>
      )}

      {/* Entry list */}
      <EntryList
        entries={entries}
        categories={categories}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onFetchNextPage={handleFetchNextPage}
        onRefresh={handleRefresh}
        isRefreshing={isRefetching}
        isLoading={isLoading}
        onEntryPress={handleEntryPress}
        onEntryEdit={handleEntryEdit}
        onEntrySplit={handleEntrySplit}
        onEntryDuplicate={handleEntryDuplicate}
        emptyMessage={emptyMessage}
        isSelectable={isSelectMode}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
      />

      {/* Floating action bar for select mode */}
      {isSelectMode && selectedCount > 0 && (
        <View style={styles.actionBar}>
          <Pressable
            style={styles.actionBarButton}
            onPress={() => setCategoryPickerVisible(true)}
            disabled={isBulkActionPending}
            accessibilityRole="button"
            accessibilityLabel="Edit category"
          >
            <Icon name="folder" size={16} color={colors.primary} />
            <Text style={styles.actionBarButtonText}>Category</Text>
          </Pressable>

          {selectedCount >= 2 && (
            <Pressable
              style={styles.actionBarButton}
              onPress={handleMerge}
              disabled={isBulkActionPending}
              accessibilityRole="button"
              accessibilityLabel="Merge entries"
            >
              <Icon name="merge" size={16} color={colors.primary} />
              <Text style={styles.actionBarButtonText}>Merge</Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.actionBarButton, styles.actionBarDeleteButton]}
            onPress={handleBulkDelete}
            disabled={isBulkActionPending}
            accessibilityRole="button"
            accessibilityLabel="Delete entries"
          >
            <Icon name="trash" size={16} color={colors.error} />
            <Text
              style={
                StyleSheet.flatten([
                  styles.actionBarButtonText,
                  styles.actionBarDeleteText,
                ]) as TextStyle
              }
            >
              Delete
            </Text>
          </Pressable>
        </View>
      )}

      {/* Manual entry modal */}
      <ManualEntryModal
        visible={addEntryModalVisible}
        onClose={() => setAddEntryModalVisible(false)}
      />

      {/* Split entry modal */}
      <SplitEntryModal
        visible={splitModalVisible}
        entry={splitEntry}
        onClose={() => {
          setSplitModalVisible(false);
          setSplitEntry(null);
        }}
      />

      {/* Undo delete banner */}
      {undoBanner?.visible && (
        <View style={styles.undoBanner}>
          <Text style={styles.undoBannerText}>Entry deleted</Text>
          <Pressable
            onPress={handleUndoDelete}
            accessibilityRole="button"
            accessibilityLabel="Undo delete"
          >
            <Text style={styles.undoButton}>Undo</Text>
          </Pressable>
        </View>
      )}

      {/* Category picker modal for bulk edit */}
      <Modal
        visible={categoryPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoryPickerVisible(false)}
      >
        <View style={styles.categoryModalOverlay}>
          <View style={styles.categoryModalContent}>
            <View style={styles.categoryModalHeader}>
              <Text variant="heading" style={styles.categoryModalTitle}>
                Change Category
              </Text>
              <Pressable
                onPress={() => setCategoryPickerVisible(false)}
                style={styles.categoryModalClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Icon name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.categoryList}>
              <Pressable
                style={styles.categoryOption}
                onPress={() => handleBulkEditCategory(null)}
                accessibilityRole="button"
              >
                <Text style={styles.categoryOptionText}>No category</Text>
              </Pressable>
              {categories.map((cat: Category) => (
                <Pressable
                  key={cat.id}
                  style={styles.categoryOption}
                  onPress={() => handleBulkEditCategory(cat.id)}
                  accessibilityRole="button"
                >
                  <View style={styles.categoryOptionRow}>
                    <View style={[styles.categoryColorChip, { backgroundColor: cat.color }]} />
                    <Text style={styles.categoryOptionText}>{cat.name}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            <Button variant="outline" onPress={() => setCategoryPickerVisible(false)}>
              Cancel
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    color: colors.text,
  },
  selectAllButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  selectAllText: {
    fontSize: fontSizes.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  entryCount: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  selectButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectButtonText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  selectButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  addEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  addEntryButtonText: {
    fontSize: fontSizes.sm,
    color: '#fff',
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: colors.error + '20',
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSizes.sm,
    textAlign: 'center',
  },
  // Floating action bar
  actionBar: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '15',
    gap: 4,
  },
  actionBarButtonText: {
    fontSize: fontSizes.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  actionBarDeleteButton: {
    backgroundColor: colors.error + '15',
  },
  actionBarDeleteText: {
    color: colors.error,
  },
  // Category picker modal
  categoryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  categoryModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  categoryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  categoryModalTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  categoryModalClose: {
    padding: spacing.xs,
  },
  categoryList: {
    marginBottom: spacing.md,
  },
  categoryOption: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  categoryOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryColorChip: {
    width: 16,
    height: 16,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  categoryOptionText: {
    fontSize: fontSizes.md,
    color: colors.text,
  },
  undoBanner: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  undoBannerText: {
    fontSize: fontSizes.md,
    color: colors.text,
  },
  undoButton: {
    fontSize: fontSizes.md,
    color: colors.primary,
    fontWeight: '700',
  },
});

export default HistoryScreen;
