/**
 * ConnectionIndicator Component
 *
 * Displays real-time connection status with animated visual feedback.
 * Features:
 * - Pulsing animation on the connection dot (when connected)
 * - Smooth color transitions between states
 * - Small spinner when reconnecting
 * - Respects reduced motion preferences
 */

import * as React from 'react';
import { View, StyleSheet, Animated, ActivityIndicator, type ViewStyle } from 'react-native';
import { useEffect, useRef, useCallback, useState } from 'react';
import { Text } from '@/components/ui';
import { useTheme, spacing } from '@/theme';
import { pulse, getReducedMotionPreference, ANIMATION_DURATION } from '@/lib/animations';

/**
 * Connection status type
 */
export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

/**
 * Props for ConnectionIndicator component
 */
export interface ConnectionIndicatorProps {
  /** Current connection status */
  status: ConnectionStatus;
  /** Optional additional styles */
  style?: ViewStyle;
}

// Create inline style for glow effect to avoid inline-styles warning
const glowOpacityStyle = { opacity: 0.3 };

/**
 * Connection status indicator with animations
 */
export function ConnectionIndicator({
  status,
  style,
}: ConnectionIndicatorProps): React.ReactElement {
  const { colors } = useTheme();

  // Animation values - use useState with lazy initializer for React Compiler compatibility
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const [opacityAnim] = useState(() => new Animated.Value(1));

  // Track current animation for cleanup
  const currentPulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const currentFadeRef = useRef<Animated.CompositeAnimation | null>(null);

  // Status colors mapping
  const statusColors = {
    connected: colors.success,
    reconnecting: colors.warning,
    disconnected: colors.error,
  };

  // Status labels mapping
  const statusLabels = {
    connected: 'Connected',
    reconnecting: 'Reconnecting...',
    disconnected: 'Offline',
  };

  // Should we animate?
  const shouldAnimate = !getReducedMotionPreference();

  // Start pulse animation for connected state
  const startPulse = useCallback(() => {
    if (!shouldAnimate) return;

    // Stop any existing pulse
    const currentPulse = currentPulseRef.current;
    if (currentPulse) {
      currentPulse.stop();
    }

    // Reset to 1
    pulseAnim.setValue(1);

    // Create looping pulse animation
    const pulseAnimation = pulse(pulseAnim, {
      duration: 2000, // Slow, subtle pulse
      minScale: 1,
      maxScale: 1.3,
      iterations: -1, // Infinite loop
    });

    currentPulseRef.current = pulseAnimation;
    pulseAnimation.start();
  }, [pulseAnim, shouldAnimate]);

  // Stop pulse animation
  const stopPulse = useCallback(() => {
    const currentPulse = currentPulseRef.current;
    if (currentPulse) {
      currentPulse.stop();
      currentPulseRef.current = null;
    }
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  // Animate opacity for state transitions
  const animateTransition = useCallback(() => {
    if (!shouldAnimate) return;

    // Stop any existing transition
    const currentFade = currentFadeRef.current;
    if (currentFade) {
      currentFade.stop();
    }

    // Quick fade out then fade in
    const transitionAnimation = Animated.sequence([
      Animated.timing(opacityAnim, {
        toValue: 0.5,
        duration: ANIMATION_DURATION.fast,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: ANIMATION_DURATION.fast,
        useNativeDriver: true,
      }),
    ]);

    currentFadeRef.current = transitionAnimation;
    transitionAnimation.start();
  }, [opacityAnim, shouldAnimate]);

  // Handle status changes
  useEffect(() => {
    // Animate the transition between states
    animateTransition();

    if (status === 'connected') {
      // Start pulsing when connected
      startPulse();
    } else {
      // Stop pulsing for other states
      stopPulse();
    }

    // Cleanup on unmount or status change
    return () => {
      const pulseAnimation = currentPulseRef.current;
      if (pulseAnimation) {
        pulseAnimation.stop();
      }
      const fadeAnimation = currentFadeRef.current;
      if (fadeAnimation) {
        fadeAnimation.stop();
      }
    };
  }, [status, startPulse, stopPulse, animateTransition]);

  // Get current color based on status
  const currentColor = statusColors[status];

  return (
    <Animated.View
      style={[styles.container, { opacity: opacityAnim }, style]}
      accessibilityRole="text"
      accessibilityLabel={`Connection status: ${statusLabels[status]}`}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.dotContainer}>
        {/* Pulsing glow effect (only when connected) */}
        {status === 'connected' && shouldAnimate && (
          <Animated.View
            style={[
              styles.dotGlow,
              {
                backgroundColor: currentColor,
                transform: [{ scale: pulseAnim }],
              },
              glowOpacityStyle,
            ]}
          />
        )}

        {/* Main dot or spinner */}
        {status === 'reconnecting' ? (
          <ActivityIndicator size={10} color={currentColor} style={styles.spinner} />
        ) : (
          <View style={[styles.dot, { backgroundColor: currentColor }]} />
        )}
      </View>

      <Text variant="caption" color="muted">
        {statusLabels[status]}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dotContainer: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotGlow: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  spinner: {
    transform: [{ scale: 0.8 }],
  },
});

export default ConnectionIndicator;
