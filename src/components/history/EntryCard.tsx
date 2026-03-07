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
 * Tag info for display on entry cards
 */
export interface EntryTagInfo {
  id: string;
  name: string;
  color: string;
}

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
  /** Tags assigned to this entry */
  tags?: EntryTagInfo[];
  /** Callback when edit button is pressed */
  onEdit?: (entry: TimeEntry) => void;
  /** Callback when card is pressed */
  onPress?: (entry: TimeEntry) => void;
  /** Category hourly rate (null if not set) */
  categoryHourlyRate?: number | null;
  /** Callback when split button is pressed */
  onSplit?: (entry: TimeEntry) => void;
  /** Callback when duplicate button is pressed */
  onDuplicate?: (entry: TimeEntry) => void;
  /** Whether the card is in selectable mode */
  isSelectable?: boolean;
  /** Whether the card is currently selected */
  isSelected?: boolean;
  /** Callback when selection checkbox is toggled */
  onToggleSelect?: (entry: TimeEntry) => void;
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
 * Render notes with basic markdown formatting (bold, italic, bullet lists)
 */
function RichNotes({ text }: { text: string }): React.ReactElement {
  const lines = text.split('\n');
  const elements: React.ReactElement[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBullet = /^[-*]\s+/.test(line);
    const content = isBullet ? line.replace(/^[-*]\s+/, '') : line;

    const styledParts = renderInlineMarkdown(content, i);

    if (isBullet) {
      elements.push(
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>{'\u2022'}</Text>
          <Text style={styles.notesPreview} numberOfLines={1}>
            {styledParts}
          </Text>
        </View>
      );
    } else {
      elements.push(
        <Text key={i} style={styles.notesPreview} numberOfLines={1}>
          {styledParts}
        </Text>
      );
    }
  }

  return <View style={styles.notesContainer}>{elements}</View>;
}

/**
 * Parse inline markdown (**bold** and *italic*) into styled Text elements
 */
function renderInlineMarkdown(text: string, lineKey: number): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold** or *italic* patterns
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // Bold
      parts.push(
        <Text key={`${lineKey}-${partIndex}`} style={styles.boldText}>
          {match[2]}
        </Text>
      );
    } else if (match[3]) {
      // Italic
      parts.push(
        <Text key={`${lineKey}-${partIndex}`} style={styles.italicText}>
          {match[3]}
        </Text>
      );
    }

    lastIndex = match.index + match[0].length;
    partIndex++;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Check if text contains markdown formatting
 */
function hasMarkdown(text: string): boolean {
  return /(\*\*.+?\*\*|\*.+?\*|^[-*]\s+)/m.test(text);
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
  tags,
  categoryHourlyRate,
  onEdit,
  onPress,
  onSplit,
  onDuplicate,
  isSelectable = false,
  isSelected = false,
  onToggleSelect,
}: EntryCardProps): React.ReactElement {
  const handlePress = React.useCallback(() => {
    if (isSelectable && onToggleSelect) {
      onToggleSelect(entry);
    } else {
      onPress?.(entry);
    }
  }, [onPress, onToggleSelect, entry, isSelectable]);

  const handleEdit = React.useCallback(() => {
    onEdit?.(entry);
  }, [onEdit, entry]);

  const handleSplit = React.useCallback(() => {
    onSplit?.(entry);
  }, [onSplit, entry]);

  const handleDuplicate = React.useCallback(() => {
    onDuplicate?.(entry);
  }, [onDuplicate, entry]);

  const handleCheckboxPress = React.useCallback(() => {
    onToggleSelect?.(entry);
  }, [onToggleSelect, entry]);

  const isBreak = entry.entry_type && entry.entry_type !== 'work';
  const breakLabel = entry.entry_type === 'long_break' ? 'Long Break' : 'Break';
  const isBillable = entry.is_billable === true;
  const earnings =
    isBillable && categoryHourlyRate ? (categoryHourlyRate * entry.duration_seconds) / 3600 : null;

  return (
    <Card
      padding="md"
      elevation="sm"
      style={StyleSheet.flatten([styles.card, isSelected ? styles.cardSelected : undefined])}
      pressable={!!onPress || isSelectable}
      onPress={handlePress}
    >
      {/* Row 1: Checkbox + Category name + type badge + actions */}
      <View style={styles.header}>
        <View style={styles.categoryContainer}>
          {isSelectable && (
            <Pressable
              style={styles.checkbox}
              onPress={handleCheckboxPress}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={isSelected ? 'Deselect entry' : 'Select entry'}
            >
              <Icon
                name={isSelected ? 'checkbox-checked' : 'checkbox-blank'}
                size={20}
                color={isSelected ? colors.primary : colors.textSecondary}
              />
            </Pressable>
          )}
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

        <View style={styles.actionButtons}>
          {onDuplicate && !isSelectable && (
            <Pressable
              style={styles.editButton}
              onPress={handleDuplicate}
              accessibilityRole="button"
              accessibilityLabel="Duplicate entry"
            >
              <Icon name="copy" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
          {onSplit && !isSelectable && (
            <Pressable
              style={styles.editButton}
              onPress={handleSplit}
              accessibilityRole="button"
              accessibilityLabel="Split entry"
            >
              <Icon name="scissors" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
          {onEdit && !isSelectable && (
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
      </View>

      {/* Row 2: Notes preview with markdown */}
      {entry.notes ? (
        hasMarkdown(entry.notes) ? (
          <RichNotes text={entry.notes} />
        ) : (
          <Text style={styles.notesPreview} numberOfLines={2}>
            {truncateNotes(entry.notes)}
          </Text>
        )
      ) : null}

      {/* Row 2.5: Tags */}
      {tags && tags.length > 0 && (
        <View style={styles.tagRow}>
          {tags.map(tag => (
            <View
              key={tag.id}
              style={[
                styles.tagChip,
                { backgroundColor: tag.color + '20', borderColor: tag.color },
              ]}
            >
              <View style={[styles.tagDot, { backgroundColor: tag.color }]} />
              <Text style={StyleSheet.flatten([styles.tagText, { color: tag.color }]) as TextStyle}>
                {tag.name}
              </Text>
            </View>
          ))}
        </View>
      )}

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
        {isBillable && (
          <View style={styles.billableBadge}>
            <Text style={styles.billableText}>$</Text>
          </View>
        )}
        {earnings !== null && (
          <View style={styles.earningsBadge}>
            <Text style={styles.earningsText}>${earnings.toFixed(2)}</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
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
  checkbox: {
    marginRight: spacing.sm,
    padding: 2,
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
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
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
  notesContainer: {
    marginBottom: spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulletDot: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginRight: spacing.xs,
    lineHeight: fontSizes.sm * 1.4,
  },
  boldText: {
    fontWeight: '700',
    color: colors.text,
  },
  italicText: {
    fontStyle: 'italic',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: spacing.sm,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  tagText: {
    fontSize: fontSizes.xs,
    fontWeight: '500',
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
  billableBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  billableText: {
    fontSize: fontSizes.sm,
    color: colors.success,
    fontWeight: '700',
  },
  earningsBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  earningsText: {
    fontSize: fontSizes.sm,
    color: colors.success,
    fontWeight: '600',
  },
});

export default EntryCard;
