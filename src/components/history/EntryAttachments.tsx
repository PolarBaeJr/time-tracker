/**
 * EntryAttachments Component
 *
 * Displays an attachment list with an upload button for a time entry.
 * Used in entry detail/edit views.
 *
 * USAGE:
 * ```tsx
 * <EntryAttachments entryId={entry.id} />
 * ```
 */

import * as React from 'react';
import { useCallback } from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { Text, Button, Icon, Spinner } from '@/components/ui';
import { colors, spacing, fontSizes, borderRadius } from '@/theme';
import {
  useEntryAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  useAttachmentUrl,
} from '@/hooks/useEntryAttachments';
import type { EntryAttachment } from '@/schemas';

export interface EntryAttachmentsProps {
  entryId: string;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(contentType: string): boolean {
  return contentType.startsWith('image/');
}

function AttachmentThumbnail({ storagePath }: { storagePath: string }): React.ReactElement {
  const { data: url } = useAttachmentUrl(storagePath);

  if (!url) {
    return (
      <View style={styles.thumbnailPlaceholder}>
        <Spinner size="small" />
      </View>
    );
  }

  return <Image source={{ uri: url }} style={styles.thumbnail} resizeMode="cover" />;
}

function AttachmentItem({
  attachment,
  entryId,
  onDelete,
  disabled,
}: {
  attachment: EntryAttachment;
  entryId: string;
  onDelete: (attachment: EntryAttachment) => void;
  disabled: boolean;
}): React.ReactElement {
  const { data: url } = useAttachmentUrl(attachment.storage_path);
  const isImage = isImageType(attachment.content_type);

  const handlePress = useCallback(() => {
    if (url) {
      window.open(url, '_blank');
    }
  }, [url]);

  return (
    <View style={styles.attachmentItem}>
      <Pressable style={styles.attachmentContent} onPress={handlePress} disabled={!url}>
        {isImage ? (
          <AttachmentThumbnail storagePath={attachment.storage_path} />
        ) : (
          <View style={styles.fileIconContainer}>
            <Icon name="file" size={20} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.attachmentInfo}>
          <Text style={styles.attachmentName} numberOfLines={1}>
            {attachment.file_name}
          </Text>
          <Text style={styles.attachmentSize}>{formatFileSize(attachment.file_size)}</Text>
        </View>
      </Pressable>
      {!disabled && (
        <Pressable
          onPress={() => onDelete(attachment)}
          style={styles.deleteButton}
          accessibilityRole="button"
          accessibilityLabel="Delete attachment"
        >
          <Icon name="trash" size={14} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

export function EntryAttachments({
  entryId,
  disabled = false,
}: EntryAttachmentsProps): React.ReactElement {
  const { data: attachments = [], isLoading } = useEntryAttachments(entryId);
  const uploadAttachment = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();

  const handleUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/gif,image/webp,application/pdf';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        uploadAttachment.mutate({ entryId, file });
      }
    };
    input.click();
  }, [entryId, uploadAttachment]);

  const handleDelete = useCallback(
    (attachment: EntryAttachment) => {
      deleteAttachment.mutate({ attachment, entryId });
    },
    [deleteAttachment, entryId]
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionLabel}>Attachments</Text>
        <Spinner size="small" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>
        Attachments {attachments.length > 0 ? `(${attachments.length})` : ''}
      </Text>

      {/* Attachment list */}
      {attachments.map(attachment => (
        <AttachmentItem
          key={attachment.id}
          attachment={attachment}
          entryId={entryId}
          onDelete={handleDelete}
          disabled={disabled || deleteAttachment.isPending}
        />
      ))}

      {attachments.length === 0 && <Text style={styles.emptyText}>No attachments yet.</Text>}

      {/* Upload button */}
      {!disabled && (
        <Button
          variant="outline"
          size="sm"
          onPress={handleUpload}
          disabled={uploadAttachment.isPending}
          loading={uploadAttachment.isPending}
        >
          Attach File
        </Button>
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
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  attachmentContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
  },
  thumbnailPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    fontSize: fontSizes.sm,
    color: colors.text,
  },
  attachmentSize: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  deleteButton: {
    padding: 4,
  },
  emptyText: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
});

export default EntryAttachments;
