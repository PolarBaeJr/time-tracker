/**
 * Tags Query & Mutation Hooks
 *
 * Provides TanStack Query hooks for CRUD operations on tags and
 * managing tag assignments on time entries.
 *
 * SECURITY:
 * - RLS policies ensure only the authenticated user's tags are returned
 * - user_id is NOT included in queries; it's enforced server-side
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  TagSchema,
  CreateTagSchema,
  type Tag,
  type CreateTagInput,
  type UpdateTagInput,
  type TimeEntryTag,
} from '@/schemas';

/**
 * Error thrown when a tag operation fails
 */
export class TagError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'TagError';
  }
}

// ============================================================================
// FETCH
// ============================================================================

async function fetchTags(): Promise<Tag[]> {
  const { data, error } = await supabase.from('tags').select('*').order('name');

  if (error) {
    throw new TagError(error.message, error.code);
  }

  if (!data) {
    return [];
  }

  return data.map(tag => {
    const parsed = TagSchema.safeParse(tag);
    if (!parsed.success) {
      console.warn('Invalid tag data:', tag, parsed.error);
      return tag as Tag;
    }
    return parsed.data;
  });
}

async function fetchEntryTags(entryId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('time_entry_tags')
    .select('tag_id')
    .eq('time_entry_id', entryId);

  if (error) {
    throw new TagError(error.message, error.code);
  }

  return (data || []).map(row => row.tag_id);
}

// ============================================================================
// MUTATIONS
// ============================================================================

async function createTag(input: CreateTagInput): Promise<Tag> {
  const validatedInput = CreateTagSchema.parse(input);

  const { data, error } = await supabase.from('tags').insert(validatedInput).select().single();

  if (error) {
    throw new TagError(error.message, error.code);
  }

  if (!data) {
    throw new TagError('No data returned from create');
  }

  return data as Tag;
}

async function updateTag({ id, data }: { id: string; data: UpdateTagInput }): Promise<Tag> {
  const { data: updated, error } = await supabase
    .from('tags')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new TagError(error.message, error.code);
  }

  if (!updated) {
    throw new TagError('No data returned from update');
  }

  return updated as Tag;
}

async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase.from('tags').delete().eq('id', id);

  if (error) {
    throw new TagError(error.message, error.code);
  }
}

async function setEntryTags({
  entryId,
  tagIds,
}: {
  entryId: string;
  tagIds: string[];
}): Promise<void> {
  // Remove all existing tags for this entry
  const { error: deleteError } = await supabase
    .from('time_entry_tags')
    .delete()
    .eq('time_entry_id', entryId);

  if (deleteError) {
    throw new TagError(deleteError.message, deleteError.code);
  }

  // Insert new tags
  if (tagIds.length > 0) {
    const rows = tagIds.map(tag_id => ({
      time_entry_id: entryId,
      tag_id,
    }));

    const { error: insertError } = await supabase.from('time_entry_tags').insert(rows);

    if (insertError) {
      throw new TagError(insertError.message, insertError.code);
    }
  }
}

// ============================================================================
// HOOKS
// ============================================================================

export interface UseTagsOptions {
  enabled?: boolean;
}

export function useTags(options?: UseTagsOptions) {
  return useQuery({
    queryKey: queryKeys.tags,
    queryFn: fetchTags,
    enabled: options?.enabled,
  });
}

export function useEntryTags(entryId: string | null) {
  return useQuery({
    queryKey: queryKeys.entryTags(entryId || ''),
    queryFn: () => fetchEntryTags(entryId!),
    enabled: !!entryId,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation<Tag, TagError, CreateTagInput>({
    mutationFn: createTag,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation<Tag, TagError, { id: string; data: UpdateTagInput }>({
    mutationFn: updateTag,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation<void, TagError, string>({
    mutationFn: deleteTag,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
    },
  });
}

export function useSetEntryTags() {
  const queryClient = useQueryClient();

  return useMutation<void, TagError, { entryId: string; tagIds: string[] }>({
    mutationFn: setEntryTags,
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entryTags(variables.entryId) });
    },
  });
}

export type UseTagsResult = ReturnType<typeof useTags>;
export type UseEntryTagsResult = ReturnType<typeof useEntryTags>;
export type UseCreateTagResult = ReturnType<typeof useCreateTag>;
export type UseUpdateTagResult = ReturnType<typeof useUpdateTag>;
export type UseDeleteTagResult = ReturnType<typeof useDeleteTag>;
export type UseSetEntryTagsResult = ReturnType<typeof useSetEntryTags>;
