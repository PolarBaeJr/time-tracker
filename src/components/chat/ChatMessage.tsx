/**
 * ChatMessage Component
 *
 * Displays a single chat message with role-based styling.
 * User messages are right-aligned with primary color.
 * Assistant messages are left-aligned with surface color.
 *
 * USAGE:
 * ```tsx
 * import { ChatMessage } from '@/components/chat';
 *
 * <ChatMessage
 *   message={message}
 *   isTyping={false}
 * />
 * ```
 */

import * as React from 'react';
import { View, StyleSheet, Animated, type ViewStyle, type TextStyle } from 'react-native';

import { Text } from '@/components/ui';
import { useTheme, spacing, fontSizes, borderRadius } from '@/theme';
import type { ChatMessage as ChatMessageType } from '@/schemas';

// ============================================================================
// TYPES
// ============================================================================

/**
 * ChatMessage component props
 */
export interface ChatMessageProps {
  /** The message data */
  message: ChatMessageType;
  /** Whether to show typing indicator (for pending responses) */
  isTyping?: boolean;
  /** Additional container styles */
  style?: ViewStyle;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format timestamp for display
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  const timeString = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (isToday) {
    return timeString;
  }

  const dateString = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return `${dateString}, ${timeString}`;
}

/**
 * Simple markdown parsing for basic formatting
 * Supports: **bold**, *italic*, - lists
 */
function parseSimpleMarkdown(content: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const lines = content.split('\n');

  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) {
      elements.push(<Text key={`br-${lineIndex}`}>{'\n'}</Text>);
    }

    // Check if it's a list item
    const listMatch = line.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      elements.push(
        <Text key={`list-${lineIndex}`}>
          {'  \u2022 '}
          {parseInlineMarkdown(listMatch[1], `${lineIndex}`)}
        </Text>
      );
      return;
    }

    // Check if it's a numbered list item
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      elements.push(
        <Text key={`num-${lineIndex}`}>
          {`  ${numberedMatch[1]}. `}
          {parseInlineMarkdown(numberedMatch[2], `${lineIndex}`)}
        </Text>
      );
      return;
    }

    // Regular line
    elements.push(
      <React.Fragment key={`line-${lineIndex}`}>
        {parseInlineMarkdown(line, `${lineIndex}`)}
      </React.Fragment>
    );
  });

  return elements;
}

/**
 * Parse inline markdown (bold, italic)
 */
function parseInlineMarkdown(text: string, keyPrefix: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const remaining = text;
  let keyIndex = 0;

  // Match bold (**text**) and italic (*text*)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(remaining)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      elements.push(
        <Text key={`${keyPrefix}-text-${keyIndex++}`}>
          {remaining.slice(lastIndex, match.index)}
        </Text>
      );
    }

    // Check if bold or italic
    if (match[2]) {
      // Bold
      elements.push(
        <Text key={`${keyPrefix}-bold-${keyIndex++}`} style={{ fontWeight: '700' }}>
          {match[2]}
        </Text>
      );
    } else if (match[3]) {
      // Italic
      elements.push(
        <Text key={`${keyPrefix}-italic-${keyIndex++}`} style={{ fontStyle: 'italic' }}>
          {match[3]}
        </Text>
      );
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < remaining.length) {
    elements.push(
      <Text key={`${keyPrefix}-text-${keyIndex++}`}>{remaining.slice(lastIndex)}</Text>
    );
  }

  return elements.length > 0 ? elements : [<Text key={`${keyPrefix}-empty`}>{text}</Text>];
}

// ============================================================================
// TYPING INDICATOR COMPONENT
// ============================================================================

function TypingIndicator(): React.ReactElement {
  const { colors } = useTheme();
  const [dot1] = React.useState(new Animated.Value(0));
  const [dot2] = React.useState(new Animated.Value(0));
  const [dot3] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    const createAnimation = (value: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = createAnimation(dot1, 0);
    const anim2 = createAnimation(dot2, 150);
    const anim3 = createAnimation(dot3, 300);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
    marginHorizontal: 3,
  };

  return (
    <View style={styles.typingContainer}>
      <Animated.View
        style={[
          dotStyle,
          {
            opacity: dot1.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 1],
            }),
          },
        ]}
      />
      <Animated.View
        style={[
          dotStyle,
          {
            opacity: dot2.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 1],
            }),
          },
        ]}
      />
      <Animated.View
        style={[
          dotStyle,
          {
            opacity: dot3.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 1],
            }),
          },
        ]}
      />
    </View>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ChatMessage displays a single message with role-based styling.
 */
export function ChatMessage({
  message,
  isTyping = false,
  style,
}: ChatMessageProps): React.ReactElement {
  const { colors } = useTheme();
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Determine bubble colors and alignment
  const bubbleColor = isUser ? colors.primary : isSystem ? colors.surfaceVariant : colors.surface;
  const textColor = isUser ? '#FFFFFF' : colors.text;
  const alignment = isUser ? 'flex-end' : 'flex-start';

  return (
    <View
      style={[styles.container, { alignItems: alignment }, style]}
      accessibilityRole="text"
      accessibilityLabel={`${message.role} message: ${message.content.slice(0, 100)}`}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: bubbleColor,
            borderBottomRightRadius: isUser ? borderRadius.sm : borderRadius.lg,
            borderBottomLeftRadius: isUser ? borderRadius.lg : borderRadius.sm,
          },
          isUser && styles.userBubble,
          !isUser && { borderWidth: 1, borderColor: colors.border },
        ]}
      >
        {isTyping ? (
          <TypingIndicator />
        ) : (
          <Text
            style={StyleSheet.flatten([styles.content, { color: textColor }]) as TextStyle}
            selectable
          >
            {parseSimpleMarkdown(message.content)}
          </Text>
        )}
      </View>

      {/* Timestamp */}
      <Text
        style={
          StyleSheet.flatten([
            styles.timestamp,
            { color: colors.textMuted },
            isUser ? styles.timestampRight : styles.timestampLeft,
          ]) as TextStyle
        }
      >
        {formatTimestamp(message.created_at)}
      </Text>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
    marginHorizontal: spacing.md,
    maxWidth: '85%',
  },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  userBubble: {
    // User bubble specific styles
  },
  content: {
    fontSize: fontSizes.md,
    lineHeight: fontSizes.md * 1.5,
  },
  timestamp: {
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
  timestampLeft: {
    marginLeft: spacing.xs,
  },
  timestampRight: {
    textAlign: 'right',
    marginRight: spacing.xs,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
});

export default ChatMessage;
