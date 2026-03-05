/**
 * Spinner component for loading states
 */

import * as React from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { Text } from './Text';
import { colors, spacing } from '@/theme';

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

/**
 * Spinner component for indicating loading states
 *
 * @example
 * ```tsx
 * <Spinner />
 *
 * <Spinner size="large" message="Loading data..." />
 *
 * <Spinner fullScreen />
 * ```
 */
export function Spinner({
  size = 'small',
  color = colors.primary,
  message,
  center = true,
  fullScreen = false,
  style,
}: SpinnerProps): React.ReactElement {
  return (
    <View
      style={[
        styles.container,
        center && styles.centered,
        fullScreen && styles.fullScreen,
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={message ?? 'Loading'}
      accessibilityState={{ busy: true }}
    >
      <ActivityIndicator size={size} color={color} />
      {message && (
        <Text
          variant="bodySmall"
          color="secondary"
          style={styles.message}
        >
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
    backgroundColor: colors.background,
  },
  message: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

export default Spinner;
