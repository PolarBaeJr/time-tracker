/**
 * Public Profile Hooks
 *
 * This module provides TanStack Query hooks for fetching public profile data
 * and updating public profile settings.
 *
 * USAGE:
 * ```typescript
 * import { usePublicProfile, useUpdatePublicProfileSettings } from '@/hooks/usePublicProfile';
 *
 * // Viewing a public profile (no auth required)
 * function PublicProfileView({ slug }: { slug: string }) {
 *   const { data, isLoading, error } = usePublicProfile(slug);
 *   if (isLoading) return <Spinner />;
 *   if (error) return <NotFound />;
 *   return <ProfileCard name={data.name} stats={data.stats} />;
 * }
 *
 * // Updating your own profile settings (auth required)
 * function ProfileSettings() {
 *   const updateSettings = useUpdatePublicProfileSettings();
 *   const handleEnable = () => updateSettings.mutate({ enabled: true, slug: 'johndoe' });
 * }
 * ```
 *
 * SECURITY:
 * - Public profile fetch requires no authentication (public endpoint)
 * - Update settings requires authentication and only updates current user's profile
 * - Slug validation is performed both client-side and server-side
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Regex for validating profile slug
 * Must match: lowercase letters, numbers, hyphens, 3-30 characters
 */
const SLUG_REGEX = /^[a-z0-9-]{3,30}$/;

/**
 * Edge Function URL for public profile
 */
const PUBLIC_PROFILE_FUNCTION_URL = '/functions/v1/public-profile';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Public profile stats returned by the Edge Function
 */
export interface PublicProfileStats {
  total_hours: number;
  category_breakdown: {
    work: number;
    break: number;
    long_break: number;
  };
  current_streak: number;
  goals_completed: number;
}

/**
 * Full public profile response
 */
export interface PublicProfile {
  name: string;
  stats: PublicProfileStats;
}

/**
 * Input for updating public profile settings
 */
export interface UpdatePublicProfileInput {
  enabled: boolean;
  slug?: string;
}

// ============================================================================
// ERROR CLASS
// ============================================================================

/**
 * Error thrown when public profile operations fail
 */
export class PublicProfileFetchError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'PublicProfileFetchError';
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate slug format
 */
export function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}

// ============================================================================
// FETCH PUBLIC PROFILE
// ============================================================================

/**
 * Fetch a public profile by slug
 * No authentication required - calls the public-profile Edge Function
 *
 * @param slug - The profile slug to fetch
 * @returns Promise<PublicProfile> - The public profile data
 * @throws PublicProfileFetchError if the fetch fails
 */
export async function fetchPublicProfile(slug: string): Promise<PublicProfile> {
  // Validate slug format
  if (!isValidSlug(slug)) {
    throw new PublicProfileFetchError(
      'Invalid slug format. Must be lowercase alphanumeric with hyphens, 3-30 characters.',
      'INVALID_SLUG'
    );
  }

  // Get Supabase URL from environment
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new PublicProfileFetchError('Supabase URL not configured', 'MISSING_CONFIG');
  }

  // Call the Edge Function
  const response = await fetch(
    `${supabaseUrl}${PUBLIC_PROFILE_FUNCTION_URL}?slug=${encodeURIComponent(slug)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));

    if (response.status === 404) {
      throw new PublicProfileFetchError('Profile not found', 'NOT_FOUND');
    }

    if (response.status === 400) {
      throw new PublicProfileFetchError(data.error || 'Invalid request', 'BAD_REQUEST');
    }

    throw new PublicProfileFetchError(
      data.error || `Failed to fetch profile: ${response.statusText}`,
      'FETCH_ERROR'
    );
  }

  const profile = await response.json();

  // Validate response structure
  if (!profile.name || !profile.stats) {
    throw new PublicProfileFetchError('Invalid profile data received', 'INVALID_RESPONSE');
  }

  return profile as PublicProfile;
}

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Options for usePublicProfile hook
 */
export interface UsePublicProfileOptions {
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Hook to fetch a public profile by slug
 * No authentication required
 *
 * @param slug - The profile slug to fetch
 * @param options - Query options
 * @returns Query result with public profile data
 */
export function usePublicProfile(slug: string, options?: UsePublicProfileOptions) {
  return useQuery({
    queryKey: queryKeys.publicProfile(slug),
    queryFn: () => fetchPublicProfile(slug),
    enabled: options?.enabled !== false && isValidSlug(slug),
    staleTime: 5 * 60 * 1000, // 5 minutes - match server cache
    retry: (failureCount, error) => {
      // Don't retry on 404 (profile not found)
      if (error instanceof PublicProfileFetchError && error.code === 'NOT_FOUND') {
        return false;
      }
      return failureCount < 2;
    },
  });
}

// ============================================================================
// CHECK SLUG AVAILABILITY
// ============================================================================

/**
 * Check if a slug is available (not taken by another user)
 *
 * @param slug - The slug to check
 * @returns Promise<boolean> - true if available, false if taken
 */
export async function checkSlugAvailability(slug: string): Promise<boolean> {
  if (!isValidSlug(slug)) {
    return false;
  }

  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('public_profile_slug', slug)
    .maybeSingle();

  if (error) {
    throw new PublicProfileFetchError(
      `Failed to check slug availability: ${error.message}`,
      'DB_ERROR'
    );
  }

  // If no user found with this slug, it's available
  return data === null;
}

// ============================================================================
// UPDATE SETTINGS MUTATION
// ============================================================================

/**
 * Options for useUpdatePublicProfileSettings hook
 */
export interface UseUpdatePublicProfileSettingsOptions {
  onSuccess?: () => void;
  onError?: (error: PublicProfileFetchError) => void;
}

/**
 * Result type for useUpdatePublicProfileSettings hook
 */
export type UseUpdatePublicProfileSettingsResult = ReturnType<
  typeof useUpdatePublicProfileSettings
>;

/**
 * Hook to update the current user's public profile settings
 * Requires authentication
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useUpdatePublicProfileSettings(options?: UseUpdatePublicProfileSettingsOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdatePublicProfileInput) => {
      // Validate slug if provided
      if (input.slug !== undefined && input.slug !== null) {
        if (!isValidSlug(input.slug)) {
          throw new PublicProfileFetchError(
            'Invalid slug format. Must be lowercase alphanumeric with hyphens, 3-30 characters.',
            'INVALID_SLUG'
          );
        }

        // Check if slug is available (when enabling or changing slug)
        if (input.enabled) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) {
            throw new PublicProfileFetchError('Not authenticated', 'UNAUTHORIZED');
          }

          // Check if another user has this slug
          const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id')
            .eq('public_profile_slug', input.slug)
            .neq('id', user.id)
            .maybeSingle();

          if (checkError) {
            throw new PublicProfileFetchError(
              `Failed to check slug availability: ${checkError.message}`,
              'DB_ERROR'
            );
          }

          if (existingUser) {
            throw new PublicProfileFetchError('This slug is already taken', 'SLUG_TAKEN');
          }
        }
      }

      // Build update object
      const updateData: Record<string, unknown> = {
        public_profile_enabled: input.enabled,
      };

      if (input.slug !== undefined) {
        updateData.public_profile_slug = input.slug;
      }

      // If disabling, we could optionally clear the slug
      // For now, we keep it to allow re-enabling later

      // Update the user record
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new PublicProfileFetchError('Not authenticated', 'UNAUTHORIZED');
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id);

      if (updateError) {
        // Handle unique constraint violation
        if (updateError.code === '23505') {
          throw new PublicProfileFetchError('This slug is already taken', 'SLUG_TAKEN');
        }

        // Handle check constraint violation (invalid slug format)
        if (updateError.code === '23514') {
          throw new PublicProfileFetchError('Invalid slug format', 'INVALID_SLUG');
        }

        throw new PublicProfileFetchError(
          `Failed to update profile settings: ${updateError.message}`,
          'UPDATE_ERROR'
        );
      }

      return { success: true };
    },
    onSuccess: () => {
      // Invalidate user query to refresh settings
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
      options?.onSuccess?.();
    },
    onError: error => {
      if (options?.onError && error instanceof PublicProfileFetchError) {
        options.onError(error);
      }
    },
  });
}
