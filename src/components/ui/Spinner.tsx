/**
 * Spinner component for loading states
 */

import * as React from 'react';
import { View, ActivityIndicator, StyleSheet, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/theme';
import { spacing } from '@/theme';

/**
 * Spinner size options
 */
export type SpinnerSize = 'small' | 'large';

/**
 * Spinner component props
 */
export interface SpinnerProps {
  /** Size of the spinner */
  size?: SpinnerSize;
  /** Color of the spinner */
  color?: string;
  /** Optional loading message */
  message?: string;
  /** Whether to center the spinner in its container */
  center?: boolean;
  /** Whether to fill available space */
  fullScreen?: boolean;
  /** Additional styles for the container */
  style?: ViewStyle;
}

export function Spinner({
  size = 'small',
  color,
  message,
  center = true,
  fullScreen = false,
  style,
}: SpinnerProps): React.ReactElement {
  const { colors } = useTheme();
  const spinnerColor = color ?? colors.primary;

  return (
    <View
      style={[
        styles.container,
        center && styles.centered,
        fullScreen && [styles.fullScreen, { backgroundColor: colors.background }],
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={message ?? 'Loading'}
      accessibilityState={{ busy: true }}
    >
      <ActivityIndicator size={size} color={spinnerColor} />
      {message && (
        <Text variant="bodySmall" color="secondary" style={styles.message}>
          {message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreen: {
    flex: 1,
  },
  message: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

export default Spinner;
