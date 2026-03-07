/**
 * Card component with elevation, padding variants, and pressable option
 */

import * as React from 'react';
import { View, Pressable, StyleSheet, type ViewStyle, type PressableProps } from 'react-native';
import { useTheme } from '@/theme';
import { spacing, borderRadius, shadows, type ShadowKey } from '@/theme';

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

export function Card({
  children,
  padding = 'md',
  elevation = 'sm',
  pressable = false,
  style,
  backgroundColor,
  onPress,
  ...pressableProps
}: CardProps): React.ReactElement {
  const { colors } = useTheme();
  const bgColor = backgroundColor ?? colors.surface;

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

  if (pressable && onPress) {
    return (
      <Pressable
        {...pressableProps}
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [baseStyle, cardStyle, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
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
