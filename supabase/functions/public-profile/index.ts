/**
 * Edge Function: public-profile
 *
 * Returns aggregate statistics for a public user profile.
 * No authentication required - this is a public endpoint.
 * Only returns data for users who have opted-in by enabling their public profile.
 *
 * Method: GET
 * Path: /public-profile?slug={slug} or /public-profile/{slug}
 * Returns: { name, stats: { total_hours, category_breakdown, current_streak, goals_completed } }
 *
 * Error Handling:
 * - 400: Invalid slug format
 * - 404: Profile not found or not public
 *
 * SECURITY:
 * - Only exposes aggregate statistics, NEVER individual entries
 * - Only returns data for users with public_profile_enabled = true
 * - No PII exposed (email, etc.)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders,
  handleCorsPreflightRequest,
  jsonResponse,
  errorResponse,
} from '../_shared/cors.ts';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Regex for validating profile slug
 * Must match: lowercase letters, numbers, hyphens, 3-30 characters
 */
const SLUG_REGEX = /^[a-z0-9-]{3,30}$/;

// =============================================================================
// TYPES
// =============================================================================

interface PublicProfileStats {
  total_hours: number;
  category_breakdown: {
    work: number;
    break: number;
    long_break: number;
  };
  current_streak: number;
  goals_completed: number;
}

interface PublicProfileResponse {
  name: string;
  stats: PublicProfileStats;
}

interface RpcResult {
  name?: string;
  stats?: PublicProfileStats;
  error?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract slug from request URL
 * Supports both query param (?slug=foo) and path (/public-profile/foo)
 */
function extractSlugFromRequest(req: Request): string | null {
  const url = new URL(req.url);

  // Try query parameter first
  const querySlug = url.searchParams.get('slug');
  if (querySlug) {
    return querySlug;
  }

  // Try path parameter (e.g., /public-profile/foo)
  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts.length >= 2) {
    // Last part after "public-profile"
    const slugIndex = pathParts.indexOf('public-profile');
    if (slugIndex !== -1 && slugIndex < pathParts.length - 1) {
      return pathParts[slugIndex + 1];
    }
  }

  return null;
}

/**
 * Validate slug format
 */
function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Extract slug from request
    const slug = extractSlugFromRequest(req);

    if (!slug) {
      return errorResponse('Missing slug parameter', 400);
    }

    // Validate slug format
    if (!isValidSlug(slug)) {
      return errorResponse(
        'Invalid slug format. Must be lowercase alphanumeric with hyphens, 3-30 characters.',
        400
      );
    }

    // Create Supabase admin client (no auth required for public endpoint)
    // Using service role key to bypass RLS for reading public profiles
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Call the RPC function that computes all stats in a single database call
    const { data: result, error: rpcError } = await supabase.rpc('get_public_profile_stats', {
      p_slug: slug,
    });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      return errorResponse('Failed to fetch profile stats', 500);
    }

    // The RPC function returns a JSONB object
    const rpcResult = result as RpcResult;

    // Check for error in result
    if (rpcResult.error) {
      if (rpcResult.error === 'Profile not found') {
        return errorResponse('Profile not found', 404);
      }
      if (rpcResult.error === 'Invalid slug format') {
        return errorResponse('Invalid slug format', 400);
      }
      return errorResponse(rpcResult.error, 500);
    }

    // Validate response structure
    if (!rpcResult.name || !rpcResult.stats) {
      return errorResponse('Invalid profile data', 500);
    }

    // Build response
    const response: PublicProfileResponse = {
      name: rpcResult.name,
      stats: rpcResult.stats,
    };

    return jsonResponse(response);
  } catch (error) {
    console.error('Public profile error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Failed to fetch profile: ${message}`, 500);
  }
});
