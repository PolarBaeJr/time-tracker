import { z } from 'zod';

/**
 * Chat Schemas - Validation schemas for AI chat assistant functionality
 *
 * Used for validating chat conversations and messages between users and AI.
 */

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Chat role enum - matches database chat_role ENUM
 */
export const ChatRoleEnum = z.enum(['user', 'assistant', 'system']);

// =============================================================================
// ENTITY SCHEMAS
// =============================================================================

/**
 * Chat Message Schema - Entity schema for query responses
 *
 * Represents a single message in a chat conversation.
 */
export const ChatMessageSchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),

  /** UUID of the owning user (server-managed via auth.uid()) */
  user_id: z.string().uuid(),

  /** UUID of the parent conversation */
  conversation_id: z.string().uuid(),

  /** Role of the message sender: user, assistant, or system */
  role: ChatRoleEnum,

  /** Message content (max 50000 chars) */
  content: z.string().max(50000),

  /** Timestamp when message was created */
  created_at: z.string().datetime({ offset: true }),
});

/**
 * Chat Conversation Schema - Entity schema for query responses
 *
 * Represents a conversation thread between a user and the AI assistant.
 */
export const ChatConversationSchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),

  /** UUID of the owning user (server-managed via auth.uid()) */
  user_id: z.string().uuid(),

  /** Conversation title, auto-generated from first message (max 200 chars) */
  title: z.string().max(200).nullable(),

  /** Timestamp when conversation was created */
  created_at: z.string().datetime({ offset: true }),

  /** Timestamp when conversation was last updated (new message added) */
  updated_at: z.string().datetime({ offset: true }),
});

// =============================================================================
// MUTATION SCHEMAS
// =============================================================================

/**
 * Create Chat Message Schema - Mutation schema for sending messages
 *
 * EXCLUDES server-managed fields: id, user_id, created_at
 * Used when a user sends a new message to the AI assistant.
 *
 * Note: User messages have a shorter max length (10000) than assistant messages
 * to prevent abuse while still allowing detailed questions.
 */
export const CreateChatMessageSchema = z.object({
  /** UUID of the conversation to add the message to */
  conversation_id: z.string().uuid(),

  /** Message content (min 1 char, max 10000 chars for user messages) */
  content: z.string().min(1, 'Message cannot be empty').max(10000),
});

/**
 * Create Conversation Schema - Mutation schema for creating new conversations
 *
 * EXCLUDES server-managed fields: id, user_id, created_at, updated_at
 */
export const CreateConversationSchema = z.object({
  /** Optional conversation title (max 200 chars) */
  title: z.string().max(200).optional(),
});

/**
 * Update Conversation Schema - Mutation schema for updating conversations
 *
 * All fields optional for partial updates.
 */
export const UpdateConversationSchema = z.object({
  /** Update conversation title */
  title: z.string().max(200).nullable().optional(),
});

// =============================================================================
// INFERRED TYPES
// =============================================================================

/** Chat role type */
export type ChatRole = z.infer<typeof ChatRoleEnum>;

/** Chat message type */
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/** Chat conversation type */
export type ChatConversation = z.infer<typeof ChatConversationSchema>;

/** Input type for creating chat messages */
export type CreateChatMessageInput = z.infer<typeof CreateChatMessageSchema>;

/** Input type for creating conversations */
export type CreateConversationInput = z.infer<typeof CreateConversationSchema>;

/** Input type for updating conversations */
export type UpdateConversationInput = z.infer<typeof UpdateConversationSchema>;

// =============================================================================
// HELPER SCHEMAS
// =============================================================================

/**
 * Chat conversation with last message preview
 * Used for conversation list display
 */
export const ChatConversationWithPreviewSchema = ChatConversationSchema.extend({
  /** Preview of the last message in the conversation */
  last_message_preview: z.string().max(100).nullable().optional(),

  /** Total message count in the conversation */
  message_count: z.number().int().nonnegative().optional(),
});

export type ChatConversationWithPreview = z.infer<typeof ChatConversationWithPreviewSchema>;
