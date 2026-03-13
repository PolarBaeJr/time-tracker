/**
 * Chat Hooks Tests
 *
 * Tests for the chat React Query hooks - specifically the non-hook exports
 * and utilities that can be tested directly.
 *
 * Tests:
 * - Rate limiting logic via getRemainingMessages
 * - ChatError and RateLimitError classes
 * - Query key generation
 *
 * Note: Hook integration tests are handled in src/__tests__/integration/chat.test.ts
 */

// Mock dependencies BEFORE importing the module under test
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    chatConversations: ['chatConversations'],
    chatMessages: (id: string) => ['chatMessages', id],
  },
}));

jest.mock('@/lib/ai', () => ({
  aiEngine: {
    chat: jest.fn(),
  },
  buildTimeTrackingContext: jest.fn().mockResolvedValue('Mock context'),
  getSystemPrompt: jest.fn((ctx: string) => `System: ${ctx}`),
}));

// Now import the module under test
import { getRemainingMessages, ChatError, RateLimitError, chatQueryKeys } from '@/hooks/useChat';

describe('Chat Hooks Utilities', () => {
  // ============================================================================
  // Query Keys Tests
  // ============================================================================

  describe('chatQueryKeys', () => {
    it('should have correct conversations key', () => {
      expect(chatQueryKeys.conversations).toEqual(['chatConversations']);
    });

    it('should generate correct messages key with conversationId', () => {
      const conversationId = '123e4567-e89b-12d3-a456-426614174000';
      expect(chatQueryKeys.messages(conversationId)).toEqual(['chatMessages', conversationId]);
    });

    it('should generate unique keys for different conversations', () => {
      const id1 = '123e4567-e89b-12d3-a456-426614174000';
      const id2 = '123e4567-e89b-12d3-a456-426614174001';

      const key1 = chatQueryKeys.messages(id1);
      const key2 = chatQueryKeys.messages(id2);

      expect(key1).not.toEqual(key2);
      expect(key1[0]).toEqual(key2[0]); // Same prefix
      expect(key1[1]).not.toEqual(key2[1]); // Different conversation IDs
    });
  });

  // ============================================================================
  // ChatError Tests
  // ============================================================================

  describe('ChatError', () => {
    it('should create error with message', () => {
      const error = new ChatError('Something went wrong');
      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('ChatError');
    });

    it('should create error with message and code', () => {
      const error = new ChatError('Database error', 'PGRST001');
      expect(error.message).toBe('Database error');
      expect(error.code).toBe('PGRST001');
    });

    it('should be an instance of Error', () => {
      const error = new ChatError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ChatError);
    });

    it('should have undefined code when not provided', () => {
      const error = new ChatError('Test error');
      expect(error.code).toBeUndefined();
    });

    it('should have correct error name for stack traces', () => {
      const error = new ChatError('Test');
      expect(error.name).toBe('ChatError');
      expect(error.stack).toContain('ChatError');
    });
  });

  // ============================================================================
  // RateLimitError Tests
  // ============================================================================

  describe('RateLimitError', () => {
    it('should create rate limit error with retry time', () => {
      const error = new RateLimitError(30000);
      expect(error.retryAfterMs).toBe(30000);
      expect(error.name).toBe('RateLimitError');
    });

    it('should generate user-friendly message with seconds', () => {
      const error = new RateLimitError(45000);
      expect(error.message).toContain('45');
      expect(error.message.toLowerCase()).toContain('second');
    });

    it('should round up partial seconds', () => {
      const error = new RateLimitError(45500); // 45.5 seconds
      expect(error.message).toContain('46'); // Should round up
    });

    it('should be an instance of ChatError', () => {
      const error = new RateLimitError(10000);
      expect(error).toBeInstanceOf(ChatError);
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should include rate limit indication in message', () => {
      const error = new RateLimitError(30000);
      expect(error.message.toLowerCase()).toContain('rate limit');
    });

    it('should have correct error name for identification', () => {
      const error = new RateLimitError(10000);
      expect(error.name).toBe('RateLimitError');
    });

    it('should store exact retry time', () => {
      const times = [1000, 5000, 15000, 30000, 60000];
      times.forEach(time => {
        const error = new RateLimitError(time);
        expect(error.retryAfterMs).toBe(time);
      });
    });
  });

  // ============================================================================
  // Rate Limiting Tests
  // ============================================================================

  describe('Rate Limiting via getRemainingMessages', () => {
    beforeEach(() => {
      // Use fake timers for consistent testing
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-03-01T10:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return a number', () => {
      const remaining = getRemainingMessages();
      expect(typeof remaining).toBe('number');
    });

    it('should return a value between 0 and 30', () => {
      const remaining = getRemainingMessages();
      expect(remaining).toBeGreaterThanOrEqual(0);
      expect(remaining).toBeLessThanOrEqual(30);
    });

    it('should be consistent when called multiple times without sending messages', () => {
      const first = getRemainingMessages();
      const second = getRemainingMessages();
      expect(first).toBe(second);
    });

    it('should return max messages (30) when no messages have been sent recently', () => {
      // Move time forward past any previous messages (clear rate limit window)
      jest.setSystemTime(new Date('2024-03-01T12:00:00.000Z'));
      const remaining = getRemainingMessages();
      expect(remaining).toBe(30);
    });
  });

  // ============================================================================
  // Type Safety Tests
  // ============================================================================

  describe('Type Safety', () => {
    it('chatQueryKeys.conversations should be a readonly tuple', () => {
      const key = chatQueryKeys.conversations;
      // Should be ['chatConversations']
      expect(key).toHaveLength(1);
      expect(key[0]).toBe('chatConversations');
    });

    it('chatQueryKeys.messages should return a readonly tuple', () => {
      const key = chatQueryKeys.messages('test-id');
      // Should be ['chatMessages', 'test-id']
      expect(key).toHaveLength(2);
      expect(key[0]).toBe('chatMessages');
      expect(key[1]).toBe('test-id');
    });
  });
});
