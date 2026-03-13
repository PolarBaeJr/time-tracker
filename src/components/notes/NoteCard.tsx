/**
 * NoteCard Component
 *
 * Displays a note with title, content preview, category badge,
 * timestamps, and pin indicator. Supports swipe actions and
 * interactive callbacks.
 *
 * USAGE:
 * ```tsx
 * import { NoteCard } from '@/components/notes';
 *
 * <NoteCard
 *   note={note}
 *   categoryName="Work"
 *   categoryColor="#6366F1"
 *   onPress={() => handleNotePress(note)}
 *   onEdit={() => handleEdit(note)}
 *   onDelete={() => handleDelete(note.id)}
 *   onPin={() => handlePin(note.id, !note.pinned)}
 * />
 * ```
 */

import * as React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Card, Text, Icon } from '@/components/ui';
import { colors, spacing, fontSizes, borderRadius } from '@/theme';
import type { Note } from '@/schemas';

/**
 * NoteCard props
 */
export interface NoteCardProps {
  /** The note data */
  note: Note;
  /** Category name (null if uncategorized) */
  categoryName?: string | null;
  /** Category color hex (null if uncategorized) */
  categoryColor?: string | null;
  /** Callback when card is pressed */
  onPress?: (note: Note) => void;
  /** Callback when edit button is pressed */
  onEdit?: (note: Note) => void;
  /** Callback when delete is triggered */
  onDelete?: (note: Note) => void;
  /** Callback when pin button is pressed */
  onPin?: (note: Note) => void;
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
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Truncate content to a preview length
 */
function truncateContent(content: string | null, maxLength: number = 100): string {
  if (!content) return '';
  // Collapse newlines to spaces for preview
  const collapsed = content.replace(/\n+/g, ' ').trim();
  if (collapsed.length <= maxLength) return collapsed;
  return collapsed.slice(0, maxLength).trim() + '...';
}

/**
 * NoteCard component
 */
export function NoteCard({
  note,
  categoryName,
  categoryColor,
  onPress,
  onEdit,
  onDelete,
  onPin,
}: NoteCardProps): React.ReactElement {
  const handlePress = React.useCallback(() => {
    onPress?.(note);
  }, [onPress, note]);

  const handleEdit = React.useCallback(() => {
    onEdit?.(note);
  }, [onEdit, note]);

  const handlePin = React.useCallback(() => {
    onPin?.(note);
  }, [onPin, note]);

  const handleDelete = React.useCallback(() => {
    onDelete?.(note);
  }, [onDelete, note]);

  const contentPreview = truncateContent(note.content);

  return (
    <Card
      padding="md"
      elevation="sm"
      style={styles.card}
      pressable={!!onPress}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Note: ${note.title}${note.pinned ? ', pinned' : ''}`}
    >
      {/* Row 1: Title + pin indicator + actions */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          {note.pinned && (
            <Icon name="pin" size={14} color={colors.primary} style={styles.pinIcon} />
          )}
          <Text style={styles.title} numberOfLines={1}>
            {note.title}
          </Text>
        </View>

        <View style={styles.actionButtons}>
          {onPin && (
            <Pressable
              style={styles.actionButton}
              onPress={handlePin}
              accessibilityRole="button"
              accessibilityLabel={note.pinned ? 'Unpin note' : 'Pin note'}
            >
              <Icon
                name={note.pinned ? 'pin-off' : 'pin'}
                size={16}
                color={note.pinned ? colors.primary : colors.textSecondary}
              />
            </Pressable>
          )}
          {onEdit && (
            <Pressable
              style={styles.actionButton}
              onPress={handleEdit}
              accessibilityRole="button"
              accessibilityLabel="Edit note"
            >
              <Icon name="edit" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
          {onDelete && (
            <Pressable
              style={styles.actionButton}
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel="Delete note"
            >
              <Icon name="trash" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Row 2: Content preview */}
      {contentPreview && (
        <Text style={styles.contentPreview} numberOfLines={2}>
          {contentPreview}
        </Text>
      )}

      {/* Row 3: Category badge + timestamps */}
      <View style={styles.metaRow}>
        {categoryName && (
          <View style={styles.categoryBadge}>
            <View
              style={[styles.categoryDot, { backgroundColor: categoryColor || colors.primary }]}
            />
            <Text style={styles.categoryText}>{categoryName}</Text>
          </View>
        )}
        <View style={styles.timestamps}>
          <Text style={styles.dateText}>{formatDate(note.updated_at)}</Text>
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
    marginBottom: spacing.xs,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  pinIcon: {
    marginRight: spacing.xs,
  },
  title: {
    fontSize: fontSizes.md,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  contentPreview: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: fontSizes.sm * 1.4,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  categoryText: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  timestamps: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
});

export default NoteCard;
