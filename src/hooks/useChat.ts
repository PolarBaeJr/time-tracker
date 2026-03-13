/**
 * Chat Query Hooks
 *
 * TanStack Query hooks for managing AI chat conversations and messages.
 *
 * USAGE:
 * ```typescript
 * import { useChatConversations, useSendMessage } from '@/hooks/useChat';
 *
 * function ChatScreen() {
 *   const { data: conversations } = useChatConversations();
 *   const sendMessage = useSendMessage();
 *
 *   const handleSend = async (content: string) => {
 *     await sendMessage.mutateAsync({ conversationId, content });
 *   };
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only the authenticated user's data is accessed
 * - Rate limiting prevents abuse (30 messages per minute)
 * - User messages validated with CreateChatMessageSchema
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import { aiEngine, buildTimeTrackingContext, getSystemPrompt } from '@/lib/ai';
import {
  ChatMessageSchema,
  ChatConversationSchema,
  CreateChatMessageSchema,
  CreateConversationSchema,
  type ChatMessage,
  type ChatConversation,
  type CreateChatMessageInput,
  type CreateConversationInput,
} from '@/schemas';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum messages per minute for rate limiting */
const MAX_MESSAGES_PER_MINUTE = 30;

/** Number of recent messages to include in conversation history for AI */
const CONVERSATION_HISTORY_LIMIT = 20;

// ============================================================================
// QUERY KEYS
// ============================================================================

/**
 * Query keys for chat data
 */
export const chatQueryKeys = {
  /** All conversations for current user */
  conversations: ['chatConversations'] as const,

  /** Messages for a specific conversation */
  messages: (conversationId: string) => ['chatMessages', conversationId] as const,
} as const;

// ============================================================================
// ERROR CLASS
// ============================================================================

/**
 * Error thrown when chat operations fail
 */
export class ChatError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ChatError';
  }
}

/**
 * Error for rate limiting
 */
export class RateLimitError extends ChatError {
  constructor(public readonly retryAfterMs: number) {
    super(`Rate limit exceeded. Please wait ${Math.ceil(retryAfterMs / 1000)} seconds.`);
    this.name = 'RateLimitError';
  }
}

// ============================================================================
// RATE LIMITING
// ============================================================================

/** Track message timestamps for rate limiting */
const messageTimestamps: number[] = [];

/**
 * Check if user is rate limited
 * @returns true if rate limited, false otherwise
 */
function isRateLimited(): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  // Remove old timestamps
  while (messageTimestamps.length > 0 && messageTimestamps[0] < oneMinuteAgo) {
    messageTimestamps.shift();
  }

  return messageTimestamps.length >= MAX_MESSAGES_PER_MINUTE;
}

/**
 * Get remaining messages allowed this minute
 */
export function getRemainingMessages(): number {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  // Count recent messages
  const recentCount = messageTimestamps.filter(ts => ts >= oneMinuteAgo).length;
  return Math.max(0, MAX_MESSAGES_PER_MINUTE - recentCount);
}

/**
 * Record a message being sent (for rate limiting)
 */
function recordMessage(): void {
  messageTimestamps.push(Date.now());
}

// ============================================================================
// FETCH FUNCTIONS
// ============================================================================

/**
 * Fetch all conversations for the current user
 */
async function fetchConversations(): Promise<ChatConversation[]> {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    throw new ChatError(error.message, error.code);
  }

  if (!data) {
    return [];
  }

  // Validate each conversation
  return data.map(conv => {
    const parsed = ChatConversationSchema.safeParse(conv);
    if (!parsed.success) {
      console.warn('[useChat] Invalid conversation data:', conv, parsed.error);
      return conv as ChatConversation;
    }
    return parsed.data;
  });
}

/**
 * Fetch messages for a specific conversation
 */
async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new ChatError(error.message, error.code);
  }

  if (!data) {
    return [];
  }

  // Validate each message
  return data.map(msg => {
    const parsed = ChatMessageSchema.safeParse(msg);
    if (!parsed.success) {
      console.warn('[useChat] Invalid message data:', msg, parsed.error);
      return msg as ChatMessage;
    }
    return parsed.data;
  });
}

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Hook to fetch all chat conversations
 */
export interface UseChatConversationsOptions {
  enabled?: boolean;
  staleTime?: number;
}

export function useChatConversations(options?: UseChatConversationsOptions) {
  const { enabled = true, staleTime } = options ?? {};

  return useQuery({
    queryKey: chatQueryKeys.conversations,
    queryFn: fetchConversations,
    enabled,
    staleTime,
  });
}

/**
 * Hook to fetch messages for a specific conversation
 */
export interface UseChatMessagesOptions {
  enabled?: boolean;
  staleTime?: number;
}

export function useChatMessages(conversationId: string, options?: UseChatMessagesOptions) {
  const { enabled = true, staleTime } = options ?? {};

  return useQuery({
    queryKey: chatQueryKeys.messages(conversationId),
    queryFn: () => fetchMessages(conversationId),
    enabled: enabled && !!conversationId,
    staleTime,
  });
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

/**
 * Hook to create a new conversation
 */
export interface UseCreateConversationOptions {
  onSuccess?: (conversation: ChatConversation) => void;
  onError?: (error: ChatError) => void;
}

export function useCreateConversation(options?: UseCreateConversationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateConversationInput): Promise<ChatConversation> => {
      // Validate input
      const validated = CreateConversationSchema.safeParse(input);
      if (!validated.success) {
        throw new ChatError('Invalid conversation data: ' + validated.error.message);
      }

      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({
          title: validated.data.title ?? null,
        })
        .select()
        .single();

      if (error) {
        throw new ChatError(error.message, error.code);
      }

      return data as ChatConversation;
    },
    onSuccess: conversation => {
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.conversations });
      options?.onSuccess?.(conversation);
    },
    onError: error => {
      options?.onError?.(error as ChatError);
    },
  });
}

/**
 * Hook to send a message and get AI response
 */
export interface UseSendMessageOptions {
  onSuccess?: (assistantMessage: ChatMessage) => void;
  onError?: (error: ChatError) => void;
}

export interface SendMessageInput {
  conversationId: string;
  content: string;
}

export function useSendMessage(options?: UseSendMessageOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SendMessageInput): Promise<ChatMessage> => {
      // Validate input
      const validated = CreateChatMessageSchema.safeParse({
        conversation_id: input.conversationId,
        content: input.content,
      });

      if (!validated.success) {
        throw new ChatError('Invalid message: ' + validated.error.message);
      }

      // Check rate limit
      if (isRateLimited()) {
        throw new RateLimitError(60000 - (Date.now() - messageTimestamps[0]));
      }

      // Record this message for rate limiting
      recordMessage();

      // Step 1: Insert user message
      const { data: userMessage, error: userError } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: input.conversationId,
          role: 'user',
          content: input.content,
        })
        .select()
        .single();

      if (userError) {
        throw new ChatError(userError.message, userError.code);
      }

      // Step 2: Try to get AI response
      let assistantContent: string;

      try {
        // Build context
        const context = await buildTimeTrackingContext();
        const systemPrompt = getSystemPrompt(context);

        // Fetch conversation history (last N messages)
        const { data: historyData } = await supabase
          .from('chat_messages')
          .select('role, content')
          .eq('conversation_id', input.conversationId)
          .order('created_at', { ascending: false })
          .limit(CONVERSATION_HISTORY_LIMIT);

        // Build message history for AI (reverse to chronological order)
        const history = (historyData ?? []).reverse().map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        }));

        // Call AI
        const response = await aiEngine.chat(history, {
          systemPrompt,
          maxTokens: 2000,
          temperature: 0.7,
        });

        assistantContent = response.content;
      } catch (aiError) {
        // On AI error, still save an error message from assistant
        console.error('[useChat] AI error:', aiError);
        assistantContent =
          "I'm sorry, I encountered an error while processing your request. Please try again later.";
      }

      // Step 3: Insert assistant response
      const { data: assistantMessage, error: assistantError } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: input.conversationId,
          role: 'assistant',
          content: assistantContent,
        })
        .select()
        .single();

      if (assistantError) {
        throw new ChatError(assistantError.message, assistantError.code);
      }

      // Step 4: Update conversation title if it's the first message
      const { data: msgCount } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', input.conversationId);

      // If this is the first exchange (2 messages), generate a title
      if ((msgCount as unknown as { count: number })?.count === 2) {
        // Use the first 50 chars of the user's message as title
        const title = input.content.slice(0, 50) + (input.content.length > 50 ? '...' : '');
        await supabase.from('chat_conversations').update({ title }).eq('id', input.conversationId);
      }

      return assistantMessage as ChatMessage;
    },
    onSuccess: (assistantMessage, variables) => {
      // Invalidate messages for this conversation
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.messages(variables.conversationId),
      });
      // Invalidate conversations list (for updated_at)
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.conversations,
      });
      options?.onSuccess?.(assistantMessage);
    },
    onError: error => {
      options?.onError?.(error as ChatError);
    },
  });
}

/**
 * Hook to delete a conversation (cascade deletes messages via FK)
 */
export interface UseDeleteConversationOptions {
  onSuccess?: () => void;
  onError?: (error: ChatError) => void;
}

export function useDeleteConversation(options?: UseDeleteConversationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string): Promise<void> => {
      const { error } = await supabase.from('chat_conversations').delete().eq('id', conversationId);

      if (error) {
        throw new ChatError(error.message, error.code);
      }
    },
    onSuccess: (_, conversationId) => {
      // Invalidate conversations list
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.conversations });
      // Remove messages from cache
      queryClient.removeQueries({ queryKey: chatQueryKeys.messages(conversationId) });
      options?.onSuccess?.();
    },
    onError: error => {
      options?.onError?.(error as ChatError);
    },
  });
}

/**
 * Hook to clear all messages in a conversation (keeps conversation record)
 */
export interface UseClearConversationHistoryOptions {
  onSuccess?: () => void;
  onError?: (error: ChatError) => void;
}

export function useClearConversationHistory(options?: UseClearConversationHistoryOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string): Promise<void> => {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('conversation_id', conversationId);

      if (error) {
        throw new ChatError(error.message, error.code);
      }

      // Reset conversation title since messages are cleared
      await supabase.from('chat_conversations').update({ title: null }).eq('id', conversationId);
    },
    onSuccess: (_, conversationId) => {
      // Invalidate messages for this conversation
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.messages(conversationId),
      });
      // Invalidate conversations list
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.conversations,
      });
      options?.onSuccess?.();
    },
    onError: error => {
      options?.onError?.(error as ChatError);
    },
  });
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UseChatConversationsResult = ReturnType<typeof useChatConversations>;
export type UseChatMessagesResult = ReturnType<typeof useChatMessages>;
export type UseCreateConversationResult = ReturnType<typeof useCreateConversation>;
export type UseSendMessageResult = ReturnType<typeof useSendMessage>;
export type UseDeleteConversationResult = ReturnType<typeof useDeleteConversation>;
export type UseClearConversationHistoryResult = ReturnType<typeof useClearConversationHistory>;
