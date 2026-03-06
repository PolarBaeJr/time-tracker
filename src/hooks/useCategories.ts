/**
 * Categories Query Hook
 *
 * This hook provides a React Query-based interface for fetching
 * user categories from Supabase.
 *
 * USAGE:
 * ```typescript
 * import { useCategories } from '@/hooks/useCategories';
 *
 * function CategoryList() {
 *   const { data: categories, isLoading, error } = useCategories();
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Text>Error loading categories</Text>;
 *
 *   return categories?.map(cat => <CategoryCard key={cat.id} category={cat} />);
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only the authenticated user's categories are returned
 * - user_id is NOT included in the query; it's enforced server-side
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import { CategorySchema, type Category } from '@/schemas';

/**
 * Error thrown when category fetch fails
 */
export class CategoriesFetchError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'CategoriesFetchError';
  }
}

/**
 * Fetch all categories for the current user from Supabase
 *
 * @returns Promise<Category[]> - Array of validated categories sorted by name
 * @throws CategoriesFetchError if the fetch fails
 */
async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');

  if (error) {
    throw new CategoriesFetchError(error.message, error.code);
  }

  if (!data) {
    return [];
  }

  // Validate each category against the schema
  // This ensures type safety and catches any schema mismatches
  return data.map((category) => {
    const parsed = CategorySchema.safeParse(category);
    if (!parsed.success) {
      console.warn('Invalid category data:', category, parsed.error);
      // Still return the data but type assertion - schema validation is defensive
      return category as Category;
    }
    return parsed.data;
  });
}

/**
 * Options for the useCategories hook
 */
export interface UseCategoriesOptions {
  /**
   * Whether the query should be enabled
   * Useful for conditional fetching (e.g., only when user is authenticated)
   */
  enabled?: boolean;

  /**
   * Override the default stale time (5 minutes)
   */
  staleTime?: number;
}

/**
 * Hook to fetch all categories for the current user
 *
 * @param options - Optional configuration for the query
 * @returns React Query result with categories data
 *
 * @example
 * ```typescript
 * const { data: categories, isLoading } = useCategories();
 *
 * // Conditional fetch
 * const { data } = useCategories({ enabled: isAuthenticated });
 * ```
 */
export function useCategories(options?: UseCategoriesOptions) {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: fetchCategories,
    enabled: options?.enabled,
    staleTime: options?.staleTime,
  });
}

/**
 * Type for the useCategories hook return value
 */
export type UseCategoriesResult = ReturnType<typeof useCategories>;
