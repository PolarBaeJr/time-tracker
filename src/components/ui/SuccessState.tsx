/**
 * SuccessState Component
 *
 * A success state display with animated checkmark, title, message,
 * optional confetti burst, and auto-dismiss functionality.
 *
 * Features:
 * - Animated checkmark that draws in (circle then checkmark stroke)
 * - Optional confetti celebration effect
 * - Auto-dismiss after configurable delay
 * - Theme success colors
 * - Respects reduced motion settings
 */

import * as React from 'react';
import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { Button } from './Button';
import { useConfettiSafe } from './Confetti';
import { useTheme, spacing } from '@/theme';
import { ANIMATION_DURATION, getReducedMotionPreference } from '@/lib/animations';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for the SuccessState component
 */
export interface SuccessStateProps {
  /** Title to display (e.g., "Success!") */
  title?: string;
  /** Message to display below the title */
  message?: string;
  /** Callback when the state is dismissed */
  onDismiss?: () => void;
  /** Whether to show confetti animation (default: false) */
  showConfetti?: boolean;
  /** Auto-dismiss delay in ms (0 = no auto-dismiss, default: 0) */
  autoDismissDelay?: number;
  /** Label for the dismiss button (default: "Continue") */
  dismissLabel?: string;
  /** Whether to show the dismiss button (default: true) */
  showDismissButton?: boolean;
  /** Custom checkmark size (default: 80) */
  checkmarkSize?: number;
  /** Test ID for testing */
  testID?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CHECKMARK_SIZE = 80;
const CIRCLE_ANIMATION_DURATION = 400;
const CHECKMARK_ANIMATION_DURATION = 300;
const SCALE_ANIMATION_DURATION = 200;
const CONFETTI_DELAY = 300;

// ============================================================================
// ANIMATED CHECKMARK COMPONENT
// ============================================================================

interface AnimatedCheckmarkProps {
  size: number;
  color: string;
  backgroundColor: string;
  onComplete?: () => void;
}

/**
 * AnimatedCheckmark renders an animated checkmark with circle
 * The circle draws in first, then the checkmark stroke appears
 */
function AnimatedCheckmark({
  size,
  color,
  backgroundColor,
  onComplete,
}: AnimatedCheckmarkProps): React.ReactElement {
  const shouldReduceMotion = getReducedMotionPreference();

  // Animation values - stable via useState
  const [animatedValues] = useState(() => ({
    circleScale: new Animated.Value(0),
    circleOpacity: new Animated.Value(0),
    checkmarkOpacity: new Animated.Value(0),
    checkmarkScale: new Animated.Value(0.5),
    bounceScale: new Animated.Value(1),
  }));

  useEffect(() => {
    const { circleScale, circleOpacity, checkmarkOpacity, checkmarkScale, bounceScale } =
      animatedValues;

    if (shouldReduceMotion) {
      // Instant appearance for reduced motion
      circleScale.setValue(1);
      circleOpacity.setValue(1);
      checkmarkOpacity.setValue(1);
      checkmarkScale.setValue(1);
      bounceScale.setValue(1);
      onComplete?.();
      return;
    }

    // Animation sequence: circle scales in -> checkmark appears -> bounce
    const circleAnimation = Animated.parallel([
      Animated.timing(circleScale, {
        toValue: 1,
        duration: CIRCLE_ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(circleOpacity, {
        toValue: 1,
        duration: CIRCLE_ANIMATION_DURATION * 0.5,
        useNativeDriver: true,
      }),
    ]);

    const checkmarkAnimation = Animated.parallel([
      Animated.timing(checkmarkOpacity, {
        toValue: 1,
        duration: CHECKMARK_ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.spring(checkmarkScale, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
    ]);

    const bounceAnimation = Animated.sequence([
      Animated.timing(bounceScale, {
        toValue: 1.1,
        duration: SCALE_ANIMATION_DURATION / 2,
        useNativeDriver: true,
      }),
      Animated.spring(bounceScale, {
        toValue: 1,
        friction: 3,
        tension: 100,
        useNativeDriver: true,
      }),
    ]);

    Animated.sequence([circleAnimation, checkmarkAnimation, bounceAnimation]).start(
      ({ finished }) => {
        if (finished) {
          onComplete?.();
        }
      }
    );
  }, [animatedValues, shouldReduceMotion, onComplete]);

  const { circleScale, circleOpacity, checkmarkOpacity, checkmarkScale, bounceScale } =
    animatedValues;

  const checkmarkFontSize = size * 0.5;

  return (
    <Animated.View
      style={[
        styles.checkmarkContainer,
        {
          width: size,
          height: size,
          transform: [{ scale: bounceScale }],
        },
      ]}
    >
      {/* Circle background */}
      <Animated.View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor,
            opacity: circleOpacity,
            transform: [{ scale: circleScale }],
          },
        ]}
      />

      {/* Checkmark */}
      <Animated.View
        style={[
          styles.checkmarkWrapper,
          {
            opacity: checkmarkOpacity,
            transform: [{ scale: checkmarkScale }],
          },
        ]}
      >
        <Text
          style={[
            styles.checkmarkText,
            {
              fontSize: checkmarkFontSize,
              color,
            },
          ]}
        >
          {'\u2713'}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

// ============================================================================
// SUCCESS STATE COMPONENT
// ============================================================================

/**
 * SuccessState Component
 *
 * Displays a success state with animated checkmark, title, message,
 * optional confetti, and dismiss functionality.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <SuccessState
 *   title="Success!"
 *   message="Your changes have been saved."
 *   onDismiss={() => navigation.goBack()}
 * />
 *
 * // With confetti and auto-dismiss
 * <SuccessState
 *   title="Achievement Unlocked!"
 *   message="You've completed your first goal."
 *   showConfetti
 *   autoDismissDelay={3000}
 *   onDismiss={handleClose}
 * />
 * ```
 */
export function SuccessState({
  title = 'Success!',
  message,
  onDismiss,
  showConfetti = false,
  autoDismissDelay = 0,
  dismissLabel = 'Continue',
  showDismissButton = true,
  checkmarkSize = DEFAULT_CHECKMARK_SIZE,
  testID,
}: SuccessStateProps): React.ReactElement {
  const { colors, isDark } = useTheme();
  const shouldReduceMotion = getReducedMotionPreference();

  // Use safe version of confetti hook (returns null if not in provider)
  const confetti = useConfettiSafe();

  // Animation values for fade in
  const [fadeValues] = useState(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(20),
  }));

  const autoDismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiFiredRef = useRef(false);

  // Success colors
  const successColors = useMemo(
    () => ({
      background: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
      circleBackground: colors.success,
      checkmark: isDark ? '#FFFFFF' : '#FFFFFF',
      title: colors.text,
      message: colors.textSecondary,
    }),
    [colors, isDark]
  );

  // Fade in animation on mount
  useEffect(() => {
    const { opacity, translateY } = fadeValues;

    if (shouldReduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: ANIMATION_DURATION.normal,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: ANIMATION_DURATION.normal,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [fadeValues, shouldReduceMotion]);

  // Handle checkmark animation complete
  const handleCheckmarkComplete = useCallback(() => {
    // Fire confetti after checkmark animation
    if (showConfetti && confetti && !confettiFiredRef.current) {
      confettiFiredRef.current = true;

      if (shouldReduceMotion) {
        // No confetti for reduced motion
      } else {
        setTimeout(() => {
          confetti?.fire();
        }, CONFETTI_DELAY);
      }
    }
  }, [showConfetti, confetti, shouldReduceMotion]);

  // Auto-dismiss
  useEffect(() => {
    if (autoDismissDelay > 0 && onDismiss) {
      autoDismissTimeoutRef.current = setTimeout(() => {
        onDismiss();
      }, autoDismissDelay);
    }

    return () => {
      if (autoDismissTimeoutRef.current) {
        clearTimeout(autoDismissTimeoutRef.current);
      }
    };
  }, [autoDismissDelay, onDismiss]);

  const handleDismiss = useCallback(() => {
    if (autoDismissTimeoutRef.current) {
      clearTimeout(autoDismissTimeoutRef.current);
    }
    onDismiss?.();
  }, [onDismiss]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeValues.opacity,
          transform: [{ translateY: fadeValues.translateY }],
        },
      ]}
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.content}>
        {/* Animated Checkmark */}
        <View style={styles.checkmarkSection}>
          <AnimatedCheckmark
            size={checkmarkSize}
            color={successColors.checkmark}
            backgroundColor={successColors.circleBackground}
            onComplete={handleCheckmarkComplete}
          />
        </View>

        {/* Title */}
        {title && (
          <Text
            variant="heading"
            style={[styles.title, { color: successColors.title }]}
            accessibilityRole="header"
          >
            {title}
          </Text>
        )}

        {/* Message */}
        {message && (
          <Text style={[styles.message, { color: successColors.message }]}>{message}</Text>
        )}

        {/* Dismiss Button */}
        {showDismissButton && onDismiss && (
          <View style={styles.buttonContainer}>
            <Button variant="primary" onPress={handleDismiss} accessibilityLabel={dismissLabel}>
              {dismissLabel}
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
  checkmarkSection: {
    marginBottom: spacing.lg,
  },
  checkmarkContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
  },
  checkmarkWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    fontWeight: '700',
    textAlign: 'center',
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

export default SuccessState;
