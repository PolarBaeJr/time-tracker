/**
 * Entry Comments Query & Mutation Hooks
 *
 * Provides TanStack Query hooks for fetching, creating, and deleting
 * comments on time entries.
 *
 * SECURITY:
 * - RLS policies ensure only the authenticated user's comments are returned
 * - user_id is NOT included in queries; it's enforced server-side
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  EntryCommentSchema,
  CreateEntryCommentSchema,
  type EntryComment,
  type CreateEntryCommentInput,
} from '@/schemas';

/**
 * Error thrown when a comment operation fails
 */
export class EntryCommentError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'EntryCommentError';
  }
}

// ============================================================================
// FETCH
// ============================================================================

async function fetchEntryComments(entryId: string): Promise<EntryComment[]> {
  const { data, error } = await supabase
    .from('entry_comments')
    .select('*')
    .eq('time_entry_id', entryId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new EntryCommentError(error.message, error.code);
  }

  if (!data) {
    return [];
  }

  return data.map(comment => {
    const parsed = EntryCommentSchema.safeParse(comment);
    if (!parsed.success) {
      console.warn('Invalid comment data:', comment, parsed.error);
      return comment as EntryComment;
    }
    return parsed.data;
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

async function createEntryComment(input: CreateEntryCommentInput): Promise<EntryComment> {
  const validatedInput = CreateEntryCommentSchema.parse(input);

  const { data, error } = await supabase
    .from('entry_comments')
    .insert(validatedInput)
    .select()
    .single();

  if (error) {
    throw new EntryCommentError(error.message, error.code);
  }

  if (!data) {
    throw new EntryCommentError('No data returned from create');
  }

  return data as EntryComment;
}

async function deleteEntryComment(id: string): Promise<void> {
  const { error } = await supabase.from('entry_comments').delete().eq('id', id);

  if (error) {
    throw new EntryCommentError(error.message, error.code);
  }
}

// ============================================================================
// HOOKS
// ============================================================================

export function useEntryComments(entryId: string | null) {
  return useQuery({
    queryKey: queryKeys.entryComments(entryId || ''),
    queryFn: () => fetchEntryComments(entryId!),
    enabled: !!entryId,
  });
}

export function useCreateEntryComment() {
  const queryClient = useQueryClient();

  return useMutation<EntryComment, EntryCommentError, CreateEntryCommentInput>({
    mutationFn: createEntryComment,
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.entryComments(variables.time_entry_id),
      });
    },
  });
}

export function useDeleteEntryComment() {
  const queryClient = useQueryClient();

  return useMutation<void, EntryCommentError, { id: string; entryId: string }>({
    mutationFn: ({ id }) => deleteEntryComment(id),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.entryComments(variables.entryId),
      });
    },
  });
}

export type UseEntryCommentsResult = ReturnType<typeof useEntryComments>;
export type UseCreateEntryCommentResult = ReturnType<typeof useCreateEntryComment>;
export type UseDeleteEntryCommentResult = ReturnType<typeof useDeleteEntryComment>;
