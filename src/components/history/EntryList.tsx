/**
 * EntryList Component
 *
 * Displays a list of time entries using FlatList with infinite scroll,
 * pull-to-refresh, section headers by date, and empty state handling.
 *
 * USAGE:
 * ```tsx
 * import { EntryList } from '@/components/history';
 *
 * <EntryList
 *   entries={entries}
 *   categories={categories}
 *   hasNextPage={hasNextPage}
 *   isFetchingNextPage={isFetchingNextPage}
 *   onFetchNextPage={fetchNextPage}
 *   onRefresh={refetch}
 *   isRefreshing={isRefetching}
 *   isLoading={isLoading}
 *   onEntryPress={handleEntryPress}
 *   onEntryEdit={handleEntryEdit}
 * />
 * ```
 */

import * as React from 'react';
import { useMemo, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { EntryCard } from './EntryCard';
import { Text, Spinner, Card, Icon } from '@/components/ui';
import { colors, spacing, fontSizes, borderRadius } from '@/theme';
import type { TimeEntry, Category } from '@/schemas';

/**
 * Section data for grouped entries
 */
interface EntrySection {
  date: string;
  dateLabel: string;
  entries: TimeEntry[];
}

/**
 * List item type
 */
type ListItem =
  | { type: 'header'; date: string; dateLabel: string }
  | { type: 'entry'; entry: TimeEntry };

/**
 * EntryList props
 */
export interface EntryListProps {
  /** Array of time entries */
  entries: TimeEntry[];
  /** Categories for looking up category info */
  categories: Category[];
  /** Whether there are more entries to fetch */
  hasNextPage?: boolean;
  /** Whether currently fetching next page */
  isFetchingNextPage?: boolean;
  /** Callback to fetch next page */
  onFetchNextPage?: () => void;
  /** Callback to refresh the list */
  onRefresh?: () => void;
  /** Whether currently refreshing */
  isRefreshing?: boolean;
  /** Whether initial loading */
  isLoading?: boolean;
  /** Callback when entry is pressed */
  onEntryPress?: (entry: TimeEntry) => void;
  /** Callback when entry edit is pressed */
  onEntryEdit?: (entry: TimeEntry) => void;
  /** Callback when entry split is pressed */
  onEntrySplit?: (entry: TimeEntry) => void;
  /** Callback when entry duplicate is pressed */
  onEntryDuplicate?: (entry: TimeEntry) => void;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Whether select mode is active */
  isSelectable?: boolean;
  /** Set of selected entry IDs */
  selectedIds?: Set<string>;
  /** Callback when entry selection is toggled */
  onToggleSelect?: (entry: TimeEntry) => void;
}

/**
 * Get date string from ISO timestamp (YYYY-MM-DD)
 */
function getDateKey(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date key to human-readable label
 */
function formatDateLabel(dateKey: string): string {
  const date = new Date(dateKey + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateStr = date.toDateString();
  if (dateStr === today.toDateString()) {
    return 'Today';
  }
  if (dateStr === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Group entries by date
 */
function groupEntriesByDate(entries: TimeEntry[]): EntrySection[] {
  const groups = new Map<string, TimeEntry[]>();

  entries.forEach(entry => {
    const dateKey = getDateKey(entry.start_at);
    const existing = groups.get(dateKey) || [];
    groups.set(dateKey, [...existing, entry]);
  });

  // Sort groups by date descending
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));

  return sortedKeys.map(date => ({
    date,
    dateLabel: formatDateLabel(date),
    entries: groups.get(date) || [],
  }));
}

/**
 * Flatten sections to list items with headers
 */
function flattenSections(sections: EntrySection[]): ListItem[] {
  const items: ListItem[] = [];

  sections.forEach(section => {
    items.push({
      type: 'header',
      date: section.date,
      dateLabel: section.dateLabel,
    });

    section.entries.forEach(entry => {
      items.push({ type: 'entry', entry });
    });
  });

  return items;
}

/**
 * Loading skeleton component
 */
function LoadingSkeleton(): React.ReactElement {
  return (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3, 4, 5].map(i => (
        <Card key={i} padding="md" style={styles.skeletonCard}>
          <View style={styles.skeletonHeader}>
            <View style={styles.skeletonChip} />
            <View style={styles.skeletonText} />
            <View style={styles.skeletonBadge} />
          </View>
          <View style={styles.skeletonRow}>
            <View style={styles.skeletonDate} />
            <View style={styles.skeletonTime} />
            <View style={styles.skeletonDuration} />
          </View>
        </Card>
      ))}
    </View>
  );
}

/**
 * Empty state component
 */
function EmptyState({ message }: { message: string }): React.ReactElement {
  return (
    <View style={styles.emptyContainer}>
      <Icon name="clock" size={48} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>No Time Entries</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

/**
 * EntryList component
 */
export function EntryList({
  entries,
  categories,
  hasNextPage = false,
  isFetchingNextPage = false,
  onFetchNextPage,
  onRefresh,
  isRefreshing = false,
  isLoading = false,
  onEntryPress,
  onEntryEdit,
  onEntrySplit,
  onEntryDuplicate,
  emptyMessage = 'Start tracking time to see your entries here.',
  isSelectable = false,
  selectedIds,
  onToggleSelect,
}: EntryListProps): React.ReactElement {
  // Build category lookup map
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach(cat => map.set(cat.id, cat));
    return map;
  }, [categories]);

  // Group and flatten entries
  const listItems = useMemo(() => {
    const sections = groupEntriesByDate(entries);
    return flattenSections(sections);
  }, [entries]);

  // Handle end reached for infinite scroll
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && onFetchNextPage) {
      onFetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, onFetchNextPage]);

  // Render item
  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'header') {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{item.dateLabel}</Text>
          </View>
        );
      }

      const category = item.entry.category_id ? categoryMap.get(item.entry.category_id) : null;

      return (
        <EntryCard
          entry={item.entry}
          categoryName={category?.name || null}
          categoryColor={category?.color || null}
          categoryType={category?.type || null}
          categoryHourlyRate={category?.hourly_rate ?? null}
          onPress={onEntryPress}
          onEdit={onEntryEdit}
          onSplit={onEntrySplit}
          onDuplicate={onEntryDuplicate}
          isSelectable={isSelectable}
          isSelected={selectedIds?.has(item.entry.id) ?? false}
          onToggleSelect={onToggleSelect}
        />
      );
    },
    [
      categoryMap,
      onEntryPress,
      onEntryEdit,
      onEntrySplit,
      onEntryDuplicate,
      isSelectable,
      selectedIds,
      onToggleSelect,
    ]
  );

  // Key extractor
  const keyExtractor = useCallback((item: ListItem, index: number) => {
    if (item.type === 'header') {
      return `header-${item.date}`;
    }
    return item.entry.id;
  }, []);

  // Footer component
  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;

    return (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.primary} size="small" />
        <Text style={styles.footerText}>Loading more entries...</Text>
      </View>
    );
  }, [isFetchingNextPage]);

  // Show loading skeleton
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Show empty state
  if (entries.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <FlatList
      data={listItems}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.3}
      ListFooterComponent={renderFooter}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressBackgroundColor={colors.surface}
          />
        ) : undefined
      }
      // Performance optimizations
      removeClippedSubviews
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={15}
      // Accessibility
      accessibilityRole="list"
      accessibilityLabel="Time entries list"
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  footerText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyMessage: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: fontSizes.md * 1.5,
  },
  skeletonContainer: {
    flex: 1,
    padding: spacing.md,
  },
  skeletonCard: {
    marginBottom: spacing.sm,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  skeletonChip: {
    width: 12,
    height: 12,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceVariant,
    marginRight: spacing.xs,
  },
  skeletonText: {
    width: 100,
    height: 16,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceVariant,
    marginRight: spacing.sm,
  },
  skeletonBadge: {
    width: 50,
    height: 16,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceVariant,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonDate: {
    width: 80,
    height: 14,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceVariant,
    marginRight: spacing.md,
  },
  skeletonTime: {
    width: 100,
    height: 14,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceVariant,
    flex: 1,
  },
  skeletonDuration: {
    width: 50,
    height: 20,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceVariant,
    marginLeft: spacing.sm,
  },
});

export default EntryList;
