/**
 * ChatWidget Component
 *
 * Hub widget for AI assistant chat functionality.
 * Provides quick access to chat from the dashboard.
 *
 * Supports three sizes:
 * - Small: Chat icon with unread indicator, tap to open
 * - Medium: Last message preview + quick input
 * - Large: Mini chat window with recent messages
 */

import * as React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Pressable,
  TextInput,
  StyleSheet,
  FlatList,
  type ListRenderItemInfo,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { WidgetCard } from '../WidgetCard';
import { Text, Button, Icon, Spinner } from '@/components/ui';
import { useTheme, spacing, borderRadius, fontSizes } from '@/theme';
import {
  useChatConversations,
  useChatMessages,
  useCreateConversation,
  useSendMessage,
} from '@/hooks/useChat';
import type { ChatMessage } from '@/schemas';
import type { WidgetSize } from '../WidgetRegistry';
import type { RootStackParamList } from '@/navigation/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * ChatWidget component props
 */
export interface ChatWidgetProps {
  /** Widget size affects layout and information density */
  size: WidgetSize;
}

type StackNav = NativeStackNavigationProp<RootStackParamList>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format timestamp for display
 */
function formatMessageTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

interface EmptyStateProps {
  size: WidgetSize;
  onStart: () => void;
}

function EmptyState({ size, onStart }: EmptyStateProps): React.ReactElement {
  const { colors } = useTheme();

  if (size === 'small') {
    return (
      <Pressable onPress={onStart} style={styles.compactContainer}>
        <Icon name="chat-bubble" size={24} color={colors.primary} />
      </Pressable>
    );
  }

  return (
    <View style={styles.emptyContainer}>
      <Icon name="chat-bubble" size={32} color={colors.textMuted} />
      <Text variant="bodySmall" color="secondary" style={styles.emptyText}>
        Ask me anything about your time tracking!
      </Text>
      <Button variant="primary" size="sm" onPress={onStart}>
        Start Chat
      </Button>
    </View>
  );
}

// ============================================================================
// MESSAGE ITEM COMPONENT (for Large size)
// ============================================================================

interface MessageItemProps {
  message: ChatMessage;
}

function MessageItem({ message }: MessageItemProps): React.ReactElement {
  const { colors } = useTheme();
  const isUser = message.role === 'user';

  return (
    <View style={[styles.messageItem, isUser ? styles.messageUser : styles.messageAssistant]}>
      <View
        style={[
          styles.messageBubble,
          {
            backgroundColor: isUser ? colors.primary : colors.surface,
            borderColor: isUser ? colors.primary : colors.border,
          },
        ]}
      >
        <Text
          variant="caption"
          style={isUser ? styles.messageTextUser : undefined}
          numberOfLines={2}
        >
          {truncateText(message.content, 80)}
        </Text>
      </View>
    </View>
  );
}

// ============================================================================
// SMALL SIZE COMPONENT
// ============================================================================

interface SmallSizeProps {
  hasConversations: boolean;
  onPress: () => void;
}

function SmallSize({ hasConversations, onPress }: SmallSizeProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={styles.compactContainer}
      accessibilityRole="button"
      accessibilityLabel="Open AI chat"
    >
      <View style={styles.compactRow}>
        <Icon name="chat-bubble" size={24} color={colors.primary} />
        {hasConversations && (
          <View style={[styles.indicator, { backgroundColor: colors.success }]} />
        )}
      </View>
    </Pressable>
  );
}

// ============================================================================
// MEDIUM SIZE COMPONENT
// ============================================================================

interface MediumSizeProps {
  latestMessage: ChatMessage | null;
  onOpenChat: () => void;
  onQuickSend: (content: string) => void;
  isSending: boolean;
}

function MediumSize({
  latestMessage,
  onOpenChat,
  onQuickSend,
  isSending,
}: MediumSizeProps): React.ReactElement {
  const { colors } = useTheme();
  const [inputValue, setInputValue] = useState('');

  const handleSend = useCallback(() => {
    if (inputValue.trim()) {
      onQuickSend(inputValue.trim());
      setInputValue('');
    }
  }, [inputValue, onQuickSend]);

  return (
    <View style={styles.mediumContainer}>
      {/* Last message preview */}
      {latestMessage ? (
        <Pressable onPress={onOpenChat} style={styles.lastMessageContainer}>
          <View style={styles.lastMessageHeader}>
            <Icon
              name={latestMessage.role === 'assistant' ? 'sparkles' : 'chat-bubble'}
              size={14}
              color={colors.primary}
            />
            <Text variant="caption" color="primary" style={styles.lastMessageRole}>
              {latestMessage.role === 'assistant' ? 'AI' : 'You'}
            </Text>
            <Text variant="caption" color="muted">
              {formatMessageTime(latestMessage.created_at)}
            </Text>
          </View>
          <Text variant="bodySmall" numberOfLines={2} color="secondary">
            {truncateText(latestMessage.content, 100)}
          </Text>
        </Pressable>
      ) : (
        <Text variant="bodySmall" color="muted" style={styles.noMessages}>
          Start a conversation with your AI assistant
        </Text>
      )}

      {/* Quick input */}
      <View style={[styles.quickInput, { borderColor: colors.border }]}>
        <TextInput
          style={[styles.quickInputText, { color: colors.text }]}
          placeholder="Ask something..."
          placeholderTextColor={colors.textMuted}
          value={inputValue}
          onChangeText={setInputValue}
          editable={!isSending}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        {isSending ? (
          <Spinner size="small" />
        ) : (
          <Pressable onPress={handleSend} disabled={!inputValue.trim()} style={styles.sendButton}>
            <Icon
              name="send"
              size={16}
              color={inputValue.trim() ? colors.primary : colors.textMuted}
            />
          </Pressable>
        )}
      </View>

      {/* Open chat link */}
      <Pressable onPress={onOpenChat} style={styles.openChatLink}>
        <Text variant="caption" color="primary">
          Open Chat
        </Text>
        <Icon name="chevron-forward" size={14} color={colors.primary} />
      </Pressable>
    </View>
  );
}

// ============================================================================
// LARGE SIZE COMPONENT
// ============================================================================

interface LargeSizeProps {
  messages: ChatMessage[];
  onOpenChat: () => void;
  onSend: (content: string) => void;
  isSending: boolean;
  isLoading: boolean;
}

function LargeSize({
  messages,
  onOpenChat,
  onSend,
  isSending,
  isLoading,
}: LargeSizeProps): React.ReactElement {
  const { colors } = useTheme();
  const [inputValue, setInputValue] = useState('');
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(() => {
    if (inputValue.trim()) {
      onSend(inputValue.trim());
      setInputValue('');
    }
  }, [inputValue, onSend]);

  const renderMessage = useCallback(
    ({ item }: ListRenderItemInfo<ChatMessage>) => <MessageItem message={item} />,
    []
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  // Get last 5 messages
  const recentMessages = messages.slice(-5);

  return (
    <View style={styles.largeContainer}>
      {/* Messages list */}
      <View style={[styles.messagesContainer, { borderColor: colors.border }]}>
        {isLoading ? (
          <View style={styles.messagesLoading}>
            <Spinner size="small" />
          </View>
        ) : recentMessages.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={recentMessages}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.messagesList}
          />
        ) : (
          <View style={styles.messagesEmpty}>
            <Icon name="chat-bubble" size={24} color={colors.textMuted} />
            <Text variant="caption" color="muted">
              Ask me anything!
            </Text>
          </View>
        )}
      </View>

      {/* Input row */}
      <View style={[styles.inputRow, { borderColor: colors.border }]}>
        <TextInput
          style={[styles.largeInput, { color: colors.text }]}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          value={inputValue}
          onChangeText={setInputValue}
          editable={!isSending}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        {isSending ? (
          <Spinner size="small" />
        ) : (
          <Pressable
            onPress={handleSend}
            disabled={!inputValue.trim()}
            style={[
              styles.sendButtonLarge,
              { backgroundColor: inputValue.trim() ? colors.primary : colors.surfaceVariant },
            ]}
          >
            <Icon name="send" size={16} color={inputValue.trim() ? '#FFFFFF' : colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* View all link */}
      <Pressable onPress={onOpenChat} style={styles.viewAllLink}>
        <Text variant="caption" color="primary">
          View full conversation
        </Text>
        <Icon name="chevron-forward" size={14} color={colors.primary} />
      </Pressable>
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * ChatWidget Component
 *
 * Displays AI chat functionality in the Hub dashboard.
 */
export function ChatWidget({ size }: ChatWidgetProps): React.ReactElement {
  const navigation = useNavigation<StackNav>();

  // Fetch conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useChatConversations();

  // Get latest conversation
  const latestConversation = conversations.length > 0 ? conversations[0] : null;
  const latestConversationId = latestConversation?.id;

  // Fetch messages for latest conversation (for medium/large sizes)
  const { data: messages = [], isLoading: messagesLoading } = useChatMessages(
    latestConversationId ?? '',
    { enabled: !!latestConversation && size !== 'small' }
  );

  // Mutations
  const createConversation = useCreateConversation();
  const sendMessage = useSendMessage();

  // Latest message for preview
  const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;

  // Navigate to full chat screen
  const handleOpenChat = useCallback(
    (conversationId?: string) => {
      navigation.navigate('Chat', conversationId ? { conversationId } : undefined);
    },
    [navigation]
  );

  // Handle sending message (creates conversation if needed)
  const handleSendMessage = useCallback(
    async (content: string) => {
      try {
        let convId = latestConversationId;

        // Create conversation if none exists
        if (!convId) {
          const newConv = await createConversation.mutateAsync({});
          convId = newConv.id;
        }

        // Send message
        await sendMessage.mutateAsync({ conversationId: convId, content });
      } catch (error) {
        console.error('[ChatWidget] Send error:', error);
      }
    },
    [latestConversationId, createConversation, sendMessage]
  );

  // Start new conversation
  const handleStartChat = useCallback(async () => {
    try {
      const newConv = await createConversation.mutateAsync({});
      handleOpenChat(newConv.id);
    } catch (error) {
      console.error('[ChatWidget] Create conversation error:', error);
      // Still navigate to chat screen
      handleOpenChat();
    }
  }, [createConversation, handleOpenChat]);

  const isLoading = conversationsLoading || (size !== 'small' && messagesLoading);
  const isSending = createConversation.isPending || sendMessage.isPending;

  // Empty state - no conversations
  if (!isLoading && conversations.length === 0 && size !== 'small') {
    return (
      <WidgetCard
        title="AI Assistant"
        icon="chat-bubble"
        size={size}
        loading={false}
        error={null}
        onExpand={() => handleOpenChat()}
      >
        <EmptyState size={size} onStart={handleStartChat} />
      </WidgetCard>
    );
  }

  // Small size
  if (size === 'small') {
    return (
      <WidgetCard
        title="Chat"
        icon="chat-bubble"
        size={size}
        loading={isLoading}
        error={null}
        onExpand={() => handleOpenChat()}
      >
        <SmallSize
          hasConversations={conversations.length > 0}
          onPress={() => handleOpenChat(latestConversationId)}
        />
      </WidgetCard>
    );
  }

  // Medium size
  if (size === 'medium') {
    return (
      <WidgetCard
        title="AI Assistant"
        icon="chat-bubble"
        size={size}
        loading={isLoading}
        error={null}
        onExpand={() => handleOpenChat(latestConversationId)}
      >
        <MediumSize
          latestMessage={latestMessage}
          onOpenChat={() => handleOpenChat(latestConversationId)}
          onQuickSend={handleSendMessage}
          isSending={isSending}
        />
      </WidgetCard>
    );
  }

  // Large size
  return (
    <WidgetCard
      title="AI Assistant"
      icon="chat-bubble"
      size={size}
      loading={isLoading}
      error={null}
      onExpand={() => handleOpenChat(latestConversationId)}
    >
      <LargeSize
        messages={messages}
        onOpenChat={() => handleOpenChat(latestConversationId)}
        onSend={handleSendMessage}
        isSending={isSending}
        isLoading={messagesLoading}
      />
    </WidgetCard>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  compactContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: -2,
    right: -6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  // Medium size
  mediumContainer: {
    minHeight: 100,
    gap: spacing.sm,
  },
  lastMessageContainer: {
    gap: spacing.xs / 2,
  },
  lastMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lastMessageRole: {
    fontWeight: '600',
    flex: 1,
  },
  noMessages: {
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  quickInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  quickInputText: {
    flex: 1,
    fontSize: fontSizes.sm,
    paddingVertical: spacing.xs,
  },
  sendButton: {
    padding: spacing.xs,
  },
  openChatLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  // Large size
  largeContainer: {
    minHeight: 180,
    gap: spacing.sm,
  },
  messagesContainer: {
    flex: 1,
    minHeight: 100,
    maxHeight: 140,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  messagesList: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  messagesLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  messageItem: {
    marginVertical: spacing.xs / 2,
  },
  messageUser: {
    alignItems: 'flex-end',
  },
  messageAssistant: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  messageTextUser: {
    color: '#FFFFFF',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  largeInput: {
    flex: 1,
    fontSize: fontSizes.sm,
    paddingVertical: spacing.xs,
  },
  sendButtonLarge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});

export default ChatWidget;
