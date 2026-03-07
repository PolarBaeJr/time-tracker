/**
 * EntryComments Component
 *
 * Displays a comment list with an add form for a time entry.
 * Used in entry detail/edit views.
 *
 * USAGE:
 * ```tsx
 * <EntryComments entryId={entry.id} />
 * ```
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';
import { Text, Button, Icon, Spinner } from '@/components/ui';
import { colors, spacing, fontSizes, borderRadius } from '@/theme';
import {
  useEntryComments,
  useCreateEntryComment,
  useDeleteEntryComment,
} from '@/hooks/useEntryComments';
import type { EntryComment } from '@/schemas';

export interface EntryCommentsProps {
  entryId: string;
  disabled?: boolean;
}

function formatCommentDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function CommentItem({
  comment,
  onDelete,
  disabled,
}: {
  comment: EntryComment;
  onDelete: (id: string) => void;
  disabled: boolean;
}): React.ReactElement {
  return (
    <View style={styles.commentItem}>
      <View style={styles.commentHeader}>
        <Text style={styles.commentDate}>{formatCommentDate(comment.created_at)}</Text>
        {!disabled && (
          <Pressable
            onPress={() => onDelete(comment.id)}
            style={styles.deleteButton}
            accessibilityRole="button"
            accessibilityLabel="Delete comment"
          >
            <Icon name="trash" size={14} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      <Text style={styles.commentContent}>{comment.content}</Text>
    </View>
  );
}

export function EntryComments({
  entryId,
  disabled = false,
}: EntryCommentsProps): React.ReactElement {
  const { data: comments = [], isLoading } = useEntryComments(entryId);
  const createComment = useCreateEntryComment();
  const deleteComment = useDeleteEntryComment();
  const [newComment, setNewComment] = useState('');

  const handleSubmit = useCallback(async () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;

    try {
      await createComment.mutateAsync({
        time_entry_id: entryId,
        content: trimmed,
      });
      setNewComment('');
    } catch {
      // Error handled by mutation
    }
  }, [newComment, entryId, createComment]);

  const handleDelete = useCallback(
    (commentId: string) => {
      deleteComment.mutate({ id: commentId, entryId });
    },
    [deleteComment, entryId]
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionLabel}>Comments</Text>
        <Spinner size="small" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>
        Comments {comments.length > 0 ? `(${comments.length})` : ''}
      </Text>

      {/* Comment list */}
      {comments.map(comment => (
        <CommentItem
          key={comment.id}
          comment={comment}
          onDelete={handleDelete}
          disabled={disabled || deleteComment.isPending}
        />
      ))}

      {comments.length === 0 && <Text style={styles.emptyText}>No comments yet.</Text>}

      {/* Add comment form */}
      {!disabled && (
        <View style={styles.addForm}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment..."
            placeholderTextColor={colors.textMuted}
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={2000}
          />
          <Button
            variant="primary"
            size="sm"
            onPress={handleSubmit}
            disabled={!newComment.trim() || createComment.isPending}
            loading={createComment.isPending}
          >
            Add
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  sectionLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  commentItem: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentDate: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  deleteButton: {
    padding: 4,
  },
  commentContent: {
    fontSize: fontSizes.sm,
    color: colors.text,
    lineHeight: fontSizes.sm * 1.4,
  },
  emptyText: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  addForm: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.sm,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 40,
    maxHeight: 100,
  },
});

export default EntryComments;
