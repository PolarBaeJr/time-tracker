/**
 * Skeleton Component
 *
 * Loading placeholder with shimmer animation effect.
 * Supports text, circle, and rectangle variants.
 * Respects reduced motion preferences.
 */

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';

import { useTheme, borderRadius as themeBorderRadius } from '@/theme';
import { getReducedMotionPreference } from '@/lib/animations';

/**
 * Skeleton variant types
 */
export type SkeletonVariant = 'text' | 'circle' | 'rectangle';

/**
 * Props for the Skeleton component
 */
export interface SkeletonProps {
  /** Skeleton variant (default: 'rectangle') */
  variant?: SkeletonVariant;
  /** Width of the skeleton (default: '100%' for text/rectangle, required for circle) */
  width?: number | string;
  /** Height of the skeleton (default: 16 for text, required for circle/rectangle) */
  height?: number | string;
  /** Border radius (default: based on variant) */
  borderRadius?: number;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Shimmer animation duration
 */
const SHIMMER_DURATION = 1500;

/**
 * Get default dimensions for each variant
 */
function getDefaultDimensions(variant: SkeletonVariant): {
  width: number | string;
  height: number | string;
  borderRadius: number;
} {
  switch (variant) {
    case 'text':
      return {
        width: '100%',
        height: 16,
        borderRadius: themeBorderRadius.sm,
      };
    case 'circle':
      return {
        width: 40,
        height: 40,
        borderRadius: 20,
      };
    case 'rectangle':
    default:
      return {
        width: '100%',
        height: 100,
        borderRadius: themeBorderRadius.md,
      };
  }
}

/**
 * Skeleton Component
 *
 * Renders a loading placeholder with shimmer animation.
 *
 * @example
 * ```tsx
 * // Text skeleton
 * <Skeleton variant="text" width="80%" />
 *
 * // Circle skeleton (avatar)
 * <Skeleton variant="circle" width={48} height={48} />
 *
 * // Rectangle skeleton (card)
 * <Skeleton variant="rectangle" width="100%" height={120} />
 * ```
 */
export function Skeleton({
  variant = 'rectangle',
  width,
  height,
  borderRadius,
  style,
  testID,
}: SkeletonProps): React.ReactElement {
  const { colors } = useTheme();
  const shouldReduceMotion = getReducedMotionPreference();

  // Animation value for shimmer effect - use useState for React Compiler compatibility
  const [shimmerValue] = useState(() => new Animated.Value(0));

  // Get default dimensions based on variant
  const defaults = useMemo(() => getDefaultDimensions(variant), [variant]);

  // Resolved dimensions
  const resolvedWidth = width ?? defaults.width;
  const resolvedHeight = height ?? defaults.height;
  const resolvedBorderRadius =
    borderRadius ??
    (variant === 'circle'
      ? typeof resolvedWidth === 'number'
        ? resolvedWidth / 2
        : defaults.borderRadius
      : defaults.borderRadius);

  // Interpolate shimmer position - memoized to avoid recalculation
  const shimmerTranslateX = useMemo(
    () =>
      shimmerValue.interpolate({
        inputRange: [0, 1],
        outputRange: [-200, 200],
      }),
    [shimmerValue]
  );

  // Start shimmer animation
  useEffect(() => {
    if (shouldReduceMotion) {
      // No animation for reduced motion
      return;
    }

    const shimmerAnimation = Animated.loop(
      Animated.timing(shimmerValue, {
        toValue: 1,
        duration: SHIMMER_DURATION,
        useNativeDriver: true,
      })
    );

    shimmerAnimation.start();

    return () => {
      shimmerAnimation.stop();
    };
  }, [shimmerValue, shouldReduceMotion]);

  const containerStyle: ViewStyle = {
    width: resolvedWidth as ViewStyle['width'],
    height: resolvedHeight as ViewStyle['height'],
    borderRadius: resolvedBorderRadius,
    backgroundColor: colors.surfaceVariant,
    overflow: 'hidden',
  };

  // For reduced motion, show static skeleton without shimmer
  if (shouldReduceMotion) {
    return (
      <View
        style={[styles.container, containerStyle, style]}
        testID={testID}
        accessibilityLabel="Loading"
        accessibilityRole="progressbar"
      />
    );
  }

  return (
    <View
      style={[styles.container, containerStyle, style]}
      testID={testID}
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            backgroundColor: colors.overlayLight,
            transform: [{ translateX: shimmerTranslateX }],
          },
        ]}
      />
    </View>
  );
}

/**
 * Skeleton Group Component
 *
 * Renders multiple skeletons with consistent spacing.
 */
export interface SkeletonGroupProps {
  /** Number of skeleton items to render */
  count?: number;
  /** Skeleton variant for all items */
  variant?: SkeletonVariant;
  /** Width for all items */
  width?: number | string;
  /** Height for all items */
  height?: number | string;
  /** Spacing between items (default: 8) */
  spacing?: number;
  /** Additional container styles */
  style?: StyleProp<ViewStyle>;
}

/**
 * Skeleton Group Component
 *
 * @example
 * ```tsx
 * <SkeletonGroup count={3} variant="text" />
 * ```
 */
export function SkeletonGroup({
  count = 3,
  variant = 'text',
  width,
  height,
  spacing = 8,
  style,
}: SkeletonGroupProps): React.ReactElement {
  return (
    <View style={[styles.group, style]}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton
          key={index}
          variant={variant}
          width={width}
          height={height}
          style={index < count - 1 ? { marginBottom: spacing } : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 200,
    opacity: 0.5,
  },
  group: {
    flexDirection: 'column',
  },
});

export default Skeleton;
