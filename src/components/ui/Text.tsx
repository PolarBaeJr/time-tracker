/**
 * Text component with variants mapping to typography tokens
 */

import * as React from 'react';
import {
  Text as RNText,
  StyleSheet,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';
import { useTheme } from '@/theme';
import { fontSizes, fontWeights, lineHeights } from '@/theme';

/**
 * Text variants for different use cases
 */
export type TextVariant =
  | 'body'
  | 'bodySmall'
  | 'caption'
  | 'heading'
  | 'headingSmall'
  | 'display'
  | 'label';

/**
 * Text color options
 */
export type TextColor =
  | 'default'
  | 'secondary'
  | 'muted'
  | 'primary'
  | 'error'
  | 'success'
  | 'warning';

/**
 * Text component props
 */
export interface TextProps extends RNTextProps {
  /** Visual variant of the text */
  variant?: TextVariant;
  /** Text color */
  color?: TextColor;
  /** Whether text should be bold */
  bold?: boolean;
  /** Whether text should be centered */
  center?: boolean;
  /** Additional styles */
  style?: TextStyle;
}

/**
 * Variant style configurations
 */
const variantStyles: Record<TextVariant, TextStyle> = {
  body: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.normal,
    lineHeight: fontSizes.md * lineHeights.normal,
  },
  bodySmall: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.normal,
    lineHeight: fontSizes.sm * lineHeights.normal,
  },
  caption: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.normal,
    lineHeight: fontSizes.xs * lineHeights.normal,
  },
  heading: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.xxl * lineHeights.tight,
  },
  headingSmall: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.xl * lineHeights.tight,
  },
  display: {
    fontSize: fontSizes.display,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.display * lineHeights.tight,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.sm * lineHeights.tight,
  },
};

export function Text({
  children,
  variant = 'body',
  color = 'default',
  bold = false,
  center = false,
  style,
  ...textProps
}: TextProps): React.ReactElement {
  const { colors } = useTheme();

  const colorMap: Record<TextColor, string> = {
    default: colors.text,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    primary: colors.primary,
    error: colors.error,
    success: colors.success,
    warning: colors.warning,
  };

  return (
    <RNText
      {...textProps}
      style={[
        { color: colors.text },
        variantStyles[variant],
        { color: colorMap[color] },
        bold && styles.bold,
        center && styles.center,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  bold: {
    fontWeight: fontWeights.bold,
  },
  center: {
    textAlign: 'center',
  },
});

export default Text;
