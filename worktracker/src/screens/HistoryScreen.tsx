/**
 * HistoryScreen
 *
 * Main screen for viewing time entry history with filtering and infinite scroll.
 * Displays entries grouped by date with category information.
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
import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HistoryFilters, EntryList } from '@/components/history';
import { Text } from '@/components/ui';
import { colors, spacing, fontSizes } from '@/theme';
import { useTimeEntries, useCategories } from '@/hooks';
import type { TimeEntry, TimeEntryFilters } from '@/schemas';

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
  // Initialize filters from route params
  const [filters, setFilters] = useState<TimeEntryFilters>(() => ({
    categoryId: route?.params?.categoryId,
    dateStart: route?.params?.dateStart,
    dateEnd: route?.params?.dateEnd,
  }));

  // Fetch categories for filter dropdown and entry display
  const {
    data: categories = [],
    isLoading: categoriesLoading,
  } = useCategories();

  // Fetch time entries with filters and pagination
  const {
    data,
    isLoading: entriesLoading,
    isFetching,
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

  // Flatten paginated entries
  const entries = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.data);
  }, [data?.pages]);

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="heading" style={styles.title}>
          History
        </Text>
        {entries.length > 0 && (
          <Text style={styles.entryCount}>
            {entries.length}{hasNextPage ? '+' : ''} entries
          </Text>
        )}
      </View>

      {/* Filters */}
      <HistoryFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        categories={categories}
        disabled={isLoading}
      />

      {/* Error state */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Failed to load entries. Pull down to retry.
          </Text>
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
        emptyMessage={emptyMessage}
      />
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
  title: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    color: colors.text,
  },
  entryCount: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
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
});

export default HistoryScreen;
