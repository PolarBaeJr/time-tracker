/**
 * Category Mutation Hooks
 *
 * This module provides React Query mutation hooks for creating, updating,
 * and deleting categories with optimistic updates.
 *
 * IMPORTANT:
 * - Create mutations validate with CreateCategorySchema (name, color, type)
 * - Update mutations validate with UpdateCategorySchema (partial fields)
 * - NEVER use full CategorySchema for mutations - it includes server-managed fields
 *
 * USAGE:
 * ```typescript
 * import {
 *   useCreateCategory,
 *   useUpdateCategory,
 *   useDeleteCategory,
 * } from '@/hooks/useCategoryMutations';
 *
 * function CategoryForm() {
 *   const createMutation = useCreateCategory();
 *
 *   const handleSubmit = async (data: CreateCategoryInput) => {
 *     try {
 *       await createMutation.mutateAsync(data);
 *       // Success - category created
 *     } catch (error) {
 *       // Handle error
 *     }
 *   };
 * }
 * ```
 *
 * SECURITY:
 * - user_id is set by the database via DEFAULT auth.uid()
 * - RLS policies ensure users can only modify their own categories
 * - Schema validation prevents injection of server-managed fields
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  type Category,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@/schemas';

/**
 * Error thrown when a category mutation fails
 */
export class CategoryMutationError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly operation?: 'create' | 'update' | 'delete'
  ) {
    super(message);
    this.name = 'CategoryMutationError';
  }
}

/**
 * Context type for optimistic updates
 * Used in onError to rollback on failure
 */
interface MutationContext {
  previousCategories?: Category[];
}

// ============================================================================
// CREATE CATEGORY MUTATION
// ============================================================================

/**
 * Create a new category
 *
 * @param input - Validated category creation input (name, color, type)
 * @returns Created category with server-generated fields
 * @throws CategoryMutationError if creation fails
 */
async function createCategory(input: CreateCategoryInput): Promise<Category> {
  // Validate input with CreateCategorySchema
  // This ensures we only send allowed fields (name, color, type)
  const validatedInput = CreateCategorySchema.parse(input);

  const { data, error } = await supabase
    .from('categories')
    .insert(validatedInput)
    .select()
    .single();

  if (error) {
    throw new CategoryMutationError(error.message, error.code, 'create');
  }

  if (!data) {
    throw new CategoryMutationError('No data returned from create', undefined, 'create');
  }

  return data as Category;
}

/**
 * Hook to create a new category with optimistic updates
 *
 * @returns React Query mutation for creating categories
 *
 * @example
 * ```typescript
 * const { mutate, mutateAsync, isPending, isError, error } = useCreateCategory();
 *
 * // Fire-and-forget
 * mutate({ name: 'Work', color: '#6366F1', type: 'work' });
 *
 * // Await result
 * const category = await mutateAsync({ name: 'Work', color: '#6366F1', type: 'work' });
 * ```
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation<Category, CategoryMutationError, CreateCategoryInput, MutationContext>({
    mutationFn: createCategory,

    // Optimistic update: add placeholder to cache immediately
    onMutate: async (newCategory) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: queryKeys.categories });

      // Snapshot the previous value for rollback
      const previousCategories = queryClient.getQueryData<Category[]>(queryKeys.categories);

      // Optimistically add the new category with a temporary ID
      if (previousCategories) {
        const optimisticCategory: Category = {
          id: `temp-${Date.now()}`,
          user_id: 'pending', // Will be replaced with actual value
          name: newCategory.name,
          color: newCategory.color,
          type: newCategory.type,
          created_at: new Date().toISOString(),
        };

        // Insert and maintain sort order by name
        const updated = [...previousCategories, optimisticCategory].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        queryClient.setQueryData(queryKeys.categories, updated);
      }

      return { previousCategories };
    },

    // Rollback on error
    onError: (_error, _newCategory, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(queryKeys.categories, context.previousCategories);
      }
    },

    // Always refetch after success or error to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
  });
}

// ============================================================================
// UPDATE CATEGORY MUTATION
// ============================================================================

/**
 * Update category input with required ID
 */
interface UpdateCategoryVariables {
  id: string;
  data: UpdateCategoryInput;
}

/**
 * Update an existing category
 *
 * @param variables - Category ID and update data
 * @returns Updated category
 * @throws CategoryMutationError if update fails
 */
async function updateCategory({ id, data }: UpdateCategoryVariables): Promise<Category> {
  // Validate input with UpdateCategorySchema
  // This ensures we only send allowed fields (name?, color?, type?)
  const validatedInput = UpdateCategorySchema.parse(data);

  // Skip if no fields to update
  if (Object.keys(validatedInput).length === 0) {
    // Fetch and return current category
    const { data: current, error: fetchError } = await supabase
      .from('categories')
      .select()
      .eq('id', id)
      .single();

    if (fetchError) {
      throw new CategoryMutationError(fetchError.message, fetchError.code, 'update');
    }

    return current as Category;
  }

  const { data: updated, error } = await supabase
    .from('categories')
    .update(validatedInput)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new CategoryMutationError(error.message, error.code, 'update');
  }

  if (!updated) {
    throw new CategoryMutationError('No data returned from update', undefined, 'update');
  }

  return updated as Category;
}

/**
 * Hook to update an existing category with optimistic updates
 *
 * @returns React Query mutation for updating categories
 *
 * @example
 * ```typescript
 * const { mutate, mutateAsync, isPending } = useUpdateCategory();
 *
 * // Update name only
 * mutate({ id: 'category-uuid', data: { name: 'New Name' } });
 *
 * // Update multiple fields
 * mutateAsync({ id: 'category-uuid', data: { name: 'Work', color: '#FF0000' } });
 * ```
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation<Category, CategoryMutationError, UpdateCategoryVariables, MutationContext>({
    mutationFn: updateCategory,

    // Optimistic update: modify cache immediately
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categories });

      const previousCategories = queryClient.getQueryData<Category[]>(queryKeys.categories);

      if (previousCategories) {
        const updated = previousCategories.map((cat) =>
          cat.id === id ? { ...cat, ...data } : cat
        );

        // Re-sort if name changed
        if (data.name) {
          updated.sort((a, b) => a.name.localeCompare(b.name));
        }

        queryClient.setQueryData(queryKeys.categories, updated);
      }

      return { previousCategories };
    },

    onError: (_error, _variables, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(queryKeys.categories, context.previousCategories);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
  });
}

// ============================================================================
// DELETE CATEGORY MUTATION
// ============================================================================

/**
 * Delete an existing category
 *
 * @param id - Category UUID to delete
 * @returns void
 * @throws CategoryMutationError if deletion fails
 *
 * NOTE: When a category is deleted, associated time_entries have their
 * category_id set to NULL (ON DELETE SET NULL). Entries are never lost.
 */
async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);

  if (error) {
    throw new CategoryMutationError(error.message, error.code, 'delete');
  }
}

/**
 * Hook to delete a category with optimistic updates
 *
 * @returns React Query mutation for deleting categories
 *
 * @example
 * ```typescript
 * const { mutate, isPending } = useDeleteCategory();
 *
 * // Confirm and delete
 * const handleDelete = (id: string) => {
 *   if (confirm('Delete this category?')) {
 *     mutate(id);
 *   }
 * };
 * ```
 *
 * WARNING: Deleting a category will set category_id to NULL for all
 * associated time entries. The entries are preserved but become uncategorized.
 */
export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation<void, CategoryMutationError, string, MutationContext>({
    mutationFn: deleteCategory,

    // Optimistic update: remove from cache immediately
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categories });

      const previousCategories = queryClient.getQueryData<Category[]>(queryKeys.categories);

      if (previousCategories) {
        const updated = previousCategories.filter((cat) => cat.id !== id);
        queryClient.setQueryData(queryKeys.categories, updated);
      }

      return { previousCategories };
    },

    onError: (_error, _id, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(queryKeys.categories, context.previousCategories);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
  });
}

/**
 * Type exports for hook return values
 */
export type UseCreateCategoryResult = ReturnType<typeof useCreateCategory>;
export type UseUpdateCategoryResult = ReturnType<typeof useUpdateCategory>;
export type UseDeleteCategoryResult = ReturnType<typeof useDeleteCategory>;
