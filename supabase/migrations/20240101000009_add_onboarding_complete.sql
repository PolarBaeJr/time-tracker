-- Migration: Add onboarding_complete flag to users
-- Used to redirect new users to Settings before accessing the app

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.onboarding_complete IS
    'Whether the user has completed initial settings setup';
