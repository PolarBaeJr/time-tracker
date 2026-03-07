/**
 * Entry Attachments Query & Mutation Hooks
 *
 * Provides TanStack Query hooks for fetching, uploading, and deleting
 * file attachments on time entries via Supabase Storage.
 *
 * SECURITY:
 * - RLS policies ensure only the authenticated user's attachments are returned
 * - Storage paths are scoped to user_id to prevent cross-user access
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { EntryAttachmentSchema, type EntryAttachment } from '@/schemas';

/**
 * Error thrown when an attachment operation fails
 */
export class EntryAttachmentError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'EntryAttachmentError';
  }
}

// ============================================================================
// FETCH
// ============================================================================

async function fetchEntryAttachments(entryId: string): Promise<EntryAttachment[]> {
  const { data, error } = await supabase
    .from('entry_attachments')
    .select('*')
    .eq('time_entry_id', entryId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new EntryAttachmentError(error.message, error.code);
  }

  if (!data) {
    return [];
  }

  return data.map(attachment => {
    const parsed = EntryAttachmentSchema.safeParse(attachment);
    if (!parsed.success) {
      console.warn('Invalid attachment data:', attachment, parsed.error);
      return attachment as EntryAttachment;
    }
    return parsed.data;
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

interface UploadAttachmentInput {
  entryId: string;
  file: File;
}

async function uploadAttachment(
  input: UploadAttachmentInput,
  userId: string
): Promise<EntryAttachment> {
  const { entryId, file } = input;
  const fileId = crypto.randomUUID();
  const storagePath = `${userId}/${entryId}/${fileId}-${file.name}`;

  // Upload to Storage
  const { error: uploadError } = await supabase.storage
    .from('entry-attachments')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new EntryAttachmentError(uploadError.message);
  }

  // Insert metadata into table
  const { data, error } = await supabase
    .from('entry_attachments')
    .insert({
      time_entry_id: entryId,
      file_name: file.name,
      file_size: file.size,
      content_type: file.type,
      storage_path: storagePath,
    })
    .select()
    .single();

  if (error) {
    // Clean up uploaded file on metadata insert failure
    await supabase.storage.from('entry-attachments').remove([storagePath]);
    throw new EntryAttachmentError(error.message, error.code);
  }

  if (!data) {
    throw new EntryAttachmentError('No data returned from create');
  }

  return data as EntryAttachment;
}

async function deleteAttachment(attachment: EntryAttachment): Promise<void> {
  // Delete from Storage
  const { error: storageError } = await supabase.storage
    .from('entry-attachments')
    .remove([attachment.storage_path]);

  if (storageError) {
    throw new EntryAttachmentError(storageError.message);
  }

  // Delete metadata from table
  const { error } = await supabase.from('entry_attachments').delete().eq('id', attachment.id);

  if (error) {
    throw new EntryAttachmentError(error.message, error.code);
  }
}

async function createSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('entry-attachments')
    .createSignedUrl(storagePath, 3600);

  if (error) {
    throw new EntryAttachmentError(error.message);
  }

  return data.signedUrl;
}

// ============================================================================
// HOOKS
// ============================================================================

export function useEntryAttachments(entryId: string | null) {
  return useQuery({
    queryKey: queryKeys.entryAttachments(entryId || ''),
    queryFn: () => fetchEntryAttachments(entryId!),
    enabled: !!entryId,
  });
}

export function useUploadAttachment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<EntryAttachment, EntryAttachmentError, UploadAttachmentInput>({
    mutationFn: input => uploadAttachment(input, user!.id),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.entryAttachments(variables.entryId),
      });
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation<void, EntryAttachmentError, { attachment: EntryAttachment; entryId: string }>({
    mutationFn: ({ attachment }) => deleteAttachment(attachment),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.entryAttachments(variables.entryId),
      });
    },
  });
}

export function useAttachmentUrl(storagePath: string | null) {
  return useQuery({
    queryKey: ['attachmentUrl', storagePath],
    queryFn: () => createSignedUrl(storagePath!),
    enabled: !!storagePath,
    staleTime: 50 * 60 * 1000, // 50 minutes (URL expires in 60)
  });
}

export type UseEntryAttachmentsResult = ReturnType<typeof useEntryAttachments>;
export type UseUploadAttachmentResult = ReturnType<typeof useUploadAttachment>;
export type UseDeleteAttachmentResult = ReturnType<typeof useDeleteAttachment>;
export type UseAttachmentUrlResult = ReturnType<typeof useAttachmentUrl>;
