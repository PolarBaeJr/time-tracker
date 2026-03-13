/**
 * Todos Query and Mutation Hooks
 *
 * This module provides TanStack Query hooks for fetching, creating, updating,
 * and deleting todo items with filtering and reordering support.
 *
 * USAGE:
 * ```typescript
 * import { useTodos, useCreateTodo, useToggleTodo } from '@/hooks/useTodos';
 *
 * function TodoList() {
 *   const { data: todos, isLoading } = useTodos();
 *   const createTodo = useCreateTodo();
 *   const toggleTodo = useToggleTodo();
 *
 *   const handleCreate = async () => {
 *     await createTodo.mutateAsync({ title: 'New task' });
 *   };
 *
 *   const handleToggle = async (id: string) => {
 *     await toggleTodo.mutateAsync(id);
 *   };
 *
 *   return <View>...</View>;
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only the authenticated user's todos are returned
 * - user_id is NOT included in mutations; it's enforced server-side via auth.uid()
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  TodoSchema,
  TodosFilterSchema,
  CreateTodoSchema,
  UpdateTodoSchema,
  ReorderTodosSchema,
  type Todo,
  type TodosFilter,
  type CreateTodoInput,
  type UpdateTodoInput,
  type ReorderTodosInput,
} from '@/schemas';

// ============================================================================
// ERROR CLASS
// ============================================================================

/**
 * Error thrown when todo operations fail
 */
export class TodoError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'TodoError';
  }
}

// ============================================================================
// FETCH FUNCTIONS
// ============================================================================

/**
 * Fetch all todos for the current user with optional filters
 *
 * @param filters - Optional filters to apply
 * @returns Promise<Todo[]> - Array of validated todos
 * @throws TodoError if the fetch fails
 */
export async function fetchTodos(filters?: TodosFilter): Promise<Todo[]> {
  // Validate filters if provided
  if (filters) {
    const validationResult = TodosFilterSchema.safeParse(filters);
    if (!validationResult.success) {
      throw new TodoError(`Invalid filters: ${validationResult.error.message}`, 'INVALID_FILTERS');
    }
  }

  // Build the query
  let query = supabase.from('todos').select('*').is('deleted_at', null);

  // Apply completion filter
  if (filters?.completed !== undefined) {
    query = query.eq('is_completed', filters.completed);
  }

  // Apply priority filter (array of priorities)
  if (filters?.priority && filters.priority.length > 0) {
    query = query.in('priority', filters.priority);
  }

  // Apply category filter
  if (filters?.categoryId !== undefined) {
    query = query.eq('category_id', filters.categoryId);
  }

  // Apply due date filters
  if (filters?.hasDueDate !== undefined) {
    if (filters.hasDueDate) {
      query = query.not('due_date', 'is', null);
    } else {
      query = query.is('due_date', null);
    }
  }

  if (filters?.dueBefore) {
    query = query.lte('due_date', filters.dueBefore);
  }

  if (filters?.dueAfter) {
    query = query.gte('due_date', filters.dueAfter);
  }

  // Apply search filter
  if (filters?.search) {
    query = query.ilike('title', `%${filters.search}%`);
  }

  // Apply sorting
  const sortColumn = filters?.sortBy ?? 'position';
  const ascending = (filters?.sortOrder ?? 'asc') === 'asc';
  query = query.order(sortColumn, { ascending });

  // Secondary sort by position for stable ordering
  if (sortColumn !== 'position') {
    query = query.order('position', { ascending: true });
  }

  const { data, error } = await query;

  if (error) {
    throw new TodoError(error.message, error.code);
  }

  if (!data) {
    return [];
  }

  // Validate each todo against the schema
  return data.map(todo => {
    const parsed = TodoSchema.safeParse(todo);
    if (!parsed.success) {
      console.warn('[useTodos] Invalid todo data:', todo, parsed.error);
      return todo as Todo;
    }
    return parsed.data;
  });
}

/**
 * Fetch a single todo by ID
 *
 * @param id - UUID of the todo
 * @returns Promise<Todo | null>
 * @throws TodoError if the fetch fails
 */
export async function fetchTodo(id: string): Promise<Todo | null> {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new TodoError(error.message, error.code);
  }

  if (!data) {
    return null;
  }

  const parsed = TodoSchema.safeParse(data);
  if (!parsed.success) {
    console.warn('[useTodos] Invalid todo data:', data, parsed.error);
    return data as Todo;
  }

  return parsed.data;
}

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Options for the useTodos hook
 */
export interface UseTodosOptions {
  /** Filters to apply to the query */
  filters?: TodosFilter;
  /** Whether the query should be enabled */
  enabled?: boolean;
  /** Override the default stale time */
  staleTime?: number;
}

/**
 * Hook to fetch all todos for the current user
 *
 * @param options - Configuration options including filters
 * @returns React Query result with todos data
 */
export function useTodos(options?: UseTodosOptions) {
  const { filters, enabled = true, staleTime } = options ?? {};

  return useQuery({
    queryKey: queryKeys.todos(filters as Record<string, unknown> | undefined),
    queryFn: () => fetchTodos(filters),
    enabled,
    staleTime,
  });
}

/**
 * Hook to fetch a single todo by ID
 *
 * @param id - UUID of the todo
 * @param options - Optional configuration
 * @returns React Query result with todo data
 */
export function useTodo(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.todo(id),
    queryFn: () => fetchTodo(id),
    enabled: options?.enabled ?? !!id,
  });
}

// ============================================================================
// MUTATION FUNCTIONS
// ============================================================================

/**
 * Create a new todo
 */
async function createTodo(input: CreateTodoInput): Promise<Todo> {
  // Validate input
  const validationResult = CreateTodoSchema.safeParse(input);
  if (!validationResult.success) {
    throw new TodoError(
      `Validation failed: ${validationResult.error.message}`,
      'VALIDATION_ERROR',
      validationResult.error.flatten()
    );
  }

  const validatedInput = validationResult.data;

  // Get max position to set new todo at the end
  const { data: maxPositionData } = await supabase
    .from('todos')
    .select('position')
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
    .single();

  const newPosition = validatedInput.position ?? (maxPositionData?.position ?? -1) + 1;

  // Insert the todo - user_id is set server-side via DEFAULT auth.uid()
  const { data, error } = await supabase
    .from('todos')
    .insert({
      title: validatedInput.title,
      content: validatedInput.content ?? null,
      category_id: validatedInput.category_id ?? null,
      time_entry_id: validatedInput.time_entry_id ?? null,
      is_completed: validatedInput.is_completed ?? false,
      due_date: validatedInput.due_date ?? null,
      priority: validatedInput.priority ?? 'medium',
      position: newPosition,
    })
    .select()
    .single();

  if (error) {
    throw new TodoError(error.message, error.code, error.details);
  }

  if (!data) {
    throw new TodoError('No data returned from insert', 'NO_DATA');
  }

  const parsed = TodoSchema.safeParse(data);
  if (!parsed.success) {
    console.warn('[useTodos] Invalid response data:', data, parsed.error);
    return data as Todo;
  }

  return parsed.data;
}

/**
 * Update an existing todo
 */
interface UpdateTodoParams {
  id: string;
  data: UpdateTodoInput;
}

async function updateTodo({ id, data }: UpdateTodoParams): Promise<Todo> {
  // Validate input
  const validationResult = UpdateTodoSchema.safeParse(data);
  if (!validationResult.success) {
    throw new TodoError(
      `Validation failed: ${validationResult.error.message}`,
      'VALIDATION_ERROR',
      validationResult.error.flatten()
    );
  }

  const validatedInput = validationResult.data;

  // Build update object with only defined fields
  const updateData: Record<string, unknown> = {};

  if (validatedInput.title !== undefined) updateData.title = validatedInput.title;
  if (validatedInput.content !== undefined) updateData.content = validatedInput.content;
  if (validatedInput.category_id !== undefined) updateData.category_id = validatedInput.category_id;
  if (validatedInput.time_entry_id !== undefined)
    updateData.time_entry_id = validatedInput.time_entry_id;
  if (validatedInput.is_completed !== undefined)
    updateData.is_completed = validatedInput.is_completed;
  if (validatedInput.completed_at !== undefined)
    updateData.completed_at = validatedInput.completed_at;
  if (validatedInput.due_date !== undefined) updateData.due_date = validatedInput.due_date;
  if (validatedInput.priority !== undefined) updateData.priority = validatedInput.priority;
  if (validatedInput.position !== undefined) updateData.position = validatedInput.position;

  const { data: result, error } = await supabase
    .from('todos')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new TodoError(error.message, error.code, error.details);
  }

  if (!result) {
    throw new TodoError('Todo not found or no permission', 'NOT_FOUND');
  }

  const parsed = TodoSchema.safeParse(result);
  if (!parsed.success) {
    console.warn('[useTodos] Invalid response data:', result, parsed.error);
    return result as Todo;
  }

  return parsed.data;
}

/**
 * Toggle todo completion status
 */
async function toggleTodo(id: string): Promise<Todo> {
  // Fetch current state
  const { data: current, error: fetchError } = await supabase
    .from('todos')
    .select('is_completed')
    .eq('id', id)
    .single();

  if (fetchError || !current) {
    throw new TodoError('Todo not found', fetchError?.code);
  }

  const newCompleted = !current.is_completed;
  const completedAt = newCompleted ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from('todos')
    .update({
      is_completed: newCompleted,
      completed_at: completedAt,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new TodoError(error.message, error.code, error.details);
  }

  const parsed = TodoSchema.safeParse(data);
  if (!parsed.success) {
    return data as Todo;
  }

  return parsed.data;
}

/**
 * Reorder todos by updating their positions
 */
async function reorderTodos(items: ReorderTodosInput): Promise<void> {
  // Validate input
  const validationResult = ReorderTodosSchema.safeParse(items);
  if (!validationResult.success) {
    throw new TodoError(`Validation failed: ${validationResult.error.message}`, 'VALIDATION_ERROR');
  }

  // Update each todo's position
  // Note: Supabase doesn't support transactions via JS client,
  // so we do sequential updates
  for (const item of items) {
    const { error } = await supabase
      .from('todos')
      .update({ position: item.position })
      .eq('id', item.id);

    if (error) {
      throw new TodoError(
        `Failed to update position for todo ${item.id}: ${error.message}`,
        error.code
      );
    }
  }
}

/**
 * Soft delete a todo
 */
async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase
    .from('todos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new TodoError(error.message, error.code, error.details);
  }
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

export interface UseCreateTodoOptions {
  onSuccess?: (todo: Todo) => void;
  onError?: (error: TodoError) => void;
}

/**
 * Hook to create a new todo
 */
export function useCreateTodo(options?: UseCreateTodoOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTodo,
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      const todoError = error instanceof TodoError ? error : new TodoError(error.message);
      options?.onError?.(todoError);
    },
  });
}

export interface UseUpdateTodoOptions {
  onSuccess?: (todo: Todo) => void;
  onError?: (error: TodoError) => void;
}

/**
 * Hook to update an existing todo
 */
export function useUpdateTodo(options?: UseUpdateTodoOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTodo,
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['todos'] });

      const previousData = queryClient.getQueriesData<Todo[]>({ queryKey: ['todos'] });

      // Optimistic update
      queryClient.setQueriesData<Todo[]>({ queryKey: ['todos'] }, old => {
        if (!old) return old;
        return old.map(todo =>
          todo.id === id ? { ...todo, ...data, updated_at: new Date().toISOString() } : todo
        );
      });

      return { previousData };
    },
    onError: (error, _variables, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      const todoError = error instanceof TodoError ? error : new TodoError(error.message);
      options?.onError?.(todoError);
    },
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.todo(data.id) });
      options?.onSuccess?.(data);
    },
  });
}

export interface UseToggleTodoOptions {
  onSuccess?: (todo: Todo) => void;
  onError?: (error: TodoError) => void;
}

/**
 * Hook to toggle a todo's completion status
 */
export function useToggleTodo(options?: UseToggleTodoOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleTodo,
    onMutate: async id => {
      await queryClient.cancelQueries({ queryKey: ['todos'] });

      const previousData = queryClient.getQueriesData<Todo[]>({ queryKey: ['todos'] });

      // Optimistic update
      queryClient.setQueriesData<Todo[]>({ queryKey: ['todos'] }, old => {
        if (!old) return old;
        return old.map(todo =>
          todo.id === id
            ? {
                ...todo,
                is_completed: !todo.is_completed,
                completed_at: !todo.is_completed ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
              }
            : todo
        );
      });

      return { previousData };
    },
    onError: (error, _id, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      const todoError = error instanceof TodoError ? error : new TodoError(error.message);
      options?.onError?.(todoError);
    },
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      options?.onSuccess?.(data);
    },
  });
}

export interface UseReorderTodosOptions {
  onSuccess?: () => void;
  onError?: (error: TodoError) => void;
}

/**
 * Hook to reorder todos by updating their positions
 */
export function useReorderTodos(options?: UseReorderTodosOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderTodos,
    onMutate: async items => {
      await queryClient.cancelQueries({ queryKey: ['todos'] });

      const previousData = queryClient.getQueriesData<Todo[]>({ queryKey: ['todos'] });

      // Optimistic update
      queryClient.setQueriesData<Todo[]>({ queryKey: ['todos'] }, old => {
        if (!old) return old;
        const positionMap = new Map(items.map(item => [item.id, item.position]));
        return old
          .map(todo => {
            const newPosition = positionMap.get(todo.id);
            return newPosition !== undefined ? { ...todo, position: newPosition } : todo;
          })
          .sort((a, b) => a.position - b.position);
      });

      return { previousData };
    },
    onError: (error, _items, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      const todoError = error instanceof TodoError ? error : new TodoError(error.message);
      options?.onError?.(todoError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      options?.onSuccess?.();
    },
  });
}

export interface UseDeleteTodoOptions {
  onSuccess?: (id: string) => void;
  onError?: (error: TodoError, id: string) => void;
}

/**
 * Hook to soft delete a todo
 */
export function useDeleteTodo(options?: UseDeleteTodoOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTodo,
    onMutate: async id => {
      await queryClient.cancelQueries({ queryKey: ['todos'] });

      const previousData = queryClient.getQueriesData<Todo[]>({ queryKey: ['todos'] });

      // Optimistic removal
      queryClient.setQueriesData<Todo[]>({ queryKey: ['todos'] }, old => {
        if (!old) return old;
        return old.filter(todo => todo.id !== id);
      });

      return { previousData, deletedId: id };
    },
    onError: (error, id, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      const todoError = error instanceof TodoError ? error : new TodoError(error.message);
      options?.onError?.(todoError, id);
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      options?.onSuccess?.(id);
    },
  });
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UseTodosResult = ReturnType<typeof useTodos>;
export type UseTodoResult = ReturnType<typeof useTodo>;
export type UseCreateTodoResult = ReturnType<typeof useCreateTodo>;
export type UseUpdateTodoResult = ReturnType<typeof useUpdateTodo>;
export type UseToggleTodoResult = ReturnType<typeof useToggleTodo>;
export type UseReorderTodosResult = ReturnType<typeof useReorderTodos>;
export type UseDeleteTodoResult = ReturnType<typeof useDeleteTodo>;
