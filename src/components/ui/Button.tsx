/**
 * Button component with variants, sizes, loading state, and accessibility support
 */

import * as React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  type TextStyle,
  type PressableProps,
  type AccessibilityProps,
} from 'react-native';
import { useTheme } from '@/theme';
import { spacing, fontSizes, fontWeights, borderRadius, type Colors } from '@/theme';

/**
 * Button variants for different use cases
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

/**
 * Button sizes
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Button component props
 */
export interface ButtonProps extends Omit<PressableProps, 'style'>, AccessibilityProps {
  /** The button text content */
  children: React.ReactNode;
  /** Visual variant of the button */
  variant?: ButtonVariant;
  /** Size of the button */
  size?: ButtonSize;
  /** Whether the button is in a loading state */
  loading?: boolean;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Additional styles to apply to the button container */
  style?: ViewStyle;
  /** Additional styles to apply to the button text */
  textStyle?: TextStyle;
}

function getBackgroundColor(
  variant: ButtonVariant,
  pressed: boolean,
  disabled: boolean,
  colors: Colors
): string {
  if (disabled) {
    return colors.surfaceVariant;
  }

  switch (variant) {
    case 'primary':
      return pressed ? colors.primaryVariant : colors.primary;
    case 'secondary':
      return pressed ? colors.surfaceVariant : colors.surface;
    case 'outline':
    case 'ghost':
      return pressed ? colors.overlayLight : 'transparent';
    case 'danger':
      return pressed ? '#DC2626' : colors.error;
    default:
      return colors.primary;
  }
}

function getTextColor(variant: ButtonVariant, disabled: boolean, colors: Colors): string {
  if (disabled) {
    return colors.textMuted;
  }

  switch (variant) {
    case 'primary':
    case 'danger':
      return colors.text;
    case 'secondary':
      return colors.text;
    case 'outline':
      return colors.primary;
    case 'ghost':
      return colors.textSecondary;
    default:
      return colors.text;
  }
}

function getBorderStyle(variant: ButtonVariant, disabled: boolean, colors: Colors): ViewStyle {
  if (variant === 'outline') {
    return {
      borderWidth: 1,
      borderColor: disabled ? colors.textMuted : colors.primary,
    };
  }
  return {};
}

/**
 * Size configurations for button dimensions and text
 */
const sizeConfig: Record<
  ButtonSize,
  { height: number; paddingHorizontal: number; fontSize: number }
> = {
  sm: {
    height: 32,
    paddingHorizontal: spacing.sm,
    fontSize: fontSizes.sm,
  },
  md: {
    height: 44,
    paddingHorizontal: spacing.md,
    fontSize: fontSizes.md,
  },
  lg: {
    height: 56,
    paddingHorizontal: spacing.lg,
    fontSize: fontSizes.lg,
  },
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
  ...pressableProps
}: ButtonProps): React.ReactElement {
  const { colors } = useTheme();
  const sizeStyles = sizeConfig[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      {...pressableProps}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{
        disabled: isDisabled,
        busy: loading,
      }}
      accessibilityLabel={
        accessibilityLabel ?? (typeof children === 'string' ? children : undefined)
      }
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        {
          height: sizeStyles.height,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          backgroundColor: getBackgroundColor(variant, pressed, isDisabled, colors),
          ...getBorderStyle(variant, isDisabled, colors),
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={getTextColor(variant, false, colors)}
          accessibilityLabel="Loading"
        />
      ) : typeof children === 'string' || typeof children === 'number' ? (
        <Text
          style={[
            styles.text,
            {
              fontSize: sizeStyles.fontSize,
              color: getTextColor(variant, isDisabled, colors),
            },
            textStyle,
          ]}
        >
          {children}
        </Text>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    minWidth: 64,
  },
  text: {
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
});

export default Button;
