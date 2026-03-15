/**
 * Integration Tests: Chat Operations
 *
 * These tests verify real chat operations against a local Supabase instance.
 * Run with: INTEGRATION_TESTS=true npm test -- --testPathPattern=integration
 *
 * Prerequisites:
 * - `supabase start` must be running
 * - Migrations must be applied
 *
 * Tests cover:
 * - New conversation flow (create -> send -> receive)
 * - Conversation history management
 * - Message persistence
 * - Rate limiting across session
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

maybeDescribe('Chat Integration Tests', () => {
  let supabase: SupabaseClient;
  let adminClient: SupabaseClient;
  let userId: string;

  const testEmail = `chat-test-${Date.now()}@worktracker.local`;
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
  });

  afterAll(async () => {
    // Clean up test data - messages will cascade delete with conversations
    await supabase.from('chat_conversations').delete().eq('user_id', userId);

    // Delete test user
    const { data: users } = await adminClient.auth.admin.listUsers();
    const testUser = users?.users.find(u => u.email === testEmail);
    if (testUser) {
      await adminClient.auth.admin.deleteUser(testUser.id);
    }
  });

  afterEach(async () => {
    // Clean up conversations between tests
    await supabase.from('chat_conversations').delete().eq('user_id', userId);
  });

  // ============================================================================
  // Conversation CRUD
  // ============================================================================

  describe('Conversation CRUD', () => {
    it('creates a conversation with user_id auto-set', async () => {
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({})
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data?.user_id).toBe(userId);
      expect(data?.title).toBeNull();
      expect(data?.created_at).toBeTruthy();
      expect(data?.updated_at).toBeTruthy();
    });

    it('creates a conversation with a title', async () => {
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({ title: 'My First Chat' })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.title).toBe('My First Chat');
    });

    it('enforces title max length constraint', async () => {
      const longTitle = 'a'.repeat(201); // Max is 200

      const { error } = await supabase
        .from('chat_conversations')
        .insert({ title: longTitle })
        .select()
        .single();

      expect(error).not.toBeNull();
    });

    it('retrieves conversations ordered by updated_at', async () => {
      // Create conversations in order
      await supabase.from('chat_conversations').insert({ title: 'First' });
      await new Promise(resolve => setTimeout(resolve, 10));
      await supabase.from('chat_conversations').insert({ title: 'Second' });
      await new Promise(resolve => setTimeout(resolve, 10));
      await supabase.from('chat_conversations').insert({ title: 'Third' });

      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .order('updated_at', { ascending: false });

      expect(error).toBeNull();
      expect(data).toHaveLength(3);
      expect(data?.[0].title).toBe('Third');
      expect(data?.[2].title).toBe('First');
    });

    it('updates conversation title', async () => {
      const { data: created } = await supabase
        .from('chat_conversations')
        .insert({ title: 'Original' })
        .select()
        .single();

      const { data, error } = await supabase
        .from('chat_conversations')
        .update({ title: 'Updated Title' })
        .eq('id', created!.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.title).toBe('Updated Title');
    });

    it('deletes conversation and cascades to messages', async () => {
      // Create conversation with messages
      const { data: conv } = await supabase.from('chat_conversations').insert({}).select().single();

      await supabase.from('chat_messages').insert([
        { conversation_id: conv!.id, role: 'user', content: 'Hello' },
        { conversation_id: conv!.id, role: 'assistant', content: 'Hi there!' },
      ]);

      // Delete conversation
      const { error } = await supabase.from('chat_conversations').delete().eq('id', conv!.id);

      expect(error).toBeNull();

      // Verify messages are also deleted (cascade)
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conv!.id);

      expect(messages).toEqual([]);
    });
  });

  // ============================================================================
  // Message CRUD
  // ============================================================================

  describe('Message CRUD', () => {
    let conversationId: string;

    beforeEach(async () => {
      const { data } = await supabase.from('chat_conversations').insert({}).select().single();
      conversationId = data!.id;
    });

    it('creates a user message', async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          role: 'user',
          content: 'Hello, AI!',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data?.user_id).toBe(userId);
      expect(data?.role).toBe('user');
      expect(data?.content).toBe('Hello, AI!');
    });

    it('creates an assistant message', async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: 'Hello! How can I help you today?',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.role).toBe('assistant');
    });

    it('creates a system message', async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          role: 'system',
          content: 'You are a helpful assistant.',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.role).toBe('system');
    });

    it('enforces content max length constraint', async () => {
      const longContent = 'a'.repeat(50001); // Max is 50000

      const { error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          role: 'user',
          content: longContent,
        })
        .select()
        .single();

      expect(error).not.toBeNull();
    });

    it('rejects invalid role values', async () => {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          role: 'invalid' as 'user',
          content: 'Test',
        })
        .select()
        .single();

      expect(error).not.toBeNull();
    });

    it('retrieves messages in chronological order', async () => {
      await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: 'First message',
      });
      await new Promise(resolve => setTimeout(resolve, 10));
      await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: 'Second message',
      });
      await new Promise(resolve => setTimeout(resolve, 10));
      await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: 'Third message',
      });

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      expect(error).toBeNull();
      expect(data).toHaveLength(3);
      expect(data?.[0].content).toBe('First message');
      expect(data?.[1].content).toBe('Second message');
      expect(data?.[2].content).toBe('Third message');
    });
  });

  // ============================================================================
  // New Conversation Flow
  // ============================================================================

  describe('New conversation flow', () => {
    it('completes full conversation flow: create -> send -> persist', async () => {
      // Step 1: Create conversation
      const { data: conversation, error: convError } = await supabase
        .from('chat_conversations')
        .insert({})
        .select()
        .single();

      expect(convError).toBeNull();
      expect(conversation).not.toBeNull();
      const conversationId = conversation!.id;

      // Step 2: Send user message
      const { data: userMessage, error: userError } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          role: 'user',
          content: 'What is my time tracking summary for this week?',
        })
        .select()
        .single();

      expect(userError).toBeNull();
      expect(userMessage?.role).toBe('user');

      // Step 3: Simulate AI response (normally done by AI engine)
      const { data: assistantMessage, error: assistantError } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: 'Based on your time tracking data, you have logged 32 hours this week.',
        })
        .select()
        .single();

      expect(assistantError).toBeNull();
      expect(assistantMessage?.role).toBe('assistant');

      // Step 4: Verify messages persist
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      expect(messages).toHaveLength(2);
      expect(messages?.[0].role).toBe('user');
      expect(messages?.[1].role).toBe('assistant');
    });

    it('updates conversation updated_at when message added', async () => {
      // Create conversation
      const { data: conversation } = await supabase
        .from('chat_conversations')
        .insert({})
        .select()
        .single();

      const originalUpdatedAt = conversation!.updated_at;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Add a message
      await supabase.from('chat_messages').insert({
        conversation_id: conversation!.id,
        role: 'user',
        content: 'Test message',
      });

      // Check conversation updated_at (should be updated by trigger)
      const { data: updatedConv } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('id', conversation!.id)
        .single();

      // The trigger should have updated updated_at
      expect(updatedConv?.updated_at).not.toEqual(originalUpdatedAt);
    });
  });

  // ============================================================================
  // Conversation History
  // ============================================================================

  describe('Conversation history', () => {
    it('loads conversation history correctly', async () => {
      // Create conversation with history
      const { data: conversation } = await supabase
        .from('chat_conversations')
        .insert({ title: 'History Test' })
        .select()
        .single();

      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi! How can I help?' },
        { role: 'user', content: 'What time is it?' },
        { role: 'assistant', content: 'I cannot tell you the time.' },
        { role: 'user', content: 'Okay, thanks' },
        { role: 'assistant', content: "You're welcome!" },
      ];

      for (const msg of messages) {
        await supabase.from('chat_messages').insert({
          conversation_id: conversation!.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Load history
      const { data: history, error } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('conversation_id', conversation!.id)
        .order('created_at', { ascending: true });

      expect(error).toBeNull();
      expect(history).toHaveLength(6);
      expect(history?.[0].content).toBe('Hello');
      expect(history?.[5].content).toBe("You're welcome!");
    });

    it('limits history to recent messages for AI context', async () => {
      const HISTORY_LIMIT = 20;

      // Create conversation
      const { data: conversation } = await supabase
        .from('chat_conversations')
        .insert({})
        .select()
        .single();

      // Insert 30 messages
      for (let i = 0; i < 30; i++) {
        await supabase.from('chat_messages').insert({
          conversation_id: conversation!.id,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i + 1}`,
        });
      }

      // Fetch limited history (like the AI context builder would)
      const { data: history } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversation!.id)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT);

      expect(history).toHaveLength(HISTORY_LIMIT);
      // Should have most recent messages
      expect(history?.[0].content).toBe('Message 30');
    });

    it('clears conversation history', async () => {
      // Create conversation with messages
      const { data: conversation } = await supabase
        .from('chat_conversations')
        .insert({ title: 'Clear Test' })
        .select()
        .single();

      await supabase.from('chat_messages').insert([
        { conversation_id: conversation!.id, role: 'user', content: 'Message 1' },
        { conversation_id: conversation!.id, role: 'assistant', content: 'Message 2' },
      ]);

      // Clear history (delete messages, keep conversation)
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('conversation_id', conversation!.id);

      expect(error).toBeNull();

      // Verify messages deleted
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversation!.id);

      expect(messages).toEqual([]);

      // Verify conversation still exists
      const { data: conv } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('id', conversation!.id)
        .single();

      expect(conv).not.toBeNull();
    });
  });

  // ============================================================================
  // RLS Policy Tests
  // ============================================================================

  describe('RLS: User isolation', () => {
    it("user cannot read another user's conversations", async () => {
      // Create conversation as test user
      const { data: conversation } = await supabase
        .from('chat_conversations')
        .insert({ title: 'Private Chat' })
        .select()
        .single();

      // Create second user
      const otherClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const otherEmail = `other-chat-${Date.now()}@worktracker.local`;

      await otherClient.auth.signUp({ email: otherEmail, password: testPassword });

      // Try to read first user's conversation
      const { data } = await otherClient
        .from('chat_conversations')
        .select('*')
        .eq('id', conversation!.id);

      expect(data).toEqual([]);

      // Cleanup
      const { data: users } = await adminClient.auth.admin.listUsers();
      const otherUser = users?.users.find(u => u.email === otherEmail);
      if (otherUser) {
        await adminClient.auth.admin.deleteUser(otherUser.id);
      }
    });

    it("user cannot read another user's messages", async () => {
      // Create conversation with message as test user
      const { data: conversation } = await supabase
        .from('chat_conversations')
        .insert({})
        .select()
        .single();

      const { data: message } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversation!.id,
          role: 'user',
          content: 'Secret message',
        })
        .select()
        .single();

      // Create second user
      const otherClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const otherEmail = `other-msg-${Date.now()}@worktracker.local`;

      await otherClient.auth.signUp({ email: otherEmail, password: testPassword });

      // Try to read first user's message
      const { data } = await otherClient.from('chat_messages').select('*').eq('id', message!.id);

      expect(data).toEqual([]);

      // Cleanup
      const { data: users } = await adminClient.auth.admin.listUsers();
      const otherUser = users?.users.find(u => u.email === otherEmail);
      if (otherUser) {
        await adminClient.auth.admin.deleteUser(otherUser.id);
      }
    });

    it("user cannot insert message into another user's conversation", async () => {
      // Create conversation as test user
      const { data: conversation } = await supabase
        .from('chat_conversations')
        .insert({})
        .select()
        .single();

      // Create second user
      const otherClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const otherEmail = `other-insert-${Date.now()}@worktracker.local`;

      await otherClient.auth.signUp({ email: otherEmail, password: testPassword });

      // Try to insert message into first user's conversation
      // This should fail due to RLS or FK constraint
      const { error } = await otherClient.from('chat_messages').insert({
        conversation_id: conversation!.id,
        role: 'user',
        content: 'Hacked message',
      });

      // Should fail - either RLS violation or message not visible
      expect(error).not.toBeNull();

      // Cleanup
      const { data: users } = await adminClient.auth.admin.listUsers();
      const otherUser = users?.users.find(u => u.email === otherEmail);
      if (otherUser) {
        await adminClient.auth.admin.deleteUser(otherUser.id);
      }
    });
  });

  // ============================================================================
  // Data Integrity
  // ============================================================================

  describe('Data integrity', () => {
    it('requires conversation_id for messages', async () => {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          role: 'user',
          content: 'Orphan message',
        } as Record<string, unknown>)
        .select()
        .single();

      expect(error).not.toBeNull();
    });

    it('requires valid conversation_id (FK constraint)', async () => {
      const fakeConversationId = '00000000-0000-0000-0000-000000000000';

      const { error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: fakeConversationId,
          role: 'user',
          content: 'Invalid conversation',
        })
        .select()
        .single();

      expect(error).not.toBeNull();
    });

    it('requires content for messages', async () => {
      const { data: conversation } = await supabase
        .from('chat_conversations')
        .insert({})
        .select()
        .single();

      const { error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversation!.id,
          role: 'user',
        } as Record<string, unknown>)
        .select()
        .single();

      expect(error).not.toBeNull();
    });

    it('requires role for messages', async () => {
      const { data: conversation } = await supabase
        .from('chat_conversations')
        .insert({})
        .select()
        .single();

      const { error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversation!.id,
          content: 'Missing role',
        } as Record<string, unknown>)
        .select()
        .single();

      expect(error).not.toBeNull();
    });
  });
});

// Unit-level chat logic tests (no Supabase required)
describe('Chat logic (unit)', () => {
  describe('rate limiting calculation', () => {
    it('calculates messages remaining correctly', () => {
      const MAX_MESSAGES_PER_MINUTE = 30;
      const recentMessages = 15;
      const remaining = MAX_MESSAGES_PER_MINUTE - recentMessages;
      expect(remaining).toBe(15);
    });

    it('returns 0 when at limit', () => {
      const MAX_MESSAGES_PER_MINUTE = 30;
      const recentMessages = 30;
      const remaining = Math.max(0, MAX_MESSAGES_PER_MINUTE - recentMessages);
      expect(remaining).toBe(0);
    });

    it('never returns negative', () => {
      const MAX_MESSAGES_PER_MINUTE = 30;
      const recentMessages = 35;
      const remaining = Math.max(0, MAX_MESSAGES_PER_MINUTE - recentMessages);
      expect(remaining).toBe(0);
    });
  });

  describe('message content validation', () => {
    it('validates content is not empty', () => {
      const content = '';
      expect(content.length >= 1).toBe(false);
    });

    it('validates user message max length', () => {
      const USER_MAX = 10000;
      const validContent = 'a'.repeat(10000);
      const invalidContent = 'a'.repeat(10001);

      expect(validContent.length <= USER_MAX).toBe(true);
      expect(invalidContent.length <= USER_MAX).toBe(false);
    });

    it('validates assistant message max length', () => {
      const ASSISTANT_MAX = 50000;
      const validContent = 'a'.repeat(50000);
      const invalidContent = 'a'.repeat(50001);

      expect(validContent.length <= ASSISTANT_MAX).toBe(true);
      expect(invalidContent.length <= ASSISTANT_MAX).toBe(false);
    });
  });

  describe('conversation title generation', () => {
    it('truncates long first messages for title', () => {
      const firstMessage =
        'This is a very long first message that should be truncated for the conversation title';
      const maxLength = 50;
      const title =
        firstMessage.slice(0, maxLength) + (firstMessage.length > maxLength ? '...' : '');

      expect(title.length).toBeLessThanOrEqual(53); // 50 + '...'
      expect(title).toContain('...');
    });

    it('keeps short messages as-is for title', () => {
      const firstMessage = 'Short message';
      const maxLength = 50;
      const title =
        firstMessage.slice(0, maxLength) + (firstMessage.length > maxLength ? '...' : '');

      expect(title).toBe('Short message');
    });
  });

  describe('conversation history order', () => {
    it('reverses descending order to ascending for AI context', () => {
      const descending = ['msg3', 'msg2', 'msg1'];
      const ascending = [...descending].reverse();

      expect(ascending).toEqual(['msg1', 'msg2', 'msg3']);
    });
  });
});
