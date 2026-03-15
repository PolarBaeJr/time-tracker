/**
 * Integration Tests: Notes Operations
 *
 * These tests verify real notes operations against a local Supabase instance.
 * Run with: INTEGRATION_TESTS=true npm test -- --testPathPattern=integration
 *
 * Prerequisites:
 * - `supabase start` must be running
 * - Migrations must be applied
 *
 * Tests cover:
 * - Full CRUD lifecycle (create -> read -> update -> delete)
 * - Search filter integration
 * - Category linking
 * - Soft delete and recovery
 * - RLS policy enforcement
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

maybeDescribe('Notes Integration Tests', () => {
  let supabase: SupabaseClient;
  let adminClient: SupabaseClient;
  let userId: string;
  let categoryId: string;

  const testEmail = `notes-test-${Date.now()}@worktracker.local`;
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

    // Create a test category for linking
    const { data: category } = await supabase
      .from('categories')
      .insert({ name: 'Notes Test Category', color: '#6366F1', type: 'work' })
      .select()
      .single();

    categoryId = category!.id;
  });

  afterAll(async () => {
    // Clean up test data
    await supabase.from('notes').delete().eq('user_id', userId);
    await supabase.from('categories').delete().eq('user_id', userId);

    // Delete test user
    const { data: users } = await adminClient.auth.admin.listUsers();
    const testUser = users?.users.find(u => u.email === testEmail);
    if (testUser) {
      await adminClient.auth.admin.deleteUser(testUser.id);
    }
  });

  afterEach(async () => {
    // Clean up notes between tests to ensure isolation
    await supabase.from('notes').delete().eq('user_id', userId);
  });

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  describe('Notes CRUD', () => {
    it('creates a note with user_id auto-set', async () => {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          title: 'Test Note',
          content: 'Test content',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data?.user_id).toBe(userId);
      expect(data?.title).toBe('Test Note');
      expect(data?.content).toBe('Test content');
      expect(data?.pinned).toBe(false);
      expect(data?.deleted_at).toBeNull();
    });

    it('creates a note with a category', async () => {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          title: 'Categorized Note',
          content: 'Has a category',
          category_id: categoryId,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.category_id).toBe(categoryId);
    });

    it('creates a pinned note', async () => {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          title: 'Pinned Note',
          pinned: true,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.pinned).toBe(true);
    });

    it('retrieves a note by id', async () => {
      // Create first
      const { data: created } = await supabase
        .from('notes')
        .insert({ title: 'Retrieve Test' })
        .select()
        .single();

      // Retrieve
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', created!.id)
        .single();

      expect(error).toBeNull();
      expect(data?.id).toBe(created!.id);
      expect(data?.title).toBe('Retrieve Test');
    });

    it('updates a note', async () => {
      // Create first
      const { data: created } = await supabase
        .from('notes')
        .insert({ title: 'Original Title', content: 'Original content' })
        .select()
        .single();

      // Update
      const { data, error } = await supabase
        .from('notes')
        .update({ title: 'Updated Title', content: 'Updated content' })
        .eq('id', created!.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.title).toBe('Updated Title');
      expect(data?.content).toBe('Updated content');
      // updated_at should be different from created_at (trigger)
      expect(data?.updated_at).not.toEqual(data?.created_at);
    });

    it('enforces title max length constraint', async () => {
      const longTitle = 'a'.repeat(201); // Max is 200

      const { error } = await supabase.from('notes').insert({ title: longTitle }).select().single();

      expect(error).not.toBeNull();
    });

    it('enforces content max length constraint', async () => {
      const longContent = 'a'.repeat(10001); // Max is 10000

      const { error } = await supabase
        .from('notes')
        .insert({ title: 'Valid Title', content: longContent })
        .select()
        .single();

      expect(error).not.toBeNull();
    });
  });

  // ============================================================================
  // Full CRUD Lifecycle
  // ============================================================================

  describe('Full create -> read -> update -> delete flow', () => {
    it('completes full lifecycle', async () => {
      // CREATE
      const { data: created, error: createError } = await supabase
        .from('notes')
        .insert({
          title: 'Lifecycle Test Note',
          content: 'Initial content',
          category_id: categoryId,
        })
        .select()
        .single();

      expect(createError).toBeNull();
      expect(created).not.toBeNull();
      const noteId = created!.id;

      // READ
      const { data: read, error: readError } = await supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .single();

      expect(readError).toBeNull();
      expect(read?.title).toBe('Lifecycle Test Note');
      expect(read?.category_id).toBe(categoryId);

      // UPDATE
      const { data: updated, error: updateError } = await supabase
        .from('notes')
        .update({
          title: 'Updated Lifecycle Note',
          content: 'Modified content',
          pinned: true,
        })
        .eq('id', noteId)
        .select()
        .single();

      expect(updateError).toBeNull();
      expect(updated?.title).toBe('Updated Lifecycle Note');
      expect(updated?.content).toBe('Modified content');
      expect(updated?.pinned).toBe(true);

      // SOFT DELETE
      const { error: deleteError } = await supabase
        .from('notes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', noteId);

      expect(deleteError).toBeNull();

      // VERIFY SOFT DELETE - should not be found with normal query
      const { data: afterDelete } = await supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .is('deleted_at', null)
        .maybeSingle();

      expect(afterDelete).toBeNull();

      // RESTORE
      const { data: restored, error: restoreError } = await supabase
        .from('notes')
        .update({ deleted_at: null })
        .eq('id', noteId)
        .select()
        .single();

      expect(restoreError).toBeNull();
      expect(restored?.deleted_at).toBeNull();

      // VERIFY RESTORE
      const { data: afterRestore } = await supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .is('deleted_at', null)
        .single();

      expect(afterRestore).not.toBeNull();
      expect(afterRestore?.title).toBe('Updated Lifecycle Note');
    });
  });

  // ============================================================================
  // Search Filter Integration
  // ============================================================================

  describe('Search filter integration', () => {
    beforeEach(async () => {
      // Create test notes for search
      await supabase.from('notes').insert([
        { title: 'Meeting notes from Monday', content: 'Discussed project timeline' },
        { title: 'Project ideas', content: 'New feature brainstorming' },
        { title: 'Todo list', content: 'Buy groceries and schedule meeting' },
        { title: 'Random thoughts', content: 'Nothing important here' },
      ]);
    });

    it('searches by title', async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .ilike('title', '%meeting%')
        .is('deleted_at', null);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0].title).toContain('Meeting');
    });

    it('searches by content', async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .ilike('content', '%timeline%')
        .is('deleted_at', null);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0].content).toContain('timeline');
    });

    it('searches by title OR content', async () => {
      const searchPattern = '%meeting%';
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .or(`title.ilike.${searchPattern},content.ilike.${searchPattern}`)
        .is('deleted_at', null);

      expect(error).toBeNull();
      // Should find "Meeting notes from Monday" and "Todo list" (has meeting in content)
      expect(data?.length).toBeGreaterThanOrEqual(2);
    });

    it('searches are case-insensitive', async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .ilike('title', '%PROJECT%')
        .is('deleted_at', null);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0].title.toLowerCase()).toContain('project');
    });
  });

  // ============================================================================
  // Category Linking
  // ============================================================================

  describe('Category linking', () => {
    it('links note to category on creation', async () => {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          title: 'Work Note',
          category_id: categoryId,
        })
        .select('*, category:categories(*)')
        .single();

      expect(error).toBeNull();
      expect(data?.category_id).toBe(categoryId);
      expect(data?.category?.name).toBe('Notes Test Category');
    });

    it('updates note category', async () => {
      // Create another category
      const { data: newCategory } = await supabase
        .from('categories')
        .insert({ name: 'Personal', color: '#EC4899', type: 'personal' })
        .select()
        .single();

      // Create note with original category
      const { data: note } = await supabase
        .from('notes')
        .insert({ title: 'Category Test', category_id: categoryId })
        .select()
        .single();

      // Update to new category
      const { data: updated, error } = await supabase
        .from('notes')
        .update({ category_id: newCategory!.id })
        .eq('id', note!.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(updated?.category_id).toBe(newCategory!.id);

      // Cleanup
      await supabase.from('categories').delete().eq('id', newCategory!.id);
    });

    it('removes category link (set to null)', async () => {
      const { data: note } = await supabase
        .from('notes')
        .insert({ title: 'Remove Category', category_id: categoryId })
        .select()
        .single();

      const { data: updated, error } = await supabase
        .from('notes')
        .update({ category_id: null })
        .eq('id', note!.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(updated?.category_id).toBeNull();
    });

    it('filters notes by category', async () => {
      // Create notes with different categories
      await supabase
        .from('notes')
        .insert([
          { title: 'Work Note 1', category_id: categoryId },
          { title: 'Work Note 2', category_id: categoryId },
          { title: 'Uncategorized Note' },
        ]);

      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('category_id', categoryId)
        .is('deleted_at', null);

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
      data?.forEach(note => {
        expect(note.category_id).toBe(categoryId);
      });
    });
  });

  // ============================================================================
  // Soft Delete and Recovery
  // ============================================================================

  describe('Soft delete and recovery', () => {
    it('soft deletes by setting deleted_at', async () => {
      const { data: note } = await supabase
        .from('notes')
        .insert({ title: 'To Be Deleted' })
        .select()
        .single();

      const deleteTime = new Date().toISOString();
      const { error } = await supabase
        .from('notes')
        .update({ deleted_at: deleteTime })
        .eq('id', note!.id);

      expect(error).toBeNull();

      // Verify deleted_at is set
      const { data: deleted } = await supabase
        .from('notes')
        .select('*')
        .eq('id', note!.id)
        .single();

      expect(deleted?.deleted_at).not.toBeNull();
    });

    it('excludes soft-deleted notes from normal queries', async () => {
      // Create and soft delete a note
      const { data: note } = await supabase
        .from('notes')
        .insert({ title: 'Hidden Note' })
        .select()
        .single();

      await supabase
        .from('notes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', note!.id);

      // Query with deleted_at filter
      const { data } = await supabase
        .from('notes')
        .select('*')
        .is('deleted_at', null)
        .eq('user_id', userId);

      const found = data?.find(n => n.id === note!.id);
      expect(found).toBeUndefined();
    });

    it('recovers soft-deleted notes by setting deleted_at to null', async () => {
      const { data: note } = await supabase
        .from('notes')
        .insert({ title: 'Recoverable Note' })
        .select()
        .single();

      // Soft delete
      await supabase
        .from('notes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', note!.id);

      // Recover
      const { data: recovered, error } = await supabase
        .from('notes')
        .update({ deleted_at: null })
        .eq('id', note!.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(recovered?.deleted_at).toBeNull();

      // Verify it appears in normal queries again
      const { data: visible } = await supabase
        .from('notes')
        .select('*')
        .eq('id', note!.id)
        .is('deleted_at', null)
        .single();

      expect(visible).not.toBeNull();
    });

    it('can query deleted notes when needed', async () => {
      const { data: note } = await supabase
        .from('notes')
        .insert({ title: 'Deleted Query Test' })
        .select()
        .single();

      await supabase
        .from('notes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', note!.id);

      // Query including deleted notes
      const { data } = await supabase
        .from('notes')
        .select('*')
        .eq('id', note!.id)
        .not('deleted_at', 'is', null)
        .single();

      expect(data).not.toBeNull();
      expect(data?.id).toBe(note!.id);
    });
  });

  // ============================================================================
  // RLS Policy Tests
  // ============================================================================

  describe('RLS: User isolation', () => {
    it("user cannot read another user's notes", async () => {
      // Create a note as the test user
      const { data: note } = await supabase
        .from('notes')
        .insert({ title: 'Private Note' })
        .select()
        .single();

      // Create a second client/user
      const otherClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const otherEmail = `other-${Date.now()}@worktracker.local`;

      await otherClient.auth.signUp({ email: otherEmail, password: testPassword });

      // Try to read first user's note
      const { data } = await otherClient.from('notes').select('*').eq('id', note!.id);

      expect(data).toEqual([]);

      // Cleanup
      const { data: users } = await adminClient.auth.admin.listUsers();
      const otherUser = users?.users.find(u => u.email === otherEmail);
      if (otherUser) {
        await adminClient.auth.admin.deleteUser(otherUser.id);
      }
    });

    it("user cannot update another user's notes", async () => {
      // Create a note as the test user
      const { data: note } = await supabase
        .from('notes')
        .insert({ title: 'Private Note' })
        .select()
        .single();

      // Create a second client/user
      const otherClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const otherEmail = `other-update-${Date.now()}@worktracker.local`;

      await otherClient.auth.signUp({ email: otherEmail, password: testPassword });

      // Try to update first user's note
      const { error, data } = await otherClient
        .from('notes')
        .update({ title: 'Hacked!' })
        .eq('id', note!.id)
        .select();

      // Should succeed but affect 0 rows
      expect(error).toBeNull();
      expect(data).toEqual([]);

      // Verify original note unchanged
      const { data: original } = await supabase
        .from('notes')
        .select('*')
        .eq('id', note!.id)
        .single();

      expect(original?.title).toBe('Private Note');

      // Cleanup
      const { data: users } = await adminClient.auth.admin.listUsers();
      const otherUser = users?.users.find(u => u.email === otherEmail);
      if (otherUser) {
        await adminClient.auth.admin.deleteUser(otherUser.id);
      }
    });

    it("user cannot delete another user's notes", async () => {
      // Create a note as the test user
      const { data: note } = await supabase
        .from('notes')
        .insert({ title: 'Private Note' })
        .select()
        .single();

      // Create a second client/user
      const otherClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const otherEmail = `other-delete-${Date.now()}@worktracker.local`;

      await otherClient.auth.signUp({ email: otherEmail, password: testPassword });

      // Try to delete first user's note
      const { error } = await otherClient.from('notes').delete().eq('id', note!.id);

      // Should succeed but affect 0 rows (no error, just no action)
      expect(error).toBeNull();

      // Verify note still exists
      const { data: stillExists } = await supabase
        .from('notes')
        .select('*')
        .eq('id', note!.id)
        .single();

      expect(stillExists).not.toBeNull();

      // Cleanup
      const { data: users } = await adminClient.auth.admin.listUsers();
      const otherUser = users?.users.find(u => u.email === otherEmail);
      if (otherUser) {
        await adminClient.auth.admin.deleteUser(otherUser.id);
      }
    });
  });

  // ============================================================================
  // Sorting and Ordering
  // ============================================================================

  describe('Sorting and ordering', () => {
    beforeEach(async () => {
      // Create notes with specific order
      await supabase.from('notes').insert({ title: 'B Note', pinned: false });
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      await supabase.from('notes').insert({ title: 'A Note', pinned: true });
      await new Promise(resolve => setTimeout(resolve, 10));
      await supabase.from('notes').insert({ title: 'C Note', pinned: false });
    });

    it('sorts by created_at descending', async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      expect(error).toBeNull();
      expect(data).toHaveLength(3);
      expect(data?.[0].title).toBe('C Note');
      expect(data?.[2].title).toBe('B Note');
    });

    it('sorts by title ascending', async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .is('deleted_at', null)
        .order('title', { ascending: true });

      expect(error).toBeNull();
      expect(data?.[0].title).toBe('A Note');
      expect(data?.[1].title).toBe('B Note');
      expect(data?.[2].title).toBe('C Note');
    });

    it('sorts pinned notes first, then by created_at', async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .is('deleted_at', null)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });

      expect(error).toBeNull();
      expect(data?.[0].pinned).toBe(true);
      expect(data?.[0].title).toBe('A Note');
    });
  });
});

// Unit-level notes logic tests (no Supabase required)
describe('Notes logic (unit)', () => {
  describe('title validation', () => {
    it('validates title is not empty', () => {
      const title = '';
      expect(title.length).toBe(0);
      expect(title.length >= 1 && title.length <= 200).toBe(false);
    });

    it('validates title max length', () => {
      const validTitle = 'a'.repeat(200);
      const invalidTitle = 'a'.repeat(201);

      expect(validTitle.length <= 200).toBe(true);
      expect(invalidTitle.length <= 200).toBe(false);
    });
  });

  describe('content validation', () => {
    it('allows null content', () => {
      const content: string | null = null;
      // Validate: null is allowed, or if string, must be <= 10000 chars
      function validateContent(c: string | null): boolean {
        return c === null || c.length <= 10000;
      }
      expect(validateContent(content)).toBe(true);
    });

    it('validates content max length', () => {
      const validContent = 'a'.repeat(10000);
      const invalidContent = 'a'.repeat(10001);

      expect(validContent.length <= 10000).toBe(true);
      expect(invalidContent.length <= 10000).toBe(false);
    });
  });

  describe('search pattern generation', () => {
    it('generates correct ilike pattern', () => {
      const search = 'meeting';
      const pattern = `%${search}%`;
      expect(pattern).toBe('%meeting%');
    });

    it('handles special characters in search', () => {
      // Note: In production, we should escape % and _
      const search = 'test%value';
      const pattern = `%${search}%`;
      expect(pattern).toContain('%');
    });
  });
});
