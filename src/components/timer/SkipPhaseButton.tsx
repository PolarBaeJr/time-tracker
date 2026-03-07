import * as React from 'react';
import { Pressable, StyleSheet, Text, ActivityIndicator } from 'react-native';

import { colors, spacing, fontSizes, borderRadius } from '@/theme';

export interface SkipPhaseButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  nextPhaseLabel: string;
}

export function SkipPhaseButton({
  onPress,
  loading = false,
  disabled = false,
  nextPhaseLabel,
}: SkipPhaseButtonProps): React.ReactElement {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={`Skip to ${nextPhaseLabel}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.textSecondary} />
      ) : (
        <Text style={[styles.text, isDisabled && styles.textDisabled]}>
          Skip → {nextPhaseLabel}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: colors.overlayLight,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  textDisabled: {
    color: colors.textMuted,
  },
});

export default SkipPhaseButton;
