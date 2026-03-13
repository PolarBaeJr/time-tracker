/**
 * ChatInput Component
 *
 * Text input with auto-resize, send button, and rate limit indicator.
 * Supports keyboard submit on Enter (web).
 *
 * USAGE:
 * ```tsx
 * import { ChatInput } from '@/components/chat';
 *
 * <ChatInput
 *   onSend={(content) => handleSend(content)}
 *   disabled={isSending}
 *   placeholder="Type your message..."
 * />
 * ```
 */

import * as React from 'react';
import { useCallback, useState, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Platform,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type TextInputContentSizeChangeEventData,
} from 'react-native';

import { Text, Icon } from '@/components/ui';
import { useTheme, spacing, fontSizes, borderRadius } from '@/theme';
import { getRemainingMessages } from '@/hooks/useChat';

// ============================================================================
// TYPES
// ============================================================================

/**
 * ChatInput component props
 */
export interface ChatInputProps {
  /** Callback when message is sent */
  onSend: (content: string) => void;
  /** Whether input is disabled (e.g., during sending) */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Whether to auto-focus the input */
  autoFocus?: boolean;
  /** Maximum height for the input (auto-resize limit) */
  maxHeight?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_HEIGHT = 44;
const DEFAULT_MAX_HEIGHT = 120;

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ChatInput provides a text input with send button for chat messages.
 */
export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
  autoFocus = false,
  maxHeight = DEFAULT_MAX_HEIGHT,
}: ChatInputProps): React.ReactElement {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);

  // State
  const [content, setContent] = useState('');
  const [inputHeight, setInputHeight] = useState(MIN_HEIGHT);
  const [isFocused, setIsFocused] = useState(false);

  // Calculate remaining messages for rate limit indicator
  const remainingMessages = getRemainingMessages();
  const isRateLimited = remainingMessages === 0;

  // Derived state
  const canSend = content.trim().length > 0 && !disabled && !isRateLimited;

  // Handle content size change for auto-resize
  const handleContentSizeChange = useCallback(
    (event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      const newHeight = Math.min(
        Math.max(event.nativeEvent.contentSize.height, MIN_HEIGHT),
        maxHeight
      );
      setInputHeight(newHeight);
    },
    [maxHeight]
  );

  // Handle send
  const handleSend = useCallback(() => {
    const trimmedContent = content.trim();
    if (!trimmedContent || disabled || isRateLimited) {
      return;
    }

    onSend(trimmedContent);
    setContent('');
    setInputHeight(MIN_HEIGHT);
  }, [content, disabled, isRateLimited, onSend]);

  // Handle key press (for web Enter to send)
  const handleKeyPress = useCallback(
    (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (Platform.OS === 'web') {
        // Check for Enter without Shift
        const nativeEvent = event.nativeEvent as unknown as KeyboardEvent;
        if (nativeEvent.key === 'Enter' && !nativeEvent.shiftKey) {
          event.preventDefault();
          handleSend();
        }
      }
    },
    [handleSend]
  );

  // Handle focus/blur
  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => setIsFocused(false), []);

  return (
    <View style={styles.wrapper}>
      {/* Rate limit warning */}
      {isRateLimited && (
        <View style={[styles.rateLimitBanner, { backgroundColor: colors.error + '20' }]}>
          <Icon name="warning" size={14} color={colors.error} />
          <Text style={{ color: colors.error, fontSize: fontSizes.xs, marginLeft: spacing.xs }}>
            Rate limit reached. Please wait before sending more messages.
          </Text>
        </View>
      )}

      {/* Rate limit indicator */}
      {!isRateLimited && remainingMessages <= 10 && (
        <View style={styles.rateLimitIndicator}>
          <Text style={{ color: colors.textMuted, fontSize: fontSizes.xs }}>
            {remainingMessages} messages remaining this minute
          </Text>
        </View>
      )}

      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.surface,
            borderColor: isFocused ? colors.primary : colors.border,
          },
        ]}
      >
        {/* Text Input */}
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            {
              color: colors.text,
              height: inputHeight,
              maxHeight,
            },
          ]}
          value={content}
          onChangeText={setContent}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          multiline
          editable={!disabled}
          onContentSizeChange={handleContentSizeChange}
          onKeyPress={handleKeyPress}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoFocus={autoFocus}
          returnKeyType="default"
          blurOnSubmit={false}
          accessibilityLabel="Message input"
          accessibilityHint="Type your message and press the send button"
          textAlignVertical="center"
        />

        {/* Send Button */}
        <Pressable
          style={[
            styles.sendButton,
            canSend
              ? { backgroundColor: colors.primary }
              : { backgroundColor: colors.surfaceVariant },
          ]}
          onPress={handleSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !canSend }}
        >
          <Icon name="send" size={18} color={canSend ? '#FFFFFF' : colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: fontSizes.md,
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
    minHeight: MIN_HEIGHT - spacing.sm * 2,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as object,
    }),
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  rateLimitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  rateLimitIndicator: {
    alignItems: 'flex-end',
    marginBottom: spacing.xs,
  },
});

export default ChatInput;
