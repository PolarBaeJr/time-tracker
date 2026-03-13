/**
 * ConversationList Component
 *
 * Displays a list of chat conversations with title, preview, and timestamp.
 * Supports swipe to delete and empty state.
 *
 * USAGE:
 * ```tsx
 * import { ConversationList } from '@/components/chat';
 *
 * <ConversationList
 *   conversations={conversations}
 *   onSelect={(conversation) => openConversation(conversation.id)}
 *   onDelete={(id) => deleteConversation(id)}
 * />
 * ```
 */

import * as React from 'react';
import { useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  type ListRenderItemInfo,
} from 'react-native';

import { Card, Text, Icon, Button, Spinner } from '@/components/ui';
import { useTheme, spacing, fontSizes, borderRadius } from '@/theme';
import type { ChatConversation } from '@/schemas';

// ============================================================================
// TYPES
// ============================================================================

/**
 * ConversationList component props
 */
export interface ConversationListProps {
  /** List of conversations to display */
  conversations: ChatConversation[];
  /** Whether data is loading */
  isLoading?: boolean;
  /** Whether to show pull-to-refresh indicator */
  isRefreshing?: boolean;
  /** Callback when a conversation is selected */
  onSelect?: (conversation: ChatConversation) => void;
  /** Callback when a conversation should be deleted */
  onDelete?: (conversationId: string) => void;
  /** Callback for pull-to-refresh */
  onRefresh?: () => void;
  /** Callback to create new conversation */
  onCreateNew?: () => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format timestamp for display
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateOnly.getTime() === today.getTime()) {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  if (dateOnly.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }

  // Within last 7 days
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  if (dateOnly >= weekAgo) {
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  }

  // Older
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

interface EmptyStateProps {
  onCreateNew?: () => void;
}

function EmptyState({ onCreateNew }: EmptyStateProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.emptyState}>
      <Icon name="chat-bubble" size={64} color={colors.textMuted} />
      <Text style={StyleSheet.flatten([styles.emptyTitle, { color: colors.text }])}>
        Start your first conversation
      </Text>
      <Text style={StyleSheet.flatten([styles.emptySubtitle, { color: colors.textSecondary }])}>
        Chat with your AI assistant to get insights about your time tracking and productivity.
      </Text>
      {onCreateNew && (
        <Button variant="primary" onPress={onCreateNew} style={styles.emptyButton}>
          New Conversation
        </Button>
      )}
    </View>
  );
}

// ============================================================================
// CONVERSATION ITEM COMPONENT
// ============================================================================

interface ConversationItemProps {
  conversation: ChatConversation;
  onPress?: () => void;
  onDelete?: () => void;
}

function ConversationItem({
  conversation,
  onPress,
  onDelete,
}: ConversationItemProps): React.ReactElement {
  const { colors } = useTheme();

  const handleDelete = useCallback(() => {
    if (Platform.OS === 'web') {
      // On web, use confirm dialog
      const confirmed = window.confirm('Delete this conversation? This action cannot be undone.');
      if (confirmed) {
        onDelete?.();
      }
    } else {
      // On mobile, use Alert
      Alert.alert(
        'Delete Conversation',
        'Are you sure you want to delete this conversation? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: onDelete },
        ]
      );
    }
  }, [onDelete]);

  return (
    <Card
      padding="md"
      elevation="sm"
      style={styles.conversationCard}
      pressable={!!onPress}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Conversation: ${conversation.title || 'Untitled'}`}
    >
      <View style={styles.conversationContent}>
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
          <Icon name="chat-bubble" size={20} color={colors.primary} />
        </View>

        {/* Content */}
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text
              style={StyleSheet.flatten([styles.conversationTitle, { color: colors.text }])}
              numberOfLines={1}
            >
              {conversation.title || 'New Conversation'}
            </Text>
            <Text style={StyleSheet.flatten([styles.timestamp, { color: colors.textMuted }])}>
              {formatTimestamp(conversation.updated_at)}
            </Text>
          </View>

          {/* Preview would go here if we had it in the data */}
          <Text
            style={StyleSheet.flatten([styles.preview, { color: colors.textSecondary }])}
            numberOfLines={1}
          >
            {conversation.title ? 'Tap to continue...' : 'Start a new chat'}
          </Text>
        </View>

        {/* Delete button */}
        {onDelete && (
          <Pressable
            style={styles.deleteButton}
            onPress={handleDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete conversation"
          >
            <Icon name="trash" size={18} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
    </Card>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ConversationList displays a list of chat conversations.
 */
export function ConversationList({
  conversations,
  isLoading = false,
  isRefreshing = false,
  onSelect,
  onDelete,
  onRefresh,
  onCreateNew,
}: ConversationListProps): React.ReactElement {
  const { colors } = useTheme();

  // Render conversation item
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ChatConversation>) => (
      <ConversationItem
        conversation={item}
        onPress={onSelect ? () => onSelect(item) : undefined}
        onDelete={onDelete ? () => onDelete(item.id) : undefined}
      />
    ),
    [onSelect, onDelete]
  );

  // Key extractor
  const keyExtractor = useCallback((item: ChatConversation) => item.id, []);

  // Loading state
  if (isLoading && conversations.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <Spinner size="large" message="Loading conversations..." />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={conversations}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          conversations.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={<EmptyState onCreateNew={onCreateNew} />}
        onRefresh={onRefresh}
        refreshing={isRefreshing}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
  listContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
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
  separator: {
    height: 0,
  },
  // Conversation Item
  conversationCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  conversationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  conversationTitle: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  timestamp: {
    fontSize: fontSizes.xs,
  },
  preview: {
    fontSize: fontSizes.sm,
  },
  deleteButton: {
    padding: spacing.sm,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: fontSizes.md,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    maxWidth: 300,
    lineHeight: fontSizes.md * 1.5,
  },
  emptyButton: {
    minWidth: 180,
  },
});

export default ConversationList;
