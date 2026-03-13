/**
 * NotesList Component
 *
 * Displays a list of notes using FlatList with search, filtering,
 * pull-to-refresh, and empty state handling. Notes are sorted with
 * pinned notes at the top.
 *
 * USAGE:
 * ```tsx
 * import { NotesList } from '@/components/notes';
 *
 * <NotesList
 *   notes={notes}
 *   categories={categories}
 *   isLoading={isLoading}
 *   isRefreshing={isRefreshing}
 *   onRefresh={refetch}
 *   onNotePress={handleNotePress}
 *   onNoteEdit={handleNoteEdit}
 *   onNoteDelete={handleNoteDelete}
 *   onNotePin={handleNotePin}
 *   searchQuery={searchQuery}
 *   onSearchChange={setSearchQuery}
 *   selectedCategoryId={categoryFilter}
 *   onCategoryChange={setCategoryFilter}
 * />
 * ```
 */

import * as React from 'react';
import { useMemo, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, TextInput, Pressable } from 'react-native';
import { NoteCard } from './NoteCard';
import { Text, Card, Icon } from '@/components/ui';
import { colors, spacing, fontSizes, borderRadius } from '@/theme';
import type { Note, Category } from '@/schemas';

/**
 * NotesList props
 */
export interface NotesListProps {
  /** Array of notes */
  notes: Note[];
  /** Categories for looking up category info */
  categories: Category[];
  /** Whether initial loading */
  isLoading?: boolean;
  /** Whether currently refreshing */
  isRefreshing?: boolean;
  /** Callback to refresh the list */
  onRefresh?: () => void;
  /** Callback when note is pressed */
  onNotePress?: (note: Note) => void;
  /** Callback when note edit is pressed */
  onNoteEdit?: (note: Note) => void;
  /** Callback when note delete is pressed */
  onNoteDelete?: (note: Note) => void;
  /** Callback when note pin is toggled */
  onNotePin?: (note: Note) => void;
  /** Current search query */
  searchQuery?: string;
  /** Callback when search query changes */
  onSearchChange?: (query: string) => void;
  /** Currently selected category filter ID */
  selectedCategoryId?: string | null;
  /** Callback when category filter changes */
  onCategoryChange?: (categoryId: string | null) => void;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Whether to show search and filters */
  showFilters?: boolean;
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
            <View style={styles.skeletonTitle} />
            <View style={styles.skeletonIcon} />
          </View>
          <View style={styles.skeletonContent} />
          <View style={styles.skeletonMeta}>
            <View style={styles.skeletonBadge} />
            <View style={styles.skeletonDate} />
          </View>
        </Card>
      ))}
    </View>
  );
}

/**
 * Empty state component
 */
function EmptyState({
  message,
  hasFilters,
}: {
  message: string;
  hasFilters: boolean;
}): React.ReactElement {
  return (
    <View style={styles.emptyContainer}>
      <Icon name="file-text" size={48} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>{hasFilters ? 'No Matching Notes' : 'No Notes Yet'}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

/**
 * NotesList component
 */
export function NotesList({
  notes,
  categories,
  isLoading = false,
  isRefreshing = false,
  onRefresh,
  onNotePress,
  onNoteEdit,
  onNoteDelete,
  onNotePin,
  searchQuery = '',
  onSearchChange,
  selectedCategoryId,
  onCategoryChange,
  emptyMessage = 'Create a note to get started.',
  showFilters = true,
}: NotesListProps): React.ReactElement {
  // Build category lookup map
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach(cat => map.set(cat.id, cat));
    return map;
  }, [categories]);

  // Filter and sort notes
  const filteredNotes = useMemo(() => {
    let result = [...notes];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        note =>
          note.title.toLowerCase().includes(query) ||
          (note.content?.toLowerCase().includes(query) ?? false)
      );
    }

    // Filter by category
    if (selectedCategoryId) {
      result = result.filter(note => note.category_id === selectedCategoryId);
    }

    // Sort: pinned first, then by updated_at descending
    result.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return result;
  }, [notes, searchQuery, selectedCategoryId]);

  const hasFilters = searchQuery.trim() !== '' || selectedCategoryId !== null;

  // Render item
  const renderItem = useCallback(
    ({ item }: { item: Note }) => {
      const category = item.category_id ? categoryMap.get(item.category_id) : null;

      return (
        <NoteCard
          note={item}
          categoryName={category?.name}
          categoryColor={category?.color}
          onPress={onNotePress}
          onEdit={onNoteEdit}
          onDelete={onNoteDelete}
          onPin={onNotePin}
        />
      );
    },
    [categoryMap, onNotePress, onNoteEdit, onNoteDelete, onNotePin]
  );

  // Key extractor
  const keyExtractor = useCallback((item: Note) => item.id, []);

  // Header component with search and filters
  const ListHeader = useMemo(() => {
    if (!showFilters) return null;

    return (
      <View style={styles.filtersContainer}>
        {/* Search input */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search notes..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={onSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search notes"
          />
          {searchQuery !== '' && (
            <Pressable
              onPress={() => onSearchChange?.('')}
              style={styles.clearButton}
              accessibilityLabel="Clear search"
            >
              <Icon name="x" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Category filter chips */}
        {categories.length > 0 && (
          <View style={styles.categoryFilters}>
            <Pressable
              style={[
                styles.categoryChip,
                selectedCategoryId === null ? styles.categoryChipActive : undefined,
              ]}
              onPress={() => onCategoryChange?.(null)}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedCategoryId === null }}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategoryId === null ? styles.categoryChipTextActive : undefined,
                ]}
              >
                All
              </Text>
            </Pressable>
            {categories.map(cat => (
              <Pressable
                key={cat.id}
                style={[
                  styles.categoryChip,
                  selectedCategoryId === cat.id ? styles.categoryChipActive : undefined,
                ]}
                onPress={() => onCategoryChange?.(selectedCategoryId === cat.id ? null : cat.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedCategoryId === cat.id }}
              >
                <View style={[styles.categoryChipDot, { backgroundColor: cat.color }]} />
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategoryId === cat.id ? styles.categoryChipTextActive : undefined,
                  ]}
                  numberOfLines={1}
                >
                  {cat.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  }, [showFilters, searchQuery, onSearchChange, categories, selectedCategoryId, onCategoryChange]);

  // Show loading skeleton
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Show empty state
  if (filteredNotes.length === 0) {
    return (
      <View style={styles.container}>
        {ListHeader}
        <EmptyState
          message={hasFilters ? 'Try adjusting your search or filters.' : emptyMessage}
          hasFilters={hasFilters}
        />
      </View>
    );
  }

  return (
    <FlatList
      data={filteredNotes}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={ListHeader}
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
      accessibilityLabel="Notes list"
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  filtersContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  clearButton: {
    padding: spacing.xs,
  },
  categoryFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.overlayLight,
  },
  categoryChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  categoryChipText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  categoryChipTextActive: {
    color: colors.primary,
    fontWeight: '500',
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
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  skeletonTitle: {
    width: 150,
    height: 18,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceVariant,
  },
  skeletonIcon: {
    width: 18,
    height: 18,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceVariant,
  },
  skeletonContent: {
    width: '100%',
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceVariant,
    marginBottom: spacing.sm,
  },
  skeletonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skeletonBadge: {
    width: 80,
    height: 20,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceVariant,
  },
  skeletonDate: {
    width: 60,
    height: 14,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceVariant,
  },
});

export default NotesList;
