/**
 * Card component with elevation, padding variants, and pressable option
 *
 * Features:
 * - Optional fadeIn animation on mount (animateEntry prop)
 * - Scale animation on press for pressable cards (0.99 scale)
 * - Subtle shadow increase on press
 * - Respects reduced motion settings
 */

import * as React from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Animated,
  type ViewStyle,
  type PressableProps,
} from 'react-native';
import { useTheme } from '@/theme';
import { spacing, borderRadius, shadows, type ShadowKey } from '@/theme';
import { useUXSettingsSelector } from '@/stores/uxSettingsStore';
import { useAnimatedValue } from '@/hooks/useAnimatedValue';
import { ANIMATION_DURATION, parallel } from '@/lib/animations';

/**
 * Padding size options for Card
 */
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

/**
 * Elevation/shadow options for Card
 */
export type CardElevation = ShadowKey;

/**
 * Card component props
 */
export interface CardProps extends Omit<PressableProps, 'style'> {
  /** Card contents */
  children: React.ReactNode;
  /** Padding inside the card */
  padding?: CardPadding;
  /** Elevation/shadow level */
  elevation?: CardElevation;
  /** Whether the card is pressable */
  pressable?: boolean;
  /** Additional styles for the card */
  style?: ViewStyle;
  /** Background color override */
  backgroundColor?: string;
  /** Enable fadeIn animation on mount (default: false) */
  animateEntry?: boolean;
  /** Duration for entry animation in ms (default: 'normal' = 250ms) */
  entryDuration?: number;
  /** Delay before entry animation starts in ms (default: 0) */
  entryDelay?: number;
}

/**
 * Padding values for each size
 */
const paddingValues: Record<CardPadding, number> = {
  none: 0,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
};

/**
 * Shadow elevation increase on press
 * Maps from current elevation to pressed elevation
 */
const pressedElevation: Record<ShadowKey, ShadowKey> = {
  none: 'sm',
  sm: 'md',
  md: 'lg',
  lg: 'lg', // Already at max
};

export function Card({
  children,
  padding = 'md',
  elevation = 'sm',
  pressable = false,
  style,
  backgroundColor,
  onPress,
  animateEntry = false,
  entryDuration = ANIMATION_DURATION.normal,
  entryDelay = 0,
  ...pressableProps
}: CardProps): React.ReactElement {
  const { colors } = useTheme();
  const bgColor = backgroundColor ?? colors.surface;

  // Get animation preferences from UX settings
  const animationsEnabled = useUXSettingsSelector(s => s.animationsEnabled);
  const reducedMotion = useUXSettingsSelector(s => s.reducedMotion);
  const shouldAnimate = animationsEnabled && !reducedMotion;

  // Animation values for entry animation
  const { value: opacityValue, animations: opacityAnimations } = useAnimatedValue({
    initialValue: shouldAnimate && animateEntry ? 0 : 1,
  });
  const { value: scaleValue, animations: scaleAnimations } = useAnimatedValue({
    initialValue: shouldAnimate && animateEntry ? 0.95 : 1,
  });

  // Animation values for press animation (for pressable cards)
  const { value: pressScaleValue, animations: pressScaleAnimations } = useAnimatedValue({
    initialValue: 1,
  });

  // Run entry animation on mount
  const hasAnimatedRef = React.useRef(false);
  React.useEffect(() => {
    if (animateEntry && shouldAnimate && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;

      const entryAnimation = parallel([
        opacityAnimations.fadeIn({ duration: entryDuration, delay: entryDelay }),
        scaleAnimations.scale(1, { duration: entryDuration, delay: entryDelay, easing: 'easeOut' }),
      ]);

      entryAnimation.start();
    }
  }, [animateEntry, shouldAnimate, entryDuration, entryDelay, opacityAnimations, scaleAnimations]);

  const cardStyle: ViewStyle = {
    padding: paddingValues[padding],
    backgroundColor: bgColor,
    ...shadows[elevation],
  };

  const baseStyle: ViewStyle = {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  };

  // Animated style for entry animation
  const animatedStyle = animateEntry
    ? {
        opacity: opacityValue,
        transform: [{ scale: scaleValue }],
      }
    : {};

  // Handle press animations for pressable cards
  const handlePressIn = React.useCallback(() => {
    if (shouldAnimate) {
      pressScaleAnimations.scale(0.99, { duration: 'fast', easing: 'easeOut' }).start();
    }
  }, [shouldAnimate, pressScaleAnimations]);

  const handlePressOut = React.useCallback(() => {
    if (shouldAnimate) {
      pressScaleAnimations.spring(1, { friction: 7, tension: 40 }).start();
    }
  }, [shouldAnimate, pressScaleAnimations]);

  if (pressable && onPress) {
    // Get the pressed shadow style
    const pressedShadow = shadows[pressedElevation[elevation]];

    return (
      <Animated.View
        style={[
          baseStyle,
          animateEntry ? animatedStyle : undefined,
          { transform: [{ scale: pressScaleValue }] },
        ]}
      >
        <Pressable
          {...pressableProps}
          onPress={onPress}
          onPressIn={e => {
            handlePressIn();
            pressableProps.onPressIn?.(e);
          }}
          onPressOut={e => {
            handlePressOut();
            pressableProps.onPressOut?.(e);
          }}
          accessibilityRole="button"
          style={({ pressed }) => [
            cardStyle,
            // Only use CSS-based opacity/transform if animations are disabled
            !shouldAnimate && pressed && styles.pressed,
            // Apply pressed shadow when pressed and animations enabled
            shouldAnimate && pressed && pressedShadow,
            style,
          ]}
        >
          {children}
        </Pressable>
      </Animated.View>
    );
  }

  // Non-pressable card
  if (animateEntry) {
    return (
      <Animated.View style={[baseStyle, cardStyle, animatedStyle, style]}>{children}</Animated.View>
    );
  }

  return <View style={[baseStyle, cardStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});

export default Card;
