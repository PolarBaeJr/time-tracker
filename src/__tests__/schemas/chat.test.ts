/**
 * Chat Schema Tests
 *
 * Tests all chat Zod schemas with valid and invalid inputs.
 * Tests ChatRoleEnum, ChatMessageSchema, ChatConversationSchema,
 * and mutation schemas (CreateChatMessageSchema, CreateConversationSchema).
 */

import {
  ChatRoleEnum,
  ChatMessageSchema,
  ChatConversationSchema,
  CreateChatMessageSchema,
  CreateConversationSchema,
  UpdateConversationSchema,
  ChatConversationWithPreviewSchema,
} from '@/schemas/chat';

describe('Chat Schemas', () => {
  // ============================================================================
  // ChatRoleEnum Tests
  // ============================================================================

  describe('ChatRoleEnum', () => {
    it('should accept valid roles', () => {
      expect(ChatRoleEnum.safeParse('user').success).toBe(true);
      expect(ChatRoleEnum.safeParse('assistant').success).toBe(true);
      expect(ChatRoleEnum.safeParse('system').success).toBe(true);
    });

    it('should reject invalid roles', () => {
      expect(ChatRoleEnum.safeParse('admin').success).toBe(false);
      expect(ChatRoleEnum.safeParse('bot').success).toBe(false);
      expect(ChatRoleEnum.safeParse('').success).toBe(false);
      expect(ChatRoleEnum.safeParse(null).success).toBe(false);
      expect(ChatRoleEnum.safeParse(undefined).success).toBe(false);
    });
  });

  // ============================================================================
  // ChatMessageSchema Tests
  // ============================================================================

  describe('ChatMessageSchema', () => {
    const validMessage = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      conversation_id: '123e4567-e89b-12d3-a456-426614174002',
      role: 'user',
      content: 'Hello, how can I improve my productivity?',
      created_at: '2024-03-01T10:00:00.000Z',
    };

    it('should accept valid message data', () => {
      const result = ChatMessageSchema.safeParse(validMessage);
      expect(result.success).toBe(true);
    });

    it('should accept all valid roles', () => {
      expect(ChatMessageSchema.safeParse({ ...validMessage, role: 'user' }).success).toBe(true);
      expect(ChatMessageSchema.safeParse({ ...validMessage, role: 'assistant' }).success).toBe(
        true
      );
      expect(ChatMessageSchema.safeParse({ ...validMessage, role: 'system' }).success).toBe(true);
    });

    it('should require valid UUID for id', () => {
      const result = ChatMessageSchema.safeParse({ ...validMessage, id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should require valid UUID for user_id', () => {
      const result = ChatMessageSchema.safeParse({ ...validMessage, user_id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should require valid UUID for conversation_id', () => {
      const result = ChatMessageSchema.safeParse({ ...validMessage, conversation_id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid role', () => {
      const result = ChatMessageSchema.safeParse({ ...validMessage, role: 'admin' });
      expect(result.success).toBe(false);
    });

    it('should require valid datetime for created_at', () => {
      const result = ChatMessageSchema.safeParse({
        ...validMessage,
        created_at: 'invalid-date',
      });
      expect(result.success).toBe(false);
    });

    it('should validate content max length (50000 for entity schema)', () => {
      // Entity schema allows up to 50000 chars (for assistant messages)
      const longContent = 'a'.repeat(50000);
      const result = ChatMessageSchema.safeParse({ ...validMessage, content: longContent });
      expect(result.success).toBe(true);

      const tooLongContent = 'a'.repeat(50001);
      const failResult = ChatMessageSchema.safeParse({ ...validMessage, content: tooLongContent });
      expect(failResult.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const { id, ...withoutId } = validMessage;
      expect(ChatMessageSchema.safeParse(withoutId).success).toBe(false);

      const { user_id, ...withoutUserId } = validMessage;
      expect(ChatMessageSchema.safeParse(withoutUserId).success).toBe(false);

      const { conversation_id, ...withoutConvId } = validMessage;
      expect(ChatMessageSchema.safeParse(withoutConvId).success).toBe(false);

      const { role, ...withoutRole } = validMessage;
      expect(ChatMessageSchema.safeParse(withoutRole).success).toBe(false);

      const { content, ...withoutContent } = validMessage;
      expect(ChatMessageSchema.safeParse(withoutContent).success).toBe(false);

      const { created_at, ...withoutCreatedAt } = validMessage;
      expect(ChatMessageSchema.safeParse(withoutCreatedAt).success).toBe(false);
    });
  });

  // ============================================================================
  // ChatConversationSchema Tests
  // ============================================================================

  describe('ChatConversationSchema', () => {
    const validConversation = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      title: 'Productivity Discussion',
      created_at: '2024-03-01T10:00:00.000Z',
      updated_at: '2024-03-01T10:30:00.000Z',
    };

    it('should accept valid conversation data', () => {
      const result = ChatConversationSchema.safeParse(validConversation);
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for id', () => {
      const result = ChatConversationSchema.safeParse({ ...validConversation, id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should require valid UUID for user_id', () => {
      const result = ChatConversationSchema.safeParse({ ...validConversation, user_id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should allow null title', () => {
      const result = ChatConversationSchema.safeParse({ ...validConversation, title: null });
      expect(result.success).toBe(true);
    });

    it('should validate title max length (200)', () => {
      const maxTitle = 'a'.repeat(200);
      expect(
        ChatConversationSchema.safeParse({ ...validConversation, title: maxTitle }).success
      ).toBe(true);

      const tooLongTitle = 'a'.repeat(201);
      expect(
        ChatConversationSchema.safeParse({ ...validConversation, title: tooLongTitle }).success
      ).toBe(false);
    });

    it('should require valid datetime for created_at', () => {
      const result = ChatConversationSchema.safeParse({
        ...validConversation,
        created_at: 'invalid-date',
      });
      expect(result.success).toBe(false);
    });

    it('should require valid datetime for updated_at', () => {
      const result = ChatConversationSchema.safeParse({
        ...validConversation,
        updated_at: 'invalid-date',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const { id, ...withoutId } = validConversation;
      expect(ChatConversationSchema.safeParse(withoutId).success).toBe(false);

      const { user_id, ...withoutUserId } = validConversation;
      expect(ChatConversationSchema.safeParse(withoutUserId).success).toBe(false);
    });
  });

  // ============================================================================
  // CreateChatMessageSchema Tests
  // ============================================================================

  describe('CreateChatMessageSchema', () => {
    const validCreate = {
      conversation_id: '123e4567-e89b-12d3-a456-426614174000',
      content: 'Hello, how can I improve my productivity?',
    };

    it('should accept valid create data', () => {
      const result = CreateChatMessageSchema.safeParse(validCreate);
      expect(result.success).toBe(true);
    });

    it('should REJECT server-managed fields', () => {
      const schema = CreateChatMessageSchema.shape;

      // These fields should NOT be in CreateChatMessageSchema
      expect('id' in schema).toBe(false);
      expect('user_id' in schema).toBe(false);
      expect('role' in schema).toBe(false);
      expect('created_at' in schema).toBe(false);
    });

    it('should require valid UUID for conversation_id', () => {
      const result = CreateChatMessageSchema.safeParse({
        ...validCreate,
        conversation_id: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty content', () => {
      const result = CreateChatMessageSchema.safeParse({ ...validCreate, content: '' });
      expect(result.success).toBe(false);
    });

    it('should validate content min length (1)', () => {
      const result = CreateChatMessageSchema.safeParse({ ...validCreate, content: 'a' });
      expect(result.success).toBe(true);
    });

    it('should validate content max length (10000 for user messages)', () => {
      // User messages are limited to 10000 chars in CreateChatMessageSchema
      const maxContent = 'a'.repeat(10000);
      const result = CreateChatMessageSchema.safeParse({ ...validCreate, content: maxContent });
      expect(result.success).toBe(true);

      const tooLongContent = 'a'.repeat(10001);
      const failResult = CreateChatMessageSchema.safeParse({
        ...validCreate,
        content: tooLongContent,
      });
      expect(failResult.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const { conversation_id, ...withoutConvId } = validCreate;
      expect(CreateChatMessageSchema.safeParse(withoutConvId).success).toBe(false);

      const { content, ...withoutContent } = validCreate;
      expect(CreateChatMessageSchema.safeParse(withoutContent).success).toBe(false);
    });
  });

  // ============================================================================
  // CreateConversationSchema Tests
  // ============================================================================

  describe('CreateConversationSchema', () => {
    it('should accept valid create data with title', () => {
      const result = CreateConversationSchema.safeParse({ title: 'My Conversation' });
      expect(result.success).toBe(true);
    });

    it('should accept empty object (title is optional)', () => {
      const result = CreateConversationSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should REJECT server-managed fields', () => {
      const schema = CreateConversationSchema.shape;

      // These fields should NOT be in CreateConversationSchema
      expect('id' in schema).toBe(false);
      expect('user_id' in schema).toBe(false);
      expect('created_at' in schema).toBe(false);
      expect('updated_at' in schema).toBe(false);
    });

    it('should validate title max length (200)', () => {
      const maxTitle = 'a'.repeat(200);
      expect(CreateConversationSchema.safeParse({ title: maxTitle }).success).toBe(true);

      const tooLongTitle = 'a'.repeat(201);
      expect(CreateConversationSchema.safeParse({ title: tooLongTitle }).success).toBe(false);
    });
  });

  // ============================================================================
  // UpdateConversationSchema Tests
  // ============================================================================

  describe('UpdateConversationSchema', () => {
    it('should accept valid update with title', () => {
      const result = UpdateConversationSchema.safeParse({ title: 'Updated Title' });
      expect(result.success).toBe(true);
    });

    it('should accept null title', () => {
      const result = UpdateConversationSchema.safeParse({ title: null });
      expect(result.success).toBe(true);
    });

    it('should accept empty object (no updates)', () => {
      const result = UpdateConversationSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should REJECT server-managed fields', () => {
      const schema = UpdateConversationSchema.shape;

      expect('id' in schema).toBe(false);
      expect('user_id' in schema).toBe(false);
      expect('created_at' in schema).toBe(false);
      expect('updated_at' in schema).toBe(false);
    });

    it('should validate title max length (200)', () => {
      const maxTitle = 'a'.repeat(200);
      expect(UpdateConversationSchema.safeParse({ title: maxTitle }).success).toBe(true);

      const tooLongTitle = 'a'.repeat(201);
      expect(UpdateConversationSchema.safeParse({ title: tooLongTitle }).success).toBe(false);
    });
  });

  // ============================================================================
  // ChatConversationWithPreviewSchema Tests
  // ============================================================================

  describe('ChatConversationWithPreviewSchema', () => {
    const validConversationWithPreview = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      title: 'Productivity Discussion',
      created_at: '2024-03-01T10:00:00.000Z',
      updated_at: '2024-03-01T10:30:00.000Z',
      last_message_preview: 'Hello, how can I...',
      message_count: 5,
    };

    it('should accept valid conversation with preview', () => {
      const result = ChatConversationWithPreviewSchema.safeParse(validConversationWithPreview);
      expect(result.success).toBe(true);
    });

    it('should allow null last_message_preview', () => {
      const result = ChatConversationWithPreviewSchema.safeParse({
        ...validConversationWithPreview,
        last_message_preview: null,
      });
      expect(result.success).toBe(true);
    });

    it('should allow optional last_message_preview', () => {
      const { last_message_preview, ...withoutPreview } = validConversationWithPreview;
      const result = ChatConversationWithPreviewSchema.safeParse(withoutPreview);
      expect(result.success).toBe(true);
    });

    it('should validate last_message_preview max length (100)', () => {
      const maxPreview = 'a'.repeat(100);
      expect(
        ChatConversationWithPreviewSchema.safeParse({
          ...validConversationWithPreview,
          last_message_preview: maxPreview,
        }).success
      ).toBe(true);

      const tooLongPreview = 'a'.repeat(101);
      expect(
        ChatConversationWithPreviewSchema.safeParse({
          ...validConversationWithPreview,
          last_message_preview: tooLongPreview,
        }).success
      ).toBe(false);
    });

    it('should allow optional message_count', () => {
      const { message_count, ...withoutCount } = validConversationWithPreview;
      const result = ChatConversationWithPreviewSchema.safeParse(withoutCount);
      expect(result.success).toBe(true);
    });

    it('should require non-negative message_count', () => {
      expect(
        ChatConversationWithPreviewSchema.safeParse({
          ...validConversationWithPreview,
          message_count: 0,
        }).success
      ).toBe(true);

      expect(
        ChatConversationWithPreviewSchema.safeParse({
          ...validConversationWithPreview,
          message_count: -1,
        }).success
      ).toBe(false);
    });

    it('should require integer message_count', () => {
      expect(
        ChatConversationWithPreviewSchema.safeParse({
          ...validConversationWithPreview,
          message_count: 5.5,
        }).success
      ).toBe(false);
    });
  });
});
