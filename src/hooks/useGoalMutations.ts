/**
 * Goal Mutation Hooks
 *
 * This module provides TanStack Query mutation hooks for setting and
 * deleting monthly goals.
 *
 * IMPORTANT: Due to partial unique indexes on the monthly_goals table,
 * we need separate mutation handlers for:
 * - Overall goals (category_id IS NULL)
 * - Per-category goals (category_id IS NOT NULL)
 *
 * This is because PostgreSQL partial indexes cannot be used with a single
 * ON CONFLICT clause that handles both NULL and non-NULL values.
 *
 * USAGE:
 * ```typescript
 * import {
 *   useSetOverallGoal,
 *   useSetCategoryGoal,
 *   useDeleteGoal,
 * } from '@/hooks/useGoalMutations';
 *
 * function GoalEditor() {
 *   const setOverall = useSetOverallGoal();
 *   const setCategory = useSetCategoryGoal();
 *   const deleteGoal = useDeleteGoal();
 *
 *   // Set overall goal (upserts existing)
 *   await setOverall.mutateAsync({
 *     month: '2024-03-01',
 *     target_hours: 160,
 *   });
 *
 *   // Set category goal (upserts existing)
 *   await setCategory.mutateAsync({
 *     month: '2024-03-01',
 *     category_id: 'uuid-here',
 *     target_hours: 40,
 *   });
 *
 *   // Delete a goal
 *   await deleteGoal.mutateAsync('goal-uuid');
 * }
 * ```
 *
 * SECURITY:
 * - Input is validated against Zod schemas before mutation
 * - RLS policies ensure users can only modify their own goals
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  SetOverallGoalSchema,
  SetCategoryGoalSchema,
  SetTypeGoalSchema,
  MonthlyGoalSchema,
  type MonthlyGoal,
  type SetOverallGoalInput,
  type SetCategoryGoalInput,
  type SetTypeGoalInput,
} from '@/schemas';

/**
 * Error thrown when goal mutation fails
 */
export class GoalMutationError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'GoalMutationError';
  }
}

// ============================================================================
// SET OVERALL GOAL (category_id IS NULL)
// ============================================================================

/**
 * Set or update an overall goal for a month
 *
 * Uses upsert with the partial unique index on (user_id, month) WHERE category_id IS NULL.
 *
 * @param input - Month and target hours
 * @returns Promise<MonthlyGoal> - The created/updated goal
 * @throws GoalMutationError if validation or mutation fails
 */
async function setOverallGoal(input: SetOverallGoalInput): Promise<MonthlyGoal> {
  // Validate input
  const validationResult = SetOverallGoalSchema.safeParse(input);
  if (!validationResult.success) {
    throw new GoalMutationError(
      `Validation failed: ${validationResult.error.message}`,
      'VALIDATION_ERROR',
      validationResult.error.flatten()
    );
  }

  const { month, target_hours } = validationResult.data;

  // Use RPC function if available, otherwise manual upsert
  // First try to find existing goal
  const { data: existing } = await supabase
    .from('monthly_goals')
    .select('id')
    .eq('month', month)
    .is('category_id', null)
    .single();

  let result;
  let error;

  if (existing?.id) {
    // Update existing
    const updateResult = await supabase
      .from('monthly_goals')
      .update({ target_hours })
      .eq('id', existing.id)
      .select()
      .single();
    result = updateResult.data;
    error = updateResult.error;
  } else {
    // Insert new
    const insertResult = await supabase
      .from('monthly_goals')
      .insert({
        month,
        category_id: null,
        target_hours,
      })
      .select()
      .single();
    result = insertResult.data;
    error = insertResult.error;
  }

  if (error) {
    throw new GoalMutationError(error.message, error.code, error.details);
  }

  if (!result) {
    throw new GoalMutationError('No data returned from mutation', 'NO_DATA');
  }

  // Validate response
  const parsed = MonthlyGoalSchema.safeParse(result);
  if (!parsed.success) {
    console.warn('[useGoalMutations] Invalid response data:', result, parsed.error);
    return result as MonthlyGoal;
  }

  return parsed.data;
}

/**
 * Options for useSetOverallGoal hook
 */
export interface UseSetOverallGoalOptions {
  /**
   * Callback invoked on successful mutation
   */
  onSuccess?: (goal: MonthlyGoal) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: GoalMutationError) => void;
}

/**
 * Hook to set/update an overall goal for a month
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 *
 * @example
 * ```typescript
 * const setOverall = useSetOverallGoal({
 *   onSuccess: (goal) => console.log('Goal set:', goal.target_hours),
 * });
 *
 * await setOverall.mutateAsync({
 *   month: '2024-03-01',
 *   target_hours: 160,
 * });
 * ```
 */
export function useSetOverallGoal(options?: UseSetOverallGoalOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setOverallGoal,
    onSuccess: data => {
      // Invalidate goals queries for this month
      queryClient.invalidateQueries({ queryKey: queryKeys.goals(data.month) });

      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      const mutationError =
        error instanceof GoalMutationError ? error : new GoalMutationError(error.message);

      options?.onError?.(mutationError);
    },
  });
}

// ============================================================================
// SET CATEGORY GOAL (category_id IS NOT NULL)
// ============================================================================

/**
 * Set or update a per-category goal for a month
 *
 * Uses upsert with the partial unique index on (user_id, month, category_id)
 * WHERE category_id IS NOT NULL.
 *
 * @param input - Month, category ID, and target hours
 * @returns Promise<MonthlyGoal> - The created/updated goal
 * @throws GoalMutationError if validation or mutation fails
 */
async function setCategoryGoal(input: SetCategoryGoalInput): Promise<MonthlyGoal> {
  // Validate input
  const validationResult = SetCategoryGoalSchema.safeParse(input);
  if (!validationResult.success) {
    throw new GoalMutationError(
      `Validation failed: ${validationResult.error.message}`,
      'VALIDATION_ERROR',
      validationResult.error.flatten()
    );
  }

  const { month, category_id, target_hours } = validationResult.data;

  // First try to find existing goal
  const { data: existing } = await supabase
    .from('monthly_goals')
    .select('id')
    .eq('month', month)
    .eq('category_id', category_id)
    .single();

  let result;
  let error;

  if (existing?.id) {
    // Update existing
    const updateResult = await supabase
      .from('monthly_goals')
      .update({ target_hours })
      .eq('id', existing.id)
      .select()
      .single();
    result = updateResult.data;
    error = updateResult.error;
  } else {
    // Insert new
    const insertResult = await supabase
      .from('monthly_goals')
      .insert({
        month,
        category_id,
        target_hours,
      })
      .select()
      .single();
    result = insertResult.data;
    error = insertResult.error;
  }

  if (error) {
    throw new GoalMutationError(error.message, error.code, error.details);
  }

  if (!result) {
    throw new GoalMutationError('No data returned from mutation', 'NO_DATA');
  }

  // Validate response
  const parsed = MonthlyGoalSchema.safeParse(result);
  if (!parsed.success) {
    console.warn('[useGoalMutations] Invalid response data:', result, parsed.error);
    return result as MonthlyGoal;
  }

  return parsed.data;
}

/**
 * Options for useSetCategoryGoal hook
 */
export interface UseSetCategoryGoalOptions {
  /**
   * Callback invoked on successful mutation
   */
  onSuccess?: (goal: MonthlyGoal) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: GoalMutationError) => void;
}

/**
 * Hook to set/update a per-category goal for a month
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 *
 * @example
 * ```typescript
 * const setCategory = useSetCategoryGoal({
 *   onSuccess: (goal) => console.log('Goal set:', goal.target_hours),
 * });
 *
 * await setCategory.mutateAsync({
 *   month: '2024-03-01',
 *   category_id: 'work-uuid',
 *   target_hours: 80,
 * });
 * ```
 */
export function useSetCategoryGoal(options?: UseSetCategoryGoalOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setCategoryGoal,
    onSuccess: data => {
      // Invalidate goals queries for this month
      queryClient.invalidateQueries({ queryKey: queryKeys.goals(data.month) });

      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      const mutationError =
        error instanceof GoalMutationError ? error : new GoalMutationError(error.message);

      options?.onError?.(mutationError);
    },
  });
}

// ============================================================================
// SET TYPE GOAL (category_type IS NOT NULL)
// ============================================================================

/**
 * Set or update a per-type goal for a month
 *
 * Uses upsert with the partial unique index on (user_id, month, category_type)
 * WHERE category_type IS NOT NULL.
 *
 * @param input - Month, category type, and target hours
 * @returns Promise<MonthlyGoal> - The created/updated goal
 * @throws GoalMutationError if validation or mutation fails
 */
async function setTypeGoal(input: SetTypeGoalInput): Promise<MonthlyGoal> {
  // Validate input
  const validationResult = SetTypeGoalSchema.safeParse(input);
  if (!validationResult.success) {
    throw new GoalMutationError(
      `Validation failed: ${validationResult.error.message}`,
      'VALIDATION_ERROR',
      validationResult.error.flatten()
    );
  }

  const { month, category_type, target_hours } = validationResult.data;

  // First try to find existing goal
  const { data: existing } = await supabase
    .from('monthly_goals')
    .select('id')
    .eq('month', month)
    .eq('category_type', category_type)
    .single();

  let result;
  let error;

  if (existing?.id) {
    // Update existing
    const updateResult = await supabase
      .from('monthly_goals')
      .update({ target_hours })
      .eq('id', existing.id)
      .select()
      .single();
    result = updateResult.data;
    error = updateResult.error;
  } else {
    // Insert new
    const insertResult = await supabase
      .from('monthly_goals')
      .insert({
        month,
        category_type,
        target_hours,
      })
      .select()
      .single();
    result = insertResult.data;
    error = insertResult.error;
  }

  if (error) {
    throw new GoalMutationError(error.message, error.code, error.details);
  }

  if (!result) {
    throw new GoalMutationError('No data returned from mutation', 'NO_DATA');
  }

  // Validate response
  const parsed = MonthlyGoalSchema.safeParse(result);
  if (!parsed.success) {
    console.warn('[useGoalMutations] Invalid response data:', result, parsed.error);
    return result as MonthlyGoal;
  }

  return parsed.data;
}

/**
 * Options for useSetTypeGoal hook
 */
export interface UseSetTypeGoalOptions {
  /**
   * Callback invoked on successful mutation
   */
  onSuccess?: (goal: MonthlyGoal) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: GoalMutationError) => void;
}

/**
 * Hook to set/update a per-type goal for a month
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useSetTypeGoal(options?: UseSetTypeGoalOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setTypeGoal,
    onSuccess: data => {
      // Invalidate goals queries for this month
      queryClient.invalidateQueries({ queryKey: queryKeys.goals(data.month) });

      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      const mutationError =
        error instanceof GoalMutationError ? error : new GoalMutationError(error.message);

      options?.onError?.(mutationError);
    },
  });
}

// ============================================================================
// DELETE GOAL
// ============================================================================

/**
 * Delete a goal by ID
 *
 * @param id - UUID of the goal to delete
 * @returns Promise<{ id: string; month: string }> - The deleted goal's id and month
 * @throws GoalMutationError if deletion fails
 */
async function deleteGoal(id: string): Promise<{ id: string; month: string }> {
  // First fetch the goal to get the month for cache invalidation
  const { data: goal, error: fetchError } = await supabase
    .from('monthly_goals')
    .select('month')
    .eq('id', id)
    .single();

  if (fetchError) {
    throw new GoalMutationError(fetchError.message, fetchError.code, fetchError.details);
  }

  if (!goal) {
    throw new GoalMutationError('Goal not found', 'NOT_FOUND');
  }

  // Delete the goal
  const { error } = await supabase.from('monthly_goals').delete().eq('id', id);

  if (error) {
    throw new GoalMutationError(error.message, error.code, error.details);
  }

  return { id, month: goal.month };
}

/**
 * Options for useDeleteGoal hook
 */
export interface UseDeleteGoalOptions {
  /**
   * Callback invoked on successful deletion
   */
  onSuccess?: (data: { id: string; month: string }) => void;

  /**
   * Callback invoked on error
   */
  onError?: (error: GoalMutationError) => void;
}

/**
 * Hook to delete a goal
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 *
 * @example
 * ```typescript
 * const deleteGoal = useDeleteGoal({
 *   onSuccess: ({ id }) => console.log('Deleted:', id),
 * });
 *
 * await deleteGoal.mutateAsync('goal-uuid');
 * ```
 */
export function useDeleteGoal(options?: UseDeleteGoalOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteGoal,
    onSuccess: data => {
      // Invalidate goals queries for this month
      queryClient.invalidateQueries({ queryKey: queryKeys.goals(data.month) });

      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      const mutationError =
        error instanceof GoalMutationError ? error : new GoalMutationError(error.message);

      options?.onError?.(mutationError);
    },
  });
}

/**
 * Type exports for hook return values
 */
export type UseSetOverallGoalResult = ReturnType<typeof useSetOverallGoal>;
export type UseSetCategoryGoalResult = ReturnType<typeof useSetCategoryGoal>;
export type UseSetTypeGoalResult = ReturnType<typeof useSetTypeGoal>;
export type UseDeleteGoalResult = ReturnType<typeof useDeleteGoal>;
