/**
 * Integration Tests: Authentication Flow
 *
 * These tests verify the OAuth authentication flow against a test Supabase instance.
 * Run with a local Supabase instance: `supabase start` before running these tests.
 *
 * NOTE: These are integration tests that require a running Supabase instance.
 * They are skipped in CI unless INTEGRATION_TESTS=true is set.
 */

import { createClient } from '@supabase/supabase-js';

const RUN_INTEGRATION = process.env.INTEGRATION_TESTS === 'true';
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7ACciz0OlO4eTbK9FjkuWVZ2q0k9x6rJk88';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SBc0';

const maybeDescribe = RUN_INTEGRATION ? describe : describe.skip;

maybeDescribe('Auth Integration Tests', () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const testEmail = `test-${Date.now()}@worktracker.local`;
  const testPassword = 'TestPassword123!';

  afterAll(async () => {
    // Clean up test user
    const { data: users } = await adminClient.auth.admin.listUsers();
    const testUser = users?.users.find((u) => u.email === testEmail);
    if (testUser) {
      await adminClient.auth.admin.deleteUser(testUser.id);
    }
  });

  describe('User Registration', () => {
    it('creates a new user with email and password', async () => {
      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
      });

      expect(error).toBeNull();
      expect(data.user).not.toBeNull();
      expect(data.user?.email).toBe(testEmail);
    });

    it('creates a corresponding public.users row via trigger', async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (!userId) {
        // Sign in to get session
        await supabase.auth.signInWithPassword({ email: testEmail, password: testPassword });
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', testEmail)
        .maybeSingle();

      expect(error).toBeNull();
      expect(userData).not.toBeNull();
      expect(userData?.email).toBe(testEmail);
    });
  });

  describe('Session Management', () => {
    it('signs in with email and password', async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

      expect(error).toBeNull();
      expect(data.session).not.toBeNull();
      expect(data.session?.access_token).toBeTruthy();
      expect(data.user?.email).toBe(testEmail);
    });

    it('retrieves the current session', async () => {
      const { data, error } = await supabase.auth.getSession();

      expect(error).toBeNull();
      expect(data.session).not.toBeNull();
    });

    it('retrieves the current user', async () => {
      const { data, error } = await supabase.auth.getUser();

      expect(error).toBeNull();
      expect(data.user).not.toBeNull();
      expect(data.user?.email).toBe(testEmail);
    });

    it('signs out successfully', async () => {
      const { error } = await supabase.auth.signOut();

      expect(error).toBeNull();

      const { data } = await supabase.auth.getSession();
      expect(data.session).toBeNull();
    });
  });

  describe('RLS: Authenticated vs Unauthenticated Access', () => {
    let userId: string;

    beforeAll(async () => {
      const { data } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });
      userId = data.user!.id;
    });

    it('authenticated user can read their own data', async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('unauthenticated user cannot read protected tables', async () => {
      const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      // Don't sign in

      const { data, error } = await anonClient.from('categories').select('*');

      // Should return empty or error due to RLS
      if (error) {
        expect(error).not.toBeNull();
      } else {
        expect(data).toEqual([]);
      }
    });

    it('user_id defaults to auth.uid() on insert', async () => {
      const { data, error } = await supabase
        .from('categories')
        .insert({ name: 'Integration Test Category', color: '#6366F1', type: 'work' })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data?.user_id).toBe(userId);

      // Cleanup
      if (data?.id) {
        await supabase.from('categories').delete().eq('id', data.id);
      }
    });
  });
});

// Unit-style tests that don't require a live Supabase instance
describe('Auth helpers (unit)', () => {
  it('Supabase URL is defined in environment or defaults to local', () => {
    const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
    expect(url).toBeTruthy();
    expect(url).toMatch(/^https?:\/\//);
  });

  it('client can be created without throwing', () => {
    expect(() => {
      createClient(
        'http://127.0.0.1:54321',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7ACciz0OlO4eTbK9FjkuWVZ2q0k9x6rJk88'
      );
    }).not.toThrow();
  });
});
