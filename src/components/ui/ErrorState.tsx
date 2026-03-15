/**
 * ErrorState Component
 *
 * An error state display with animated shake, title, message,
 * optional illustration, and retry button with loading state.
 *
 * Features:
 * - Subtle shake animation on mount (3 shakes)
 * - Retry button with loading state
 * - Theme error colors
 * - Respects reduced motion settings
 * - Accessible with proper ARIA roles
 */

import * as React from 'react';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { useTheme, spacing } from '@/theme';
import {
  ANIMATION_DURATION,
  ANIMATION_PRESETS,
  getReducedMotionPreference,
  shake,
  fadeIn,
} from '@/lib/animations';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for the ErrorState component
 */
export interface ErrorStateProps {
  /** Title to display (e.g., "Something went wrong") */
  title?: string;
  /** Message to display below the title */
  message?: string;
  /** Callback when retry button is pressed */
  onRetry?: () => void | Promise<void>;
  /** Whether the retry operation is in progress */
  isRetrying?: boolean;
  /** Optional icon name for the illustration (default: "alert-circle") */
  icon?: IconName;
  /** Optional custom icon size (default: 64) */
  iconSize?: number;
  /** Label for the retry button (default: "Try Again") */
  retryLabel?: string;
  /** Whether to show the retry button (default: true if onRetry is provided) */
  showRetryButton?: boolean;
  /** Test ID for testing */
  testID?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_ICON_SIZE = 64;
const SHAKE_DELAY = 200; // Delay before shake starts (after fade in)

// ============================================================================
// ERROR STATE COMPONENT
// ============================================================================

/**
 * ErrorState Component
 *
 * Displays an error state with animated icon, title, message,
 * and optional retry button with loading state.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ErrorState
 *   title="Something went wrong"
 *   message="We couldn't load your data. Please try again."
 *   onRetry={handleRetry}
 * />
 *
 * // With loading state
 * <ErrorState
 *   title="Connection Error"
 *   message="Unable to connect to the server."
 *   onRetry={handleRetry}
 *   isRetrying={isLoading}
 * />
 *
 * // Custom icon
 * <ErrorState
 *   title="No Internet"
 *   message="Check your connection and try again."
 *   icon="wifi-off"
 *   onRetry={handleRetry}
 * />
 * ```
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  isRetrying = false,
  icon = 'alert-circle',
  iconSize = DEFAULT_ICON_SIZE,
  retryLabel = 'Try Again',
  showRetryButton,
  testID,
}: ErrorStateProps): React.ReactElement {
  const { colors, isDark } = useTheme();
  const shouldReduceMotion = getReducedMotionPreference();

  // Animation values - stable via useState with lazy initializer
  const [animatedValues] = useState(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(20),
    shakeX: new Animated.Value(0),
  }));

  // Error colors
  const errorColors = useMemo(
    () => ({
      iconBackground: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
      icon: colors.error,
      title: colors.text,
      message: colors.textSecondary,
    }),
    [colors, isDark]
  );

  // Determine if retry button should be shown
  const shouldShowRetryButton = showRetryButton ?? !!onRetry;

  // Fade in and shake animation on mount
  useEffect(() => {
    const { opacity, translateY, shakeX } = animatedValues;

    if (shouldReduceMotion) {
      // Instant appearance for reduced motion
      opacity.setValue(1);
      translateY.setValue(0);
      shakeX.setValue(0);
      return;
    }

    // Fade in first
    const fadeInAnimation = Animated.parallel([
      fadeIn(opacity, { duration: ANIMATION_DURATION.normal }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: ANIMATION_DURATION.normal,
        useNativeDriver: true,
      }),
    ]);

    // Then shake
    fadeInAnimation.start(({ finished }) => {
      if (finished) {
        // Small delay before shake for better UX
        setTimeout(() => {
          shake(shakeX, {
            intensity: ANIMATION_PRESETS.error.intensity,
            shakes: ANIMATION_PRESETS.error.shakes,
            duration: ANIMATION_PRESETS.error.duration,
          }).start();
        }, SHAKE_DELAY);
      }
    });

    return () => {
      // Cleanup
      fadeInAnimation.stop();
    };
  }, [animatedValues, shouldReduceMotion]);

  // Handle retry with potential async operation
  const handleRetry = useCallback(async () => {
    if (onRetry) {
      await onRetry();
    }
  }, [onRetry]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: animatedValues.opacity,
          transform: [
            { translateY: animatedValues.translateY },
            { translateX: animatedValues.shakeX },
          ],
        },
      ]}
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <View style={styles.content}>
        {/* Icon Section */}
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: errorColors.iconBackground,
              width: iconSize + spacing.lg * 2,
              height: iconSize + spacing.lg * 2,
              borderRadius: (iconSize + spacing.lg * 2) / 2,
            },
          ]}
        >
          <Icon name={icon} size={iconSize} color={errorColors.icon} />
        </View>

        {/* Title */}
        {title && (
          <Text
            variant="heading"
            style={[styles.title, { color: errorColors.title }]}
            accessibilityRole="header"
          >
            {title}
          </Text>
        )}

        {/* Message */}
        {message && <Text style={[styles.message, { color: errorColors.message }]}>{message}</Text>}

        {/* Retry Button */}
        {shouldShowRetryButton && onRetry && (
          <View style={styles.buttonContainer}>
            <Button
              variant="primary"
              onPress={handleRetry}
              loading={isRetrying}
              disabled={isRetrying}
              accessibilityLabel={isRetrying ? 'Retrying...' : retryLabel}
            >
              {retryLabel}
            </Button>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  buttonContainer: {
    marginTop: spacing.md,
    minWidth: 150,
  },
});

export default ErrorState;
