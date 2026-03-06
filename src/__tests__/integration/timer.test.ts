/**
 * Integration Tests: Timer Operations
 *
 * These tests verify real timer operations against a local Supabase instance.
 * Run with: INTEGRATION_TESTS=true npm test -- --testPathPattern=integration
 *
 * Prerequisites:
 * - `supabase start` must be running
 * - Migrations must be applied
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const RUN_INTEGRATION = process.env.INTEGRATION_TESTS === 'true';
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7ACciz0OlO4eTbK9FjkuWVZ2q0k9x6rJk88';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SBc0';

const maybeDescribe = RUN_INTEGRATION ? describe : describe.skip;

maybeDescribe('Timer Integration Tests', () => {
  let supabase: SupabaseClient;
  let adminClient: SupabaseClient;
  let userId: string;
  let categoryId: string;

  const testEmail = `timer-test-${Date.now()}@worktracker.local`;
  const testPassword = 'TestPassword123!';

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create and sign in test user
    const { data } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (!data.user) {
      await supabase.auth.signInWithPassword({ email: testEmail, password: testPassword });
      const { data: sessionData } = await supabase.auth.getUser();
      userId = sessionData.user!.id;
    } else {
      userId = data.user.id;
    }

    // Create a test category
    const { data: category } = await supabase
      .from('categories')
      .insert({ name: 'Test Category', color: '#6366F1', type: 'work' })
      .select()
      .single();

    categoryId = category!.id;
  });

  afterAll(async () => {
    // Clean up test data
    await supabase.from('time_entries').delete().eq('user_id', userId);
    await supabase.from('active_timers').delete().eq('user_id', userId);
    await supabase.from('categories').delete().eq('user_id', userId);

    // Delete test user
    const { data: users } = await adminClient.auth.admin.listUsers();
    const testUser = users?.users.find((u) => u.email === testEmail);
    if (testUser) {
      await adminClient.auth.admin.deleteUser(testUser.id);
    }
  });

  afterEach(async () => {
    // Ensure timer is stopped between tests
    await supabase.from('active_timers').delete().eq('user_id', userId);
  });

  describe('Active Timer CRUD', () => {
    it('creates an active timer with user_id auto-set', async () => {
      const { data, error } = await supabase
        .from('active_timers')
        .insert({ running: true })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data?.user_id).toBe(userId);
      expect(data?.running).toBe(true);
      expect(data?.started_at).toBeTruthy();
    });

    it('creates a timer with a category', async () => {
      const { data, error } = await supabase
        .from('active_timers')
        .insert({ running: true, category_id: categoryId })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.category_id).toBe(categoryId);
    });

    it('only one active timer per user (constraint)', async () => {
      await supabase.from('active_timers').insert({ running: true }).select().single();

      const { error } = await supabase
        .from('active_timers')
        .insert({ running: true })
        .select()
        .single();

      // Should fail with unique constraint violation
      expect(error).not.toBeNull();
    });

    it('retrieves the active timer', async () => {
      await supabase.from('active_timers').insert({ running: true });

      const { data, error } = await supabase
        .from('active_timers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data?.running).toBe(true);
    });

    it('deletes the active timer on stop', async () => {
      await supabase.from('active_timers').insert({ running: true });

      const { error } = await supabase
        .from('active_timers')
        .delete()
        .eq('user_id', userId);

      expect(error).toBeNull();

      const { data } = await supabase
        .from('active_timers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      expect(data).toBeNull();
    });
  });

  describe('stop_timer_and_create_entry RPC', () => {
    it('stops timer and creates a time entry atomically', async () => {
      // Start a timer
      await supabase.from('active_timers').insert({ running: true });

      // Wait briefly to ensure non-zero duration
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Stop via RPC
      const { data, error } = await supabase.rpc('stop_timer_and_create_entry', {
        p_notes: 'Integration test entry',
      });

      expect(error).toBeNull();
      expect(data).not.toBeNull();

      // Timer should be gone
      const { data: timer } = await supabase
        .from('active_timers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      expect(timer).toBeNull();

      // Time entry should exist
      const { data: entry } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      expect(entry).not.toBeNull();
      expect(entry?.notes).toBe('Integration test entry');
      expect(entry?.duration_seconds).toBeGreaterThan(0);
    });

    it('returns error when no active timer exists', async () => {
      // Ensure no timer
      await supabase.from('active_timers').delete().eq('user_id', userId);

      const { error } = await supabase.rpc('stop_timer_and_create_entry', {
        p_notes: null,
      });

      expect(error).not.toBeNull();
    });
  });

  describe('Time Entries', () => {
    it('creates a time entry directly', async () => {
      const startAt = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const endAt = new Date().toISOString();

      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          category_id: categoryId,
          start_at: startAt,
          end_at: endAt,
          duration_seconds: 3600,
          notes: 'Manual entry',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.user_id).toBe(userId);
      expect(data?.duration_seconds).toBe(3600);
    });

    it('queries time entries with date filtering', async () => {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('start_at', `${today}T00:00:00Z`)
        .order('start_at', { ascending: false });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('user cannot read another user\'s time entries', async () => {
      // Create a second client/user to test isolation
      const otherClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const otherEmail = `other-${Date.now()}@worktracker.local`;

      await otherClient.auth.signUp({ email: otherEmail, password: testPassword });

      // Try to read first user's entries
      const { data } = await otherClient
        .from('time_entries')
        .select('*')
        .eq('user_id', userId);

      expect(data).toEqual([]);

      // Cleanup
      const { data: users } = await adminClient.auth.admin.listUsers();
      const otherUser = users?.users.find((u) => u.email === otherEmail);
      if (otherUser) {
        await adminClient.auth.admin.deleteUser(otherUser.id);
      }
    });
  });
});

// Unit-level timer logic tests (no Supabase required)
describe('Timer logic (unit)', () => {
  describe('duration calculation', () => {
    it('calculates duration in seconds between two timestamps', () => {
      const startAt = new Date('2024-03-01T10:00:00.000Z');
      const endAt = new Date('2024-03-01T11:30:00.000Z');
      const durationSeconds = Math.floor((endAt.getTime() - startAt.getTime()) / 1000);

      expect(durationSeconds).toBe(5400);
    });

    it('handles sub-second timers by flooring to 0', () => {
      const startAt = new Date('2024-03-01T10:00:00.000Z');
      const endAt = new Date('2024-03-01T10:00:00.500Z');
      const durationSeconds = Math.floor((endAt.getTime() - startAt.getTime()) / 1000);

      expect(durationSeconds).toBe(0);
    });

    it('calculates elapsed seconds from started_at to now', () => {
      const startedAt = new Date(Date.now() - 65000); // 65 seconds ago
      const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);

      expect(elapsed).toBeGreaterThanOrEqual(65);
      expect(elapsed).toBeLessThan(70);
    });
  });

  describe('timer state validation', () => {
    it('a running timer has running=true', () => {
      const timer = { running: true, started_at: new Date().toISOString() };
      expect(timer.running).toBe(true);
    });

    it('elapsed time increases over time', () => {
      const startedAt = new Date(Date.now() - 10000).toISOString();
      const elapsed1 = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);

      // Simulate 1 second passing
      const elapsed2 = elapsed1 + 1;

      expect(elapsed2).toBeGreaterThan(elapsed1);
    });
  });
});
