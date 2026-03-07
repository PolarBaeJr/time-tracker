/**
 * EntryCard Component
 *
 * Displays a time entry with category information, times, duration,
 * and notes preview. Used in the History screen entry list.
 *
 * USAGE:
 * ```tsx
 * import { EntryCard } from '@/components/history';
 *
 * <EntryCard
 *   entry={timeEntry}
 *   categoryName="Work"
 *   categoryColor="#6366F1"
 *   categoryType="project"
 *   onEdit={() => navigateToEdit(entry.id)}
 * />
 * ```
 */

import * as React from 'react';
import { View, StyleSheet, Pressable, type TextStyle } from 'react-native';
import { Card, Text, Icon } from '@/components/ui';
import { colors, spacing, fontSizes, borderRadius } from '@/theme';
import type { TimeEntry } from '@/schemas';

/**
 * EntryCard props
 */
export interface EntryCardProps {
  /** The time entry data */
  entry: TimeEntry;
  /** Category name (null if uncategorized) */
  categoryName: string | null;
  /** Category color hex (null if uncategorized) */
  categoryColor: string | null;
  /** Category type (null if uncategorized) */
  categoryType: string | null;
  /** Callback when edit button is pressed */
  onEdit?: (entry: TimeEntry) => void;
  /** Callback when card is pressed */
  onPress?: (entry: TimeEntry) => void;
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
 * Format time from ISO string to HH:MM
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Format date from ISO string to readable format
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Check if today
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }

  // Check if yesterday
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  // Otherwise return formatted date
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Truncate notes to a preview length
 */
function truncateNotes(notes: string | null, maxLength: number = 80): string {
  if (!notes) return '';
  if (notes.length <= maxLength) return notes;
  return notes.slice(0, maxLength).trim() + '...';
}

/**
 * EntryCard component
 */
export function EntryCard({
  entry,
  categoryName,
  categoryColor,
  categoryType,
  onEdit,
  onPress,
}: EntryCardProps): React.ReactElement {
  const handlePress = React.useCallback(() => {
    onPress?.(entry);
  }, [onPress, entry]);

  const handleEdit = React.useCallback(() => {
    onEdit?.(entry);
  }, [onEdit, entry]);

  const isBreak = entry.entry_type && entry.entry_type !== 'work';
  const breakLabel = entry.entry_type === 'long_break' ? 'Long Break' : 'Break';

  return (
    <Card
      padding="md"
      elevation="sm"
      style={styles.card}
      pressable={!!onPress}
      onPress={handlePress}
    >
      {/* Row 1: Category name + type badge + edit button */}
      <View style={styles.header}>
        <View style={styles.categoryContainer}>
          {categoryName ? (
            <>
              <View
                style={[styles.colorChip, { backgroundColor: categoryColor || colors.primary }]}
              />
              <Text style={styles.categoryName}>{categoryName}</Text>
              <View style={styles.typeBadge}>
                <Text style={styles.typeText}>{categoryType || 'Other'}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.uncategorized}>Uncategorized</Text>
          )}
        </View>

        {onEdit && (
          <Pressable
            style={styles.editButton}
            onPress={handleEdit}
            accessibilityRole="button"
            accessibilityLabel="Edit entry"
          >
            <Icon name="edit" size={18} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Row 2: Notes preview */}
      {entry.notes ? (
        <Text style={styles.notesPreview} numberOfLines={2}>
          {truncateNotes(entry.notes)}
        </Text>
      ) : null}

      {/* Row 3: Date + time range */}
      <View style={styles.timeRow}>
        <Text style={styles.date}>{formatDate(entry.start_at)}</Text>
        <View style={styles.timeRange}>
          <Text style={styles.time}>{formatTime(entry.start_at)}</Text>
          <Text style={styles.timeSeparator}>-</Text>
          <Text style={styles.time}>{entry.end_at ? formatTime(entry.end_at) : 'Ongoing'}</Text>
        </View>
      </View>

      {/* Row 4: Break badge + Duration */}
      <View style={styles.metaRow}>
        {isBreak && (
          <View
            style={[
              styles.entryTypeBadge,
              entry.entry_type === 'long_break' ? styles.longBreakBadge : styles.breakBadge,
            ]}
          >
            <Text
              style={
                StyleSheet.flatten([
                  styles.entryTypeText,
                  entry.entry_type === 'long_break' ? styles.longBreakText : styles.breakText,
                ]) as TextStyle
              }
            >
              {breakLabel}: {formatDuration(entry.duration_seconds)}
            </Text>
          </View>
        )}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>
            Duration: {formatDuration(entry.duration_seconds)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorChip: {
    width: 12,
    height: 12,
    borderRadius: borderRadius.sm,
    marginRight: spacing.xs,
  },
  categoryName: {
    fontSize: fontSizes.md,
    color: colors.text,
    fontWeight: '500',
    marginRight: spacing.xs,
  },
  typeBadge: {
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  typeText: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  uncategorized: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  entryTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginRight: spacing.xs,
  },
  breakBadge: {
    backgroundColor: colors.success + '20',
  },
  longBreakBadge: {
    backgroundColor: colors.warning + '20',
  },
  entryTypeText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  breakText: {
    color: colors.success,
  },
  longBreakText: {
    color: colors.warning,
  },
  editButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  notesPreview: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: fontSizes.sm * 1.4,
    marginBottom: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  date: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginRight: spacing.md,
    minWidth: 80,
  },
  timeRange: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  time: {
    fontSize: fontSizes.sm,
    color: colors.text,
  },
  timeSeparator: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginHorizontal: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  durationBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  durationText: {
    fontSize: fontSizes.sm,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default EntryCard;
