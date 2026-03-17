/**
 * Time Entry Mutation Hooks
 *
 * This module provides TanStack Query mutation hooks for creating, updating,
 * and deleting time entries with optimistic updates.
 *
 * USAGE:
 * ```typescript
 * import {
 *   useCreateTimeEntry,
 *   useUpdateTimeEntry,
 *   useDeleteTimeEntry,
 * } from '@/hooks/useTimeEntryMutations';
 *
 * function EntryActions({ entry }: { entry: TimeEntry }) {
 *   const createEntry = useCreateTimeEntry();
 *   const updateEntry = useUpdateTimeEntry();
 *   const deleteEntry = useDeleteTimeEntry();
 *
 *   const handleCreate = async () => {
 *     await createEntry.mutateAsync({
 *       start_at: new Date().toISOString(),
 *       duration_seconds: 3600,
 *     });
 *   };
 *
 *   const handleUpdate = async () => {
 *     await updateEntry.mutateAsync({
 *       id: entry.id,
 *       data: { notes: 'Updated notes' },
 *     });
 *   };
 *
 *   const handleDelete = async () => {
 *     await deleteEntry.mutateAsync(entry.id);
 *   };
 *
 *   return <View>...</View>;
 * }
 * ```
 *
 * IMPORTANT:
 * - Use CreateTimeEntrySchema/UpdateTimeEntrySchema for validation
 * - NEVER include server-managed fields (id, user_id, created_at, updated_at) in mutations
 * - RLS policies handle user_id enforcement server-side
 *
 * SECURITY:
 * - Input is validated against Zod schemas before mutation
 * - RLS policies ensure users can only modify their own entries
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { isDeviceOnline } from './useNetworkStatus';
import { queueCreateEntry, queueUpdateEntry, queueDeleteEntry } from './useOfflineSync';
import {
  CreateTimeEntrySchema,
  UpdateTimeEntrySchema,
  TimeEntrySchema,
  type TimeEntry,
  type CreateTimeEntryInput,
  type UpdateTimeEntryInput,
} from '@/schemas';
import type { TimeEntriesPage } from './useTimeEntries';

/**
 * Error thrown when time entry mutation fails
 */
export class TimeEntryMutationError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'TimeEntryMutationError';
  }
}

// ============================================================================
// CREATE TIME ENTRY
// ============================================================================

/**
 * Create a new time entry
 *
 * @param input - Entry data validated against CreateTimeEntrySchema
 * @returns Promise<TimeEntry> - The created entry
 * @throws TimeEntryMutationError if validation or creation fails
 */
async function createTimeEntry(input: CreateTimeEntryInput): Promise<TimeEntry> {
  // Validate input against CreateTimeEntrySchema
  const validationResult = CreateTimeEntrySchema.safeParse(input);
  if (!validationResult.success) {
    throw new TimeEntryMutationError(
      `Validation failed: ${validationResult.error.message}`,
      'VALIDATION_ERROR',
      validationResult.error.flatten()
    );
  }

  const validatedInput = validationResult.data;

  // If offline, queue the action and return a synthetic entry
  if (!isDeviceOnline()) {
    await queueCreateEntry(validatedInput);
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      user_id: '00000000-0000-0000-0000-000000000000',
      category_id: validatedInput.category_id ?? null,
      start_at: validatedInput.start_at,
      end_at: validatedInput.end_at ?? null,
      duration_seconds: validatedInput.duration_seconds,
      notes: validatedInput.notes ?? null,
      entry_type: 'work',
      is_billable: validatedInput.is_billable ?? false,
      project_id: validatedInput.project_id ?? null,
      created_at: now,
      updated_at: now,
    } as TimeEntry;
  }

  // Insert the entry - user_id is set server-side via DEFAULT auth.uid()
  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      category_id: validatedInput.category_id ?? null,
      start_at: validatedInput.start_at,
      end_at: validatedInput.end_at ?? null,
      duration_seconds: validatedInput.duration_seconds,
      notes: validatedInput.notes ?? null,
      is_billable: validatedInput.is_billable ?? false,
      project_id: validatedInput.project_id ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new TimeEntryMutationError(error.message, error.code, error.details);
  }

  if (!data) {
    throw new TimeEntryMutationError('No data returned from insert', 'NO_DATA');
  }

  // Validate response
  const parsed = TimeEntrySchema.safeParse(data);
  if (!parsed.success) {
    console.warn('[useTimeEntryMutations] Invalid response data:', data, parsed.error);
    return data as TimeEntry;
  }

  return parsed.data;
}

/**
 * Options for useCreateTimeEntry hook
 */
export interface UseCreateTimeEntryOptions {
  /**
   * Callback invoked on successful creation
   */
  onSuccess?: (entry: TimeEntry) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: TimeEntryMutationError) => void;
}

/**
 * Hook to create a new time entry
 *
 * Uses optimistic updates to immediately add the entry to the cache,
 * then reconciles with the server response.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 *
 * @example
 * ```typescript
 * const createEntry = useCreateTimeEntry({
 *   onSuccess: (entry) => console.log('Created:', entry.id),
 * });
 *
 * await createEntry.mutateAsync({
 *   start_at: '2024-01-15T09:00:00Z',
 *   end_at: '2024-01-15T10:00:00Z',
 *   duration_seconds: 3600,
 *   category_id: 'uuid-here',
 *   notes: 'Morning work session',
 * });
 * ```
 */
export function useCreateTimeEntry(options?: UseCreateTimeEntryOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTimeEntry,
    onSuccess: data => {
      // Invalidate all time entry queries to refetch with new data
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });

      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      const mutationError =
        error instanceof TimeEntryMutationError ? error : new TimeEntryMutationError(error.message);

      options?.onError?.(mutationError);
    },
  });
}

// ============================================================================
// UPDATE TIME ENTRY
// ============================================================================

/**
 * Parameters for updating a time entry
 */
export interface UpdateTimeEntryParams {
  id: string;
  data: UpdateTimeEntryInput;
}

/**
 * Update an existing time entry
 *
 * @param params - Entry ID and update data
 * @returns Promise<TimeEntry> - The updated entry
 * @throws TimeEntryMutationError if validation or update fails
 */
async function updateTimeEntry({ id, data }: UpdateTimeEntryParams): Promise<TimeEntry> {
  // Validate input against UpdateTimeEntrySchema
  const validationResult = UpdateTimeEntrySchema.safeParse(data);
  if (!validationResult.success) {
    throw new TimeEntryMutationError(
      `Validation failed: ${validationResult.error.message}`,
      'VALIDATION_ERROR',
      validationResult.error.flatten()
    );
  }

  const validatedInput = validationResult.data;

  // If offline, queue the update and return optimistic data
  if (!isDeviceOnline()) {
    await queueUpdateEntry(id, validatedInput);
    const now = new Date().toISOString();
    return {
      id,
      user_id: '00000000-0000-0000-0000-000000000000',
      category_id: null,
      start_at: now,
      end_at: null,
      duration_seconds: 0,
      notes: null,
      entry_type: 'work',
      created_at: now,
      updated_at: now,
      ...validatedInput,
    } as TimeEntry;
  }

  // Build the update object, only including defined fields
  const updateData: Record<string, unknown> = {};

  if (validatedInput.category_id !== undefined) {
    updateData.category_id = validatedInput.category_id;
  }
  if (validatedInput.start_at !== undefined) {
    updateData.start_at = validatedInput.start_at;
  }
  if (validatedInput.end_at !== undefined) {
    updateData.end_at = validatedInput.end_at;
  }
  if (validatedInput.duration_seconds !== undefined) {
    updateData.duration_seconds = validatedInput.duration_seconds;
  }
  if (validatedInput.notes !== undefined) {
    updateData.notes = validatedInput.notes;
  }
  if (validatedInput.is_billable !== undefined) {
    updateData.is_billable = validatedInput.is_billable;
  }
  if (validatedInput.billing_rate !== undefined) {
    updateData.billing_rate = validatedInput.billing_rate;
  }
  if (validatedInput.project_id !== undefined) {
    updateData.project_id = validatedInput.project_id;
  }

  // RLS ensures user can only update their own entries
  const { data: result, error } = await supabase
    .from('time_entries')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new TimeEntryMutationError(error.message, error.code, error.details);
  }

  if (!result) {
    throw new TimeEntryMutationError('Entry not found or no permission', 'NOT_FOUND');
  }

  // Validate response
  const parsed = TimeEntrySchema.safeParse(result);
  if (!parsed.success) {
    console.warn('[useTimeEntryMutations] Invalid response data:', result, parsed.error);
    return result as TimeEntry;
  }

  return parsed.data;
}

/**
 * Options for useUpdateTimeEntry hook
 */
export interface UseUpdateTimeEntryOptions {
  /**
   * Callback invoked on successful update
   */
  onSuccess?: (entry: TimeEntry) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: TimeEntryMutationError) => void;
}

/**
 * Hook to update an existing time entry
 *
 * Uses optimistic updates to immediately reflect changes in the UI,
 * rolling back on error.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 *
 * @example
 * ```typescript
 * const updateEntry = useUpdateTimeEntry({
 *   onSuccess: (entry) => console.log('Updated:', entry.id),
 * });
 *
 * await updateEntry.mutateAsync({
 *   id: 'entry-uuid',
 *   data: { notes: 'Updated notes' },
 * });
 * ```
 */
export function useUpdateTimeEntry(options?: UseUpdateTimeEntryOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTimeEntry,
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['timeEntries'] });

      // Snapshot previous values for rollback
      const previousData = queryClient.getQueriesData<{ pages: TimeEntriesPage[] }>({
        queryKey: ['timeEntries'],
      });

      // Optimistically update the cache
      queryClient.setQueriesData<{ pages: TimeEntriesPage[]; pageParams: unknown[] }>(
        { queryKey: ['timeEntries'] },
        old => {
          if (!old?.pages) return old;

          return {
            ...old,
            pages: old.pages.map(page => ({
              ...page,
              data: (page.data ?? []).map(entry =>
                entry.id === id
                  ? { ...entry, ...data, updated_at: new Date().toISOString() }
                  : entry
              ),
            })),
          };
        }
      );

      return { previousData };
    },
    onError: (error, _variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      const mutationError =
        error instanceof TimeEntryMutationError ? error : new TimeEntryMutationError(error.message);

      options?.onError?.(mutationError);
    },
    onSuccess: data => {
      // Invalidate to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });

      options?.onSuccess?.(data);
    },
  });
}

// ============================================================================
// DELETE TIME ENTRY
// ============================================================================

/**
 * Delete a time entry by ID
 *
 * @param id - UUID of the entry to delete
 * @returns Promise<void>
 * @throws TimeEntryMutationError if deletion fails
 */
async function deleteTimeEntry(id: string): Promise<void> {
  // If offline, queue the deletion
  if (!isDeviceOnline()) {
    await queueDeleteEntry(id);
    return;
  }

  // Soft delete: set deleted_at instead of hard delete
  const { error } = await supabase
    .from('time_entries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new TimeEntryMutationError(error.message, error.code, error.details);
  }
}

/**
 * Options for useDeleteTimeEntry hook
 */
export interface UseDeleteTimeEntryOptions {
  /**
   * Callback invoked on successful deletion
   */
  onSuccess?: (id: string) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: TimeEntryMutationError, id: string) => void;
}

/**
 * Hook to delete a time entry
 *
 * Uses optimistic updates to immediately remove the entry from the cache,
 * rolling back on error.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 *
 * @example
 * ```typescript
 * const deleteEntry = useDeleteTimeEntry({
 *   onSuccess: (id) => console.log('Deleted:', id),
 *   onError: (error) => console.error('Delete failed:', error.message),
 * });
 *
 * await deleteEntry.mutateAsync('entry-uuid');
 * ```
 */
export function useDeleteTimeEntry(options?: UseDeleteTimeEntryOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTimeEntry,
    onMutate: async id => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['timeEntries'] });

      // Snapshot previous values for rollback
      const previousData = queryClient.getQueriesData<{ pages: TimeEntriesPage[] }>({
        queryKey: ['timeEntries'],
      });

      // Optimistically remove from cache
      queryClient.setQueriesData<{ pages: TimeEntriesPage[]; pageParams: unknown[] }>(
        { queryKey: ['timeEntries'] },
        old => {
          if (!old?.pages) return old;

          return {
            ...old,
            pages: old.pages.map(page => ({
              ...page,
              data: page.data?.filter(entry => entry.id !== id) ?? [],
            })),
          };
        }
      );

      return { previousData, deletedId: id };
    },
    onError: (error, id, context) => {
      // Rollback optimistic update on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      const mutationError =
        error instanceof TimeEntryMutationError ? error : new TimeEntryMutationError(error.message);

      options?.onError?.(mutationError, id);
    },
    onSuccess: (_data, id) => {
      // Invalidate to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });

      options?.onSuccess?.(id);
    },
  });
}

// ============================================================================
// PERMANENTLY DELETE TIME ENTRY
// ============================================================================

async function permanentlyDeleteTimeEntry(id: string): Promise<void> {
  const { error } = await supabase.from('time_entries').delete().eq('id', id);

  if (error) {
    throw new TimeEntryMutationError(error.message, error.code, error.details);
  }
}

export function usePermanentlyDeleteTimeEntry(options?: UseDeleteTimeEntryOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: permanentlyDeleteTimeEntry,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      options?.onSuccess?.(id);
    },
    onError: (error: Error, id) => {
      const mutationError =
        error instanceof TimeEntryMutationError ? error : new TimeEntryMutationError(error.message);
      options?.onError?.(mutationError, id);
    },
  });
}

// ============================================================================
// RESTORE TIME ENTRY
// ============================================================================

async function restoreTimeEntry(id: string): Promise<void> {
  const { error } = await supabase.from('time_entries').update({ deleted_at: null }).eq('id', id);

  if (error) {
    throw new TimeEntryMutationError(error.message, error.code, error.details);
  }
}

export interface UseRestoreTimeEntryOptions {
  onSuccess?: (id: string) => void;
  onError?: (error: TimeEntryMutationError, id: string) => void;
}

export function useRestoreTimeEntry(options?: UseRestoreTimeEntryOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restoreTimeEntry,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      options?.onSuccess?.(id);
    },
    onError: (error: Error, id) => {
      const mutationError =
        error instanceof TimeEntryMutationError ? error : new TimeEntryMutationError(error.message);
      options?.onError?.(mutationError, id);
    },
  });
}

// ============================================================================
// DUPLICATE TIME ENTRY
// ============================================================================

async function duplicateTimeEntry(id: string): Promise<TimeEntry> {
  const { data: original, error: fetchError } = await supabase
    .from('time_entries')
    .select()
    .eq('id', id)
    .single();

  if (fetchError || !original) {
    throw new TimeEntryMutationError('Failed to fetch entry for duplication', fetchError?.code);
  }

  const now = new Date();
  const durationMs = original.duration_seconds * 1000;
  const newEndAt = now.toISOString();
  const newStartAt = new Date(now.getTime() - durationMs).toISOString();

  const { data: created, error: createError } = await supabase
    .from('time_entries')
    .insert({
      category_id: original.category_id,
      start_at: newStartAt,
      end_at: newEndAt,
      duration_seconds: original.duration_seconds,
      notes: original.notes,
      entry_type: original.entry_type,
      is_billable: original.is_billable,
      billing_rate: original.billing_rate,
      project_id: original.project_id,
    })
    .select()
    .single();

  if (createError || !created) {
    throw new TimeEntryMutationError('Failed to create duplicate entry', createError?.code);
  }

  return created as TimeEntry;
}

export interface UseDuplicateTimeEntryOptions {
  onSuccess?: (entry: TimeEntry) => void;
  onError?: (error: TimeEntryMutationError) => void;
}

export function useDuplicateTimeEntry(options?: UseDuplicateTimeEntryOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: duplicateTimeEntry,
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      const mutationError =
        error instanceof TimeEntryMutationError ? error : new TimeEntryMutationError(error.message);
      options?.onError?.(mutationError);
    },
  });
}

// ============================================================================
// BULK UPDATE ENTRIES
// ============================================================================

/**
 * Parameters for bulk updating time entries
 */
export interface BulkUpdateParams {
  ids: string[];
  data: UpdateTimeEntryInput;
}

/**
 * Bulk update multiple time entries
 */
async function bulkUpdateEntries({ ids, data }: BulkUpdateParams): Promise<TimeEntry[]> {
  const results: TimeEntry[] = [];
  for (const id of ids) {
    const result = await updateTimeEntry({ id, data });
    results.push(result);
  }
  return results;
}

/**
 * Hook to bulk update time entries
 */
export function useBulkUpdateEntries(options?: {
  onSuccess?: (entries: TimeEntry[]) => void;
  onError?: (error: TimeEntryMutationError) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkUpdateEntries,
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      const mutationError =
        error instanceof TimeEntryMutationError ? error : new TimeEntryMutationError(error.message);
      options?.onError?.(mutationError);
    },
  });
}

// ============================================================================
// BULK DELETE ENTRIES (SOFT DELETE)
// ============================================================================

/**
 * Soft delete multiple time entries by setting deleted_at
 */
async function bulkSoftDeleteEntries(ids: string[]): Promise<void> {
  if (!isDeviceOnline()) {
    for (const id of ids) {
      await queueDeleteEntry(id);
    }
    return;
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from('time_entries').update({ deleted_at: now }).in('id', ids);

  if (error) {
    throw new TimeEntryMutationError(error.message, error.code, error.details);
  }
}

/**
 * Hook to bulk soft-delete time entries
 */
export function useBulkDeleteEntries(options?: {
  onSuccess?: (ids: string[]) => void;
  onError?: (error: TimeEntryMutationError) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkSoftDeleteEntries,
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['timeEntries'] });

      const previousData = queryClient.getQueriesData<{ pages: TimeEntriesPage[] }>({
        queryKey: ['timeEntries'],
      });

      queryClient.setQueriesData<{ pages: TimeEntriesPage[]; pageParams: unknown[] }>(
        { queryKey: ['timeEntries'] },
        old => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map(page => ({
              ...page,
              data: page.data?.filter(entry => !ids.includes(entry.id)) ?? [],
            })),
          };
        }
      );

      return { previousData };
    },
    onError: (error, _ids, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      const mutationError =
        error instanceof TimeEntryMutationError ? error : new TimeEntryMutationError(error.message);
      options?.onError?.(mutationError);
    },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      options?.onSuccess?.(ids);
    },
  });
}

// ============================================================================
// SPLIT TIME ENTRY
// ============================================================================

/**
 * Parameters for splitting a time entry
 */
export interface SplitTimeEntryParams {
  id: string;
  splitAtSeconds: number;
}

/**
 * Split a time entry into two entries at the given point
 */
async function splitTimeEntry({
  id,
  splitAtSeconds,
}: SplitTimeEntryParams): Promise<[TimeEntry, TimeEntry]> {
  // Fetch the original entry
  const { data: original, error: fetchError } = await supabase
    .from('time_entries')
    .select()
    .eq('id', id)
    .single();

  if (fetchError || !original) {
    throw new TimeEntryMutationError('Failed to fetch entry for split', fetchError?.code);
  }

  const originalDuration = original.duration_seconds;
  if (splitAtSeconds <= 0 || splitAtSeconds >= originalDuration) {
    throw new TimeEntryMutationError('Split point must be between 0 and the entry duration');
  }

  const startDate = new Date(original.start_at);
  const splitDate = new Date(startDate.getTime() + splitAtSeconds * 1000);

  // Update original to end at split point
  const { data: updated, error: updateError } = await supabase
    .from('time_entries')
    .update({
      end_at: splitDate.toISOString(),
      duration_seconds: splitAtSeconds,
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError || !updated) {
    throw new TimeEntryMutationError(
      'Failed to update original entry during split',
      updateError?.code
    );
  }

  // Create new entry from split point to original end
  const { data: created, error: createError } = await supabase
    .from('time_entries')
    .insert({
      category_id: original.category_id,
      start_at: splitDate.toISOString(),
      end_at: original.end_at,
      duration_seconds: originalDuration - splitAtSeconds,
      notes: original.notes,
      billing_rate: original.billing_rate,
    })
    .select()
    .single();

  if (createError || !created) {
    throw new TimeEntryMutationError('Failed to create new entry during split', createError?.code);
  }

  return [updated as TimeEntry, created as TimeEntry];
}

/**
 * Hook to split a time entry
 */
export function useSplitTimeEntry(options?: {
  onSuccess?: (entries: [TimeEntry, TimeEntry]) => void;
  onError?: (error: TimeEntryMutationError) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: splitTimeEntry,
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      const mutationError =
        error instanceof TimeEntryMutationError ? error : new TimeEntryMutationError(error.message);
      options?.onError?.(mutationError);
    },
  });
}

// ============================================================================
// MERGE TIME ENTRIES
// ============================================================================

/**
 * Merge multiple time entries into one
 */
async function mergeTimeEntries(ids: string[]): Promise<TimeEntry> {
  if (ids.length < 2) {
    throw new TimeEntryMutationError('Must select at least 2 entries to merge');
  }

  // Fetch all entries
  const { data: entries, error: fetchError } = await supabase
    .from('time_entries')
    .select()
    .in('id', ids)
    .order('start_at', { ascending: true });

  if (fetchError || !entries || entries.length < 2) {
    throw new TimeEntryMutationError('Failed to fetch entries for merge', fetchError?.code);
  }

  // Calculate merged values
  const earliestStart = entries[0].start_at;
  const latestEnd = entries.reduce(
    (latest, e) => {
      if (!e.end_at) return latest;
      if (!latest) return e.end_at;
      return new Date(e.end_at) > new Date(latest) ? e.end_at : latest;
    },
    entries[0].end_at as string | null
  );
  const totalDuration = entries.reduce((sum, e) => sum + e.duration_seconds, 0);
  const categoryId = entries[0].category_id;
  const projectId = entries[0].project_id;
  const notes = entries
    .map(e => e.notes)
    .filter(Boolean)
    .join('\n');

  // Create merged entry
  const { data: merged, error: createError } = await supabase
    .from('time_entries')
    .insert({
      category_id: categoryId,
      start_at: earliestStart,
      end_at: latestEnd,
      duration_seconds: totalDuration,
      notes: notes || null,
      billing_rate: entries[0].billing_rate,
      project_id: projectId,
    })
    .select()
    .single();

  if (createError || !merged) {
    throw new TimeEntryMutationError('Failed to create merged entry', createError?.code);
  }

  // Soft-delete originals
  const now = new Date().toISOString();
  const { error: deleteError } = await supabase
    .from('time_entries')
    .update({ deleted_at: now })
    .in('id', ids);

  if (deleteError) {
    throw new TimeEntryMutationError('Failed to soft-delete original entries', deleteError?.code);
  }

  return merged as TimeEntry;
}

/**
 * Hook to merge time entries
 */
export function useMergeTimeEntries(options?: {
  onSuccess?: (entry: TimeEntry) => void;
  onError?: (error: TimeEntryMutationError) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mergeTimeEntries,
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      const mutationError =
        error instanceof TimeEntryMutationError ? error : new TimeEntryMutationError(error.message);
      options?.onError?.(mutationError);
    },
  });
}

/**
 * Type exports for hook return values
 */
export type UseCreateTimeEntryResult = ReturnType<typeof useCreateTimeEntry>;
export type UseUpdateTimeEntryResult = ReturnType<typeof useUpdateTimeEntry>;
export type UseDeleteTimeEntryResult = ReturnType<typeof useDeleteTimeEntry>;
export type UsePermanentlyDeleteTimeEntryResult = ReturnType<typeof usePermanentlyDeleteTimeEntry>;
export type UseRestoreTimeEntryResult = ReturnType<typeof useRestoreTimeEntry>;
export type UseDuplicateTimeEntryResult = ReturnType<typeof useDuplicateTimeEntry>;
export type UseBulkUpdateEntriesResult = ReturnType<typeof useBulkUpdateEntries>;
export type UseBulkDeleteEntriesResult = ReturnType<typeof useBulkDeleteEntries>;
export type UseSplitTimeEntryResult = ReturnType<typeof useSplitTimeEntry>;
export type UseMergeTimeEntriesResult = ReturnType<typeof useMergeTimeEntries>;
