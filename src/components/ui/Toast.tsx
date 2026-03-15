/**
 * Toast Component
 *
 * Individual toast notification with icon, message, and dismiss button.
 * Supports swipe to dismiss on mobile and keyboard dismiss on web.
 * Animates in/out using the animation foundation.
 */

import * as React from 'react';
import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import {
  Animated,
  StyleSheet,
  TouchableOpacity,
  View,
  Platform,
  PanResponder,
  type ViewStyle,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';

import { Text } from './Text';
import { Icon, type IconName } from './Icon';
import { useTheme, borderRadius, spacing, shadows } from '@/theme';
import { ANIMATION_DURATION, getReducedMotionPreference } from '@/lib/animations';
import type { ToastVariant } from '@/contexts/ToastContext';

/**
 * Props for the Toast component
 */
export interface ToastProps {
  /** Unique identifier */
  id: string;
  /** Message to display */
  message: string;
  /** Toast variant (determines color/icon) */
  variant: ToastVariant;
  /** Duration in ms before auto-dismiss (0 = no auto-dismiss) */
  duration: number;
  /** Callback when toast should be dismissed */
  onDismiss: (id: string) => void;
  /** Index in the toast stack (for stacking animation) */
  index?: number;
}

/**
 * Get icon name for toast variant
 */
function getVariantIcon(variant: ToastVariant): IconName {
  switch (variant) {
    case 'success':
      return 'check';
    case 'error':
      return 'close';
    case 'warning':
      return 'alert';
    case 'info':
    default:
      return 'alert-circle';
  }
}

/**
 * Toast Component
 *
 * Renders an individual toast notification with animation support.
 *
 * @example
 * ```tsx
 * <Toast
 *   id="toast-1"
 *   message="Operation successful!"
 *   variant="success"
 *   duration={4000}
 *   onDismiss={(id) => removeToast(id)}
 * />
 * ```
 */
export function Toast({
  id,
  message,
  variant,
  duration,
  onDismiss,
  index: _index = 0,
}: ToastProps): React.ReactElement {
  const { isDark } = useTheme();
  const shouldReduceMotion = getReducedMotionPreference();

  // Animation values - stable via useState
  const [animatedValues] = useState(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(-20),
    translateX: new Animated.Value(0),
    scale: new Animated.Value(0.9),
  }));

  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDismissingRef = useRef(false);

  // Get variant-specific colors
  const variantColors = useMemo(() => {
    const baseColors = {
      success: {
        background: isDark ? '#065F46' : '#D1FAE5',
        text: isDark ? '#A7F3D0' : '#065F46',
        icon: isDark ? '#34D399' : '#059669',
        border: isDark ? '#10B981' : '#6EE7B7',
      },
      error: {
        background: isDark ? '#7F1D1D' : '#FEE2E2',
        text: isDark ? '#FECACA' : '#7F1D1D',
        icon: isDark ? '#F87171' : '#DC2626',
        border: isDark ? '#EF4444' : '#FCA5A5',
      },
      warning: {
        background: isDark ? '#78350F' : '#FEF3C7',
        text: isDark ? '#FDE68A' : '#78350F',
        icon: isDark ? '#FBBF24' : '#D97706',
        border: isDark ? '#F59E0B' : '#FCD34D',
      },
      info: {
        background: isDark ? '#1E3A5F' : '#DBEAFE',
        text: isDark ? '#93C5FD' : '#1E3A5F',
        icon: isDark ? '#60A5FA' : '#2563EB',
        border: isDark ? '#3B82F6' : '#93C5FD',
      },
    };
    return baseColors[variant];
  }, [variant, isDark]);

  // Animate in on mount
  useEffect(() => {
    const { opacity, translateY, scale } = animatedValues;

    if (shouldReduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      scale.setValue(1);
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: ANIMATION_DURATION.fast,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: ANIMATION_DURATION.fast,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: ANIMATION_DURATION.fast,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [animatedValues, shouldReduceMotion]);

  // Dismiss with animation
  const handleDismiss = useCallback(() => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;

    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
    }

    const { opacity, translateY, scale } = animatedValues;

    if (shouldReduceMotion) {
      onDismiss(id);
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: ANIMATION_DURATION.fast,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: ANIMATION_DURATION.fast,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.9,
          duration: ANIMATION_DURATION.fast,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onDismiss(id);
      });
    }
  }, [id, onDismiss, animatedValues, shouldReduceMotion]);

  // Auto-dismiss after duration
  useEffect(() => {
    if (duration > 0) {
      dismissTimeoutRef.current = setTimeout(() => {
        handleDismiss();
      }, duration);
    }

    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, [duration, handleDismiss]);

  // Swipe to dismiss (mobile)
  const panResponder = useMemo(() => {
    const SWIPE_THRESHOLD = 50;
    const VELOCITY_THRESHOLD = 0.3;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (
        _evt: GestureResponderEvent,
        gestureState: PanResponderGestureState
      ) => {
        // Only respond to horizontal swipes
        return (
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10
        );
      },
      onPanResponderMove: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        animatedValues.translateX.setValue(gestureState.dx);
        // Fade as user swipes
        const progress = Math.min(Math.abs(gestureState.dx) / SWIPE_THRESHOLD, 1);
        animatedValues.opacity.setValue(1 - progress * 0.5);
      },
      onPanResponderRelease: (
        _evt: GestureResponderEvent,
        gestureState: PanResponderGestureState
      ) => {
        const shouldDismiss =
          Math.abs(gestureState.dx) > SWIPE_THRESHOLD ||
          Math.abs(gestureState.vx) > VELOCITY_THRESHOLD;

        if (shouldDismiss) {
          // Animate off screen
          const direction = gestureState.dx > 0 ? 1 : -1;
          Animated.parallel([
            Animated.timing(animatedValues.translateX, {
              toValue: direction * 300,
              duration: ANIMATION_DURATION.fast,
              useNativeDriver: true,
            }),
            Animated.timing(animatedValues.opacity, {
              toValue: 0,
              duration: ANIMATION_DURATION.fast,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onDismiss(id);
          });
        } else {
          // Snap back
          Animated.parallel([
            Animated.spring(animatedValues.translateX, {
              toValue: 0,
              useNativeDriver: true,
              friction: 8,
            }),
            Animated.spring(animatedValues.opacity, {
              toValue: 1,
              useNativeDriver: true,
              friction: 8,
            }),
          ]).start();
        }
      },
    });
  }, [animatedValues, id, onDismiss]);

  const animatedStyle: Animated.WithAnimatedObject<ViewStyle> = {
    opacity: animatedValues.opacity,
    transform: [
      { translateY: animatedValues.translateY },
      { translateX: animatedValues.translateX },
      { scale: animatedValues.scale },
    ],
  };

  const containerStyle: ViewStyle = {
    backgroundColor: variantColors.background,
    borderColor: variantColors.border,
    borderWidth: 1,
    ...shadows.md,
  };

  return (
    <Animated.View
      style={[styles.container, containerStyle, animatedStyle]}
      {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.iconContainer}>
        <Icon name={getVariantIcon(variant)} size={20} color={variantColors.icon} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.message, { color: variantColors.text }]} numberOfLines={2}>
          {message}
        </Text>
      </View>

      <TouchableOpacity
        onPress={handleDismiss}
        style={styles.dismissButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
      >
        <Icon name="close" size={16} color={variantColors.text} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    maxWidth: 400,
    minWidth: 280,
    alignSelf: 'center',
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  content: {
    flex: 1,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  dismissButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
});

export default Toast;
