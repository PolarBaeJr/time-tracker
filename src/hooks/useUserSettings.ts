/**
 * User Settings Hook
 *
 * Provides fetching and updating of user profile settings.
 * Uses TanStack Query for caching and optimistic updates.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';

import { supabase } from '@/lib';
import { UserSchema, UpdateUserSchema } from '@/schemas';
import type { User, UpdateUserInput } from '@/types';

/**
 * Query key for user settings
 */
export const userSettingsQueryKey = (userId: string) => ['user-settings', userId] as const;

/**
 * Error class for user settings operations
 */
export class UserSettingsError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'UserSettingsError';
  }
}

/**
 * Fetch user settings from database
 */
async function fetchUserSettings(userId: string): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    throw new UserSettingsError(
      `Failed to fetch user settings: ${error.message}`,
      error.code
    );
  }

  const parsed = UserSchema.safeParse(data);
  if (!parsed.success) {
    throw new UserSettingsError(
      `Invalid user data: ${parsed.error.message}`
    );
  }

  return parsed.data;
}

/**
 * Update user settings in database
 */
async function updateUserSettings(
  userId: string,
  updates: UpdateUserInput
): Promise<User> {
  // Validate input
  const validatedUpdates = UpdateUserSchema.safeParse(updates);
  if (!validatedUpdates.success) {
    throw new UserSettingsError(
      `Invalid update data: ${validatedUpdates.error.message}`
    );
  }

  const { data, error } = await supabase
    .from('users')
    .update({
      ...validatedUpdates.data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new UserSettingsError(
      `Failed to update user settings: ${error.message}`,
      error.code
    );
  }

  const parsed = UserSchema.safeParse(data);
  if (!parsed.success) {
    throw new UserSettingsError(
      `Invalid response data: ${parsed.error.message}`
    );
  }

  return parsed.data;
}

/**
 * Hook options for useUserSettings
 */
export interface UseUserSettingsOptions {
  /** User ID to fetch settings for */
  userId: string | undefined;
  /** Enable/disable the query */
  enabled?: boolean;
}

/**
 * Hook result for useUserSettings
 */
export interface UseUserSettingsResult {
  /** User settings data */
  settings: User | undefined;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch function */
  refetch: UseQueryResult<User>['refetch'];
}

/**
 * Hook to fetch user settings
 *
 * @example
 * ```tsx
 * const { settings, isLoading, error } = useUserSettings({
 *   userId: user?.id,
 * });
 * ```
 */
export function useUserSettings({
  userId,
  enabled = true,
}: UseUserSettingsOptions): UseUserSettingsResult {
  const query = useQuery({
    queryKey: userSettingsQueryKey(userId ?? ''),
    queryFn: () => fetchUserSettings(userId!),
    enabled: enabled && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook options for useUpdateUserSettings
 */
export interface UseUpdateUserSettingsOptions {
  /** Callback on successful update */
  onSuccess?: (data: User) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Hook result for useUpdateUserSettings
 */
export interface UseUpdateUserSettingsResult {
  /** Mutation function */
  updateSettings: UseMutationResult<
    User,
    Error,
    { userId: string; updates: UpdateUserInput }
  >['mutateAsync'];
  /** Loading state */
  isUpdating: boolean;
  /** Error state */
  error: Error | null;
}

/**
 * Hook to update user settings
 *
 * @example
 * ```tsx
 * const { updateSettings, isUpdating } = useUpdateUserSettings({
 *   onSuccess: () => console.log('Settings updated!'),
 * });
 *
 * await updateSettings({
 *   userId: user.id,
 *   updates: { timezone: 'America/New_York' },
 * });
 * ```
 */
export function useUpdateUserSettings(
  options: UseUpdateUserSettingsOptions = {}
): UseUpdateUserSettingsResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      userId,
      updates,
    }: {
      userId: string;
      updates: UpdateUserInput;
    }) => {
      return updateUserSettings(userId, updates);
    },
    onSuccess: (data, variables) => {
      // Update the cache with new data
      queryClient.setQueryData(userSettingsQueryKey(variables.userId), data);
      options.onSuccess?.(data);
    },
    onError: (error) => {
      options.onError?.(error);
    },
  });

  return {
    updateSettings: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}

export default useUserSettings;
