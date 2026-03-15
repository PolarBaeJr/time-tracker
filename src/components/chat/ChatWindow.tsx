/**
 * ChatWindow Component
 *
 * Displays a complete chat window with message history and input.
 * Auto-scrolls to bottom on new messages.
 *
 * USAGE:
 * ```tsx
 * import { ChatWindow } from '@/components/chat';
 *
 * <ChatWindow
 *   conversationId={conversationId}
 *   onBack={() => navigation.goBack()}
 * />
 * ```
 */

import * as React from 'react';
import { useRef, useCallback, useEffect } from 'react';
import { View, FlatList, StyleSheet, Pressable, type ListRenderItemInfo } from 'react-native';

import { Text, Spinner, Icon } from '@/components/ui';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useChatMessages, useSendMessage, ChatError, RateLimitError } from '@/hooks/useChat';
import { useTheme, spacing, fontSizes } from '@/theme';
import type { ChatMessage as ChatMessageType, ChatConversation } from '@/schemas';

// ============================================================================
// TYPES
// ============================================================================

/**
 * ChatWindow component props
 */
export interface ChatWindowProps {
  /** UUID of the conversation to display */
  conversationId: string;
  /** Conversation details (for header) */
  conversation?: ChatConversation | null;
  /** Callback when back button is pressed */
  onBack?: () => void;
  /** Whether to show the header */
  showHeader?: boolean;
}

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

interface EmptyStateProps {
  isNewConversation: boolean;
}

function EmptyState({ isNewConversation }: EmptyStateProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.emptyState}>
      <Icon name="chat-bubble" size={48} color={colors.textMuted} />
      <Text style={StyleSheet.flatten([styles.emptyTitle, { color: colors.text }])}>
        {isNewConversation ? 'Start a conversation' : 'No messages yet'}
      </Text>
      <Text style={StyleSheet.flatten([styles.emptySubtitle, { color: colors.textSecondary }])}>
        {isNewConversation
          ? 'Ask me anything about your time tracking, productivity, or goals!'
          : 'Send a message to start chatting.'}
      </Text>
    </View>
  );
}

// ============================================================================
// HEADER COMPONENT
// ============================================================================

interface HeaderProps {
  title: string | null;
  onBack?: () => void;
}

function Header({ title, onBack }: HeaderProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
    >
      {onBack && (
        <Pressable
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-back" size={24} color={colors.text} />
        </Pressable>
      )}
      <Text
        style={StyleSheet.flatten([styles.headerTitle, { color: colors.text }])}
        numberOfLines={1}
      >
        {title || 'New Conversation'}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ChatWindow displays a complete chat interface with message history and input.
 */
export function ChatWindow({
  conversationId,
  conversation,
  onBack,
  showHeader = true,
}: ChatWindowProps): React.ReactElement {
  const { colors } = useTheme();
  const flatListRef = useRef<FlatList<ChatMessageType>>(null);

  // Fetch messages
  const { data: messages = [], isLoading, error, refetch } = useChatMessages(conversationId);

  // Send message mutation
  const sendMessage = useSendMessage();

  // Pending message state (optimistic UI)
  const [pendingMessage, setPendingMessage] = React.useState<string | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      // Small delay to ensure list has rendered
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, pendingMessage]);

  // Handle send message
  const handleSend = useCallback(
    async (content: string) => {
      // Show pending message immediately (optimistic UI)
      setPendingMessage(content);

      try {
        await sendMessage.mutateAsync({
          conversationId,
          content,
        });
      } catch (err) {
        // Error is handled by mutation callbacks
        console.error('[ChatWindow] Send error:', err);
      } finally {
        // Clear pending message after response (or error)
        setPendingMessage(null);
      }
    },
    [conversationId, sendMessage]
  );

  // Render message item
  const renderMessage = useCallback(
    ({ item }: ListRenderItemInfo<ChatMessageType>) => <ChatMessage message={item} />,
    []
  );

  // Key extractor
  const keyExtractor = useCallback((item: ChatMessageType) => item.id, []);

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {showHeader && <Header title={conversation?.title ?? null} onBack={onBack} />}
        <View style={styles.loadingContainer}>
          <Spinner size="large" message="Loading messages..." />
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {showHeader && <Header title={conversation?.title ?? null} onBack={onBack} />}
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>
            {error instanceof ChatError ? error.message : 'Failed to load messages'}
          </Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading messages"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      {showHeader && <Header title={conversation?.title ?? null} onBack={onBack} />}

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          messages.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={<EmptyState isNewConversation={!conversation?.title} />}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        // Accessibility
        accessibilityRole="list"
        accessibilityLabel="Chat messages"
        ListFooterComponent={
          pendingMessage ? (
            <View>
              {/* Show user's pending message */}
              <ChatMessage
                message={{
                  id: 'pending-user',
                  user_id: '',
                  conversation_id: conversationId,
                  role: 'user',
                  content: pendingMessage,
                  created_at: new Date().toISOString(),
                }}
              />
              {/* Show typing indicator for assistant */}
              <ChatMessage
                message={{
                  id: 'pending-assistant',
                  user_id: '',
                  conversation_id: conversationId,
                  role: 'assistant',
                  content: '',
                  created_at: new Date().toISOString(),
                }}
                isTyping
              />
            </View>
          ) : null
        }
      />

      {/* Error banner for send errors */}
      {sendMessage.error && (
        <View style={[styles.errorBanner, { backgroundColor: colors.error + '20' }]}>
          <Icon name="alert-circle" size={16} color={colors.error} />
          <Text style={{ color: colors.error, marginLeft: spacing.xs, flex: 1 }}>
            {sendMessage.error instanceof RateLimitError
              ? sendMessage.error.message
              : 'Failed to send message. Please try again.'}
          </Text>
        </View>
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={sendMessage.isPending}
        placeholder="Ask me about your time tracking..."
      />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSizes.lg,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40, // Balance the back button
  },
  listContent: {
    paddingVertical: spacing.md,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: fontSizes.md,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: fontSizes.md,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 280,
    lineHeight: fontSizes.md * 1.5,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: 8,
  },
});

export default ChatWindow;
