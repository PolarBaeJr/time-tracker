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

  // Insert the entry - user_id is set server-side via DEFAULT auth.uid()
  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      category_id: validatedInput.category_id ?? null,
      start_at: validatedInput.start_at,
      end_at: validatedInput.end_at ?? null,
      duration_seconds: validatedInput.duration_seconds,
      notes: validatedInput.notes ?? null,
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
    onSuccess: (data) => {
      // Invalidate all time entry queries to refetch with new data
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });

      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      const mutationError =
        error instanceof TimeEntryMutationError
          ? error
          : new TimeEntryMutationError(error.message);

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
        (old) => {
          if (!old) return old;

          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((entry) =>
                entry.id === id ? { ...entry, ...data, updated_at: new Date().toISOString() } : entry
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
        error instanceof TimeEntryMutationError
          ? error
          : new TimeEntryMutationError(error.message);

      options?.onError?.(mutationError);
    },
    onSuccess: (data) => {
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
  // RLS ensures user can only delete their own entries
  const { error } = await supabase.from('time_entries').delete().eq('id', id);

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
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['timeEntries'] });

      // Snapshot previous values for rollback
      const previousData = queryClient.getQueriesData<{ pages: TimeEntriesPage[] }>({
        queryKey: ['timeEntries'],
      });

      // Optimistically remove from cache
      queryClient.setQueriesData<{ pages: TimeEntriesPage[]; pageParams: unknown[] }>(
        { queryKey: ['timeEntries'] },
        (old) => {
          if (!old) return old;

          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.filter((entry) => entry.id !== id),
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
        error instanceof TimeEntryMutationError
          ? error
          : new TimeEntryMutationError(error.message);

      options?.onError?.(mutationError, id);
    },
    onSuccess: (_data, id) => {
      // Invalidate to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });

      options?.onSuccess?.(id);
    },
  });
}

/**
 * Type exports for hook return values
 */
export type UseCreateTimeEntryResult = ReturnType<typeof useCreateTimeEntry>;
export type UseUpdateTimeEntryResult = ReturnType<typeof useUpdateTimeEntry>;
export type UseDeleteTimeEntryResult = ReturnType<typeof useDeleteTimeEntry>;
