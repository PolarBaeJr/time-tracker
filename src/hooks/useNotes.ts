/**
 * Notes Query and Mutation Hooks
 *
 * This module provides TanStack Query hooks for fetching, creating, updating,
 * and deleting notes with optimistic updates.
 *
 * USAGE:
 * ```typescript
 * import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '@/hooks/useNotes';
 *
 * function NotesList() {
 *   const { data: notes, isLoading } = useNotes();
 *   const createNote = useCreateNote();
 *   const updateNote = useUpdateNote();
 *   const deleteNote = useDeleteNote();
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return notes?.map(note => <NoteCard key={note.id} note={note} />);
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only the authenticated user's notes are returned
 * - user_id is NOT included in queries; it's enforced server-side via auth.uid()
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  NoteSchema,
  CreateNoteSchema,
  UpdateNoteSchema,
  NotesFilterSchema,
  type Note,
  type CreateNoteInput,
  type UpdateNoteInput,
  type NotesFilter,
} from '@/schemas';

// ============================================================================
// ERROR CLASS
// ============================================================================

/**
 * Error thrown when note operations fail
 */
export class NoteFetchError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'NoteFetchError';
  }
}

// ============================================================================
// FETCH NOTES
// ============================================================================

/**
 * Fetch all notes for the current user with optional filtering
 *
 * @param filters - Optional filters for the query
 * @returns Promise<Note[]> - Array of validated notes
 * @throws NoteFetchError if the fetch fails
 */
export async function fetchNotes(filters?: NotesFilter): Promise<Note[]> {
  // Validate filters if provided
  if (filters) {
    const validationResult = NotesFilterSchema.safeParse(filters);
    if (!validationResult.success) {
      throw new NoteFetchError(
        `Invalid filters: ${validationResult.error.message}`,
        'INVALID_FILTERS'
      );
    }
  }

  // Build the query
  let query = supabase.from('notes').select('*').is('deleted_at', null);

  // Apply search filter (search in title and content)
  if (filters?.search) {
    const searchPattern = `%${filters.search}%`;
    query = query.or(`title.ilike.${searchPattern},content.ilike.${searchPattern}`);
  }

  // Apply category filter
  if (filters?.categoryId) {
    query = query.eq('category_id', filters.categoryId);
  }

  // Apply pinned filter
  if (filters?.pinnedOnly) {
    query = query.eq('pinned', true);
  }

  // Apply sorting - pinned notes first, then by sortBy
  const sortColumn = filters?.sortBy ?? 'created_at';
  const sortAscending = (filters?.sortOrder ?? 'desc') === 'asc';

  // Always sort pinned DESC first, then by the specified sort
  query = query
    .order('pinned', { ascending: false })
    .order(sortColumn, { ascending: sortAscending });

  const { data, error } = await query;

  if (error) {
    throw new NoteFetchError(error.message, error.code);
  }

  if (!data) {
    return [];
  }

  // Validate each note against the schema
  return data.map(note => {
    const parsed = NoteSchema.safeParse(note);
    if (!parsed.success) {
      console.warn('[useNotes] Invalid note data:', note, parsed.error);
      return note as Note;
    }
    return parsed.data;
  });
}

/**
 * Fetch a single note by ID
 *
 * @param id - UUID of the note to fetch
 * @returns Promise<Note> - The validated note
 * @throws NoteFetchError if the fetch fails
 */
export async function fetchNote(id: string): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    throw new NoteFetchError(error.message, error.code);
  }

  if (!data) {
    throw new NoteFetchError('Note not found', 'NOT_FOUND');
  }

  const parsed = NoteSchema.safeParse(data);
  if (!parsed.success) {
    console.warn('[useNotes] Invalid note data:', data, parsed.error);
    return data as Note;
  }

  return parsed.data;
}

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Options for the useNotes hook
 */
export interface UseNotesOptions {
  /**
   * Filters to apply to the query
   */
  filters?: NotesFilter;

  /**
   * Whether the query should be enabled
   */
  enabled?: boolean;

  /**
   * Override the default stale time
   */
  staleTime?: number;
}

/**
 * Hook to fetch all notes for the current user
 *
 * @param options - Optional configuration including filters
 * @returns React Query result with notes data
 *
 * @example
 * ```typescript
 * const { data: notes, isLoading } = useNotes();
 *
 * // With filters
 * const { data } = useNotes({
 *   filters: { search: 'meeting', pinnedOnly: true },
 * });
 * ```
 */
export function useNotes(options?: UseNotesOptions) {
  const { filters, enabled = true, staleTime } = options ?? {};

  return useQuery({
    queryKey: queryKeys.notes(filters as Record<string, unknown> | undefined),
    queryFn: () => fetchNotes(filters),
    enabled,
    staleTime,
  });
}

/**
 * Options for the useNote hook
 */
export interface UseNoteOptions {
  /**
   * Whether the query should be enabled
   */
  enabled?: boolean;

  /**
   * Override the default stale time
   */
  staleTime?: number;
}

/**
 * Hook to fetch a single note by ID
 *
 * @param id - UUID of the note to fetch
 * @param options - Optional configuration
 * @returns React Query result with note data
 */
export function useNote(id: string, options?: UseNoteOptions) {
  const { enabled = true, staleTime } = options ?? {};

  return useQuery({
    queryKey: queryKeys.note(id),
    queryFn: () => fetchNote(id),
    enabled: enabled && !!id,
    staleTime,
  });
}

// ============================================================================
// CREATE NOTE
// ============================================================================

/**
 * Create a new note
 *
 * @param input - Note data validated against CreateNoteSchema
 * @returns Promise<Note> - The created note
 * @throws NoteFetchError if validation or creation fails
 */
async function createNote(input: CreateNoteInput): Promise<Note> {
  // Validate input
  const validationResult = CreateNoteSchema.safeParse(input);
  if (!validationResult.success) {
    throw new NoteFetchError(
      `Validation failed: ${validationResult.error.message}`,
      'VALIDATION_ERROR',
      validationResult.error.flatten()
    );
  }

  const validatedInput = validationResult.data;

  // Insert the note - user_id is set server-side via DEFAULT auth.uid()
  const { data, error } = await supabase
    .from('notes')
    .insert({
      title: validatedInput.title,
      content: validatedInput.content ?? null,
      category_id: validatedInput.category_id ?? null,
      time_entry_id: validatedInput.time_entry_id ?? null,
      pinned: validatedInput.pinned ?? false,
    })
    .select()
    .single();

  if (error) {
    throw new NoteFetchError(error.message, error.code, error.details);
  }

  if (!data) {
    throw new NoteFetchError('No data returned from insert', 'NO_DATA');
  }

  const parsed = NoteSchema.safeParse(data);
  if (!parsed.success) {
    console.warn('[useNotes] Invalid response data:', data, parsed.error);
    return data as Note;
  }

  return parsed.data;
}

/**
 * Options for useCreateNote hook
 */
export interface UseCreateNoteOptions {
  /**
   * Callback invoked on successful creation
   */
  onSuccess?: (note: Note) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: NoteFetchError) => void;
}

/**
 * Hook to create a new note
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useCreateNote(options?: UseCreateNoteOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createNote,
    onSuccess: data => {
      // Invalidate all notes queries to refetch with new data
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      const fetchError =
        error instanceof NoteFetchError ? error : new NoteFetchError(error.message);
      options?.onError?.(fetchError);
    },
  });
}

// ============================================================================
// UPDATE NOTE
// ============================================================================

/**
 * Parameters for updating a note
 */
export interface UpdateNoteParams {
  id: string;
  data: UpdateNoteInput;
}

/**
 * Update an existing note
 *
 * @param params - Note ID and update data
 * @returns Promise<Note> - The updated note
 * @throws NoteFetchError if validation or update fails
 */
async function updateNote({ id, data }: UpdateNoteParams): Promise<Note> {
  // Validate input
  const validationResult = UpdateNoteSchema.safeParse(data);
  if (!validationResult.success) {
    throw new NoteFetchError(
      `Validation failed: ${validationResult.error.message}`,
      'VALIDATION_ERROR',
      validationResult.error.flatten()
    );
  }

  const validatedInput = validationResult.data;

  // Build the update object, only including defined fields
  const updateData: Record<string, unknown> = {};

  if (validatedInput.title !== undefined) {
    updateData.title = validatedInput.title;
  }
  if (validatedInput.content !== undefined) {
    updateData.content = validatedInput.content;
  }
  if (validatedInput.category_id !== undefined) {
    updateData.category_id = validatedInput.category_id;
  }
  if (validatedInput.time_entry_id !== undefined) {
    updateData.time_entry_id = validatedInput.time_entry_id;
  }
  if (validatedInput.pinned !== undefined) {
    updateData.pinned = validatedInput.pinned;
  }

  // RLS ensures user can only update their own notes
  const { data: result, error } = await supabase
    .from('notes')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new NoteFetchError(error.message, error.code, error.details);
  }

  if (!result) {
    throw new NoteFetchError('Note not found or no permission', 'NOT_FOUND');
  }

  const parsed = NoteSchema.safeParse(result);
  if (!parsed.success) {
    console.warn('[useNotes] Invalid response data:', result, parsed.error);
    return result as Note;
  }

  return parsed.data;
}

/**
 * Options for useUpdateNote hook
 */
export interface UseUpdateNoteOptions {
  /**
   * Callback invoked on successful update
   */
  onSuccess?: (note: Note) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: NoteFetchError) => void;
}

/**
 * Hook to update an existing note
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useUpdateNote(options?: UseUpdateNoteOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateNote,
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notes'] });

      // Snapshot previous values for rollback
      const previousNotes = queryClient.getQueriesData<Note[]>({ queryKey: ['notes'] });
      const previousNote = queryClient.getQueryData<Note>(queryKeys.note(id));

      // Optimistically update the cache
      queryClient.setQueriesData<Note[]>({ queryKey: ['notes'] }, old => {
        if (!old) return old;
        return old.map(note =>
          note.id === id ? { ...note, ...data, updated_at: new Date().toISOString() } : note
        );
      });

      if (previousNote) {
        queryClient.setQueryData<Note>(queryKeys.note(id), {
          ...previousNote,
          ...data,
          updated_at: new Date().toISOString(),
        });
      }

      return { previousNotes, previousNote };
    },
    onError: (error, { id }, context) => {
      // Rollback optimistic update on error
      if (context?.previousNotes) {
        context.previousNotes.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousNote) {
        queryClient.setQueryData(queryKeys.note(id), context.previousNote);
      }

      const fetchError =
        error instanceof NoteFetchError ? error : new NoteFetchError(error.message);
      options?.onError?.(fetchError);
    },
    onSuccess: data => {
      // Invalidate to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      options?.onSuccess?.(data);
    },
  });
}

// ============================================================================
// DELETE NOTE (SOFT DELETE)
// ============================================================================

/**
 * Soft delete a note by setting deleted_at
 *
 * @param id - UUID of the note to delete
 * @returns Promise<void>
 * @throws NoteFetchError if deletion fails
 */
async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new NoteFetchError(error.message, error.code, error.details);
  }
}

/**
 * Options for useDeleteNote hook
 */
export interface UseDeleteNoteOptions {
  /**
   * Callback invoked on successful deletion
   */
  onSuccess?: (id: string) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: NoteFetchError, id: string) => void;
}

/**
 * Hook to soft delete a note
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useDeleteNote(options?: UseDeleteNoteOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteNote,
    onMutate: async id => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['notes'] });

      // Snapshot previous values for rollback
      const previousNotes = queryClient.getQueriesData<Note[]>({ queryKey: ['notes'] });

      // Optimistically remove from cache
      queryClient.setQueriesData<Note[]>({ queryKey: ['notes'] }, old => {
        if (!old) return old;
        return old.filter(note => note.id !== id);
      });

      return { previousNotes, deletedId: id };
    },
    onError: (error, id, context) => {
      // Rollback optimistic update on error
      if (context?.previousNotes) {
        context.previousNotes.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      const fetchError =
        error instanceof NoteFetchError ? error : new NoteFetchError(error.message);
      options?.onError?.(fetchError, id);
    },
    onSuccess: (_data, id) => {
      // Invalidate to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      // Remove single note from cache
      queryClient.removeQueries({ queryKey: queryKeys.note(id) });
      options?.onSuccess?.(id);
    },
  });
}

// ============================================================================
// PIN NOTE
// ============================================================================

/**
 * Parameters for toggling note pinned state
 */
export interface PinNoteParams {
  id: string;
  pinned: boolean;
}

/**
 * Toggle the pinned state of a note
 *
 * @param params - Note ID and new pinned state
 * @returns Promise<Note> - The updated note
 */
async function pinNote({ id, pinned }: PinNoteParams): Promise<Note> {
  return updateNote({ id, data: { pinned } });
}

/**
 * Options for usePinNote hook
 */
export interface UsePinNoteOptions {
  /**
   * Callback invoked on successful pin/unpin
   */
  onSuccess?: (note: Note) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: NoteFetchError) => void;
}

/**
 * Hook to toggle the pinned state of a note
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function usePinNote(options?: UsePinNoteOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: pinNote,
    onMutate: async ({ id, pinned }) => {
      await queryClient.cancelQueries({ queryKey: ['notes'] });

      const previousNotes = queryClient.getQueriesData<Note[]>({ queryKey: ['notes'] });

      queryClient.setQueriesData<Note[]>({ queryKey: ['notes'] }, old => {
        if (!old) return old;
        return old.map(note =>
          note.id === id ? { ...note, pinned, updated_at: new Date().toISOString() } : note
        );
      });

      return { previousNotes };
    },
    onError: (error, _params, context) => {
      if (context?.previousNotes) {
        context.previousNotes.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      const fetchError =
        error instanceof NoteFetchError ? error : new NoteFetchError(error.message);
      options?.onError?.(fetchError);
    },
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      options?.onSuccess?.(data);
    },
  });
}

// ============================================================================
// RESTORE NOTE
// ============================================================================

/**
 * Restore a soft-deleted note by setting deleted_at to null
 *
 * @param id - UUID of the note to restore
 * @returns Promise<Note> - The restored note
 */
async function restoreNote(id: string): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .update({ deleted_at: null })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new NoteFetchError(error.message, error.code, error.details);
  }

  if (!data) {
    throw new NoteFetchError('Note not found', 'NOT_FOUND');
  }

  const parsed = NoteSchema.safeParse(data);
  if (!parsed.success) {
    console.warn('[useNotes] Invalid response data:', data, parsed.error);
    return data as Note;
  }

  return parsed.data;
}

/**
 * Options for useRestoreNote hook
 */
export interface UseRestoreNoteOptions {
  /**
   * Callback invoked on successful restore
   */
  onSuccess?: (note: Note) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: NoteFetchError, id: string) => void;
}

/**
 * Hook to restore a soft-deleted note
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useRestoreNote(options?: UseRestoreNoteOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restoreNote,
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      options?.onSuccess?.(data);
    },
    onError: (error: Error, id) => {
      const fetchError =
        error instanceof NoteFetchError ? error : new NoteFetchError(error.message);
      options?.onError?.(fetchError, id);
    },
  });
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UseNotesResult = ReturnType<typeof useNotes>;
export type UseNoteResult = ReturnType<typeof useNote>;
export type UseCreateNoteResult = ReturnType<typeof useCreateNote>;
export type UseUpdateNoteResult = ReturnType<typeof useUpdateNote>;
export type UseDeleteNoteResult = ReturnType<typeof useDeleteNote>;
export type UsePinNoteResult = ReturnType<typeof usePinNote>;
export type UseRestoreNoteResult = ReturnType<typeof useRestoreNote>;
