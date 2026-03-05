/**
 * Card component with elevation, padding variants, and pressable option
 */

import * as React from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  type ViewStyle,
  type PressableProps,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, type ShadowKey } from '@/theme';

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

/**
 * Card component for grouping related content
 *
 * @example
 * ```tsx
 * <Card>
 *   <Text>Basic card content</Text>
 * </Card>
 *
 * <Card elevation="md" padding="lg">
 *   <Text>Elevated card with large padding</Text>
 * </Card>
 *
 * <Card pressable onPress={() => console.log('pressed')}>
 *   <Text>Pressable card</Text>
 * </Card>
 * ```
 */
export function Card({
  children,
  padding = 'md',
  elevation = 'sm',
  pressable = false,
  style,
  backgroundColor = colors.surface,
  onPress,
  ...pressableProps
}: CardProps): React.ReactElement {
  const cardStyle: ViewStyle = {
    padding: paddingValues[padding],
    backgroundColor,
    ...shadows[elevation],
  };

  if (pressable && onPress) {
    return (
      <Pressable
        {...pressableProps}
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.base,
          cardStyle,
          pressed && styles.pressed,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[styles.base, cardStyle, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});

export default Card;
