/**
 * ChatScreen
 *
 * Main screen for AI assistant chat with two modes:
 * - Conversation list (default): Shows all conversations
 * - Active conversation: Shows chat window for selected conversation
 *
 * Features:
 * - Create new conversations
 * - Continue existing conversations
 * - Delete conversations
 * - Clear conversation history
 * - Error handling for AI configuration, network, and rate limiting
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, Icon, Spinner } from '@/components/ui';
import { ConversationList, ChatWindow } from '@/components/chat';
import {
  useChatConversations,
  useCreateConversation,
  useDeleteConversation,
  useClearConversationHistory,
  ChatError,
} from '@/hooks/useChat';
import { useTheme, spacing, fontSizes, borderRadius } from '@/theme';
import type { ChatConversation } from '@/schemas';
import type { RouteProp } from '@react-navigation/native';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Navigation route params for the chat screen
 */
interface ChatScreenRouteParams {
  conversationId?: string;
}

export interface ChatScreenProps {
  route?: RouteProp<{ Chat: ChatScreenRouteParams }, 'Chat'>;
}

/**
 * Screen mode
 */
type ScreenMode = 'list' | 'conversation';

// ============================================================================
// FAB COMPONENT
// ============================================================================

interface FABProps {
  onPress: () => void;
  label?: string;
  disabled?: boolean;
}

function FAB({ onPress, label, disabled }: FABProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <Pressable
      style={[styles.fab, { backgroundColor: disabled ? colors.surfaceVariant : colors.primary }]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label ?? 'New conversation'}
      accessibilityState={{ disabled }}
    >
      <Icon name="plus" size={24} color={disabled ? colors.textMuted : '#FFFFFF'} />
    </Pressable>
  );
}

// ============================================================================
// HEADER COMPONENT
// ============================================================================

interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  showOptions?: boolean;
  onOptions?: () => void;
}

function Header({
  title,
  showBack,
  onBack,
  showOptions,
  onOptions,
}: HeaderProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      {showBack ? (
        <Pressable
          style={styles.headerButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back to conversation list"
        >
          <Icon name="arrow-back" size={24} color={colors.text} />
        </Pressable>
      ) : (
        <View style={styles.headerSpacer} />
      )}

      <Text variant="heading" style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>

      {showOptions ? (
        <Pressable
          style={styles.headerButton}
          onPress={onOptions}
          accessibilityRole="button"
          accessibilityLabel="Conversation options"
        >
          <Icon name="more-vertical" size={24} color={colors.text} />
        </Pressable>
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );
}

// ============================================================================
// CONVERSATION LIST MODE
// ============================================================================

interface ConversationListModeProps {
  conversations: ChatConversation[];
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onSelectConversation: (conversation: ChatConversation) => void;
  onDeleteConversation: (conversationId: string) => void;
  onCreateNew: () => void;
}

function ConversationListMode({
  conversations,
  isLoading,
  isRefreshing,
  onRefresh,
  onSelectConversation,
  onDeleteConversation,
  onCreateNew,
}: ConversationListModeProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={[styles.content, { backgroundColor: colors.background }]}>
      <ConversationList
        conversations={conversations}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        onSelect={onSelectConversation}
        onDelete={onDeleteConversation}
        onRefresh={onRefresh}
        onCreateNew={onCreateNew}
      />
      <FAB onPress={onCreateNew} label="Start new conversation" />
    </View>
  );
}

// ============================================================================
// ACTIVE CONVERSATION MODE
// ============================================================================

interface ActiveConversationModeProps {
  conversationId: string;
  conversation: ChatConversation | null;
}

function ActiveConversationMode({
  conversationId,
  conversation,
}: ActiveConversationModeProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={[styles.content, { backgroundColor: colors.background }]}>
      <ChatWindow conversationId={conversationId} conversation={conversation} showHeader={false} />
    </View>
  );
}

// ============================================================================
// OPTIONS MENU
// ============================================================================

interface OptionsMenuProps {
  visible: boolean;
  onClose: () => void;
  onClearHistory: () => void;
  onDeleteConversation: () => void;
  isClearing: boolean;
  isDeleting: boolean;
}

function OptionsMenu({
  visible,
  onClose,
  onClearHistory,
  onDeleteConversation,
  isClearing,
  isDeleting,
}: OptionsMenuProps): React.ReactElement | null {
  const { colors } = useTheme();

  if (!visible) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <Pressable
        style={styles.menuBackdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close menu"
      />

      {/* Menu */}
      <View style={[styles.menuContainer, { backgroundColor: colors.surface }]}>
        <Pressable
          style={[styles.menuItem, { borderBottomColor: colors.border }]}
          onPress={onClearHistory}
          disabled={isClearing}
          accessibilityRole="button"
          accessibilityLabel="Clear conversation history"
        >
          {isClearing ? (
            <Spinner size="small" />
          ) : (
            <Icon name="trash" size={18} color={colors.text} />
          )}
          <Text style={[styles.menuItemText, { color: colors.text }]}>Clear History</Text>
        </Pressable>

        <Pressable
          style={styles.menuItem}
          onPress={onDeleteConversation}
          disabled={isDeleting}
          accessibilityRole="button"
          accessibilityLabel="Delete conversation"
        >
          {isDeleting ? (
            <Spinner size="small" />
          ) : (
            <Icon name="trash" size={18} color={colors.error} />
          )}
          <Text style={[styles.menuItemText, { color: colors.error }]}>Delete Conversation</Text>
        </Pressable>
      </View>
    </>
  );
}

// ============================================================================
// MAIN SCREEN COMPONENT
// ============================================================================

/**
 * ChatScreen component for AI assistant conversations
 */
export function ChatScreen({ route }: ChatScreenProps): React.ReactElement {
  const { colors } = useTheme();

  // Get initial conversation ID from route params
  const initialConversationId = route?.params?.conversationId;

  // State
  const [mode, setMode] = useState<ScreenMode>(initialConversationId ? 'conversation' : 'list');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversationId ?? null
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  // Fetch conversations
  const { data: conversations = [], isLoading, refetch } = useChatConversations();

  // Find active conversation
  const activeConversation = activeConversationId
    ? (conversations.find(c => c.id === activeConversationId) ?? null)
    : null;

  // Mutations
  const createConversation = useCreateConversation({
    onSuccess: conversation => {
      setActiveConversationId(conversation.id);
      setMode('conversation');
    },
    onError: error => {
      showError('Failed to create conversation', error);
    },
  });

  const deleteConversation = useDeleteConversation({
    onSuccess: () => {
      // If deleting active conversation, go back to list
      setMode('list');
      setActiveConversationId(null);
      setShowOptionsMenu(false);
    },
    onError: error => {
      showError('Failed to delete conversation', error);
    },
  });

  const clearHistory = useClearConversationHistory({
    onSuccess: () => {
      setShowOptionsMenu(false);
    },
    onError: error => {
      showError('Failed to clear history', error);
    },
  });

  // Helper to show errors
  const showError = useCallback((title: string, error: ChatError) => {
    const message = error.message || 'An unexpected error occurred';
    if (Platform.OS === 'web') {
      alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  // Handle conversation selection
  const handleSelectConversation = useCallback((conversation: ChatConversation) => {
    setActiveConversationId(conversation.id);
    setMode('conversation');
  }, []);

  // Handle back to list
  const handleBack = useCallback(() => {
    setMode('list');
    setActiveConversationId(null);
    setShowOptionsMenu(false);
  }, []);

  // Handle create new conversation
  const handleCreateNew = useCallback(() => {
    createConversation.mutate({});
  }, [createConversation]);

  // Handle delete conversation from list
  const handleDeleteFromList = useCallback(
    (conversationId: string) => {
      const confirmDelete = () => {
        deleteConversation.mutate(conversationId);
      };

      if (Platform.OS === 'web') {
        if (confirm('Delete this conversation? This action cannot be undone.')) {
          confirmDelete();
        }
      } else {
        Alert.alert(
          'Delete Conversation',
          'Are you sure you want to delete this conversation? This action cannot be undone.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: confirmDelete },
          ]
        );
      }
    },
    [deleteConversation]
  );

  // Handle delete active conversation
  const handleDeleteActive = useCallback(() => {
    if (!activeConversationId) return;

    const confirmDelete = () => {
      deleteConversation.mutate(activeConversationId);
    };

    if (Platform.OS === 'web') {
      if (confirm('Delete this conversation? This action cannot be undone.')) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        'Delete Conversation',
        'Are you sure you want to delete this conversation? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: confirmDelete },
        ]
      );
    }
  }, [activeConversationId, deleteConversation]);

  // Handle clear history
  const handleClearHistory = useCallback(() => {
    if (!activeConversationId) return;

    const confirmClear = () => {
      clearHistory.mutate(activeConversationId);
    };

    if (Platform.OS === 'web') {
      if (confirm('Clear all messages in this conversation? This action cannot be undone.')) {
        confirmClear();
      }
    } else {
      Alert.alert(
        'Clear History',
        'Clear all messages in this conversation? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear', style: 'destructive', onPress: confirmClear },
        ]
      );
    }
  }, [activeConversationId, clearHistory]);

  // Toggle options menu
  const handleToggleOptions = useCallback(() => {
    setShowOptionsMenu(prev => !prev);
  }, []);

  // Close options menu
  const handleCloseOptions = useCallback(() => {
    setShowOptionsMenu(false);
  }, []);

  // Update mode if route params change
  useEffect(() => {
    if (initialConversationId && initialConversationId !== activeConversationId) {
      setActiveConversationId(initialConversationId);
      setMode('conversation');
    }
  }, [initialConversationId, activeConversationId]);

  // Determine header title
  const headerTitle =
    mode === 'list' ? 'AI Assistant' : (activeConversation?.title ?? 'New Conversation');

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      {/* Header */}
      <Header
        title={headerTitle}
        showBack={mode === 'conversation'}
        onBack={handleBack}
        showOptions={mode === 'conversation' && !!activeConversationId}
        onOptions={handleToggleOptions}
      />

      {/* Content */}
      {mode === 'list' ? (
        <ConversationListMode
          conversations={conversations}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteFromList}
          onCreateNew={handleCreateNew}
        />
      ) : activeConversationId ? (
        <ActiveConversationMode
          conversationId={activeConversationId}
          conversation={activeConversation}
        />
      ) : (
        <View style={styles.loadingContainer}>
          <Spinner size="large" message="Creating conversation..." />
        </View>
      )}

      {/* Options Menu */}
      <OptionsMenu
        visible={showOptionsMenu}
        onClose={handleCloseOptions}
        onClearHistory={handleClearHistory}
        onDeleteConversation={handleDeleteActive}
        isClearing={clearHistory.isPending}
        isDeleting={deleteConversation.isPending}
      />
    </SafeAreaView>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSizes.lg,
  },
  headerButton: {
    padding: spacing.sm,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.xxl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  // Options Menu
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  menuContainer: {
    position: 'absolute',
    top: 60,
    right: spacing.md,
    minWidth: 180,
    borderRadius: borderRadius.md,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
  },
  menuItemText: {
    marginLeft: spacing.sm,
    fontSize: fontSizes.md,
  },
});

export default ChatScreen;
