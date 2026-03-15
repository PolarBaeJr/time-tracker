-- Migration: Add public profile columns to users table
-- Enables users to create public-facing profile pages with aggregate stats
-- Part of Phase 5: Collaboration feature set

-- =============================================================================
-- ADD PUBLIC PROFILE COLUMNS
-- =============================================================================

-- Whether the user has enabled their public profile
-- Default: false (opt-in only)
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS public_profile_enabled boolean NOT NULL DEFAULT false;

-- Unique URL slug for the public profile (e.g., /u/johndoe)
-- Nullable when profile is not configured
-- Regex validation: lowercase letters, numbers, and hyphens only, 3-30 chars
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS public_profile_slug text UNIQUE
        CHECK (public_profile_slug IS NULL OR public_profile_slug ~ '^[a-z0-9-]{3,30}$');

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Partial index for efficient lookup of enabled public profile slugs
-- Used by the public profile Edge Function to resolve slug -> user
CREATE INDEX IF NOT EXISTS idx_users_public_profile_slug
    ON public.users(public_profile_slug)
    WHERE public_profile_enabled = true;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN public.users.public_profile_enabled IS
    'Whether the user has enabled their public profile page (opt-in, default: false)';

COMMENT ON COLUMN public.users.public_profile_slug IS
    'Unique URL-friendly identifier for public profile (e.g., johndoe for /u/johndoe). Must be lowercase alphanumeric with hyphens, 3-30 characters.';

-- =============================================================================
-- SECURITY NOTES
-- =============================================================================

/*
PUBLIC PROFILE SECURITY CONSIDERATIONS:

1. OPT-IN ONLY: public_profile_enabled defaults to false. Users must
   explicitly enable their public profile.

2. DATA EXPOSURE: The public profile Edge Function (public-profile/index.ts)
   should ONLY expose aggregate statistics when public_profile_enabled = true:
   - Total hours tracked (all-time sum)
   - Category breakdown (work/personal/hobby percentages)
   - Current tracking streak (consecutive days)
   - Goals completed count

   The Edge Function must NEVER expose:
   - Individual time entries
   - Entry descriptions or notes
   - Category names (only types)
   - User email or other PII
   - Workspace or project information

3. SLUG VALIDATION: The CHECK constraint ensures slugs are:
   - Lowercase only (prevents case-sensitivity issues)
   - Alphanumeric with hyphens only (URL-safe)
   - 3-30 characters (reasonable length bounds)
   - UNIQUE (prevents conflicts)

4. ENUMERATION PROTECTION: The partial index only includes rows where
   public_profile_enabled = true, but the Edge Function should use
   appropriate rate limiting to prevent profile enumeration attacks.

5. RLS: The existing RLS policy on users table ensures users can only
   modify their own public_profile_enabled and public_profile_slug.
   Public read access is handled by the Edge Function with explicit
   opt-in checks, NOT by modifying RLS policies.
*/
